export interface NetworkIntelligence {
  active_fraud_clusters: number;
  accounts_under_watch: number;
  shared_devices: number;
  high_centrality_entities: number;
  largest_cluster: string;
}

export const mockNetworkIntelligence: NetworkIntelligence = {
  active_fraud_clusters: 14,
  accounts_under_watch: 86,
  shared_devices: 23,
  high_centrality_entities: 11,
  largest_cluster: 'CLUSTER_MULE_04',
};
