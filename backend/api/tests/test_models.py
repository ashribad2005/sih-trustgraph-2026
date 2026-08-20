from django.test import TestCase
from api.models import Account, Transaction, FraudCase
from django.utils import timezone

class ModelTests(TestCase):
    def setUp(self):
        self.sender = Account.objects.create(account_id="ACC_001")
        self.receiver = Account.objects.create(account_id="ACC_002")

    def test_account_creation(self):
        self.assertEqual(self.sender.reputation_score, 100)
        self.assertIsNotNone(self.sender.created_at)

    def test_transaction_creation(self):
        txn = Transaction.objects.create(
            tx_id="TXN_001",
            sender=self.sender,
            receiver=self.receiver,
            amount=500.00,
            timestamp=timezone.now(),
            device_id="DEV_001",
            ip_address="192.168.1.1",
            channel="UPI"
        )
        self.assertEqual(txn.status, Transaction.StatusChoices.ALLOWED)

    def test_fraudcase_creation(self):
        txn = Transaction.objects.create(
            tx_id="TXN_002",
            sender=self.sender,
            receiver=self.receiver,
            amount=5000.00,
            timestamp=timezone.now(),
            device_id="DEV_002",
            ip_address="192.168.1.2",
            channel="UPI"
        )
        case_id = FraudCase.generate_case_id()
        case = FraudCase.objects.create(
            case_id=case_id,
            transaction=txn,
            risk_score=95,
            risk_tier=FraudCase.RiskTierChoices.CRITICAL
        )
        self.assertTrue(case.case_id.startswith('TG-'))
        self.assertEqual(case.status, FraudCase.StatusChoices.OPEN)
        self.assertEqual(case.risk_score, 95)
