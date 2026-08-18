from __future__ import annotations

from typing import Any, Dict, Iterable, Optional
import math
import numpy as np
import pandas as pd

REQUIRED_COLUMNS = [
    "tx_id", "timestamp", "sender_account", "receiver_account", "amount",
    "channel", "transaction_type", "merchant_category", "device_id",
    "ip_address", "location", "account_age_days", "account_created_at",
    "last_transaction_at", "is_fraud", "fraud_scenario",
]

MODEL_FEATURES = [
    "amount",
    "log_amount",
    "account_age_days",
    "hour",
    "day_of_week",
    "time_since_last_transaction_hours",
    "sender_tx_count_5m",
    "sender_tx_count_10m",
    "sender_tx_count_1h",
    "sender_unique_receivers_1h",
    "receiver_tx_count_10m",
    "receiver_unique_senders_10m",
    "account_inflow_10m",
    "outflow_ratio_10m",
    "is_new_account",
    "is_high_value",
    "is_unknown_device",
    "is_new_device",
    "is_mule_device",
]


def _as_dataframe(data: Any) -> pd.DataFrame:
    if isinstance(data, pd.DataFrame):
        return data.copy()
    if isinstance(data, dict):
        return pd.DataFrame([data])
    return pd.DataFrame(list(data))


