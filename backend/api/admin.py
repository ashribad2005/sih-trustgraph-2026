from django.contrib import admin
from .models import Account, Transaction, FraudCase

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('account_id', 'alias_name', 'reputation_score', 'created_at')
    search_fields = ('account_id', 'alias_name')

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('tx_id', 'sender', 'receiver', 'amount', 'status', 'timestamp')
    list_filter = ('status', 'channel')
    search_fields = ('tx_id', 'sender__account_id', 'receiver__account_id')

@admin.register(FraudCase)
class FraudCaseAdmin(admin.ModelAdmin):
    list_display = ('case_id', 'transaction', 'risk_score', 'risk_tier', 'status', 'created_at')
    list_filter = ('status', 'risk_tier')
    search_fields = ('case_id', 'transaction__tx_id')
