export interface SystemStatusItem {
  id: string;
  label: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'LIVE';
}

export const mockSystemStatus: SystemStatusItem[] = [
  { id: 'backend', label: 'Backend API', status: 'ONLINE' },
  { id: 'ai', label: 'AI ENGINE', status: 'ONLINE' },
  { id: 'graph', label: 'GRAPH ENGINE', status: 'ONLINE' },
  { id: 'blockchain', label: 'BLOCKCHAIN ANCHOR', status: 'ONLINE' },
  { id: 'stream', label: 'TRANSACTION STREAM', status: 'LIVE' },
];