def prepare_dataframe(data: Any) -> pd.DataFrame:
    """Normalize transaction records without changing the original schema."""
    df = _as_dataframe(data)
    if df.empty:
        return df

    for col in ["timestamp", "account_created_at", "last_transaction_at"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")
    for col in ["amount", "account_age_days", "is_fraud"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df["amount"] = df["amount"].fillna(0.0)
    df["account_age_days"] = df["account_age_days"].fillna(0.0)
    df = df.sort_values("timestamp", kind="stable").reset_index(drop=True)
    return df


def _count_in_window(group: pd.DataFrame, timestamp: pd.Timestamp, minutes: int) -> int:
    if group.empty:
        return 0
    start = timestamp - pd.Timedelta(minutes=minutes)
    return int(((group["timestamp"] >= start) & (group["timestamp"] <= timestamp)).sum())


def _unique_in_window(group: pd.DataFrame, timestamp: pd.Timestamp, column: str, minutes: int) -> int:
    if group.empty:
        return 0
    start = timestamp - pd.Timedelta(minutes=minutes)
    return int(group.loc[(group["timestamp"] >= start) & (group["timestamp"] <= timestamp), column].nunique())


def _sum_in_window(group: pd.DataFrame, timestamp: pd.Timestamp, minutes: int) -> float:
    if group.empty:
        return 0.0
    start = timestamp - pd.Timedelta(minutes=minutes)
    return float(group.loc[(group["timestamp"] >= start) & (group["timestamp"] <= timestamp), "amount"].sum())


def extract_transaction_features(transaction: Dict[str, Any], history: Optional[pd.DataFrame] = None) -> Dict[str, float]:
    """Create the model feature vector for one transaction using prior context."""
    tx = dict(transaction)
    ts = pd.to_datetime(tx.get("timestamp"), utc=True, errors="coerce")
    if pd.isna(ts):
        raise ValueError("transaction.timestamp must be a valid ISO timestamp")

    history_df = prepare_dataframe(history) if history is not None else pd.DataFrame()
    if not history_df.empty:
        history_df = history_df[history_df["timestamp"] <= ts].copy()

    sender = str(tx.get("sender_account", ""))
    receiver = str(tx.get("receiver_account", ""))
    sender_history = history_df[history_df["sender_account"] == sender] if not history_df.empty else pd.DataFrame()
    receiver_history = history_df[history_df["receiver_account"] == receiver] if not history_df.empty else pd.DataFrame()
    sender_inflows = history_df[history_df["receiver_account"] == sender] if not history_df.empty else pd.DataFrame()

    last_tx = pd.to_datetime(tx.get("last_transaction_at"), utc=True, errors="coerce")
    if pd.isna(last_tx):
        since_last = 0.0
    else:
        since_last = max(0.0, (ts - last_tx).total_seconds() / 3600.0)

    amount = float(tx.get("amount", 0.0) or 0.0)
    age = float(tx.get("account_age_days", 0.0) or 0.0)
    account_inflow_10m = _sum_in_window(sender_inflows, ts, 10)
    current_outflow_ratio = amount / account_inflow_10m if account_inflow_10m > 0 else 0.0

    device = str(tx.get("device_id", ""))
    features = {
        "amount": amount,
        "log_amount": math.log1p(max(amount, 0.0)),
        "account_age_days": age,
        "hour": float(ts.hour),
        "day_of_week": float(ts.dayofweek),
        "time_since_last_transaction_hours": since_last,
        "sender_tx_count_5m": float(_count_in_window(sender_history, ts, 5)),
        "sender_tx_count_10m": float(_count_in_window(sender_history, ts, 10)),
        "sender_tx_count_1h": float(_count_in_window(sender_history, ts, 60)),
        "sender_unique_receivers_1h": float(_unique_in_window(sender_history, ts, "receiver_account", 60)),
        "receiver_tx_count_10m": float(_count_in_window(receiver_history, ts, 10)),
        "receiver_unique_senders_10m": float(_unique_in_window(receiver_history, ts, "sender_account", 10)),
        "account_inflow_10m": account_inflow_10m,
        "outflow_ratio_10m": current_outflow_ratio,
        "is_new_account": float(age < 7),
        "is_high_value": float(amount > 100000),
        "is_unknown_device": float(device.startswith("DEV_UNKNOWN")),
        "is_new_device": float(device.startswith("DEV_NEW")),
        "is_mule_device": float(device.startswith("DEV_MULE")),
    }
    return features


def _window_stats(df: pd.DataFrame, group_col: str, minutes: int, unique_col: Optional[str] = None, sum_amount: bool = False):
    """Return backward-looking rolling stats, aligned to df's row index."""
    counts = np.zeros(len(df), dtype=float)
    uniques = np.zeros(len(df), dtype=float) if unique_col else None
    sums = np.zeros(len(df), dtype=float) if sum_amount else None
    window_seconds = minutes * 60.0

    # df is already timestamp-sorted. Each account group is small in this
    # synthetic dataset, so a two-pointer implementation is fast and avoids
    # an O(N^2) full-data filter for every transaction.
    for _, idx in df.groupby(group_col, sort=False).groups.items():
        positions = np.asarray(list(idx), dtype=int)
        times = df.loc[positions, "timestamp"].astype("int64").to_numpy() / 1e9
        amounts = df.loc[positions, "amount"].to_numpy(dtype=float)
        values = df.loc[positions, unique_col].astype(str).to_numpy() if unique_col else None

        left = 0
        running_sum = 0.0
        freq = {}
        for right in range(len(positions)):
            running_sum += amounts[right]
            value = values[right] if values is not None else None
            if values is not None:
                freq[value] = freq.get(value, 0) + 1

            cutoff = times[right] - window_seconds
            while left <= right and times[left] < cutoff:
                running_sum -= amounts[left]
                if values is not None:
                    old = values[left]
                    freq[old] -= 1
                    if freq[old] == 0:
                        del freq[old]
                left += 1

            counts[positions[right]] = right - left + 1
            if uniques is not None:
                uniques[positions[right]] = len(freq)
            if sums is not None:
                sums[positions[right]] = running_sum

    return counts, uniques, sums


def build_training_features(data: Any) -> pd.DataFrame:
    """Build features for every transaction using only data up to each tx."""
    df = prepare_dataframe(data)
    if df.empty:
        return pd.DataFrame(columns=MODEL_FEATURES)

    # Build from the complete time-sorted dataframe. Each rolling statistic
    # includes the current transaction, matching online scoring.
    sender_5, _, _ = _window_stats(df, "sender_account", 5)
    sender_10, _, _ = _window_stats(df, "sender_account", 10)
    sender_60, sender_unique_60, _ = _window_stats(
        df, "sender_account", 60, unique_col="receiver_account"
    )
    receiver_10, receiver_unique_10, _ = _window_stats(
        df, "receiver_account", 10, unique_col="sender_account", sum_amount=True
    )
    sender_inflow_10 = np.zeros(len(df), dtype=float)
    incoming_groups = df.groupby("receiver_account", sort=False).groups
    outgoing_groups = df.groupby("sender_account", sort=False).groups
    for account, outgoing_idx in outgoing_groups.items():
        positions_idx = incoming_groups.get(account)
        if positions_idx is None:
            continue
        positions = np.asarray(list(positions_idx), dtype=int)
        times = df.loc[positions, "timestamp"].astype("int64").to_numpy() / 1e9
        amounts = df.loc[positions, "amount"].to_numpy(dtype=float)
        # Map each outgoing row for this account to the sum of incoming rows
        # in the preceding 10 minutes. The current outgoing row itself is not
        # an incoming row for that account.
        for pos in np.asarray(list(outgoing_idx), dtype=int):
            t = df.iloc[pos]["timestamp"].value / 1e9
            left = np.searchsorted(times, t - 600.0, side="left")
            right = np.searchsorted(times, t, side="left")
            sender_inflow_10[pos] = float(amounts[left:right].sum())

    ts = df["timestamp"]
    last_tx = df["last_transaction_at"]
    since_last = (ts - last_tx).dt.total_seconds().div(3600).clip(lower=0).fillna(0)
    amount = df["amount"].astype(float)
    age = df["account_age_days"].astype(float)
    device = df["device_id"].astype(str)

    outflow_ratio = np.divide(
        amount.to_numpy(dtype=float),
        sender_inflow_10,
        out=np.zeros(len(df), dtype=float),
        where=sender_inflow_10 > 0,
    )

    features = pd.DataFrame({
        "amount": amount.to_numpy(),
        "log_amount": np.log1p(np.maximum(amount.to_numpy(), 0.0)),
        "account_age_days": age.to_numpy(),
        "hour": ts.dt.hour.to_numpy(dtype=float),
        "day_of_week": ts.dt.dayofweek.to_numpy(dtype=float),
        "time_since_last_transaction_hours": since_last.to_numpy(),
        "sender_tx_count_5m": sender_5,
        "sender_tx_count_10m": sender_10,
        "sender_tx_count_1h": sender_60,
        "sender_unique_receivers_1h": sender_unique_60,
        "receiver_tx_count_10m": receiver_10,
        "receiver_unique_senders_10m": receiver_unique_10,
        "account_inflow_10m": sender_inflow_10,
        "outflow_ratio_10m": outflow_ratio,
        "is_new_account": (age.to_numpy() < 7).astype(float),
        "is_high_value": (amount.to_numpy() > 100000).astype(float),
        "is_unknown_device": device.str.startswith("DEV_UNKNOWN").astype(float).to_numpy(),
        "is_new_device": device.str.startswith("DEV_NEW").astype(float).to_numpy(),
        "is_mule_device": device.str.startswith("DEV_MULE").astype(float).to_numpy(),
    }, index=df.index)
    return features[MODEL_FEATURES].replace([np.inf, -np.inf], 0).fillna(0.0)

