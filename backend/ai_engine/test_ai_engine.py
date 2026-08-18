from pathlib import Path
import json
import pandas as pd

from .core import TrustGraphAI

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
MODEL = Path(__file__).resolve().parent / "model.pkl"


def main() -> None:
    with open(DATA / "transactions_seed.json", "r", encoding="utf-8") as f:
        seed = json.load(f)
    df = pd.DataFrame(seed)

    ai = TrustGraphAI(MODEL)

    # Test one known fraud transaction from the supplied dataset.
    fraud_tx = next(x for x in seed if x.get("is_fraud") == 1)
    result = ai.analyze_transaction(fraud_tx, df)
    print(json.dumps(result, indent=2, default=str))

    assert result["tx_id"] == fraud_tx["tx_id"]
    assert result["risk_score"] >= 0
    assert result["risk_level"] in {"LOW", "MEDIUM", "HIGH"}
    assert "graph" in result and "explanation" in result
    print("\nAI ENGINE SMOKE TEST: PASS")


if __name__ == "__main__":
    main()
