"""
backend/api/services/rule_engine_service.py
============================================
TrustGraph 2026 — Deterministic Rule Engine Service (Layer 1)

Refactored from the standalone rule_engine.py CLI script into a callable
service class that evaluates individual transactions against deterministic
fraud rules. Maintains a rolling window of recent transactions for
velocity and mule detection.

Rules:
  RULE_01: Velocity > 8 transactions in 5 minutes (per sender)
  RULE_02: Inflow → Immediate outflow > 90% within 10 minutes (mule funnel)
  RULE_03: Amount > ₹1,00,000 AND account age < 7 days
"""

from __future__ import annotations

import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger("trustgraph.rule_engine")

# ─── Configuration ────────────────────────────────────────────────────────────

VELOCITY_WINDOW_MINUTES = 5
VELOCITY_THRESHOLD = 8

OUTFLOW_WINDOW_MINUTES = 10
OUTFLOW_RATIO_THRESHOLD = 0.90

NEW_ACCOUNT_DAYS = 7
HIGH_AMOUNT_THRESHOLD = 100_000

# Risk score contributions per rule violation
RULE_SCORES = {
    "RULE_01_VELOCITY_BURST": 35,
    "RULE_02_MULE_FUNNEL": 45,
    "RULE_03_NEW_ACCOUNT_HIGH_VALUE": 30,
}


@dataclass
class RuleViolation:
    """A single rule violation."""
    rule_id: str
    reason: str
    score: int
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class RuleResult:
    """Aggregate result from the rule engine for a single transaction."""
    violations: list[str]
    rule_risk_score: int          # 0–100, clamped
    details: list[dict[str, Any]]

    @property
    def has_violations(self) -> bool:
        return len(self.violations) > 0


