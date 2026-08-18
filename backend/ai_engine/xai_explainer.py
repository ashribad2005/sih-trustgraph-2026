from __future__ import annotations

from typing import Any, Dict, Iterable, List


def explain(
    transaction: Dict[str, Any],
    features: Dict[str, float],
    rule_alerts: Iterable[Dict[str, Any]],
    graph_result: Dict[str, Any],
    anomaly_result: Dict[str, Any],
) -> Dict[str, Any]:
    reasons: List[str] = []
    matched_rules = []
    accounts = {
        str(transaction.get("sender_account", "")),
        str(transaction.get("receiver_account", "")),
    }
    tx_id = str(transaction.get("tx_id", ""))

    for alert in rule_alerts:
        if alert.get("account") in accounts:
            matched_rules.append(alert)
            reasons.append(f"{alert.get('rule_id')}: {alert.get('reason')}")

    if features.get("sender_tx_count_5m", 0) > 8:
        reasons.append(f"High transaction velocity: {int(features['sender_tx_count_5m'])} transactions in the last 5 minutes")
    if features.get("is_high_value") and features.get("is_new_account"):
        reasons.append("High-value transaction from an account less than 7 days old")
    if features.get("outflow_ratio_10m", 0) > 0.90 and features.get("receiver_tx_count_10m", 0) >= 3:
        reasons.append("Large outflow follows multiple recent incoming transactions")
    if features.get("is_unknown_device"):
        reasons.append("Transaction uses an unknown device identifier")
    if features.get("time_since_last_transaction_hours", 0) >= 24:
        reasons.append("Transaction occurs after a long inactivity gap")
    if graph_result.get("mule_connection"):
        mule = ", ".join(graph_result.get("connected_mule_accounts", []))
        reasons.append(f"Transaction is connected to known mule account(s): {mule}")
    if anomaly_result.get("model_prediction") == "anomaly":
        reasons.append(f"Isolation Forest marked the transaction as anomalous (score {anomaly_result.get('anomaly_score')})")

    if not reasons:
        reasons.append("No strong rule, graph, or anomaly signal was found")

    return {
        "tx_id": tx_id,
        "reason_codes": reasons,
        "matched_rule_ids": sorted({a.get("rule_id") for a in matched_rules}),
        "explanation": "; ".join(reasons),
    }

