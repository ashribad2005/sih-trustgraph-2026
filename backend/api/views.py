"""
backend/api/views.py
=====================
TrustGraph 2026 — Unified API Views

Implements the complete end-to-end pipeline:
  POST /api/v1/transactions/ingest/  →  Rules → ML → Blockchain → Response
  GET  /api/v1/cases/                →  List fraud cases
  GET  /api/v1/cases/{id}/           →  Case detail with graph payload
  POST /api/v1/cases/{id}/action/    →  Investigator actions
  GET  /api/v1/cases/{id}/verify-integrity/  →  Blockchain verification
  GET  /api/v1/dashboard/metrics/    →  Dashboard KPIs
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.conf import settings
from django.db import transaction
from django.db.models import Sum, Count
import logging

from .models import Account, Transaction, FraudCase
from .serializers import (
    FraudCaseSerializer,
    FraudCaseListSerializer,
    TransactionIngestSerializer,
    InvestigatorActionSerializer
)
from .services.ai_service import TrustGraphAIService
from .services.evidence_service import EvidenceService
from .services.blockchain_service import BlockchainService

logger = logging.getLogger("trustgraph.views")

# ─── Singleton Services ──────────────────────────────────────────────────────
# Initialized once at module load. Django's WSGI/ASGI server loads this once
# per worker process, which is exactly what we want for the in-memory ML state.

ai_service = TrustGraphAIService()
blockchain_service = BlockchainService()

RISK_THRESHOLD = getattr(settings, 'RISK_THRESHOLD', 75)


class TransactionIngestView(APIView):
    """
    POST /api/v1/transactions/ingest/

    Accepts single or batch UPI transaction data and runs the full
    fraud detection pipeline:
      1. Validate & persist transaction
      2. Layer 1: Deterministic Rule Engine
      3. Layer 2: ML Anomaly Detection + Graph Intelligence
      4. Layer 3: Blockchain anchoring (if risk >= threshold)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Support single transaction or batch
        data = request.data
        if 'transactions' in data and isinstance(data['transactions'], list):
            transactions_data = data['transactions']
        else:
            transactions_data = [data]

        results = []
        errors = []

        for item in transactions_data:
            serializer = TransactionIngestSerializer(data=item)
            if serializer.is_valid():
                try:
                    result = self._process_transaction(serializer.validated_data)
                    results.append(result)
                except Exception as e:
                    logger.exception("Failed to process transaction %s", item.get('tx_id'))
                    errors.append({
                        "tx_id": item.get('tx_id'),
                        "error": str(e)
                    })
            else:
                errors.append({
                    "tx_id": item.get('tx_id'),
                    "error": serializer.errors
                })

        if errors and not results:
            return Response(
                {
                    "error": {
                        "code": "INVALID_TRANSACTION",
                        "message": "All transactions failed validation",
                        "details": errors,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            "message": f"Successfully ingested {len(results)} transaction(s).",
            "results": results,
            "errors": errors
        }, status=status.HTTP_201_CREATED)

    def _process_transaction(self, valid_data):
        """Process a single validated transaction through the full pipeline."""
        with transaction.atomic():
            # ── Idempotency check ────────────────────────────────────────────
            if Transaction.objects.filter(tx_id=valid_data['tx_id']).exists():
                raise ValueError("Transaction ID already exists.")

            # ── Create or get accounts ───────────────────────────────────────
            sender, _ = Account.objects.get_or_create(account_id=valid_data['sender_account'])
            receiver, _ = Account.objects.get_or_create(account_id=valid_data['receiver_account'])

            # ── Persist transaction ──────────────────────────────────────────
            txn = Transaction.objects.create(
                tx_id=valid_data['tx_id'],
                sender=sender,
                receiver=receiver,
                amount=valid_data['amount'],
                timestamp=valid_data['timestamp'],
                device_id=valid_data.get('device_id', ''),
                ip_address=valid_data.get('ip_address', '0.0.0.0'),
                channel=valid_data.get('channel', 'UPI'),
                status=Transaction.StatusChoices.ALLOWED
            )

            # ── Layer 1 + 2: AI Analysis (Rules + ML + Graph) ────────────────
            ai_payload = {
                "tx_id": txn.tx_id,
                "amount": float(txn.amount),
                "sender_account": sender.account_id,
                "receiver_account": receiver.account_id,
                "device_id": txn.device_id,
                "timestamp": txn.timestamp.isoformat(),
                "account_age_days": valid_data.get('account_age_days', 365),
            }

            ai_result = ai_service.analyze_transaction(ai_payload)

            risk_score = ai_result.get('composite_risk_score', 0)

            # ── Case Creation (if risk >= threshold) ─────────────────────────
            if risk_score >= RISK_THRESHOLD:
                txn.status = Transaction.StatusChoices.SIMULATED_HOLD
                txn.save()

                case_id = FraudCase.generate_case_id()
                case = FraudCase.objects.create(
                    case_id=case_id,
                    transaction=txn,
                    risk_score=risk_score,
                    risk_tier=ai_result.get('risk_tier', 'HIGH'),
                    triggered_rules=ai_result.get('rule_violations', []),
                    ai_explanations=ai_result.get('ai_explanations', []),
                    graph_payload=ai_result.get('graph_data', {}),
                )

                # ── Evidence Hash ────────────────────────────────────────────
                evidence_dict = {
                    "case_id": case.case_id,
                    "tx_id": txn.tx_id,
                    "sender": sender.account_id,
                    "receiver": receiver.account_id,
                    "amount": f"{float(txn.amount):.2f}",
                    "risk_score": risk_score,
                    "rules": ai_result.get('rule_violations', []),
                }

                evidence_hash = EvidenceService.generate_evidence_hash(evidence_dict)
                case.evidence_hash = evidence_hash
                case.save()

                # ── Layer 3: Blockchain Anchoring ────────────────────────────
                blockchain_result = blockchain_service.anchor_if_high_risk(case)

                result = {
                    "tx_id": txn.tx_id,
                    "status": txn.status,
                    "risk_score": risk_score,
                    "risk_tier": ai_result.get('risk_tier'),
                    "case_id": case.case_id,
                    "evidence_hash": evidence_hash,
                    "rule_violations": ai_result.get('rule_violations', []),
                    "ai_explanations": ai_result.get('ai_explanations', []),
                }

                if blockchain_result:
                    result["blockchain"] = blockchain_result

                return result

            # ── Low-risk: no case created ────────────────────────────────────
            return {
                "tx_id": txn.tx_id,
                "status": txn.status,
                "risk_score": risk_score,
                "risk_tier": ai_result.get('risk_tier', 'LOW'),
            }


class FraudCaseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/cases/       → List all fraud cases
    GET /api/v1/cases/{id}/  → Detail with graph payload
    """
    permission_classes = [IsAuthenticated]
    queryset = FraudCase.objects.all().order_by('-risk_score', '-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return FraudCaseListSerializer
        return FraudCaseSerializer

    @action(detail=True, methods=['post'], url_path='action')
    def investigator_action(self, request, pk=None):
        """POST /api/v1/cases/{id}/action/ — Investigator disposition."""
        case = self.get_object()
        serializer = InvestigatorActionSerializer(data=request.data)
        if serializer.is_valid():
            action_type = serializer.validated_data['action']
            if action_type == 'DISMISS':
                case.status = FraudCase.StatusChoices.DISMISSED
            elif action_type == 'CONFIRM_FRAUD':
                case.status = FraudCase.StatusChoices.RESOLVED
            elif action_type == 'HOLD':
                case.status = FraudCase.StatusChoices.UNDER_REVIEW

            case.save()
            return Response(FraudCaseSerializer(case).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='verify-integrity')
    def verify_integrity(self, request, pk=None):
        """
        GET /api/v1/cases/{id}/verify-integrity/

        Verifies evidence integrity against the blockchain anchor.
        Uses the real blockchain service (live or mock mode).
        """
        case = self.get_object()
        result = blockchain_service.verify_integrity(case)
        return Response(result)

    @action(detail=True, methods=['get'], url_path='graph')
    def graph_data(self, request, pk=None):
        """
        GET /api/v1/cases/{id}/graph/

        Returns the Cytoscape-compatible graph payload for the case.
        """
        case = self.get_object()
        return Response({
            "case_id": case.case_id,
            "graph_data": case.graph_payload,
        })


class DashboardMetricsView(APIView):
    """
    GET /api/v1/dashboard/metrics/

    Returns aggregate KPIs for the dashboard.
    Field names match frontend DashboardMetrics interface:
    - total_monitored_volume_inr
    - total_screened_transactions
    - active_high_risk_cases
    - network_interception_rate
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Total monitored volume = sum of all transaction amounts
        total_vol = Transaction.objects.aggregate(Sum('amount'))['amount__sum'] or 0

        # Active high-risk cases = OPEN + UNDER_REVIEW cases
        active_cases = FraudCase.objects.filter(
            status__in=[FraudCase.StatusChoices.OPEN, FraudCase.StatusChoices.UNDER_REVIEW]
        )
        active_high_risk_cases = active_cases.count()

        # Total screened transactions
        total_screened = Transaction.objects.count()

        # Blockchain-anchored count
        anchored_count = FraudCase.objects.exclude(
            blockchain_tx_hash__isnull=True
        ).exclude(
            blockchain_tx_hash=''
        ).count()

        # Network interception rate = (anchored / total_screened) * 100
        # If no transactions screened, rate is 100% (nothing to intercept)
        if total_screened > 0:
            network_interception_rate = round((anchored_count / total_screened) * 100, 1)
        else:
            network_interception_rate = 100.0

        return Response({
            "total_monitored_volume_inr": float(total_vol),
            "total_screened_transactions": total_screened,
            "active_high_risk_cases": active_high_risk_cases,
            "network_interception_rate": network_interception_rate,
        })
