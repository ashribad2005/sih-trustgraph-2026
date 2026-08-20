"""
backend/api/services/ml_engine.py
==================================
TrustGraph 2026 — ML Anomaly Detection & Graph Intelligence Engine (Layer 2)

Provides:
  - IsolationForestScorer : Trains incrementally on ingested transaction features,
                            returns anomaly_score ∈ [0.0, 1.0].
  - FraudGraphBuilder     : Maintains a NetworkX DiGraph of account transfers,
                            computes centrality metrics and community clusters,
                            returns Cytoscape-compatible graph payloads.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import networkx as nx
import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger("trustgraph.ml_engine")

# ─── Feature Engineering Constants ────────────────────────────────────────────

# Minimum number of samples before Isolation Forest can produce meaningful scores.
MIN_TRAINING_SAMPLES = 50

# When we have fewer than MIN_TRAINING_SAMPLES, we use a heuristic scorer.
HEURISTIC_HIGH_AMOUNT_THRESHOLD = 50_000


@dataclass
class MLResult:
    """Result from the ML engine for a single transaction."""
    anomaly_score: float          # 0.0 (normal) – 1.0 (highly anomalous)
    graph_metrics: dict[str, Any]
    graph_data: dict[str, list]   # {"nodes": [...], "edges": [...]}


class IsolationForestScorer:
    """
    Wraps scikit-learn's Isolation Forest for online-style anomaly scoring.

    Accumulates transaction feature vectors and periodically re-trains.
    Between retrains, uses the latest fitted model to score new samples.
    """

    def __init__(self, retrain_every: int = 100) -> None:
        self._model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
            n_jobs=-1,
        )
        self._features: list[list[float]] = []
        self._retrain_every = retrain_every
        self._is_fitted = False
        self._samples_since_train = 0

    def add_and_score(self, features: list[float]) -> float:
        """
        Add a feature vector and return an anomaly score ∈ [0.0, 1.0].

        Features expected (order matters):
            [amount, velocity_count, account_age_days]
        """
        self._features.append(features)
        self._samples_since_train += 1

        # Retrain periodically
        if len(self._features) >= MIN_TRAINING_SAMPLES and (
            not self._is_fitted or self._samples_since_train >= self._retrain_every
        ):
            self._train()

        if not self._is_fitted:
            return self._heuristic_score(features)

        # Isolation Forest decision_function: negative = anomaly, positive = normal
        # We invert and normalize to [0, 1]
        X = np.array([features])
        raw_score = self._model.decision_function(X)[0]
        # decision_function returns values roughly in [-0.5, 0.5]
        # Map to [0, 1] where higher = more anomalous
        anomaly_score = max(0.0, min(1.0, 0.5 - raw_score))
        return round(anomaly_score, 4)

    def _train(self) -> None:
        """Fit the Isolation Forest on all accumulated features."""
        X = np.array(self._features)
        try:
            self._model.fit(X)
            self._is_fitted = True
            self._samples_since_train = 0
            logger.info(
                "[ML] Isolation Forest trained on %d samples", len(self._features)
            )
        except Exception as e:
            logger.warning("[ML] Training failed: %s", e)

    @staticmethod
    def _heuristic_score(features: list[float]) -> float:
        """Fallback scorer when not enough training data exists."""
        amount = features[0]
        velocity = features[1] if len(features) > 1 else 0
        account_age = features[2] if len(features) > 2 else 365

        score = 0.0
        if amount > HEURISTIC_HIGH_AMOUNT_THRESHOLD:
            score += 0.3
        if amount > 100_000:
            score += 0.2
        if velocity > 5:
            score += 0.2
        if velocity > 8:
            score += 0.1
        if account_age < 7:
            score += 0.2

        return min(round(score, 4), 1.0)


class FraudGraphBuilder:
    """
    Maintains a NetworkX directed graph of account-to-account transfers.

    Provides:
      - Real-time graph updates per transaction
      - Centrality metrics (in-degree, betweenness)
      - Community detection (greedy modularity on undirected projection)
      - Shared-device subgraph detection
      - Cytoscape-compatible JSON export
    """

    def __init__(self) -> None:
        self._graph = nx.DiGraph()
        self._device_map: dict[str, set[str]] = {}  # device_id -> set of account_ids

    def add_transaction(self, transaction: dict[str, Any]) -> None:
        """Add a transaction edge to the graph."""
        sender = transaction["sender_account"]
        receiver = transaction["receiver_account"]
        amount = float(transaction["amount"])
        device_id = transaction.get("device_id", "")

        # Add/update nodes
        for account_id in [sender, receiver]:
            if not self._graph.has_node(account_id):
                self._graph.add_node(
                    account_id,
                    type="account",
                    status="normal",
                    tx_count=0,
                    total_amount=0.0,
                )

        # Update sender node stats
        self._graph.nodes[sender]["tx_count"] += 1
        self._graph.nodes[sender]["total_amount"] += amount

        # Add/update edge
        if self._graph.has_edge(sender, receiver):
            edge = self._graph.edges[sender, receiver]
            edge["weight"] = edge.get("weight", 0) + 1
            edge["total_amount"] = edge.get("total_amount", 0.0) + amount
        else:
            self._graph.add_edge(
                sender,
                receiver,
                type="TRANSFER",
                weight=1,
                total_amount=amount,
            )

        # Track shared devices
        if device_id:
            if device_id not in self._device_map:
                self._device_map[device_id] = set()
            self._device_map[device_id].add(sender)

            # If a device is shared by multiple accounts, add SHARED_DEVICE edges
            shared_accounts = self._device_map[device_id]
            if len(shared_accounts) > 1:
                for account in shared_accounts:
                    if account != sender and not self._graph.has_edge(sender, account):
                        self._graph.add_edge(
                            sender, account,
                            type="SHARED_DEVICE",
                            weight=1,
                            device_id=device_id,
                        )

    def get_metrics(self, account_id: str) -> dict[str, Any]:
        """Compute graph metrics for a specific account."""
        if not self._graph.has_node(account_id):
            return {
                "in_degree_centrality": 0.0,
                "out_degree_centrality": 0.0,
                "betweenness_centrality": 0.0,
                "community_cluster_id": None,
                "shared_device_count": 0,
            }

        n = self._graph.number_of_nodes()
        if n <= 1:
            in_deg = 0.0
            out_deg = 0.0
            betweenness = 0.0
        else:
            in_deg = self._graph.in_degree(account_id) / (n - 1)
            out_deg = self._graph.out_degree(account_id) / (n - 1)
            # Betweenness is expensive for large graphs; compute on subgraph
            try:
                subgraph = self._get_neighborhood_subgraph(account_id, radius=2)
                bc = nx.betweenness_centrality(subgraph)
                betweenness = bc.get(account_id, 0.0)
            except Exception:
                betweenness = 0.0

        # Community detection
        cluster_id = self._detect_community(account_id)

        # Shared device count
        shared_count = sum(
            1 for devices in self._device_map.values()
            if account_id in devices and len(devices) > 1
        )

        return {
            "in_degree_centrality": round(in_deg, 4),
            "out_degree_centrality": round(out_deg, 4),
            "betweenness_centrality": round(betweenness, 4),
            "community_cluster_id": cluster_id,
            "shared_device_count": shared_count,
        }

    def get_subgraph_data(
        self, account_id: str, radius: int = 2
    ) -> dict[str, list]:
        """
        Extract a neighborhood subgraph centered on `account_id` and return
        it in Cytoscape-compatible format: {"nodes": [...], "edges": [...]}.
        """
        subgraph = self._get_neighborhood_subgraph(account_id, radius)

        # Mark the center node and suspicious nodes
        nodes = []
        for node_id in subgraph.nodes():
            node_data = dict(subgraph.nodes[node_id])
            status = "normal"
            if node_id == account_id:
                status = "critical"
            elif subgraph.in_degree(node_id) > 3 or subgraph.out_degree(node_id) > 5:
                status = "suspicious"

            # Determine node type from attributes
            node_type = node_data.get("type", "account")

            # Truncate label for display
            label = node_id
            if len(label) > 16:
                label = label[:6] + "…" + label[-6:]

            nodes.append({
                "id": node_id,
                "label": label,
                "type": node_type,
                "status": status,
                "metadata": {
                    "tx_count": node_data.get("tx_count", 0),
                    "total_amount": node_data.get("total_amount", 0.0),
                },
            })

        edges = []
        for source, target, edge_data in subgraph.edges(data=True):
            edge_type = edge_data.get("type", "TRANSFER")
            weight = edge_data.get("weight", 1)

            label = edge_type
            if edge_type == "TRANSFER":
                total = edge_data.get("total_amount", 0)
                label = f"₹{total:,.0f}" if total else "Transfer"

            edges.append({
                "source": source,
                "target": target,
                "label": label,
                "type": edge_type,
                "metadata": {"weight": weight},
            })

        return {"nodes": nodes, "edges": edges}

    # ─── Private Helpers ──────────────────────────────────────────────────────

    def _get_neighborhood_subgraph(
        self, account_id: str, radius: int = 2
    ) -> nx.DiGraph:
        """Extract a subgraph of nodes within `radius` hops of `account_id`."""
        if not self._graph.has_node(account_id):
            return nx.DiGraph()

        # Use undirected ego graph for neighborhood discovery, then extract directed subgraph
        undirected = self._graph.to_undirected()
        try:
            ego = nx.ego_graph(undirected, account_id, radius=radius)
            return self._graph.subgraph(ego.nodes()).copy()
        except Exception:
            return nx.DiGraph()

    def _detect_community(self, account_id: str) -> str | None:
        """Detect the community/cluster that `account_id` belongs to."""
        if not self._graph.has_node(account_id):
            return None

        try:
            undirected = self._graph.to_undirected()
            communities = nx.community.greedy_modularity_communities(undirected)
            for idx, community in enumerate(communities):
                if account_id in community:
                    return f"CLUSTER_{idx:03d}"
        except Exception:
            pass
        return None


class MLEngine:
    """
    Unified ML engine that combines Isolation Forest scoring with
    graph intelligence. This is the entry point called by ai_service.py.
    """

    def __init__(self) -> None:
        self.scorer = IsolationForestScorer()
        self.graph_builder = FraudGraphBuilder()
        self._velocity_cache: dict[str, int] = {}

    def analyze(self, transaction: dict[str, Any]) -> MLResult:
        """
        Run the full ML pipeline on a transaction:
        1. Update the graph
        2. Compute anomaly score via Isolation Forest
        3. Compute graph metrics
        4. Return the combined result
        """
        sender = transaction["sender_account"]
        amount = float(transaction["amount"])
        account_age = int(transaction.get("account_age_days", 365))

        # Track velocity (simple in-memory counter)
        self._velocity_cache[sender] = self._velocity_cache.get(sender, 0) + 1
        velocity = self._velocity_cache[sender]

        # 1. Update graph
        self.graph_builder.add_transaction(transaction)

        # 2. Isolation Forest scoring
        features = [amount, velocity, account_age]
        anomaly_score = self.scorer.add_and_score(features)

        # 3. Graph metrics for the sender
        graph_metrics = self.graph_builder.get_metrics(sender)

        # 4. Graph data (neighborhood subgraph) for visualization
        graph_data = self.graph_builder.get_subgraph_data(sender, radius=2)

        # Boost anomaly score based on graph signals
        if graph_metrics["in_degree_centrality"] > 0.5:
            anomaly_score = min(1.0, anomaly_score + 0.15)
        if graph_metrics["shared_device_count"] > 2:
            anomaly_score = min(1.0, anomaly_score + 0.10)

        return MLResult(
            anomaly_score=round(anomaly_score, 4),
            graph_metrics=graph_metrics,
            graph_data=graph_data,
        )
