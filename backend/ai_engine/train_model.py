from pathlib import Path
import json
import argparse

from .ml_engine import AnomalyEngine


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/transactions_seed.json")
    parser.add_argument("--model", default="backend/ai_engine/model.pkl")
    args = parser.parse_args()

    with open(args.data, "r", encoding="utf-8") as f:
        transactions = json.load(f)

    engine = AnomalyEngine().fit(transactions, args.model)
    print(f"Model trained and saved to {args.model}")
    print(f"Training transactions: {len(transactions)}")
    print(f"Features: {', '.join(engine.feature_names)}")


if __name__ == "__main__":
    main()
