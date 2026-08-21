from django.db import models
from django.utils import timezone
from django.db import transaction


class Account(models.Model):
    account_id = models.CharField(max_length=255, primary_key=True)
    alias_name = models.CharField(max_length=255, blank=True, null=True)
    reputation_score = models.IntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.account_id} ({self.reputation_score})"


class Transaction(models.Model):
    class StatusChoices(models.TextChoices):
        ALLOWED = 'ALLOWED', 'Allowed'
        SIMULATED_HOLD = 'SIMULATED_HOLD', 'Simulated Hold'
        FLAGGED = 'FLAGGED', 'Flagged'

    tx_id = models.CharField(max_length=255, primary_key=True)
    sender = models.ForeignKey(Account, related_name='sent_transactions', on_delete=models.CASCADE)
    receiver = models.ForeignKey(Account, related_name='received_transactions', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    timestamp = models.DateTimeField()
    device_id = models.CharField(max_length=255, blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    channel = models.CharField(max_length=50, blank=True, default='UPI')
    status = models.CharField(
        max_length=50,
        choices=StatusChoices.choices,
        default=StatusChoices.ALLOWED
    )

    def __str__(self):
        return f"{self.tx_id}: {self.amount} ({self.status})"


class FraudCase(models.Model):
    class RiskTierChoices(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    class StatusChoices(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        RESOLVED = 'RESOLVED', 'Resolved'
        DISMISSED = 'DISMISSED', 'Dismissed'

    case_id = models.CharField(max_length=50, primary_key=True)
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='fraud_cases')
    risk_score = models.IntegerField()
    risk_tier = models.CharField(max_length=20, choices=RiskTierChoices.choices)
    triggered_rules = models.JSONField(default=list)
    ai_explanations = models.JSONField(default=list)
    graph_payload = models.JSONField(default=dict)
    evidence_hash = models.CharField(max_length=64, blank=True, null=True)
    blockchain_tx_hash = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.case_id} - Risk: {self.risk_score} ({self.status})"

    @classmethod
    def generate_case_id(cls):
        year = timezone.now().year
        prefix = f"TG-{year}-"
        
        with transaction.atomic():
            # Lock the table/rows conceptually. 
            # We select the highest case_id for the current year.
            last_case = cls.objects.filter(case_id__startswith=prefix).select_for_update().order_by('-case_id').first()
            if last_case:
                # Extract the NNNNN part
                last_number = int(last_case.case_id.split('-')[-1])
                new_number = last_number + 1
            else:
                new_number = 1
                
            return f"{prefix}{new_number:05d}"
