from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .features import MODEL_FEATURES, build_training_features, extract_transaction_features, prepare_dataframe

DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"


class AnomalyEngine:
    def __init__(self, model: Optional[IsolationForest] = None):
        self.model = model
        self.feature_names = MODEL_FEATURES

    def fit(self, transactions: Any, model_path: Optional[str | Path] = None) -> "AnomalyEngine":
        df = prepare_dataframe(transactions)
        if "is_fraud" in df.columns:
            train_df = df[df["is_fraud"] == 0].copy()
        else:
            train_df = df
        if train_df.empty:
            raise ValueError("No training transactions available")

        X = build_training_features(train_df)
        self.model = IsolationForest(
            n_estimators=300,
            max_samples="auto",
            contamination="auto",
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X[self.feature_names])
        if model_path:
            self.save(model_path)
        return self

    def save(self, model_path: str | Path = DEFAULT_MODEL_PATH) -> None:
        if self.model is None:
            raise RuntimeError("Model is not fitted")
        payload = {"model": self.model, "feature_names": self.feature_names}
        with open(model_path, "wb") as f:
            pickle.dump(payload, f)

    @classmethod
    def load(cls, model_path: str | Path = DEFAULT_MODEL_PATH) -> "AnomalyEngine":
        with open(model_path, "rb") as f:
            payload = pickle.load(f)
        engine = cls(payload["model"])
        engine.feature_names = payload.get("feature_names", MODEL_FEATURES)
        return engine

    def score(self, transaction: Dict[str, Any], history: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError("Model is not fitted. Run train_model.py first.")
        features = extract_transaction_features(transaction, history)
        X = pd.DataFrame([[features[name] for name in self.feature_names]], columns=self.feature_names)
        raw = float(self.model.decision_function(X)[0])
        prediction = int(self.model.predict(X)[0])
        # Convert the model output to a stable 0-100 anomaly score.
        anomaly_score = float(np.clip((0.10 - raw) / 0.20 * 100.0, 0.0, 100.0))
        return {
            "anomaly_score": round(anomaly_score, 2),
            "model_prediction": "anomaly" if prediction == -1 else "normal",
            "decision_function": round(raw, 6),
            "features": features,
        }

