/**
 * TRUSTGRAPH — useDashboardMetrics Hook
 *
 * Fetches dashboard KPI metrics from the Django backend.
 * Falls back to hardcoded demo values when the backend is unavailable.
 */

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/api';
import type { DashboardMetrics } from '../types/case';

const MOCK_METRICS: DashboardMetrics = {
  total_monitored_volume_inr: 247_500_000,
  total_screened_transactions: 51_290,
  active_high_risk_cases: 42,
  network_interception_rate: 94.2,
};

interface UseDashboardMetricsReturn {
  metrics: DashboardMetrics;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isUsingMockData: boolean;
}

export function useDashboardMetrics(): UseDashboardMetricsReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics>(MOCK_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

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
      });
      setIsUsingMockData(false);
    } catch (err: unknown) {
      console.warn('[useDashboardMetrics] Backend unavailable, using mock metrics', err);
      setMetrics(MOCK_METRICS);
      setIsUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, isLoading, error, refetch: fetchMetrics, isUsingMockData };
}
