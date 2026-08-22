import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/api';
import type { DashboardMetrics } from '../types/case';

const EMPTY_METRICS: DashboardMetrics = {
  total_monitored_volume_inr: 0,
  total_screened_transactions: 0,
  active_high_risk_cases: 0,
  network_interception_rate: 0,
  active_fraud_clusters: 0,
  accounts_under_watch: 0,
  shared_devices: 0,
  high_centrality_entities: 0,
  largest_cluster: 'NO_ACTIVE_CLUSTERS',
};

interface UseDashboardMetricsReturn {
  metrics: DashboardMetrics;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isUsingMockData: boolean;
}

export function useDashboardMetrics(): UseDashboardMetricsReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await dashboardApi.getMetrics();
      setMetrics({
        total_monitored_volume_inr: data.total_monitored_volume_inr ?? 0,
        total_screened_transactions: data.total_screened_transactions ?? 0,
        active_high_risk_cases: data.active_high_risk_cases ?? 0,
        network_interception_rate: data.network_interception_rate ?? 0,
        active_fraud_clusters: data.active_fraud_clusters ?? 0,
        accounts_under_watch: data.accounts_under_watch ?? 0,
        shared_devices: data.shared_devices ?? 0,
        high_centrality_entities: data.high_centrality_entities ?? 0,
        largest_cluster: data.largest_cluster ?? 'NO_ACTIVE_CLUSTERS',
        blockchain_mode: data.blockchain_mode ?? 'MOCK',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load dashboard metrics';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const refreshTimer = window.setInterval(fetchMetrics, 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchMetrics]);

  return {
    metrics,
    isLoading,
    error,
    refetch: fetchMetrics,
    isUsingMockData: false,
  };
}
