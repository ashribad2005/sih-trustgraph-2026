from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from api.models import Account, Transaction, FraudCase
from django.utils import timezone

class FraudCaseTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        response = self.client.post(reverse('token_obtain_pair'), {'username': 'testuser', 'password': 'testpassword'})
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + self.token)
        
        self.sender = Account.objects.create(account_id="ACC_001")
        self.receiver = Account.objects.create(account_id="ACC_002")
        self.txn1 = Transaction.objects.create(
            tx_id="TXN_001", sender=self.sender, receiver=self.receiver, amount=9000.00,
            timestamp=timezone.now(), device_id="D1", ip_address="1.1.1.1", channel="UPI", status="SIMULATED_HOLD"
        )
        self.case1 = FraudCase.objects.create(
            case_id="TG-2026-00001", transaction=self.txn1, risk_score=93, risk_tier="CRITICAL", status="OPEN"
        )
        self.txn2 = Transaction.objects.create(
            tx_id="TXN_002", sender=self.sender, receiver=self.receiver, amount=8500.00,
            timestamp=timezone.now(), device_id="D2", ip_address="1.1.1.2", channel="UPI", status="SIMULATED_HOLD"
        )
        self.case2 = FraudCase.objects.create(
            case_id="TG-2026-00002", transaction=self.txn2, risk_score=85, risk_tier="HIGH", status="OPEN"
        )

    def test_case_list_ordering(self):
        url = reverse('fraudcase-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should be ordered by risk_score DESC
        results = response.data['results']
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]['case_id'], "TG-2026-00001")
        self.assertEqual(results[1]['case_id'], "TG-2026-00002")
        # graph payload should be excluded in list
        self.assertNotIn('graph_payload', results[0])

    def test_case_detail(self):
        url = reverse('fraudcase-detail', args=[self.case1.case_id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['case_id'], "TG-2026-00001")
        self.assertIn('graph_payload', response.data)

    def test_investigator_action(self):
        url = reverse('fraudcase-investigator-action', args=[self.case1.case_id])
        
        # Action: DISMISS
        response = self.client.post(url, {"action": "DISMISS"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.case1.refresh_from_db()
        self.assertEqual(self.case1.status, FraudCase.StatusChoices.DISMISSED)

        # Action: CONFIRM_FRAUD
        response = self.client.post(url, {"action": "CONFIRM_FRAUD"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.case1.refresh_from_db()
        self.assertEqual(self.case1.status, FraudCase.StatusChoices.RESOLVED)

        # Action: HOLD
        response = self.client.post(url, {"action": "HOLD"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.case1.refresh_from_db()
        self.assertEqual(self.case1.status, FraudCase.StatusChoices.UNDER_REVIEW)

    def test_invalid_action(self):
        url = reverse('fraudcase-investigator-action', args=[self.case1.case_id])
        response = self.client.post(url, {"action": "INVALID"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_integrity_verify(self):
        url = reverse('fraudcase-verify-integrity', args=[self.case1.case_id])
        # Manually set a valid hash
        from api.services.evidence_service import EvidenceService
        evidence_dict = {
            "case_id": self.case1.case_id,
            "tx_id": self.case1.transaction.tx_id,
            "sender": self.sender.account_id,
            "receiver": self.receiver.account_id,
            "amount": f"{float(self.txn1.amount):.2f}",
            "risk_score": self.case1.risk_score,
            "rules": self.case1.triggered_rules,
        }
        valid_hash = EvidenceService.generate_evidence_hash(evidence_dict)
        self.case1.evidence_hash = valid_hash
        self.case1.save()

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_tampered'])

        # Tamper the case
        self.case1.risk_score = 99
        self.case1.save()
        response = self.client.get(url)
        self.assertTrue(response.data['is_tampered'])
