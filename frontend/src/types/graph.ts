// ─── Graph Types ──────────────────────────────────────────────────────────────
// These types correspond to the data contract provided by the graph/AI member.

export type NodeStatus = 'normal' | 'flagged' | 'suspicious' | 'critical';
export type NodeType = 'account' | 'device' | 'ip' | 'merchant' | 'unknown';
export type EdgeType = 'TRANSFER' | 'SHARED_DEVICE' | 'SHARED_IP' | 'LINKED';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  status: NodeStatus;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  type: EdgeType;
  metadata?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphMetrics {
  in_degree_centrality: number;
  out_degree_centrality?: number;
  community_cluster_id: string;
  shared_device_count: number;
  betweenness_centrality?: number;
}
