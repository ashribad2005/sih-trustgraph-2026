/**
 * TRUSTGRAPH – Mock Data
 *
 * Realistic mock data that mirrors the exact shapes provided by the backend,
 * AI engine, graph member, and blockchain member.
 *
 * Replace these with real API calls in src/services/api.ts once the backend
 * API contract is delivered by Member 3.
 */

import type { DashboardMetrics, Alert, Case } from '../types/case';

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export const mockMetrics: DashboardMetrics = {
  total_monitored_volume_inr: 48_200_000,   // ₹4.82 Cr
  total_screened_transactions: 12_842,
  active_high_risk_cases: 37,
  network_interception_rate: 94.2,
};

// ─── Live Alerts ──────────────────────────────────────────────────────────────

export const mockAlerts: Alert[] = [
  {
    alert_id: 'ALT_001',
    tx_id: 'TXN_99182746',
    case_id: 'TG-2026-00142',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    sender_account_id: 'ACC_109283',
    receiver_account_id: 'ACC_882910',
    amount: 9500,
    currency: 'INR',
    composite_risk_score: 93,
    risk_tier: 'CRITICAL',
    status: 'SIMULATED_HOLD',
    recommended_action: 'SIMULATED_HOLD_AND_INVESTIGATE',
  },
  {
    alert_id: 'ALT_002',
    tx_id: 'TXN_99182745',
    case_id: 'TG-2026-00141',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sender_account_id: 'ACC_774421',
    receiver_account_id: 'ACC_334092',
    amount: 2400,
    currency: 'INR',
    composite_risk_score: 62,
    risk_tier: 'ELEVATED',
    status: 'MONITORING',
    recommended_action: 'FLAG_FOR_REVIEW',
  },
  {
    alert_id: 'ALT_003',
    tx_id: 'TXN_99182744',
    case_id: 'TG-2026-00140',
    timestamp: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    sender_account_id: 'ACC_551190',
    receiver_account_id: 'ACC_228847',
    amount: 800,
    currency: 'INR',
    composite_risk_score: 18,
    risk_tier: 'NORMAL',
    status: 'MONITORING',
    recommended_action: 'NO_ACTION',
  },
  {
    alert_id: 'ALT_004',
    tx_id: 'TXN_99182743',
    case_id: 'TG-2026-00139',
    timestamp: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
    sender_account_id: 'ACC_667810',
    receiver_account_id: 'ACC_991274',
    amount: 74800,
    currency: 'INR',
    composite_risk_score: 88,
    risk_tier: 'CRITICAL',
    status: 'SIMULATED_HOLD',
    recommended_action: 'SIMULATED_HOLD_AND_INVESTIGATE',
  },
  {
    alert_id: 'ALT_005',
    tx_id: 'TXN_99182742',
    case_id: 'TG-2026-00138',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    sender_account_id: 'ACC_448821',
    receiver_account_id: 'ACC_115570',
    amount: 15000,
    currency: 'INR',
    composite_risk_score: 54,
    risk_tier: 'ELEVATED',
    status: 'MONITORING',
    recommended_action: 'FLAG_FOR_REVIEW',
  },
  {
    alert_id: 'ALT_006',
    tx_id: 'TXN_99182741',
    case_id: 'TG-2026-00137',
    timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    sender_account_id: 'ACC_881122',
    receiver_account_id: 'ACC_332200',
    amount: 1250,
    currency: 'INR',
    composite_risk_score: 9,
    risk_tier: 'NORMAL',
    status: 'MONITORING',
    recommended_action: 'NO_ACTION',
  },
  {
    alert_id: 'ALT_007',
    tx_id: 'TXN_99182740',
    case_id: 'TG-2026-00136',
    timestamp: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
    sender_account_id: 'ACC_770019',
    receiver_account_id: 'ACC_441188',
    amount: 50000,
    currency: 'INR',
    composite_risk_score: 97,
    risk_tier: 'CRITICAL',
    status: 'SIMULATED_HOLD',
    recommended_action: 'SIMULATED_HOLD_AND_INVESTIGATE',
  },
];

