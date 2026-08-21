import { useState, useEffect, useCallback } from 'react';
import { GraphData } from '../types/graph';
import { apiService } from '../services/api';

export const useGraphData = (caseId: string | number | null | undefined) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraphData = useCallback(async () => {
    if (!caseId) {
      setGraphData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getCaseGraph(caseId);
      setGraphData(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch network graph');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  return { graphData, loading, error, refetch: fetchGraphData };
};