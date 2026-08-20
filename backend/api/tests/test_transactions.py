from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from api.models import Transaction, FraudCase

class TransactionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        response = self.client.post(reverse('token_obtain_pair'), {'username': 'testuser', 'password': 'testpassword'})
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + self.token)
        self.ingest_url = reverse('transaction_ingest')

    def test_valid_transaction(self):
        data = {
            "tx_id": "TXN_VALID_001",
            "timestamp": "2026-08-16T14:32:00Z",
            "sender_account": "ACC_001",
            "receiver_account": "ACC_002",
            "amount": 1000.00,
            "channel": "UPI",
            "device_id": "DEV_001",
            "ip_address": "103.21.144.12",
            "location": "Bhubaneswar, IN"
        }
        response = self.client.post(self.ingest_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['results']), 1)
        # Mock mode gives < 80 for amount <= 5000
        self.assertEqual(response.data['results'][0]['risk_score'], 20)
        
    def test_invalid_transaction(self):
        data = {
            "tx_id": "TXN_INV_001",
            # Missing fields
            "amount": -50.00
        }
        response = self.client.post(self.ingest_url, data, format='json')
        # We expect a 400 with our custom wrapper or straight 400 from DRF
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_transaction(self):
        data = {
            "tx_id": "TXN_DUP_001",
            "timestamp": "2026-08-16T14:32:00Z",
            "sender_account": "ACC_001",
            "receiver_account": "ACC_002",
            "amount": 1000.00,
            "channel": "UPI",
            "device_id": "DEV_001",
            "ip_address": "103.21.144.12"
        }
        self.client.post(self.ingest_url, data, format='json')
        # Post again
        response = self.client.post(self.ingest_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Transaction ID already exists.", str(response.data))

    def test_batch_ingestion(self):
        data = {
            "transactions": [
                {
                    "tx_id": "TXN_BATCH_001",
                    "timestamp": "2026-08-16T14:32:00Z",
                    "sender_account": "ACC_001",
                    "receiver_account": "ACC_002",
                    "amount": 1000.00,
                    "channel": "UPI",
                    "device_id": "DEV_001",
                    "ip_address": "103.21.144.12"
                },
                {
                    "tx_id": "TXN_BATCH_002",
                    "timestamp": "2026-08-16T14:32:00Z",
                    "sender_account": "ACC_003",
                    "receiver_account": "ACC_004",
                    "amount": 2000.00,
                    "channel": "UPI",
                    "device_id": "DEV_002",
                    "ip_address": "103.21.144.13"
                }
            ]
        }
        response = self.client.post(self.ingest_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['results']), 2)

    def test_high_risk_transaction(self):
        data = {
            "tx_id": "TXN_HIGH_001",
            "timestamp": "2026-08-16T14:32:00Z",
            "sender_account": "ACC_001",
            "receiver_account": "ACC_002",
            "amount": 9000.00, # > 5000 triggers mock high risk
            "channel": "UPI",
            "device_id": "DEV_001",
            "ip_address": "103.21.144.12"
        }
        response = self.client.post(self.ingest_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['results'][0]['risk_score'], 93)
        self.assertEqual(response.data['results'][0]['status'], 'SIMULATED_HOLD')
        self.assertIn('case_id', response.data['results'][0])
        self.assertTrue(FraudCase.objects.exists())
