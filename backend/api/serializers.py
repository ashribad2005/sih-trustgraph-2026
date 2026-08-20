from decimal import Decimal

from rest_framework import serializers
from .models import Account, Transaction, FraudCase


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'


class FraudCaseSerializer(serializers.ModelSerializer):
    transaction = TransactionSerializer(read_only=True)
    
    class Meta:
        model = FraudCase
        fields = '__all__'


# For listing cases, we don't need to return the heavy graph_payload
class FraudCaseListSerializer(serializers.ModelSerializer):
    transaction = TransactionSerializer(read_only=True)
    
    class Meta:
        model = FraudCase
        exclude = ('graph_payload',)


# Input serializers for ingestion
class TransactionIngestSerializer(serializers.Serializer):
    tx_id = serializers.CharField(max_length=255)
    timestamp = serializers.DateTimeField()
    sender_account = serializers.CharField(max_length=255)
    receiver_account = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=20, decimal_places=2, min_value=Decimal('0.01'))
    channel = serializers.CharField(max_length=50, required=False, default='UPI')
    device_id = serializers.CharField(max_length=255, required=False, default='', allow_blank=True)
    ip_address = serializers.IPAddressField(required=False, default='0.0.0.0')
    location = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    account_age_days = serializers.IntegerField(required=False, default=365)


class BatchTransactionIngestSerializer(serializers.Serializer):
    transactions = TransactionIngestSerializer(many=True, required=False)
    
    # We will accept either a list of transactions OR a single transaction payload directly
    # So we don't make transactions mandatory here, logic will be handled in the view.


class InvestigatorActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['DISMISS', 'CONFIRM_FRAUD', 'HOLD'])
