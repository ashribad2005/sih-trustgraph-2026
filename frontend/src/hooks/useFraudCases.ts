import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

export interface FraudCase {
  case_id: string;
  tx_id: string;
  risk_score: number;
  risk_tier: string;
  status: string;
  audit_hash: string;
  graph_payload: {
    elements: any[];
  };
  created_at: string;
}

export function useFraudCases() {
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/cases/');
      // Django DRF typically wraps paginated results in a `results` array
      setCases(Array.isArray(data) ? data : data.results || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch fraud cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return { cases, loading, error, refetch: fetchCases };
}
