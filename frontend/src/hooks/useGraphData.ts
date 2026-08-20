/**
 * TRUSTGRAPH — useGraphData Hook
 *
 * Fetches the Cytoscape-compatible graph payload for a specific fraud case
 * from the Django backend and transforms it into the GraphData type expected
 * by the FraudGraphViewer component.
 */

import { useState, useEffect, useCallback } from 'react';
import { casesApi } from '../services/api';
import type { GraphData, GraphNode, GraphEdge } from '../types/graph';

interface UseGraphDataReturn {
  graphData: GraphData;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [] };

/**
 * Transforms the backend graph_payload into the frontend GraphData format.
 * Backend sends: { nodes: [{id, label, type, status, metadata?}], edges: [{source, target, label, type, metadata?}] }
 * Frontend expects: GraphData with GraphNode[] and GraphEdge[]
 */
function transformGraphPayload(payload: any): GraphData {
  if (!payload || typeof payload !== 'object') {
    return EMPTY_GRAPH;
  }

  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const rawEdges = Array.isArray(payload.edges) ? payload.edges : [];

  const nodes: GraphNode[] = rawNodes.map((n: any) => ({
    id: String(n.id ?? n.data?.id ?? ''),
    label: String(n.label ?? n.data?.label ?? n.id ?? ''),
    type: (n.type ?? n.data?.type ?? 'account') as GraphNode['type'],
    status: (n.status ?? n.data?.status ?? 'normal') as GraphNode['status'],
    metadata: n.metadata ?? n.data?.metadata,
  }));

  const edges: GraphEdge[] = rawEdges.map((e: any) => ({
    source: String(e.source ?? e.data?.source ?? ''),
    target: String(e.target ?? e.data?.target ?? ''),
    label: String(e.label ?? e.data?.label ?? ''),
    type: (e.type ?? e.data?.type ?? 'TRANSFER') as GraphEdge['type'],
    metadata: e.metadata ?? e.data?.metadata,
  }));

  return { nodes, edges };
}

export function useGraphData(caseId: string | null): UseGraphDataReturn {
  const [graphData, setGraphData] = useState<GraphData>(EMPTY_GRAPH);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!caseId) {
      setGraphData(EMPTY_GRAPH);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await casesApi.getCaseGraph(caseId);
      const transformed = transformGraphPayload(response.graph_data);
      setGraphData(transformed);
    } catch (err: any) {
      console.warn(`[useGraphData] Failed to fetch graph for ${caseId}:`, err);
      setError(err?.message ?? 'Failed to load graph data');
      setGraphData(EMPTY_GRAPH);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return { graphData, isLoading, error, refetch: fetchGraph };
}