from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User

class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.token_url = reverse('token_obtain_pair')

    def test_jwt_token_generation(self):
        response = self.client.post(self.token_url, {'username': 'testuser', 'password': 'testpassword'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_unauthorized_request_rejected(self):
        # Trying to access protected endpoint without token
        response = self.client.get(reverse('dashboard_metrics'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authorized_request_accepted(self):
        response = self.client.post(self.token_url, {'username': 'testuser', 'password': 'testpassword'})
        token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        response = self.client.get(reverse('dashboard_metrics'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