class RuleEngineService:
    """
    Stateful rule engine that evaluates individual transactions.

    Maintains a rolling window of recent transactions in memory for
    time-window-based rules (velocity, mule outflow). Thread-safe
    enough for Django's synchronous request cycle; for async/multi-worker
    scenarios, consider Redis-backed windows.
    """

    def __init__(self) -> None:
        # sender_account -> deque of (timestamp, amount) for velocity checks
        self._sender_history: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=200)
        )
        # receiver_account -> deque of (timestamp, amount, sender_account) for mule checks
        self._receiver_history: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=200)
        )

    def evaluate(self, transaction: dict[str, Any]) -> RuleResult:
        """
        Evaluate a single transaction against all deterministic rules.

        Expected keys in transaction dict:
            tx_id, sender_account, receiver_account, amount, timestamp, device_id
            Optional: account_age_days (defaults to 365 if missing)

        Returns:
            RuleResult with violations list, aggregate score, and details.
        """
        violations: list[RuleViolation] = []

        sender = transaction["sender_account"]
        receiver = transaction["receiver_account"]
        amount = float(transaction["amount"])
        timestamp = self._parse_timestamp(transaction["timestamp"])
        account_age_days = int(transaction.get("account_age_days", 365))

        # Record this transaction in the rolling windows
        self._sender_history[sender].append((timestamp, amount))
        self._receiver_history[receiver].append((timestamp, amount, sender))

        # ── RULE 01: Velocity Burst ──────────────────────────────────────────
        velocity_violation = self._check_velocity(sender, timestamp)
        if velocity_violation:
            violations.append(velocity_violation)

        # ── RULE 02: Mule Funnel / Smurfing ──────────────────────────────────
        mule_violation = self._check_mule_outflow(sender, amount, timestamp)
        if mule_violation:
            violations.append(mule_violation)

        # ── RULE 03: New Account High Value ──────────────────────────────────
        if amount > HIGH_AMOUNT_THRESHOLD and account_age_days < NEW_ACCOUNT_DAYS:
            violations.append(RuleViolation(
                rule_id="RULE_03_NEW_ACCOUNT_HIGH_VALUE",
                reason=(
                    f"High-value transaction (₹{amount:,.2f}) from an account "
                    f"less than {NEW_ACCOUNT_DAYS} days old (age: {account_age_days}d)"
                ),
                score=RULE_SCORES["RULE_03_NEW_ACCOUNT_HIGH_VALUE"],
                details={
                    "amount": amount,
                    "account_age_days": account_age_days,
                    "threshold": HIGH_AMOUNT_THRESHOLD,
                },
            ))

        # ── Aggregate ────────────────────────────────────────────────────────
        total_score = min(sum(v.score for v in violations), 100)

        for v in violations:
            logger.info("[RULE] %s — %s", v.rule_id, v.reason)

        return RuleResult(
            violations=[v.rule_id for v in violations],
            rule_risk_score=total_score,
            details=[
                {"rule_id": v.rule_id, "reason": v.reason, "score": v.score, **v.details}
                for v in violations
            ],
        )

    # ─── Private Rule Checks ──────────────────────────────────────────────────

    def _check_velocity(self, sender: str, timestamp: datetime) -> RuleViolation | None:
        """RULE_01: More than VELOCITY_THRESHOLD transactions within VELOCITY_WINDOW_MINUTES."""
        window_start = timestamp - timedelta(minutes=VELOCITY_WINDOW_MINUTES)
        recent = [
            ts for ts, _ in self._sender_history[sender]
            if ts >= window_start
        ]

        if len(recent) > VELOCITY_THRESHOLD:
            return RuleViolation(
                rule_id="RULE_01_VELOCITY_BURST",
                reason=(
                    f"Sender {sender[:20]}… sent {len(recent)} transactions "
                    f"within {VELOCITY_WINDOW_MINUTES} minutes "
                    f"(threshold: {VELOCITY_THRESHOLD})"
                ),
                score=RULE_SCORES["RULE_01_VELOCITY_BURST"],
                details={
                    "transaction_count": len(recent),
                    "window_minutes": VELOCITY_WINDOW_MINUTES,
                },
            )
        return None

    def _check_mule_outflow(
        self, sender: str, outflow_amount: float, timestamp: datetime
    ) -> RuleViolation | None:
        """
        RULE_02: Mule funnel detection.

        Checks if the sender (as a receiver in previous transactions) accumulated
        inflows from 3+ distinct senders in the last OUTFLOW_WINDOW_MINUTES,
        and is now sending out >= 90% of that accumulated amount.
        """
        window_start = timestamp - timedelta(minutes=OUTFLOW_WINDOW_MINUTES)

        # Look at this sender's history as a RECEIVER
        inflows = self._receiver_history.get(sender)
        if not inflows:
            return None

        recent_inflows = [
            (ts, amt, src)
            for ts, amt, src in inflows
            if window_start <= ts < timestamp
        ]

        if len(recent_inflows) < 3:
            return None

        total_inflow = sum(amt for _, amt, _ in recent_inflows)
        if total_inflow <= 0:
            return None

        outflow_ratio = outflow_amount / total_inflow
        distinct_senders = len(set(src for _, _, src in recent_inflows))

        if outflow_ratio > OUTFLOW_RATIO_THRESHOLD and distinct_senders >= 3:
            return RuleViolation(
                rule_id="RULE_02_MULE_FUNNEL",
                reason=(
                    f"Mule pattern: {distinct_senders} incoming transfers "
                    f"(₹{total_inflow:,.2f}) followed by outflow of "
                    f"₹{outflow_amount:,.2f} ({outflow_ratio:.1%}) "
                    f"within {OUTFLOW_WINDOW_MINUTES} minutes"
                ),
                score=RULE_SCORES["RULE_02_MULE_FUNNEL"],
                details={
                    "inflow_total": round(total_inflow, 2),
                    "outflow_amount": round(outflow_amount, 2),
                    "outflow_ratio": round(outflow_ratio, 4),
                    "distinct_senders": distinct_senders,
                    "inflow_count": len(recent_inflows),
                },
            )
        return None

    # ─── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_timestamp(ts: Any) -> datetime:
        """Convert various timestamp formats to datetime."""
        if isinstance(ts, datetime):
            return ts
        ts_str = str(ts)
        # Handle trailing Z (UTC marker)
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        return datetime.fromisoformat(ts_str)
