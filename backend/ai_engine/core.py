from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, Optional
import json
import pandas as pd

from .features import extract_transaction_features, prepare_dataframe
from .ml_engine import AnomalyEngine
from .graph_engine import analyze_transaction as analyze_graph, load_known_mules
from .xai_explainer import explain

PACKAGE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = PACKAGE_DIR.parent.parent / "data"
DEFAULT_MODEL_PATH = PACKAGE_DIR / "model.pkl"
DEFAULT_RULE_ALERTS_PATH = DEFAULT_DATA_DIR / "rule_alerts.json"


def load_rule_alerts(path: Optional[str | Path] = None) -> list[dict]:
    path = Path(path or DEFAULT_RULE_ALERTS_PATH)
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class TrustGraphAI:
    def __init__(
        self,
        model_path: Optional[str | Path] = None,
        rule_alerts: Optional[Iterable[Dict[str, Any]]] = None,
    ):
        self.model_path = Path(model_path or DEFAULT_MODEL_PATH)
        self.rule_alerts = list(rule_alerts) if rule_alerts is not None else load_rule_alerts()
        self.anomaly_engine = AnomalyEngine.load(self.model_path) if self.model_path.exists() else None
        self.known_mules = load_known_mules(self.rule_alerts)

    def analyze_transaction(
        self,
        transaction: Dict[str, Any],
        history: Optional[pd.DataFrame] = None,
    ) -> Dict[str, Any]:
        if not isinstance(transaction, dict):
            raise TypeError("transaction must be a dictionary")

        if history is None:
            raise ValueError(
                "history is required for AI/graph analysis. Pass the transaction context "
                "as a pandas DataFrame or records so velocity and graph signals are available."
            )
        context = prepare_dataframe(history)
        features = extract_transaction_features(transaction, context)

        if self.anomaly_engine is not None:
            anomaly = self.anomaly_engine.score(transaction, context)
        else:
            anomaly = {
                "anomaly_score": 0.0,
                "model_prediction": "unavailable",
                "decision_function": None,
                "features": features,
            }

        graph_result = analyze_graph(transaction, context, self.known_mules)
        explanation = explain(transaction, features, self.rule_alerts, graph_result, anomaly)

        related_accounts = {
            transaction.get("sender_account"),
            transaction.get("receiver_account"),
        }
        rule_matches = [
            a for a in self.rule_alerts
            if a.get("account") in related_accounts
        ]

        # Deterministic risk fusion: rules are strongest, then graph, then ML.
        risk = float(anomaly.get("anomaly_score", 0.0)) * 0.45
        if rule_matches:
            risk += 45.0
        if graph_result.get("mule_connection"):
            risk += 35.0
        if features.get("sender_tx_count_5m", 0) > 8:
            risk += 35.0
        if features.get("is_high_value") and features.get("is_new_account"):
            risk += 30.0
        if features.get("is_unknown_device"):
            risk += 15.0
        if (
            features.get("is_unknown_device")
            and features.get("time_since_last_transaction_hours", 0) >= 24
            and features.get("amount", 0) >= 50000
        ):
            risk += 25.0
        risk = min(100.0, risk)

        if risk >= 75:
            level = "HIGH"
        elif risk >= 45:
            level = "MEDIUM"
        else:
            level = "LOW"

        return {
            "tx_id": transaction.get("tx_id"),
            "risk_score": round(risk, 2),
            "risk_level": level,
            "rule_violations": rule_matches,
            "anomaly": {
                "score": anomaly.get("anomaly_score"),
                "prediction": anomaly.get("model_prediction"),
            },
            "graph": graph_result,
            "features": features,
            "explanation": explanation,
        }

