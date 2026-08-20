// ─── Case / Alert Types ───────────────────────────────────────────────────────

import type { RiskTier, TransactionStatus } from './transaction';
import type { GraphData, GraphMetrics } from './graph';

// ── AI / ML Analysis ──────────────────────────────────────────────────────────

export type RecommendedAction =
  | 'SIMULATED_HOLD_AND_INVESTIGATE'
  | 'RELEASE_HOLD'
  | 'CONFIRM_FRAUD_AND_BLOCK'
  | 'FLAG_FOR_REVIEW'
  | 'NO_ACTION';

export interface FraudAnalysis {
  tx_id: string;
  composite_risk_score: number; // 0-100
  risk_tier: RiskTier;
  rule_violations: string[];
  ml_anomaly_score: number;     // 0.0 – 1.0
  graph_metrics: GraphMetrics;
  ai_explanations: string[];
  recommended_action: RecommendedAction;
}

// ── Blockchain Evidence ───────────────────────────────────────────────────────

export type VerificationStatus = 'idle' | 'loading' | 'verified' | 'tampered' | 'error';

export interface BlockchainAuditSnapshot {
  case_id: string;
  tx_id: string;
  risk_score: number;
  flagged_timestamp: number;       // Unix epoch seconds
  evidence_fingerprint: string;    // SHA-256 hex digest
  on_chain_tx_url?: string;        // Explorer link, provided by backend
}

// ── Case ──────────────────────────────────────────────────────────────────────

export type CaseStatus =
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'CONFIRMED_FRAUD'
  | 'FALSE_POSITIVE'
  | 'RESOLVED';

export interface Case {
  case_id: string;               // e.g. TG-2026-00142
  tx_id: string;
  created_at: string;            // ISO-8601
  updated_at: string;
  status: CaseStatus;
  assigned_to?: string;
  fraud_analysis: FraudAnalysis;
  graph_data: GraphData;
  blockchain_snapshot: BlockchainAuditSnapshot;
  transaction: {
    tx_id: string;
    timestamp: string;
    sender_account_id: string;
    receiver_account_id: string;
    amount: number;
    currency: string;
    composite_risk_score: number;
    risk_tier: RiskTier;
    status: TransactionStatus;
  };
}

// ── Alert (Live stream row) ───────────────────────────────────────────────────

export interface Alert {
  alert_id: string;
  tx_id: string;
  case_id: string;
  timestamp: string;
  sender_account_id: string;
  receiver_account_id: string;
  amount: number;
  currency: string;
  composite_risk_score: number;
  risk_tier: RiskTier;
  status: TransactionStatus;
  recommended_action: RecommendedAction;
}

// ── Dashboard Metrics ─────────────────────────────────────────────────────────

export interface DashboardMetrics {
  total_monitored_volume_inr: number;    // raw paise/rupees, formatted on display
  total_screened_transactions: number;
  active_high_risk_cases: number;
  network_interception_rate: number;     // percentage e.g. 94.2
}
