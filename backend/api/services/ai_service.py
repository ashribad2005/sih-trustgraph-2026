"""
backend/api/services/ai_service.py
====================================
TrustGraph 2026 — Unified AI Analysis Orchestrator

Orchestrates the two-layer fraud detection pipeline:
  Layer 1: Deterministic Rule Engine (velocity, mule, new-account)
  Layer 2: ML Anomaly Detection (Isolation Forest) + Graph Intelligence (NetworkX)

Computes a composite risk score and returns the unified analysis result
consumed by the Django views.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from django.conf import settings

from .rule_engine_service import RuleEngineService
from .ml_engine import MLEngine

logger = logging.getLogger("trustgraph.ai_service")


def _determine_risk_tier(score: int) -> str:
    """Map a composite risk score [0–100] to a risk tier label."""
    if score >= 90:
        return "CRITICAL"
    elif score >= 75:
        return "HIGH"
    elif score >= 50:
        return "MEDIUM"
    return "LOW"


def _determine_action(tier: str) -> str:
    """Map a risk tier to a recommended action code."""
    return {
        "CRITICAL": "SIMULATED_HOLD_AND_INVESTIGATE",
        "HIGH": "FLAG_FOR_REVIEW",
        "MEDIUM": "MONITOR",
        "LOW": "ALLOW",
    }.get(tier, "ALLOW")


class TrustGraphAIService:
    """
    Central orchestrator for the fraud detection pipeline.

    When AI_ENGINE_ENABLED=True (default), runs the real Rule Engine +
    ML Engine pipeline. When False, uses the deterministic mock scorer
    for demos and development.
    """

    def __init__(self) -> None:
        self.is_enabled = getattr(settings, "AI_ENGINE_ENABLED", True)

        if self.is_enabled:
            self._rule_engine = RuleEngineService()
            self._ml_engine = MLEngine()
            logger.info("[AIService] Real engine initialized (Rule + ML + Graph)")
        else:
            self._rule_engine = None
            self._ml_engine = None
            logger.info("[AIService] Running in MOCK mode")

    def analyze_transaction(self, transaction_payload: dict[str, Any]) -> dict[str, Any]:
        """
        Analyze a single transaction through the full fraud detection pipeline.

        Args:
            transaction_payload: Dict with keys:
                tx_id, sender_account, receiver_account, amount, device_id
                Optional: timestamp, account_age_days

        Returns:
            Unified analysis result dict with:
                tx_id, composite_risk_score, risk_tier, rule_violations,
                ml_anomaly_score, graph_metrics, ai_explanations,
                graph_data, recommended_action
        """
        if self.is_enabled:
            return self._real_analysis(transaction_payload)
        return self._mock_analysis(transaction_payload)

    def _real_analysis(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Full two-layer analysis:
        1. Rule Engine → deterministic rule violations + rule score
        2. ML Engine → Isolation Forest anomaly score + graph metrics + graph data
        3. Composite score = (0.4 × rule_score) + (0.6 × ml_score × 100)
        """
        tx_id = payload.get("tx_id", "UNKNOWN")

        # ── Layer 1: Rule Engine ─────────────────────────────────────────────
        rule_result = self._rule_engine.evaluate(payload)
        logger.debug(
            "[AIService] Rule result for %s: violations=%s score=%d",
            tx_id, rule_result.violations, rule_result.rule_risk_score,
        )

        # ── Layer 2: ML Engine ───────────────────────────────────────────────
        ml_result = self._ml_engine.analyze(payload)
        logger.debug(
            "[AIService] ML result for %s: anomaly=%.4f",
            tx_id, ml_result.anomaly_score,
        )

        # ── Composite Score ──────────────────────────────────────────────────
        composite = int(
            0.4 * rule_result.rule_risk_score
            + 0.6 * ml_result.anomaly_score * 100
        )
        # Preserve strong deterministic signals while the ML model is still
        # warming up. This prevents high-confidence rule violations from being
        # hidden by a cold-start anomaly score.
        if rule_result.has_violations:
            composite = max(
                composite,
                min(
                    100,
                    (rule_result.rule_risk_score * 2)
                    + int(ml_result.anomaly_score * 25),
                ),
            )
        composite = max(0, min(100, composite))

        risk_tier = _determine_risk_tier(composite)
        action = _determine_action(risk_tier)

        # ── Build Explanations ───────────────────────────────────────────────
        explanations = []
        for detail in rule_result.details:
            explanations.append(f"[{detail['rule_id']}] {detail['reason']}")

        if ml_result.anomaly_score > 0.7:
            explanations.append(
                f"ML anomaly score is highly elevated ({ml_result.anomaly_score:.2f}), "
                f"indicating statistical deviation from normal transaction patterns."
            )

        metrics = ml_result.graph_metrics
        if metrics.get("shared_device_count", 0) > 1:
            explanations.append(
                f"Sender shares {metrics['shared_device_count']} device(s) "
                f"with previously observed accounts — potential device laundering."
            )
        if metrics.get("in_degree_centrality", 0) > 0.3:
            explanations.append(
                f"High in-degree centrality ({metrics['in_degree_centrality']:.2f}) "
                f"suggests this node is a convergence point in the transaction network."
            )

        logger.info(
            "[AIService] %s → composite=%d tier=%s action=%s violations=%s",
            tx_id, composite, risk_tier, action, rule_result.violations,
        )

        return {
            "tx_id": tx_id,
            "composite_risk_score": composite,
            "risk_tier": risk_tier,
            "rule_violations": rule_result.violations,
            "ml_anomaly_score": ml_result.anomaly_score,
            "graph_metrics": ml_result.graph_metrics,
            "ai_explanations": explanations,
            "graph_data": ml_result.graph_data,
            "recommended_action": action,
        }

    def _mock_analysis(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Mock mode for testing the backend pipeline without ML dependencies.
        Returns a high risk score if amount > 5000, else low risk.
        """
        amount = float(payload.get("amount", 0))
        tx_id = payload.get("tx_id", "TXN_TEST")

        if amount > 5000:
            return {
                "tx_id": tx_id,
                "composite_risk_score": 93,
                "risk_tier": "CRITICAL",
                "rule_violations": ["RULE_01_VELOCITY_BURST", "RULE_02_MULE_FUNNEL"],
                "ml_anomaly_score": 0.89,
                "graph_metrics": {
                    "in_degree_centrality": 0.82,
                    "out_degree_centrality": 0.15,
                    "betweenness_centrality": 0.45,
                    "community_cluster_id": "CLUSTER_MULE_04",
                    "shared_device_count": 5,
                },
                "ai_explanations": [
                    "[RULE_01_VELOCITY_BURST] High transaction velocity detected — mock mode.",
                    "[RULE_02_MULE_FUNNEL] Mule funnel pattern detected — mock mode.",
                    "ML anomaly score is highly elevated (0.89).",
                    "Sender shares 5 device(s) with previously observed accounts.",
                ],
                "graph_data": {
                    "nodes": [
                        {"id": payload.get("sender_account", "A"), "label": "Sender", "type": "account", "status": "critical"},
                        {"id": payload.get("receiver_account", "B"), "label": "Receiver", "type": "account", "status": "suspicious"},
                    ],
                    "edges": [
                        {"source": payload.get("sender_account", "A"), "target": payload.get("receiver_account", "B"), "label": f"₹{amount:,.0f}", "type": "TRANSFER"},
                    ],
                },
                "recommended_action": "SIMULATED_HOLD_AND_INVESTIGATE",
            }

        return {
            "tx_id": tx_id,
            "composite_risk_score": 20,
            "risk_tier": "LOW",
            "rule_violations": [],
            "ml_anomaly_score": 0.10,
            "graph_metrics": {
                "in_degree_centrality": 0.0,
                "out_degree_centrality": 0.0,
                "betweenness_centrality": 0.0,
                "community_cluster_id": None,
                "shared_device_count": 0,
            },
            "ai_explanations": [],
            "graph_data": {"nodes": [], "edges": []},
            "recommended_action": "ALLOW",
        }
