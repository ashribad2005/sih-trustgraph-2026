/**
 * TRUSTGRAPH — useCases Hook
 *
 * Fetches fraud cases from the Django backend and maps them to the
 * Alert type for the LiveAlertStream component, with automatic fallback
 * to mock data when the backend is unavailable.
 */

import { useState, useEffect, useCallback } from 'react';
import { casesApi } from '../services/api';
import { mockAlerts } from '../data/mockData';
import type { Alert, Case } from '../types/case';

interface UseCasesReturn {
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  getCaseById: (caseId: string) => Promise<Case | null>;
  isUsingMockData: boolean;
}

/**
 * Maps a backend FraudCase response to the frontend Alert type.
 * The backend returns FraudCaseListSerializer format (without graph_payload).
 */
function caseToAlert(caseData: any): Alert {
  const tx = caseData.transaction ?? {};
  return {
    alert_id: caseData.case_id,
    tx_id: tx.tx_id ?? caseData.case_id,
    case_id: caseData.case_id,
    timestamp: caseData.created_at ?? new Date().toISOString(),
    sender_account_id: tx.sender ?? '',
    receiver_account_id: tx.receiver ?? '',
    amount: parseFloat(tx.amount ?? '0'),
    currency: 'INR',
    composite_risk_score: caseData.risk_score ?? 0,
    risk_tier: caseData.risk_tier === 'CRITICAL' ? 'CRITICAL'
             : caseData.risk_tier === 'HIGH' ? 'CRITICAL'
             : caseData.risk_tier === 'MEDIUM' ? 'ELEVATED'
             : 'NORMAL',
    status: caseData.status === 'OPEN' ? 'SIMULATED_HOLD'
          : caseData.status === 'UNDER_REVIEW' ? 'SIMULATED_HOLD'
          : caseData.status === 'RESOLVED' ? 'CONFIRMED_FRAUD'
          : caseData.status === 'DISMISSED' ? 'CLEARED'
          : 'MONITORING',
    recommended_action: caseData.risk_score >= 90
      ? 'SIMULATED_HOLD_AND_INVESTIGATE'
      : caseData.risk_score >= 75
        ? 'FLAG_FOR_REVIEW'
        : 'NO_ACTION',
  };
}

export function useCases(): UseCasesReturn {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await casesApi.listCases();
      const mappedAlerts = response.results.map(caseToAlert);
      setAlerts(mappedAlerts);
      setIsUsingMockData(false);
    } catch (err: any) {
      console.warn('[useCases] Backend unavailable, falling back to mock data:', err?.message);
      setAlerts(mockAlerts);
      setIsUsingMockData(true);
      // Don't set error — graceful degradation to mock data
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCaseById = useCallback(async (caseId: string): Promise<Case | null> => {
    try {
      const caseData = await casesApi.getCaseDetails(caseId);
      return caseData;
    } catch (err) {
      console.warn(`[useCases] Failed to fetch case ${caseId}:`, err);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return { alerts, isLoading, error, refetch: fetchCases, getCaseById, isUsingMockData };
}
