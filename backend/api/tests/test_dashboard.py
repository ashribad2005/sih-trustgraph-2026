from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from api.models import Account, Transaction, FraudCase
from django.utils import timezone

class DashboardTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        response = self.client.post(reverse('token_obtain_pair'), {'username': 'testuser', 'password': 'testpassword'})
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + self.token)
        self.url = reverse('dashboard_metrics')

        self.sender = Account.objects.create(account_id="ACC_001")
        self.receiver = Account.objects.create(account_id="ACC_002")
        
        # Valid trans
        self.txn1 = Transaction.objects.create(
            tx_id="TXN_001", sender=self.sender, receiver=self.receiver, amount=1000.00,
            timestamp=timezone.now(), device_id="D1", ip_address="1.1.1.1", channel="UPI", status="ALLOWED"
        )
        
        # High risk trans (active case)
        self.txn2 = Transaction.objects.create(
            tx_id="TXN_002", sender=self.sender, receiver=self.receiver, amount=5000.00,
            timestamp=timezone.now(), device_id="D2", ip_address="1.1.1.2", channel="UPI", status="SIMULATED_HOLD"
        )
        self.case1 = FraudCase.objects.create(
            case_id="TG-2026-00001", transaction=self.txn2, risk_score=93, risk_tier="CRITICAL", status="OPEN"
        )
        
        # High risk trans (resolved case - shouldn't count towards active)
        self.txn3 = Transaction.objects.create(
            tx_id="TXN_003", sender=self.sender, receiver=self.receiver, amount=2000.00,
            timestamp=timezone.now(), device_id="D3", ip_address="1.1.1.3", channel="UPI", status="FLAGGED"
        )
        self.case2 = FraudCase.objects.create(
            case_id="TG-2026-00002", transaction=self.txn3, risk_score=85, risk_tier="HIGH", status="RESOLVED"
        )

    def test_dashboard_metrics(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.data
        self.assertEqual(data['total_monitored_volume'], 8000.00) # 1000 + 5000 + 2000
        self.assertEqual(data['active_alerts_count'], 1) # Only case1 is OPEN
        self.assertEqual(data['protected_value'], 5000.00) # amount for case1
