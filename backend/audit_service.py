"""
backend/audit_service.py
========================
TrustGraph 2026 — Web3 Blockchain Audit Service (Module 6)

Provides:
  - calculate_case_hash()    : Deterministic SHA-256 evidence fingerprinting
  - anchor_case_on_chain()   : Signs & broadcasts anchorProof() to Polygon Amoy / Sepolia
  - verify_case_integrity()  : Fetches on-chain hash and validates local DB state

ZERO PII POLICY: This service never sends UPI IDs, IP addresses, device IDs,
or customer names to the blockchain. Only deterministic hashes and risk metadata
are anchored.

Target Networks:
  - Polygon Amoy Testnet (Chain ID: 80002)
  - Ethereum Sepolia     (Chain ID: 11155111)

Usage:
  python audit_service.py  (runs a quick self-test in standalone mock mode)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3
from web3.exceptions import ContractLogicError
from web3.middleware import ExtraDataToPOAMiddleware

# ─── Environment ──────────────────────────────────────────────────────────────
load_dotenv()

RPC_URL           = os.getenv("RPC_URL", "")
WALLET_PRIVATE_KEY = os.getenv("WALLET_PRIVATE_KEY", "")
CONTRACT_ADDRESS  = os.getenv("CONTRACT_ADDRESS", "")
CHAIN_ID          = int(os.getenv("CHAIN_ID", "80002"))          # Polygon Amoy default
POLYGONSCAN_BASE  = os.getenv(
    "POLYGONSCAN_BASE",
    "https://amoy.polygonscan.com/tx"
)

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("trustgraph.audit_service")

# ─── Contract ABI (minimal — only functions we call) ─────────────────────────
TRUSTGRAPH_ABI: list[dict] = [
    {
        "name": "anchorProof",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "_caseId",       "type": "string"},
            {"name": "_evidenceHash", "type": "bytes32"},
            {"name": "_riskScore",    "type": "uint256"},
            {"name": "_action",       "type": "string"},
        ],
        "outputs": [{"name": "txTimestamp", "type": "uint256"}],
    },
    {
        "name": "getProof",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_caseId", "type": "string"}],
        "outputs": [
            {
                "name": "proof",
                "type": "tuple",
                "components": [
                    {"name": "caseId",            "type": "string"},
                    {"name": "evidenceHash",       "type": "bytes32"},
                    {"name": "riskScore",          "type": "uint256"},
                    {"name": "timestamp",          "type": "uint256"},
                    {"name": "recommendedAction",  "type": "string"},
                    {"name": "loggedBy",           "type": "address"},
                ],
            }
        ],
    },
    {
        "name": "isAnchored",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_caseId", "type": "string"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "totalAnchored",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "inputs": [
            {"name": "_caseId",       "type": "string"},
            {"name": "_suppliedHash", "type": "bytes32"},
        ],
        "name": "verifyIntegrity",
        "outputs": [
            {"name": "isValid",       "type": "bool"},
            {"name": "anchoredHash",  "type": "bytes32"},
            {"name": "anchoredScore", "type": "uint256"},
            {"name": "anchoredAt",    "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


# ─── Result Dataclasses ───────────────────────────────────────────────────────

@dataclass
class AnchorResult:
    """Returned by anchor_case_on_chain() on success."""
    tx_hash: str
    case_id: str
    evidence_hash: str
    risk_score: int
    explorer_url: str
    block_number: int | None = None


@dataclass
class VerifyResult:
    """Returned by verify_case_integrity()."""
    case_id: str
    is_valid: bool
    on_chain_hash: str
    computed_local_hash: str
    hashes_match: bool
    timestamp: int
    logged_by: str
    on_chain_risk_score: int
    verdict: str          # "VERIFIED" | "TAMPER_DETECTED" | "CASE_NOT_FOUND" | "CHAIN_ERROR"


# ─── Core Service ─────────────────────────────────────────────────────────────

class AuditService:
    """
    TrustGraph Web3 Audit Service.

    Operates in two modes:
      - LIVE mode   : Connects to Polygon Amoy / Sepolia via Web3 HTTPProvider.
      - MOCK mode   : In-memory simulation when RPC_URL or CONTRACT_ADDRESS are absent.
                      Ideal for CI, unit tests, and hackathon jury demonstrations.
    """

    def __init__(
        self,
        rpc_url: str = RPC_URL,
        private_key: str = WALLET_PRIVATE_KEY,
        contract_address: str = CONTRACT_ADDRESS,
        chain_id: int = CHAIN_ID,
        mock_mode: bool | None = None,
    ) -> None:
        self._private_key = private_key
        self._chain_id = chain_id
        self._mock_store: dict[str, dict] = {}   # In-memory store for mock mode

        # Auto-detect mock mode when credentials are absent
        _missing = not rpc_url or not private_key or not contract_address
        self._mock_mode: bool = _missing if mock_mode is None else mock_mode

        if self._mock_mode:
            logger.warning(
                "AuditService running in MOCK MODE "
                "(no RPC_URL / CONTRACT_ADDRESS / WALLET_PRIVATE_KEY). "
                "All blockchain operations are simulated in-memory."
            )
            self._w3 = None
            self._contract = None
            self._wallet_address = "0xMOCK_ADDRESS_TRUSTGRAPH_2026"
        else:
            self._w3 = Web3(Web3.HTTPProvider(rpc_url))
            # Inject PoA middleware (required for Polygon / Amoy)
            self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

            if not self._w3.is_connected():
                raise ConnectionError(
                    f"[AuditService] Cannot connect to RPC endpoint: {rpc_url}"
                )

            logger.info(
                "Connected to chain %s (latest block: %s)",
                self._w3.eth.chain_id,
                self._w3.eth.block_number,
            )

            self._wallet_address = Account.from_key(private_key).address
            self._contract = self._w3.eth.contract(
                address=Web3.to_checksum_address(contract_address),
                abi=TRUSTGRAPH_ABI,
            )
            logger.info("Wallet:   %s", self._wallet_address)
            logger.info("Contract: %s", contract_address)

    # ─── Public API ───────────────────────────────────────────────────────────

    def calculate_case_hash(self, case_dict: dict) -> str:
        """
        Produces a deterministic, 0x-prefixed SHA-256 hex digest from a case evidence dict.

        Canonicalization rules (CRITICAL — must be identical on all callers):
          1. Sort all keys recursively (sort_keys=True).
          2. Remove all inter-token whitespace (separators=(',', ':')).
          3. Encode as UTF-8 bytes.
          4. Apply SHA-256 and prepend '0x'.

        Args:
            case_dict: The evidence snapshot dict (must NOT contain PII fields).

        Returns:
            str: '0x' + 64-char SHA-256 hex digest.
        """
        canonical_json: str = json.dumps(
            case_dict, sort_keys=True, separators=(",", ":")
        )
        digest: str = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
        return f"0x{digest}"

    def anchor_case_on_chain(
        self,
        case_id: str,
        case_data: dict,
        risk_score: int,
        action: str,
    ) -> AnchorResult:
        """
        Builds, signs, and broadcasts an anchorProof() transaction.

        Args:
            case_id:    Opaque case reference (e.g., "TG-2026-00142"). Non-PII.
            case_data:  Evidence snapshot dict to hash — must NOT contain PII.
            risk_score: Composite risk score [0, 100].
            action:     Recommended action code string.

        Returns:
            AnchorResult with tx_hash, evidence_hash, explorer_url, etc.

        Raises:
            ValueError: If risk_score is out of [0, 100] range.
            ContractLogicError: If contract rejects the call (e.g., duplicate case).
        """
        if not (0 <= risk_score <= 100):
            raise ValueError(f"risk_score must be 0–100, got {risk_score}")

        evidence_hash_hex: str = self.calculate_case_hash(case_data)
        evidence_hash_bytes: bytes = bytes.fromhex(evidence_hash_hex[2:])  # strip '0x'

        logger.info("[ANCHOR] case_id=%s  hash=%s  score=%s", case_id, evidence_hash_hex, risk_score)

        if self._mock_mode:
            return self._mock_anchor(case_id, evidence_hash_hex, risk_score, action)

        # ── Live on-chain path ─────────────────────────────────────────────
        nonce = self._w3.eth.get_transaction_count(self._wallet_address, "pending")
        gas_price = self._w3.eth.gas_price

        tx = self._contract.functions.anchorProof(
            case_id,
            evidence_hash_bytes,
            risk_score,
            action,
        ).build_transaction(
            {
                "chainId":  self._chain_id,
                "from":     self._wallet_address,
                "nonce":    nonce,
                "gasPrice": gas_price,
            }
        )

        # Estimate gas and add 20% buffer
        estimated_gas = self._w3.eth.estimate_gas(tx)
        tx["gas"] = int(estimated_gas * 1.2)

        signed = self._w3.eth.account.sign_transaction(tx, self._private_key)
        raw_tx = signed.raw_transaction
        tx_hash_bytes = self._w3.eth.send_raw_transaction(raw_tx)
        tx_hash_hex = tx_hash_bytes.hex()

        logger.info("[ANCHOR] Broadcast tx: %s", tx_hash_hex)

        # Wait for receipt (timeout 120 s)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=120)
        block_number: int | None = receipt.get("blockNumber")

        logger.info(
            "[ANCHOR] Confirmed in block %s  status=%s",
            block_number,
            receipt.get("status"),
        )

        return AnchorResult(
            tx_hash=f"0x{tx_hash_hex}",
            case_id=case_id,
            evidence_hash=evidence_hash_hex,
            risk_score=risk_score,
            explorer_url=f"{POLYGONSCAN_BASE}/0x{tx_hash_hex}",
            block_number=block_number,
        )

    def verify_case_integrity(
        self, case_id: str, local_case_data: dict
    ) -> VerifyResult:
        """
        Fetches the on-chain evidence hash and verifies whether the current local
        state matches the immutable cryptographic fingerprint anchored at investigation time.

        Args:
            case_id:         The opaque case reference to look up.
            local_case_data: Current local DB evidence snapshot (to re-hash and compare).

        Returns:
            VerifyResult with is_valid, hash comparison, timestamps, verdict, etc.
        """
        computed_local_hash: str = self.calculate_case_hash(local_case_data)

        logger.info(
            "[VERIFY] case_id=%s  local_hash=%s", case_id, computed_local_hash
        )

        if self._mock_mode:
            return self._mock_verify(case_id, computed_local_hash)

        # ── Live on-chain path ─────────────────────────────────────────────
        try:
            is_anchored: bool = self._contract.functions.isAnchored(case_id).call()
            if not is_anchored:
                return VerifyResult(
                    case_id=case_id,
                    is_valid=False,
                    on_chain_hash="0x" + "0" * 64,
                    computed_local_hash=computed_local_hash,
                    hashes_match=False,
                    timestamp=0,
                    logged_by="",
                    on_chain_risk_score=0,
                    verdict="CASE_NOT_FOUND",
                )

            proof = self._contract.functions.getProof(case_id).call()
            # proof = (caseId, evidenceHash, riskScore, timestamp, recommendedAction, loggedBy)
            on_chain_hash_bytes: bytes = proof[1]
            on_chain_hash_hex: str = "0x" + on_chain_hash_bytes.hex()
            hashes_match: bool = on_chain_hash_hex.lower() == computed_local_hash.lower()

            verdict = "VERIFIED" if hashes_match else "TAMPER_DETECTED"
            logger.info("[VERIFY] verdict=%s", verdict)

            return VerifyResult(
                case_id=case_id,
                is_valid=hashes_match,
                on_chain_hash=on_chain_hash_hex,
                computed_local_hash=computed_local_hash,
                hashes_match=hashes_match,
                timestamp=int(proof[3]),
                logged_by=str(proof[5]),
                on_chain_risk_score=int(proof[2]),
                verdict=verdict,
            )

        except ContractLogicError as exc:
            logger.error("[VERIFY] Contract reverted: %s", exc)
            return VerifyResult(
                case_id=case_id,
                is_valid=False,
                on_chain_hash="0x" + "0" * 64,
                computed_local_hash=computed_local_hash,
                hashes_match=False,
                timestamp=0,
                logged_by="",
                on_chain_risk_score=0,
                verdict="CHAIN_ERROR",
            )

    # ─── Mock Helpers (Standalone / CI mode) ──────────────────────────────────

    def _mock_anchor(
        self,
        case_id: str,
        evidence_hash: str,
        risk_score: int,
        action: str,
    ) -> AnchorResult:
        if case_id in self._mock_store:
            raise ContractLogicError(
                f"[MOCK] CaseAlreadyAnchored: {case_id} was previously anchored."
            )
        fake_tx = "0x" + hashlib.sha256(f"{case_id}{time.time()}".encode()).hexdigest()
        self._mock_store[case_id] = {
            "evidence_hash":  evidence_hash,
            "risk_score":     risk_score,
            "action":         action,
            "timestamp":      int(time.time()),
            "logged_by":      self._wallet_address,
            "tx_hash":        fake_tx,
        }
        logger.info("[MOCK ANCHOR] case_id=%s  tx=%s", case_id, fake_tx)
        return AnchorResult(
            tx_hash=fake_tx,
            case_id=case_id,
            evidence_hash=evidence_hash,
            risk_score=risk_score,
            explorer_url=f"{POLYGONSCAN_BASE}/{fake_tx}",
            block_number=None,
        )

    def _mock_verify(self, case_id: str, computed_local_hash: str) -> VerifyResult:
        if case_id not in self._mock_store:
            return VerifyResult(
                case_id=case_id,
                is_valid=False,
                on_chain_hash="0x" + "0" * 64,
                computed_local_hash=computed_local_hash,
                hashes_match=False,
                timestamp=0,
                logged_by="",
                on_chain_risk_score=0,
                verdict="CASE_NOT_FOUND",
            )

        stored = self._mock_store[case_id]
        on_chain_hash: str = stored["evidence_hash"]
        hashes_match: bool = on_chain_hash.lower() == computed_local_hash.lower()
        verdict = "VERIFIED" if hashes_match else "TAMPER_DETECTED"
        logger.info("[MOCK VERIFY] verdict=%s", verdict)

        return VerifyResult(
            case_id=case_id,
            is_valid=hashes_match,
            on_chain_hash=on_chain_hash,
            computed_local_hash=computed_local_hash,
            hashes_match=hashes_match,
            timestamp=stored["timestamp"],
            logged_by=stored["logged_by"],
            on_chain_risk_score=stored["risk_score"],
            verdict=verdict,
        )


# ─── Standalone Self-Test ─────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  TrustGraph AuditService — Standalone Self-Test (Mock Mode)")
    print("=" * 70 + "\n")

    svc = AuditService()

    test_case: dict[str, Any] = {
        "case_id":               "TG-2026-SELFTEST-001",
        "tx_id":                 "TXN_SELFTEST",
        "risk_score":            93,
        "flagged_timestamp":     1786881120,
        "evidence_fingerprint":  "placeholder_will_be_overwritten_by_hash",
    }

    print("▶  Anchoring test case …")
    result = svc.anchor_case_on_chain(
        case_id=test_case["case_id"],
        case_data=test_case,
        risk_score=93,
        action="SIMULATED_HOLD_AND_INVESTIGATE",
    )
    print(f"   ✅ Anchored  |  TX: {result.tx_hash}")
    print(f"   Hash: {result.evidence_hash}\n")

    print("▶  Verifying integrity (pristine data) …")
    v = svc.verify_case_integrity(test_case["case_id"], test_case)
    print(f"   Verdict: {v.verdict}  |  Match: {v.hashes_match}\n")

    print("▶  Simulating tamper (risk_score 93 → 20) …")
    tampered = {**test_case, "risk_score": 20}
    v2 = svc.verify_case_integrity(test_case["case_id"], tampered)
    print(f"   Verdict: {v2.verdict}  |  Match: {v2.hashes_match}")
    print(f"   On-chain : {v2.on_chain_hash}")
    print(f"   Local    : {v2.computed_local_hash}\n")
    print("=" * 70 + "\n")
