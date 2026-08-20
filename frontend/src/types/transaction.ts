// ─── Transaction Types ────────────────────────────────────────────────────────

export type RiskTier = 'NORMAL' | 'ELEVATED' | 'CRITICAL';

export type TransactionStatus =
  | 'MONITORING'
  | 'SIMULATED_HOLD'
  | 'RELEASED'
  | 'CONFIRMED_FRAUD'
  | 'FALSE_POSITIVE'
  | 'CLEARED';

export interface Transaction {
  tx_id: string;
  timestamp: string; // ISO-8601
  sender_account_id: string;
  receiver_account_id: string;
  amount: number;          // in INR (paise or rupees, normalised at display)
  currency: string;        // e.g. "INR"
  composite_risk_score: number; // 0-100
  risk_tier: RiskTier;
  status: TransactionStatus;
  case_id?: string;
}
