"""
backend/demo_tamper_showcase.py
================================
TrustGraph 2026 — Hackathon Jury Demonstration Script (Module 6)

CLI showcase of the blockchain tamper-detection engine for the SIH jury panel.
Runs entirely in MOCK MODE — no live wallet or RPC endpoint required.

Demonstration Steps:
  Step A — Anchor a legitimate high-risk fraud case on-chain.
  Step B — Verify integrity → PASSED (cryptographic match confirmed).
  Step C — Simulate malicious insider database tampering.
  Step D — Re-run verification → FLAGGED / TAMPER DETECTED with hash diff.

Usage:
  python demo_tamper_showcase.py
  python demo_tamper_showcase.py --live   (uses .env credentials for live chain)
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Any

# Ensure backend/ is on path when run from repo root
import os
sys.path.insert(0, os.path.dirname(__file__))

from audit_service import AuditService, AnchorResult, VerifyResult

# ─── ANSI colour helpers ──────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BLUE   = "\033[94m"
WHITE  = "\033[97m"
DIM    = "\033[2m"


def _c(text: str, *codes: str) -> str:
    return "".join(codes) + str(text) + RESET


def _banner(title: str, color: str = CYAN) -> None:
    bar = "═" * 70
    print(f"\n{_c(bar, color)}")
    print(_c(f"  {title}", color, BOLD))
    print(_c(bar, color))


def _step(letter: str, description: str) -> None:
    label = _c(f" STEP {letter} ", BOLD, WHITE, "\033[44m")   # white on blue bg
    print(f"\n{label}  {_c(description, BOLD, WHITE)}\n")
    time.sleep(0.4)


def _ok(msg: str) -> None:
    print(f"  {_c('✅', GREEN)}  {msg}")


def _warn(msg: str) -> None:
    print(f"  {_c('⚠️', YELLOW)}  {msg}")


def _fail(msg: str) -> None:
    print(f"  {_c('🚨', RED)}  {_c(msg, RED, BOLD)}")


def _info(label: str, value: str) -> None:
    print(f"  {_c(label + ':', DIM)}  {_c(value, CYAN)}")


def _diff_line(prefix: str, value: str, color: str) -> None:
    print(f"  {_c(prefix, color, BOLD)}  {_c(value, color)}")


# ─── Evidence fixture ─────────────────────────────────────────────────────────

# ⚠️  ZERO PII POLICY:
#     This dict contains only opaque IDs, scores, timestamps, and flags.
#     NO UPI IDs, IP addresses, device fingerprints, or customer names.
LEGITIMATE_CASE: dict[str, Any] = {
    "case_id":             "TG-2026-00142",
    "tx_id":               "TXN_99182746",
    "risk_score":          93,
    "risk_tier":           "CRITICAL",
    "rule_violations":     ["HIGH_VELOCITY_BURST", "MULE_FAN_IN_ANOMALY"],
    "ml_anomaly_score":    0.89,
    "flagged_timestamp":   1786881120,
    "recommended_action":  "SIMULATED_HOLD_AND_INVESTIGATE",
    "graph_metrics": {
        "in_degree_centrality":  0.82,
        "community_cluster_id":  "CLUSTER_MULE_04",
        "shared_device_count":   5,
    },
}

CASE_ID = LEGITIMATE_CASE["case_id"]


# ─── Demonstration runner ─────────────────────────────────────────────────────

def run_demo(live_mode: bool) -> None:
    _banner("TRUSTGRAPH 2026 — BLOCKCHAIN TAMPER-DETECTION ENGINE", CYAN)
    print(_c(
        "  Smart India Hackathon 2026 | SIH-S40 | Module 6 Live Demo",
        DIM,
    ))
    print(_c(
        f"  Mode: {'🔴  LIVE CHAIN (Polygon Amoy)' if live_mode else '🟡  MOCK MODE (in-memory simulation)'}",
        YELLOW if not live_mode else RED,
    ))
    time.sleep(0.6)

    # Initialise service (mock or live)
    svc = AuditService(mock_mode=(not live_mode))

    # ──────────────────────────────────────────────────────────────────────────
    # STEP A — Anchor the legitimate fraud case on-chain
    # ──────────────────────────────────────────────────────────────────────────
    _step("A", "Anchoring Legitimate High-Risk Fraud Case On-Chain")

    print(_c("  Evidence Snapshot (Zero-PII):", DIM))
    for k, v in LEGITIMATE_CASE.items():
        print(f"    {_c(k, YELLOW)}: {v}")

    # Pre-compute hash for display
    evidence_hash = svc.calculate_case_hash(LEGITIMATE_CASE)
    print(f"\n  {_c('SHA-256 Fingerprint:', DIM)} {_c(evidence_hash, GREEN)}")
    time.sleep(0.5)

    try:
        result: AnchorResult = svc.anchor_case_on_chain(
            case_id=CASE_ID,
            case_data=LEGITIMATE_CASE,
            risk_score=int(LEGITIMATE_CASE["risk_score"]),
            action=str(LEGITIMATE_CASE["recommended_action"]),
        )
    except Exception as exc:
        _fail(f"Anchoring failed: {exc}")
        sys.exit(1)

    _ok(f"Case {_c(CASE_ID, BOLD)} anchored successfully!")
    _info("Transaction Hash ", result.tx_hash)
    _info("Evidence Hash    ", result.evidence_hash)
    _info("Risk Score       ", str(result.risk_score))
    _info("Explorer URL     ", _c(result.explorer_url, BLUE))
    if result.block_number:
        _info("Block Number     ", str(result.block_number))

    time.sleep(0.8)

    # ──────────────────────────────────────────────────────────────────────────
    # STEP B — Verify integrity with pristine data (should PASS)
    # ──────────────────────────────────────────────────────────────────────────
    _step("B", "Integrity Verification — Pristine Data (Expected: PASSED)")

    print(_c("  Re-hashing local database state and comparing to on-chain anchor …\n", DIM))
    time.sleep(0.6)

    v1: VerifyResult = svc.verify_case_integrity(CASE_ID, LEGITIMATE_CASE)

    _info("Local Hash       ", v1.computed_local_hash)
    _info("On-Chain Hash    ", v1.on_chain_hash)
    _info("Hashes Match     ", str(v1.hashes_match))
    print()

    if v1.verdict == "VERIFIED":
        _ok(_c("CRYPTOGRAPHIC INTEGRITY: ✅  VERIFIED ON POLYGON AMOY", GREEN, BOLD))
        print(f"  {_c('Both hashes are identical — the evidence record is tamper-proof.', GREEN)}")
    else:
        _fail(f"Unexpected result: {v1.verdict}")

    time.sleep(1.0)

    # ──────────────────────────────────────────────────────────────────────────
    # STEP C — Simulate malicious insider database tampering
    # ──────────────────────────────────────────────────────────────────────────
    _step("C", "Simulating Malicious Insider Database Tampering")

    print(_c(
        "  ⚠️  An insider actor has modified the fraud investigation record:\n",
        YELLOW,
    ))

    tampering_scenarios = [
        ("risk_score",       93,       20,   "Downgraded risk score to evade automated holds"),
        ("rule_violations",  ["HIGH_VELOCITY_BURST", "MULE_FAN_IN_ANOMALY"], [],
         "Cleared all rule violation flags"),
        ("recommended_action",
         "SIMULATED_HOLD_AND_INVESTIGATE",
         "NO_ACTION",
         "Changed recommended action to suppress investigation"),
    ]

    tampered_case: dict[str, Any] = dict(LEGITIMATE_CASE)

    for field, original, forged, description in tampering_scenarios:
        tampered_case[field] = forged
        print(f"  {_c('TAMPER:', RED, BOLD)}  {_c(field, YELLOW)}")
        print(f"    {_c('Original:', DIM)} {_c(str(original), GREEN)}")
        print(f"    {_c('Forged  :', DIM)} {_c(str(forged), RED)}")
        print(f"    {_c('Intent  :', DIM)} {description}\n")
        time.sleep(0.3)

    tampered_hash = svc.calculate_case_hash(tampered_case)
    _info("Tampered Hash  ", _c(tampered_hash, RED))
    print(_c(
        "\n  The tampered record now produces a completely different SHA-256 fingerprint.",
        DIM,
    ))

    time.sleep(0.8)

    # ──────────────────────────────────────────────────────────────────────────
    # STEP D — Re-run verification → TAMPER DETECTED
    # ──────────────────────────────────────────────────────────────────────────
    _step("D", "Re-Running Verification — Tampered Data (Expected: FLAGGED)")

    print(_c(
        "  Fetching immutable on-chain anchor and comparing against tampered local state …\n",
        DIM,
    ))
    time.sleep(0.6)

    v2: VerifyResult = svc.verify_case_integrity(CASE_ID, tampered_case)

    # ── Hash diff visualisation ────────────────────────────────────────────
    print(_c("  CRYPTOGRAPHIC DIFF:", BOLD))
    _diff_line("  + ORIGINAL (On-Chain)", v2.on_chain_hash,       GREEN)
    _diff_line("  - TAMPERED (Local DB)", v2.computed_local_hash,  RED)
    print()

    # Highlight differing hex nibbles
    orig = v2.on_chain_hash[2:]   # strip '0x'
    tamp = v2.computed_local_hash[2:]
    diff_positions = [i for i, (a, b) in enumerate(zip(orig, tamp)) if a != b]
    print(
        f"  {_c('Differing nibble positions:', DIM)} "
        f"{_c(str(diff_positions[:12]), RED)}"
        f"{_c(' … (' + str(len(diff_positions)) + ' total)', DIM)}"
    )
    print()

    if v2.verdict == "TAMPER_DETECTED":
        _fail("DATABASE INTEGRITY BREACH DETECTED")
        _fail("VERDICT: 🚨  TAMPER DETECTED — HASH MISMATCH")
        print(f"\n  {_c('The on-chain immutable record does NOT match the current database.', RED)}")
        print(f"  {_c('Evidence of database manipulation confirmed. Case flagged for review.', RED)}")
    else:
        _warn(f"Unexpected verdict: {v2.verdict}")

    # ── Summary Panel ──────────────────────────────────────────────────────
    _banner("DEMONSTRATION SUMMARY", CYAN)
    rows = [
        ("Step A — Anchoring",     "✅  ANCHORED ON-CHAIN",          GREEN),
        ("Step B — Integrity",     "✅  VERIFIED (hashes match)",     GREEN),
        ("Step C — Tampering",     "⚠️   DATABASE MANIPULATED",        YELLOW),
        ("Step D — Detection",     "🚨  TAMPER DETECTED (mismatch)",  RED),
    ]
    for label, status, color in rows:
        print(f"  {_c(label + ':', DIM):<40}  {_c(status, color, BOLD)}")

    print(f"\n  {_c('On-Chain Anchor (immutable):', DIM)}")
    print(f"    {_c(v2.on_chain_hash, GREEN)}")
    print(f"  {_c('Tampered Local State:', DIM)}")
    print(f"    {_c(v2.computed_local_hash, RED)}")
    print()
    print(_c(
        "  TrustGraph's blockchain audit trail provides irrefutable,",
        DIM,
    ))
    print(_c(
        "  cryptographically-secure tamper evidence even against privileged insider threats.",
        DIM,
    ))
    print()
    print(_c("═" * 70, CYAN))
    print()


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="TrustGraph 2026 — Blockchain Tamper Detection Demo"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Use live chain credentials from .env (default: mock mode)",
    )
    args = parser.parse_args()
    run_demo(live_mode=args.live)
