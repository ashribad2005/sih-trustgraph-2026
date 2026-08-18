from __future__ import annotations

from typing import Any, Dict, Iterable, Optional, Set
import pandas as pd
import networkx as nx


def build_graph(transactions: Any) -> nx.DiGraph:
    df = transactions if isinstance(transactions, pd.DataFrame) else pd.DataFrame(transactions)
    graph = nx.DiGraph()
    if df.empty:
        return graph
    for row in df.itertuples(index=False):
        sender = getattr(row, "sender_account")
        receiver = getattr(row, "receiver_account")
        amount = float(getattr(row, "amount", 0.0) or 0.0)
        if graph.has_edge(sender, receiver):
            graph[sender][receiver]["transaction_count"] += 1
            graph[sender][receiver]["total_amount"] += amount
        else:
            graph.add_edge(sender, receiver, transaction_count=1, total_amount=amount)
    return graph


def load_known_mules(rule_alerts: Iterable[Dict[str, Any]]) -> Set[str]:
    return {str(a["account"]) for a in rule_alerts if a.get("rule_id") == "RULE_02" and a.get("account")}


def analyze_transaction(
    transaction: Dict[str, Any],
    transactions: Any,
    known_mule_accounts: Optional[Set[str]] = None,
) -> Dict[str, Any]:
    graph = build_graph(transactions)
    known_mules = known_mule_accounts or set()
    sender = str(transaction.get("sender_account", ""))
    receiver = str(transaction.get("receiver_account", ""))

    connected = []
    for account in (sender, receiver):
        if account in known_mules:
            connected.append(account)

    # Check direct graph neighbors for a known mule. This keeps the online
    # operation cheap and produces an explainable connection for the UI.
    for account in (sender, receiver):
        if account in graph:
            neighbors = set(graph.successors(account)) | set(graph.predecessors(account))
            connected.extend(sorted(neighbors & known_mules))
    connected = sorted(set(connected))

    if graph.number_of_nodes() == 0:
        centrality = 0.0
    else:
        centrality_map = nx.in_degree_centrality(graph)
        centrality = float(centrality_map.get(receiver, 0.0))

    receiver_in_degree = int(graph.in_degree(receiver)) if receiver in graph else 0
    sender_out_degree = int(graph.out_degree(sender)) if sender in graph else 0

    return {
        "mule_connection": bool(connected),
        "connected_mule_accounts": connected,
        "receiver_in_degree": receiver_in_degree,
        "sender_out_degree": sender_out_degree,
        "receiver_in_degree_centrality": round(centrality, 6),
    }

