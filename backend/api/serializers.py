from decimal import Decimal

from rest_framework import serializers

from .models import Account, FraudCase, Transaction


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = "__all__"


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = "__all__"


class FraudCaseSerializer(serializers.ModelSerializer):
    transaction = TransactionSerializer(read_only=True)
    graph_data = serializers.SerializerMethodField()

    class Meta:
        model = FraudCase
        fields = "__all__"

    def get_graph_data(self, obj):
        return obj.graph_payload or {"nodes": [], "edges": []}


class FraudCaseListSerializer(serializers.ModelSerializer):
    """Lightweight case rows shaped for the alert stream and external API users."""

    alert_id = serializers.CharField(source="case_id", read_only=True)
    tx_id = serializers.CharField(source="transaction.tx_id", read_only=True)
    timestamp = serializers.DateTimeField(source="transaction.timestamp", read_only=True)
    sender_account_id = serializers.CharField(
        source="transaction.sender.account_id", read_only=True
    )
    receiver_account_id = serializers.CharField(
        source="transaction.receiver.account_id", read_only=True
    )
    amount = serializers.DecimalField(
        source="transaction.amount",
        max_digits=20,
        decimal_places=2,
        read_only=True,
    )
    currency = serializers.SerializerMethodField()
    composite_risk_score = serializers.IntegerField(source="risk_score", read_only=True)
    transaction_data = serializers.SerializerMethodField()

    class Meta:
        model = FraudCase
        fields = (
            "case_id",
            "alert_id",
            "tx_id",
            "timestamp",
            "sender_account_id",
            "receiver_account_id",
            "amount",
            "currency",
            "composite_risk_score",
            "risk_score",
            "risk_tier",
            "triggered_rules",
            "ai_explanations",
            "evidence_hash",
            "blockchain_tx_hash",
            "status",
            "created_at",
            "transaction_data",
        )

    def get_currency(self, obj):
        return "INR"

    def get_transaction_data(self, obj):
        return TransactionSerializer(obj.transaction).data


class TransactionIngestSerializer(serializers.Serializer):
    tx_id = serializers.CharField(max_length=255)
    timestamp = serializers.DateTimeField()
    sender_account = serializers.CharField(max_length=255)
    receiver_account = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    channel = serializers.CharField(max_length=50, required=False, default="UPI")
    device_id = serializers.CharField(
        max_length=255,
        required=False,
        default="",
        allow_blank=True,
    )
    ip_address = serializers.IPAddressField(required=False, default="0.0.0.0")
    location = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )
    account_age_days = serializers.IntegerField(required=False, default=365)


class BatchTransactionIngestSerializer(serializers.Serializer):
    transactions = TransactionIngestSerializer(many=True, required=False)


class InvestigatorActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["DISMISS", "CONFIRM_FRAUD", "HOLD"])
