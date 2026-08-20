/**
 * TRUSTGRAPH — useDashboardMetrics Hook
 *
 * Fetches dashboard KPI metrics from the Django backend.
 * Falls back to hardcoded demo values when the backend is unavailable.
 */

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/api';

export interface DashboardMetricsData {
  total_monitored_volume: number;
  total_screened_transactions: number;
  active_alerts_count: number;
  protected_value: number;
  blockchain_anchored_count: number;
}

const MOCK_METRICS: DashboardMetricsData = {
  total_monitored_volume: 247_500_000,
  total_screened_transactions: 51_290,
  active_alerts_count: 42,
  protected_value: 12_350_000,
  blockchain_anchored_count: 38,
};

interface UseDashboardMetricsReturn {
  metrics: DashboardMetricsData;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isUsingMockData: boolean;
}

export function useDashboardMetrics(): UseDashboardMetricsReturn {
  const [metrics, setMetrics] = useState<DashboardMetricsData>(MOCK_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await dashboardApi.getMetrics();
      setMetrics({
        total_monitored_volume: data.total_monitored_volume ?? 0,
        total_screened_transactions: (data as any).total_screened_transactions ?? 0,
        active_alerts_count: (data as any).active_alerts_count ?? 0,
        protected_value: (data as any).protected_value ?? 0,
        blockchain_anchored_count: (data as any).blockchain_anchored_count ?? 0,
      });
      setIsUsingMockData(false);
    } catch (err: any) {
      console.warn('[useDashboardMetrics] Backend unavailable, using mock metrics');
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
