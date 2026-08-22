import { useCallback, useEffect, useState } from 'react';
import type { Alert, Case } from '../types/case';
import { apiService } from '../services/api';
import type { RiskTier, TransactionStatus } from '../types/transaction';

function normalizeRiskTier(value: string | undefined, score: number): RiskTier {
  if (value === 'CRITICAL' || score >= 90) return 'CRITICAL';
  if (value === 'HIGH' || value === 'MEDIUM' || score >= 50) return 'ELEVATED';
  return 'NORMAL';
}

function normalizeStatus(value: string | undefined): TransactionStatus {
  switch (value) {
    case 'SIMULATED_HOLD':
    case 'FLAGGED':
      return 'SIMULATED_HOLD';
    case 'RESOLVED':
    case 'CONFIRMED_FRAUD':
      return 'CONFIRMED_FRAUD';
    case 'DISMISSED':
    case 'CLEARED':
      return 'CLEARED';
    case 'UNDER_REVIEW':
    case 'OPEN':
    default:
      return 'MONITORING';
  }
}

function toAlert(caseRow: Case): Alert {
  const nested = caseRow.transaction;
  const score = Number(caseRow.composite_risk_score ?? caseRow.risk_score ?? 0);
  return {
    alert_id: caseRow.alert_id ?? caseRow.case_id,
    case_id: caseRow.case_id,
    tx_id: caseRow.tx_id ?? nested?.tx_id ?? caseRow.case_id,
    timestamp: caseRow.timestamp ?? nested?.timestamp ?? caseRow.created_at ?? new Date().toISOString(),
    sender_account_id: caseRow.sender_account_id ?? nested?.sender_account_id ?? 'Unknown sender',
    receiver_account_id: caseRow.receiver_account_id ?? nested?.receiver_account_id ?? 'Unknown receiver',
    amount: Number(caseRow.amount ?? nested?.amount ?? 0),
    currency: caseRow.currency ?? nested?.currency ?? 'INR',
    composite_risk_score: score,
    risk_tier: normalizeRiskTier(caseRow.risk_tier, score),
    status: normalizeStatus(caseRow.status),
  };
}

export const useCases = () => {
  const [cases, setCases] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getCases();
      setCases((Array.isArray(data) ? data : []).map(toAlert));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    const refreshTimer = window.setInterval(fetchCases, 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchCases]);

  return { cases, loading, error, refreshCases: fetchCases };
};
