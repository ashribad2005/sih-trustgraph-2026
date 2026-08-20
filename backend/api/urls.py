from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    TransactionIngestView,
    FraudCaseViewSet,
    DashboardMetricsView
)

router = DefaultRouter()
router.register(r'cases', FraudCaseViewSet, basename='fraudcase')

urlpatterns = [
    # Auth
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Transaction ingestion
    path('transactions/ingest/', TransactionIngestView.as_view(), name='transaction_ingest'),

    # Dashboard
    path('dashboard/metrics/', DashboardMetricsView.as_view(), name='dashboard_metrics'),

    # Cases (ViewSet routes: list, retrieve, action, verify-integrity, graph)
    path('', include(router.urls)),
]
