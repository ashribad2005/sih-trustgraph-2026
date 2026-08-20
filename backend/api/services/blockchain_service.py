"""
backend/api/services/blockchain_service.py
===========================================
TrustGraph 2026 — Blockchain Audit Integration Service

Thin Django-aware wrapper around the standalone audit_service.py.
Handles:
  - Conditional anchoring (only when risk_score >= threshold)
  - Updating FraudCase.blockchain_tx_hash on successful anchor
  - Integrity verification via on-chain hash comparison
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any

from django.conf import settings

logger = logging.getLogger("trustgraph.blockchain_service")

# Ensure the project root is on sys.path so we can import audit_service
# from backend/audit_service.py
_backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from audit_service import AuditService, AnchorResult, VerifyResult  # noqa: E402


class BlockchainService:
    """
    Manages all blockchain interactions for the Django backend.

    Instantiates AuditService once (with mock/live auto-detection based
    on environment variables) and provides high-level methods for the
    views layer.
    """

    def __init__(self) -> None:
        self._audit_service = AuditService()
        self._risk_threshold = int(os.getenv("RISK_THRESHOLD", "75"))
        logger.info(
            "[BlockchainService] Initialized (mock=%s, threshold=%d)",
            self._audit_service._mock_mode,
            self._risk_threshold,
        )

    def anchor_if_high_risk(self, case) -> dict[str, Any] | None:
        """
        Anchor a fraud case on-chain if its risk_score meets the threshold.

        Args:
            case: A FraudCase model instance with:
                  - case_id, risk_score, evidence_hash
                  - transaction.tx_id, transaction.sender.account_id,
                    transaction.receiver.account_id, transaction.amount

        Returns:
            Dict with anchor details if anchored, None if below threshold.
            Updates case.blockchain_tx_hash in-place and saves.
        """
        if case.risk_score < self._risk_threshold:
            logger.debug(
                "[BlockchainService] Skipping anchor for %s (score=%d < threshold=%d)",
                case.case_id, case.risk_score, self._risk_threshold,
            )
            return None

        # Build the evidence dict for hashing (NO PII)
        case_data = {
            "case_id": case.case_id,
            "tx_id": case.transaction.tx_id,
            "risk_score": case.risk_score,
            "triggered_rules": case.triggered_rules,
            "amount": f"{float(case.transaction.amount):.2f}",
        }

        # Determine recommended action from risk tier
        action_map = {
            "CRITICAL": "SIMULATED_HOLD_AND_INVESTIGATE",
            "HIGH": "FLAG_FOR_REVIEW",
            "MEDIUM": "MONITOR",
            "LOW": "ALLOW",
        }
        action = action_map.get(case.risk_tier, "FLAG_FOR_REVIEW")

        try:
            result: AnchorResult = self._audit_service.anchor_case_on_chain(
                case_id=case.case_id,
                case_data=case_data,
                risk_score=case.risk_score,
                action=action,
            )

            # Persist the blockchain tx hash
            case.blockchain_tx_hash = result.tx_hash
            case.save(update_fields=["blockchain_tx_hash"])

            logger.info(
                "[BlockchainService] Anchored %s → tx=%s",
                case.case_id, result.tx_hash,
            )

            return {
                "anchored": True,
                "tx_hash": result.tx_hash,
                "evidence_hash": result.evidence_hash,
                "explorer_url": result.explorer_url,
                "block_number": result.block_number,
            }

        except Exception as e:
            logger.error(
                "[BlockchainService] Failed to anchor %s: %s",
                case.case_id, e,
            )
            return {
                "anchored": False,
                "error": str(e),
            }

    def verify_integrity(self, case) -> dict[str, Any]:
        """
        Verify a fraud case's evidence integrity against the on-chain anchor.

        Args:
            case: A FraudCase model instance.

        Returns:
            Dict with verification result including verdict, hash comparison, etc.
        """
        # Build the evidence dict (same structure as used during anchoring)
        case_data = {
            "case_id": case.case_id,
            "tx_id": case.transaction.tx_id,
            "risk_score": case.risk_score,
            "triggered_rules": case.triggered_rules,
            "amount": f"{float(case.transaction.amount):.2f}",
        }

        try:
            result: VerifyResult = self._audit_service.verify_case_integrity(
                case_id=case.case_id,
                local_case_data=case_data,
            )

            return {
                "case_id": result.case_id,
                "is_tampered": not result.is_valid,
                "verdict": result.verdict,
                "on_chain_hash": result.on_chain_hash,
                "local_hash": result.computed_local_hash,
                "hashes_match": result.hashes_match,
                "on_chain_risk_score": result.on_chain_risk_score,
                "timestamp": result.timestamp,
                "logged_by": result.logged_by,
                "verification_available": True,
            }

        except Exception as e:
            logger.error(
                "[BlockchainService] Verification failed for %s: %s",
                case.case_id, e,
            )
            return {
                "case_id": case.case_id,
                "is_tampered": False,
                "verdict": "CHAIN_ERROR",
                "on_chain_hash": None,
                "local_hash": None,
                "hashes_match": False,
                "on_chain_risk_score": 0,
                "timestamp": 0,
                "logged_by": "",
                "verification_available": False,
                "error": str(e),
            }
