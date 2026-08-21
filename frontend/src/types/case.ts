import type { GraphData, GraphMetrics } from './graph';
import type { RiskTier, TransactionStatus } from './transaction';

// ─── Dashboard Metrics ────────────────────────────────────────────────────────
export interface DashboardMetrics {
  total_monitored_volume_inr: number;
  total_screened_transactions: number;
  active_high_risk_cases: number;
  network_interception_rate: number;
}

// ─── Live Alert (maps to mock & backend alert stream) ─────────────────────────
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
  recommended_action?: string;
}

// ─── Fraud Analysis (nested in Case) ──────────────────────────────────────────
export interface FraudAnalysis {
  tx_id: string;
  composite_risk_score: number;
  risk_tier: string;
  rule_violations: string[];
  ml_anomaly_score: number;
  graph_metrics: GraphMetrics;
  ai_explanations: string[];
  recommended_action: string;
}

// ─── Blockchain Snapshot ──────────────────────────────────────────────────────
export interface BlockchainSnapshot {
  case_id: string;
  tx_id: string;
  risk_score: number;
  flagged_timestamp: number;
  evidence_fingerprint: string;
  on_chain_tx_url?: string;
}

// ─── Transaction (nested in Case) ─────────────────────────────────────────────
export interface CaseTransaction {
  tx_id: string;
  timestamp: string;
  sender_account_id: string;
  receiver_account_id: string;
  amount: number;
  currency: string;
  composite_risk_score: number;
  risk_tier: string;
  status: string;
}

// ─── Case ─────────────────────────────────────────────────────────────────────
export interface Case {
  id?: string | number;
  case_id: string;
  tx_id?: string;
  risk_score?: number;
  fraud_type?: string;
  status?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  assigned_to?: string;
  transaction?: CaseTransaction;
  fraud_analysis?: FraudAnalysis;
  graph_data?: GraphData;
  blockchain_snapshot?: BlockchainSnapshot;
}

// ─── Case Dossier (enriched case for modals) ──────────────────────────────────
export interface CaseDossier extends Case {
  ai_summary?: string;
  audit_hash?: string;
}