// ─── Case Detail ──────────────────────────────────────────────────────────────

export const mockCases: Record<string, Case> = {
  'TG-2026-00142': {
    case_id: 'TG-2026-00142',
    tx_id: 'TXN_99182746',
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    status: 'UNDER_INVESTIGATION',
    assigned_to: 'Investigator SOC-L2',
    transaction: {
      tx_id: 'TXN_99182746',
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      sender_account_id: 'ACC_109283',
      receiver_account_id: 'ACC_882910',
      amount: 9500,
      currency: 'INR',
      composite_risk_score: 93,
      risk_tier: 'CRITICAL',
      status: 'SIMULATED_HOLD',
    },
    fraud_analysis: {
      tx_id: 'TXN_99182746',
      composite_risk_score: 93,
      risk_tier: 'CRITICAL',
      rule_violations: ['HIGH_VELOCITY_BURST', 'MULE_FAN_IN_ANOMALY'],
      ml_anomaly_score: 0.89,
      graph_metrics: {
        in_degree_centrality: 0.82,
        community_cluster_id: 'CLUSTER_MULE_04',
        shared_device_count: 5,
      },
      ai_explanations: [
        '12 rapid incoming transfers from unlinked accounts within 8 minutes.',
        'Receiver shares Device ID with 4 previously flagged entities.',
        'Immediate fund forwarding ratio exceeds 94%.',
      ],
      recommended_action: 'SIMULATED_HOLD_AND_INVESTIGATE',
    },
    graph_data: {
      nodes: [
        { id: 'ACC_109283', label: 'Sender', type: 'account', status: 'flagged' },
        { id: 'ACC_882910', label: 'Mule Aggregator', type: 'account', status: 'critical' },
        { id: 'DEV_F892B1', label: 'Device #F892', type: 'device', status: 'suspicious' },
        { id: 'ACC_331001', label: 'Linked Account 1', type: 'account', status: 'suspicious' },
        { id: 'ACC_331002', label: 'Linked Account 2', type: 'account', status: 'suspicious' },
      ],
      edges: [
        { source: 'ACC_109283', target: 'ACC_882910', label: '₹9,500', type: 'TRANSFER' },
        { source: 'ACC_882910', target: 'DEV_F892B1', label: 'USES', type: 'SHARED_DEVICE' },
        { source: 'ACC_331001', target: 'ACC_882910', label: '₹4,200', type: 'TRANSFER' },
        { source: 'ACC_331002', target: 'ACC_882910', label: '₹6,800', type: 'TRANSFER' },
        { source: 'ACC_331001', target: 'DEV_F892B1', label: 'USES', type: 'SHARED_DEVICE' },
      ],
    },
    blockchain_snapshot: {
      case_id: 'TG-2026-00142',
      tx_id: 'TXN_99182746',
      risk_score: 93,
      flagged_timestamp: Math.floor(Date.now() / 1000) - 120,
      evidence_fingerprint:
        'a3f8c1d27b4e9f0612a5c8d3e6f9b2a7d4e1f8c3b6a9d2e5f8c1b4a7d0e3f6c9',
      // on_chain_tx_url: provided by backend when available
    },
  },

  'TG-2026-00141': {
    case_id: 'TG-2026-00141',
    tx_id: 'TXN_99182745',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    status: 'OPEN',
    assigned_to: undefined,
    transaction: {
      tx_id: 'TXN_99182745',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      sender_account_id: 'ACC_774421',
      receiver_account_id: 'ACC_334092',
      amount: 2400,
      currency: 'INR',
      composite_risk_score: 62,
      risk_tier: 'ELEVATED',
      status: 'MONITORING',
    },
    fraud_analysis: {
      tx_id: 'TXN_99182745',
      composite_risk_score: 62,
      risk_tier: 'ELEVATED',
      rule_violations: ['UNUSUAL_HOUR_ACTIVITY', 'CROSS_REGION_TRANSFER'],
      ml_anomaly_score: 0.61,
      graph_metrics: {
        in_degree_centrality: 0.44,
        community_cluster_id: 'CLUSTER_CROSS_07',
        shared_device_count: 1,
      },
      ai_explanations: [
        'Transaction originated at 02:47 AM, outside the account\'s typical activity window.',
        'Destination account registered in a different state with no prior relationship.',
        'Velocity pattern shows 3 similar transfers in the last 60 minutes.',
      ],
      recommended_action: 'FLAG_FOR_REVIEW',
    },
    graph_data: {
      nodes: [
        { id: 'ACC_774421', label: 'Sender', type: 'account', status: 'flagged' },
        { id: 'ACC_334092', label: 'Receiver', type: 'account', status: 'suspicious' },
        { id: 'IP_192168', label: 'IP 192.168.x', type: 'ip', status: 'suspicious' },
      ],
      edges: [
        { source: 'ACC_774421', target: 'ACC_334092', label: '₹2,400', type: 'TRANSFER' },
        { source: 'ACC_774421', target: 'IP_192168', label: 'CONNECTED', type: 'SHARED_IP' },
      ],
    },
    blockchain_snapshot: {
      case_id: 'TG-2026-00141',
      tx_id: 'TXN_99182745',
      risk_score: 62,
      flagged_timestamp: Math.floor(Date.now() / 1000) - 300,
      evidence_fingerprint:
        'b5e7d2f9a0c3e6b1d4a7f0c3e6b9d2f5a8e1c4b7d0a3f6c9e2b5d8a1f4c7e0b3',
    },
  },

  'TG-2026-00139': {
    case_id: 'TG-2026-00139',
    tx_id: 'TXN_99182743',
    created_at: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: 'UNDER_INVESTIGATION',
    assigned_to: 'Investigator SOC-L2',
    transaction: {
      tx_id: 'TXN_99182743',
      timestamp: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
      sender_account_id: 'ACC_667810',
      receiver_account_id: 'ACC_991274',
      amount: 74800,
      currency: 'INR',
      composite_risk_score: 88,
      risk_tier: 'CRITICAL',
      status: 'SIMULATED_HOLD',
    },
    fraud_analysis: {
      tx_id: 'TXN_99182743',
      composite_risk_score: 88,
      risk_tier: 'CRITICAL',
      rule_violations: ['LARGE_ROUND_AMOUNT', 'LAYERING_PATTERN', 'MULE_FAN_IN_ANOMALY'],
      ml_anomaly_score: 0.87,
      graph_metrics: {
        in_degree_centrality: 0.76,
        community_cluster_id: 'CLUSTER_LAYER_02',
        shared_device_count: 3,
      },
      ai_explanations: [
        'Large round-number transaction (₹74,800) inconsistent with account history.',
        'Receiver account shows layering pattern: 6 immediate onward transfers detected.',
        'Shared device fingerprint matches 3 previously blocked accounts.',
      ],
      recommended_action: 'SIMULATED_HOLD_AND_INVESTIGATE',
    },
    graph_data: {
      nodes: [
        { id: 'ACC_667810', label: 'Sender', type: 'account', status: 'flagged' },
        { id: 'ACC_991274', label: 'Layering Node', type: 'account', status: 'critical' },
        { id: 'DEV_A112C3', label: 'Device #A112', type: 'device', status: 'suspicious' },
        { id: 'ACC_445500', label: 'Layer 2 Account', type: 'account', status: 'suspicious' },
        { id: 'ACC_778899', label: 'Layer 2 Account', type: 'account', status: 'suspicious' },
        { id: 'ACC_221133', label: 'Exit Account', type: 'account', status: 'critical' },
      ],
      edges: [
        { source: 'ACC_667810', target: 'ACC_991274', label: '₹74,800', type: 'TRANSFER' },
        { source: 'ACC_991274', target: 'DEV_A112C3', label: 'USES', type: 'SHARED_DEVICE' },
        { source: 'ACC_991274', target: 'ACC_445500', label: '₹24,000', type: 'TRANSFER' },
        { source: 'ACC_991274', target: 'ACC_778899', label: '₹25,000', type: 'TRANSFER' },
        { source: 'ACC_445500', target: 'ACC_221133', label: '₹23,500', type: 'TRANSFER' },
        { source: 'ACC_778899', target: 'ACC_221133', label: '₹24,700', type: 'TRANSFER' },
      ],
    },
    blockchain_snapshot: {
      case_id: 'TG-2026-00139',
      tx_id: 'TXN_99182743',
      risk_score: 88,
      flagged_timestamp: Math.floor(Date.now() / 1000) - 780,
      evidence_fingerprint:
        'c7e9f1a3b5d7e9f1a3b5d7e9f1a3b5d7e9f1a3b5d7e9f1a3b5d7e9f1a3b5d7e9',
    },
  },

  'TG-2026-00136': {
    case_id: 'TG-2026-00136',
    tx_id: 'TXN_99182740',
    created_at: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    status: 'UNDER_INVESTIGATION',
    assigned_to: 'Investigator SOC-L3',
    transaction: {
      tx_id: 'TXN_99182740',
      timestamp: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
      sender_account_id: 'ACC_770019',
      receiver_account_id: 'ACC_441188',
      amount: 50000,
      currency: 'INR',
      composite_risk_score: 97,
      risk_tier: 'CRITICAL',
      status: 'SIMULATED_HOLD',
    },
    fraud_analysis: {
      tx_id: 'TXN_99182740',
      composite_risk_score: 97,
      risk_tier: 'CRITICAL',
      rule_violations: ['ACCOUNT_TAKEOVER_SIGNAL', 'DEVICE_SWAP_ANOMALY', 'HIGH_VELOCITY_BURST', 'MULE_FAN_IN_ANOMALY'],
      ml_anomaly_score: 0.97,
      graph_metrics: {
        in_degree_centrality: 0.94,
        community_cluster_id: 'CLUSTER_ATO_01',
        shared_device_count: 8,
      },
      ai_explanations: [
        'Login from a new device 4 minutes before transaction; device never seen in last 180 days.',
        'OTP verification bypassed via SIM swap indicator (telecom metadata).',
        'Destination account created 6 hours ago with no prior transaction history.',
        'Transaction amount equals 98.3% of account balance — classic drain pattern.',
      ],
      recommended_action: 'SIMULATED_HOLD_AND_INVESTIGATE',
    },
    graph_data: {
      nodes: [
        { id: 'ACC_770019', label: 'Victim Account', type: 'account', status: 'flagged' },
        { id: 'ACC_441188', label: 'ATO Drain Target', type: 'account', status: 'critical' },
        { id: 'DEV_NEW_X9', label: 'New Device', type: 'device', status: 'critical' },
        { id: 'DEV_OLD_77', label: 'Registered Device', type: 'device', status: 'normal' },
      ],
      edges: [
        { source: 'ACC_770019', target: 'ACC_441188', label: '₹50,000', type: 'TRANSFER' },
        { source: 'ACC_770019', target: 'DEV_NEW_X9', label: 'NEW LOGIN', type: 'SHARED_DEVICE' },
        { source: 'ACC_770019', target: 'DEV_OLD_77', label: 'REGISTERED', type: 'SHARED_DEVICE' },
      ],
    },
    blockchain_snapshot: {
      case_id: 'TG-2026-00136',
      tx_id: 'TXN_99182740',
      risk_score: 97,
      flagged_timestamp: Math.floor(Date.now() / 1000) - 1620,
      evidence_fingerprint:
        'd9f2b4e6a8c0d2f4b6e8a0c2d4f6b8e0a2c4d6f8b0e2a4c6d8f0b2e4a6c8d0f2',
    },
  },

  'TG-2026-00138': {
    case_id: 'TG-2026-00138',
    tx_id: 'TXN_99182742',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    status: 'OPEN',
    assigned_to: undefined,
    transaction: {
      tx_id: 'TXN_99182742',
      timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      sender_account_id: 'ACC_448821',
      receiver_account_id: 'ACC_115570',
      amount: 15000,
      currency: 'INR',
      composite_risk_score: 54,
      risk_tier: 'ELEVATED',
      status: 'MONITORING',
    },
    fraud_analysis: {
      tx_id: 'TXN_99182742',
      composite_risk_score: 54,
      risk_tier: 'ELEVATED',
      rule_violations: ['VELOCITY_SPIKE'],
      ml_anomaly_score: 0.52,
      graph_metrics: {
        in_degree_centrality: 0.2,
        community_cluster_id: 'CLUSTER_NONE',
        shared_device_count: 0,
      },
      ai_explanations: [
        'Transaction amount is 3x higher than average for this account.',
        'Slight velocity spike detected in the last 24h.',
      ],
      recommended_action: 'FLAG_FOR_REVIEW',
    },
    graph_data: {
      nodes: [
        { id: 'ACC_448821', label: 'Sender', type: 'account', status: 'suspicious' },
        { id: 'ACC_115570', label: 'Receiver', type: 'account', status: 'normal' },
      ],
      edges: [
        { source: 'ACC_448821', target: 'ACC_115570', label: '₹15,000', type: 'TRANSFER' },
      ],
    },
    blockchain_snapshot: {
      case_id: 'TG-2026-00138',
      tx_id: 'TXN_99182742',
      risk_score: 54,
      flagged_timestamp: Math.floor(Date.now() / 1000) - 1000,
      evidence_fingerprint: 'a1b2c3d4e5f6',
    },
  },

  'TG-2026-00140': {
    case_id: 'TG-2026-00140',
    tx_id: 'TXN_99182744',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    status: 'OPEN',
    assigned_to: undefined,
    transaction: {
      tx_id: 'TXN_99182744',
      timestamp: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
      sender_account_id: 'ACC_551190',
      receiver_account_id: 'ACC_228847',
      amount: 800,
      currency: 'INR',
      composite_risk_score: 18,
      risk_tier: 'NORMAL',
      status: 'MONITORING',
    },
    fraud_analysis: {
      tx_id: 'TXN_99182744',
      composite_risk_score: 18,
      risk_tier: 'NORMAL',
      rule_violations: [],
      ml_anomaly_score: 0.12,
      graph_metrics: {
        in_degree_centrality: 0.05,
        community_cluster_id: 'CLUSTER_NONE',
        shared_device_count: 0,
      },
      ai_explanations: [
        'Standard transaction behavior matching historical baseline.',
        'No known flagged connections in network.',
      ],
      recommended_action: 'NO_ACTION',
    },
    graph_data: {
      nodes: [
        { id: 'ACC_551190', label: 'Sender', type: 'account', status: 'normal' },
        { id: 'ACC_228847', label: 'Receiver', type: 'account', status: 'normal' },
      ],
      edges: [
        { source: 'ACC_551190', target: 'ACC_228847', label: '₹800', type: 'TRANSFER' },
      ],
    },
    blockchain_snapshot: {
      case_id: 'TG-2026-00140',
      tx_id: 'TXN_99182744',
      risk_score: 18,
      flagged_timestamp: Math.floor(Date.now() / 1000) - 2000,
      evidence_fingerprint: 'f6e5d4c3b2a1',
    },
  },
};

// Helper to get a case by case_id from an alert
export function getMockCaseForAlert(alert: Alert): Case | null {
  return mockCases[alert.case_id] ?? null;
}
