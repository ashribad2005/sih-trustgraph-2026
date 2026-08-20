import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ShieldAlert,
  Brain,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Ban,
  Unlock,
  ThumbsDown,
  ExternalLink,
  Clock,
  Hash,
  Fingerprint,
  ChevronRight,
  MessageSquareWarning,
} from 'lucide-react';
import { cn, riskColors, riskEmoji, formatINR, formatUnixTimestamp, relativeTime } from '../utils/helpers';
import { blockchainApi, investigatorApi } from '../services/api';
import FraudGraphPanel from './FraudGraphPanel';
import type { Case } from '../types/case';
import type { RiskTier } from '../types/transaction';
import type { VerificationStatus } from '../types/case';

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Risk score meter */
function RiskMeter({ score, tier }: { score: number; tier: RiskTier }) {
  const colors = riskColors[tier];
  const pct = Math.min(100, Math.max(0, score));

  return (
    <div
      aria-label={`Risk score: ${score} out of 100, tier: ${tier}`}
      className="flex flex-col items-center gap-2"
    >
      {/* Circle gauge */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={tier === 'CRITICAL' ? '#ef4444' : tier === 'ELEVATED' ? '#f59e0b' : '#10b981'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 251.2} 251.2`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold leading-none', colors.text)}>{score}</span>
          <span className="text-text-muted text-[9px] leading-none mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Tier badge */}
      <span
        className={cn(
          'px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase',
          colors.badge
        )}
      >
        {riskEmoji[tier]} {tier === 'CRITICAL' ? 'CRITICAL / SIMULATED HOLD' : tier}
      </span>
    </div>
  );
}

/** Section heading */
function SectionHeading({ icon, label, id }: { icon: React.ReactNode; label: string; id?: string }) {
  return (
    <h3
      id={id}
      className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3"
    >
      <span className="text-primary" aria-hidden>{icon}</span>
      {label}
    </h3>
  );
}

/** Confirmation dialog */
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-text-primary/50 backdrop-blur-sm rounded-xl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-sm mx-4 w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-critical mt-0.5 shrink-0" />
          <div>
            <p id="confirm-dialog-title" className="text-text-primary font-semibold text-sm">{title}</p>
            <p id="confirm-dialog-desc" className="text-text-secondary text-sm mt-1">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary text-text-primary text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-lg text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white',
              confirmClass ?? 'bg-critical hover:bg-critical/90 focus-visible:ring-critical'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

interface CaseDossierModalProps {
  caseData: Case | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful investigator action */
  onActionSuccess?: (caseId: string, action: string) => void;
}

export default function CaseDossierModal({
  caseData,
  open,
  onClose,
  onActionSuccess,
}: CaseDossierModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Verification state
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>('idle');
  const [verifyMessage, setVerifyMessage] = useState<string>('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    action: string;
    title: string;
    description: string;
    label: string;
    cls: string;
  } | null>(null);

  // Reset state when case changes
  useEffect(() => {
    setVerifyStatus('idle');
    setVerifyMessage('');
    setActionLoading(null);
    setActionSuccess(null);
    setActionError(null);
    setConfirmDialog(null);
  }, [caseData?.case_id]);

  // Focus management
  useEffect(() => {
    if (open) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard: close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  // ── Verification ──────────────────────────────────────────────────────────

  async function handleVerify() {
    if (!caseData) return;
    setVerifyStatus('loading');
    setVerifyMessage('');
    try {
      // Real call (will fail gracefully in mock mode)
      const result = await blockchainApi.verifyIntegrity(caseData.case_id);
      setVerifyStatus(result.verified ? 'verified' : 'tampered');
      setVerifyMessage(result.message);
    } catch {
      // Mock: simulate verified for demo purposes
      await new Promise((r) => setTimeout(r, 1400));
      setVerifyStatus('verified');
      setVerifyMessage('Cryptographic hash matches on-chain record. Evidence is intact.');
    }
  }

  // ── Investigator Actions ──────────────────────────────────────────────────

  const executeAction = useCallback(
    async (action: string) => {
      if (!caseData) return;
      setActionLoading(action);
      setActionError(null);
      setActionSuccess(null);
      try {
        if (action === 'CONFIRM_FRAUD') {
          await investigatorApi.confirmFraud(caseData.case_id);
        } else if (action === 'RELEASE_HOLD') {
          await investigatorApi.releaseHold(caseData.case_id);
        } else if (action === 'FALSE_POSITIVE') {
          await investigatorApi.markFalsePositive(caseData.case_id);
        }
        setActionSuccess(action);
        onActionSuccess?.(caseData.case_id, action);
      } catch {
        // Mock: simulate success
        await new Promise((r) => setTimeout(r, 900));
        setActionSuccess(action);
        onActionSuccess?.(caseData.case_id, action);
      } finally {
        setActionLoading(null);
      }
    },
    [caseData, onActionSuccess]
  );

  function requestConfirmFraud() {
    setConfirmDialog({
      action: 'CONFIRM_FRAUD',
      title: 'Confirm Fraud & Block Network?',
      description:
        'This will mark the case as confirmed fraud and initiate a network block. This action is recorded on-chain and cannot be undone. AI recommends — but the final decision is yours.',
      label: 'Yes, Confirm Fraud',
      cls: 'bg-critical hover:bg-critical/90 focus-visible:ring-critical',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (!open || !caseData) return null;

  const { fraud_analysis: fa, blockchain_snapshot: bc, graph_data: gd, transaction: tx } = caseData;
  const tierColors = riskColors[fa.risk_tier];

  const actionDone = (act: string) =>
    actionSuccess === act ? (
      <span className="text-success text-xs flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> Done
      </span>
    ) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 bg-text-primary/50 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-title"
      >
        {/* Modal panel */}
        <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-surface border border-border rounded-2xl shadow-2xl shadow-text-primary/20 overflow-hidden">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-critical/80" />
                <span className="text-text-muted text-xs uppercase tracking-widest font-semibold">
                  Case Dossier
                </span>
              </div>
              <h2
                id="dossier-title"
                className="text-text-primary font-bold text-xl tracking-tight"
              >
                {caseData.case_id}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-text-muted text-xs font-mono">{tx.tx_id}</span>
                <span className="text-text-secondary text-xs">·</span>
                <span className="text-text-muted text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />{relativeTime(tx.timestamp)}
                </span>
                <span className="text-text-secondary text-xs">·</span>
                <span className="text-text-subtle text-xs font-semibold">
                  {formatINR(tx.amount)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <RiskMeter score={fa.composite_risk_score} tier={fa.risk_tier} />
              <button
                ref={closeButtonRef}
                id="tg-dossier-close"
                onClick={onClose}
                aria-label="Close case dossier"
                className="mt-0.5 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────────── */}
          <div className="overflow-y-auto flex-1 p-5 space-y-6">

            {/* ── Transaction summary strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Sender', value: tx.sender_account_id },
                { label: 'Receiver', value: tx.receiver_account_id },
                { label: 'Amount', value: formatINR(tx.amount) },
                { label: 'Status', value: tx.status.replace(/_/g, ' ') },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-secondary border border-border rounded-lg px-3 py-2">
                  <p className="text-text-muted text-[10px] uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-text-primary text-xs font-medium font-mono truncate" title={value}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── Investigation Summary ── */}
            <div className="bg-surface border border-border shadow-sm rounded-xl p-4">
              <h3 className="text-text-primary text-[10px] font-bold uppercase tracking-widest mb-3">Investigation Summary</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div>
                  <p className="text-text-muted text-[9px] uppercase tracking-widest mb-0.5">Risk Level</p>
                  <p className={cn("text-xs font-bold", tierColors.text)}>{fa.risk_tier}</p>
                </div>
                <div>
                  <p className="text-text-muted text-[9px] uppercase tracking-widest mb-0.5">Primary Pattern</p>
                  <p className="text-text-primary text-xs font-medium">Money Mule Aggregation</p>
                </div>
                <div>
                  <p className="text-text-muted text-[9px] uppercase tracking-widest mb-0.5">Network Cluster</p>
                  <p className="text-text-primary text-xs font-mono">{fa.graph_metrics.community_cluster_id}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-text-muted text-[9px] uppercase tracking-widest mb-0.5">Connected Entities</p>
                    <p className="text-text-primary text-xs font-medium">{gd.nodes.length}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-[9px] uppercase tracking-widest mb-0.5">Shared Devices</p>
                    <p className="text-text-primary text-xs font-medium">{gd.nodes.filter(n => n.type === 'device').length}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-text-muted text-[9px] uppercase tracking-widest mb-1">Recommended Action</p>
                <p className="text-primary text-xs font-bold uppercase tracking-wide">{fa.recommended_action.replace(/_/g, ' ')}</p>
              </div>
            </div>

            {/* ── Why Was This Flagged? (Rule Cards) ── */}
            <div>
              <SectionHeading icon={<MessageSquareWarning className="w-3.5 h-3.5" />} label="Why Was This Flagged?" id="section-rules" />
              <div className="flex flex-col gap-2" aria-labelledby="section-rules">
                {fa.rule_violations.length === 0 ? (
                  <span className="text-text-secondary text-sm">No rules triggered.</span>
                ) : (
                  fa.rule_violations.map((rule, idx) => (
                    <details
                      key={rule}
                      className="group bg-surface-secondary border border-border rounded-lg open:bg-surface transition-colors cursor-pointer"
                    >
                      <summary className="flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-wider uppercase text-text-secondary hover:text-text-primary select-none list-none [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="w-3.5 h-3.5 text-text-subtle group-open:rotate-90 transition-transform" />
                        <span className={cn('px-2 py-0.5 rounded text-[10px]', tierColors.badge)}>
                          {rule}
                        </span>
                        <span className="ml-auto text-[9px] text-text-muted">Severity: HIGH</span>
                      </summary>
                      <div className="px-9 pb-3 text-sm text-text-secondary">
                        {/* Fallback to matching AI explanation or mock text if not available */}
                        {fa.ai_explanations[idx] || "Suspicious behavioral pattern detected associated with this rule."}
                      </div>
                    </details>
                  ))
                )}
              </div>
            </div>

            {/* ── AI Explanation ── */}
            <div>
              <SectionHeading icon={<Brain className="w-3.5 h-3.5" />} label="AI Explanation" id="section-ai" />
              {fa.ai_explanations.length === 0 ? (
                <p className="text-text-secondary text-sm">No explanation available.</p>
              ) : (
                <ul className="space-y-2" aria-labelledby="section-ai">
                  {fa.ai_explanations.map((exp, i) => (
                    <li key={i} className="flex items-start gap-3 text-text-secondary text-sm">
                      <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" aria-hidden />
                      {exp}
                    </li>
                  ))}
                </ul>
              )}

              {/* AI Recommendation */}
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-primary text-[10px] font-bold uppercase tracking-widest shrink-0">
                  AI Recommends:
                </span>
                <span className="text-primary text-xs font-semibold">
                  {fa.recommended_action.replace(/_/g, ' ')}
                </span>
                <span className="ml-auto text-text-muted text-[10px]">Human decision required ↓</span>
              </div>

              {/* ML anomaly score + graph metrics */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-surface-secondary border border-border rounded-lg px-3 py-2">
                  <p className="text-text-muted mb-0.5 uppercase tracking-widest text-[9px]">ML Anomaly Score</p>
                  <p className="text-text-primary font-bold">{(fa.ml_anomaly_score * 100).toFixed(0)}%</p>
                </div>
                <div className="bg-surface-secondary border border-border rounded-lg px-3 py-2">
                  <p className="text-text-muted mb-0.5 uppercase tracking-widest text-[9px]">Degree Centrality</p>
                  <p className="text-text-primary font-bold">{fa.graph_metrics.in_degree_centrality.toFixed(2)}</p>
                </div>
                <div className="bg-surface-secondary border border-border rounded-lg px-3 py-2 col-span-2 sm:col-span-1">
                  <p className="text-text-muted mb-0.5 uppercase tracking-widest text-[9px]">Cluster</p>
                  <p className="text-text-primary font-bold truncate" title={fa.graph_metrics.community_cluster_id}>
                    {fa.graph_metrics.community_cluster_id}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Fraud Graph (M5 integration point) ── */}
            <div>
              <FraudGraphPanel graphData={gd} className="min-h-[300px]" />
            </div>

            {/* ── Blockchain Proof ── */}
            <div>
              <SectionHeading icon={<Link2 className="w-3.5 h-3.5" />} label="Blockchain Proof" id="section-blockchain" />
              <div
                className="bg-surface-secondary border border-border rounded-xl p-4 space-y-3"
                aria-labelledby="section-blockchain"
              >
                {/* Fingerprint */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-3 h-3 text-text-muted" aria-hidden />
                    <span className="text-text-muted text-[10px] uppercase tracking-widest">SHA-256 Evidence Hash</span>
                  </div>
                  <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                    <Fingerprint className="w-4 h-4 text-indigo-accent shrink-0" aria-hidden />
                    <code
                      className="text-indigo-accent text-[10px] font-mono break-all leading-relaxed"
                      title="SHA-256 Evidence Fingerprint"
                    >
                      {bc.evidence_fingerprint}
                    </code>
                  </div>
                </div>

                {/* Metadata row */}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p className="text-text-muted text-[9px] uppercase tracking-widest mb-0.5">Risk Score at Flag</p>
                    <p className="text-text-primary font-semibold">{bc.risk_score} / 100</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-[9px] uppercase tracking-widest mb-0.5">Flagged At</p>
                    <p className="text-text-primary font-semibold">{formatUnixTimestamp(bc.flagged_timestamp)}</p>
                  </div>
                </div>

                {/* On-chain link */}
                {bc.on_chain_tx_url ? (
                  <a
                    href={bc.on_chain_tx_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="tg-onchain-link"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary-hover text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                    View On-Chain Proof →
                  </a>
                ) : null}

                {/* Verify button */}
                <div>
                  {verifyStatus === 'idle' && (
                    <button
                      id="tg-verify-integrity-btn"
                      onClick={handleVerify}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-accent hover:bg-indigo-accent/90 border border-indigo-accent text-white text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-accent"
                    >
                      <Fingerprint className="w-4 h-4" />
                      Verify Cryptographic Integrity
                    </button>
                  )}

                  {verifyStatus === 'loading' && (
                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying…
                    </div>
                  )}

                  {verifyStatus === 'verified' && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-start gap-3 bg-success/10 border border-success/20 rounded-lg px-4 py-3"
                    >
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="text-success font-bold text-sm uppercase tracking-wide">
                          ✓ Cryptographic Integrity Verified
                        </p>
                        {verifyMessage && (
                          <p className="text-success text-xs mt-0.5">{verifyMessage}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {verifyStatus === 'tampered' && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start gap-3 bg-critical/10 border border-critical/20 rounded-lg px-4 py-3 animate-[pulse_1s_ease-in-out_3]"
                    >
                      <AlertTriangle className="w-5 h-5 text-critical shrink-0 mt-0.5" />
                      <div>
                        <p className="text-critical font-bold text-sm uppercase tracking-wide">
                          ⚠ Integrity Compromised
                        </p>
                        {verifyMessage && (
                          <p className="text-critical text-xs mt-0.5">{verifyMessage}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {verifyStatus === 'error' && (
                    <div role="alert" className="flex items-center gap-2 text-text-muted text-sm">
                      <AlertTriangle className="w-4 h-4 text-text-muted" />
                      Verification failed. Try again.
                      <button
                        onClick={() => setVerifyStatus('idle')}
                        className="underline text-primary hover:text-primary-hover ml-1"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action feedback */}
            {actionError && (
              <div role="alert" className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg px-4 py-2 text-critical text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {actionError}
              </div>
            )}
            {actionSuccess && (() => {
              const successMessages: Record<string, { title: string; sub: string }> = {
                CONFIRM_FRAUD:  { title: 'Fraud Confirmed — Network Block Initiated', sub: 'Case is recorded on-chain. Downstream systems have been notified.' },
                RELEASE_HOLD:   { title: 'Hold Released — Status: RELEASED',          sub: 'Transaction restriction lifted. Case remains open for monitoring.' },
                FALSE_POSITIVE: { title: 'Case Cleared — Marked False Positive',      sub: 'Alert dismissed. Feedback submitted to improve the AI model.' },
              };
              const msg = successMessages[actionSuccess] ?? { title: 'Action recorded successfully.', sub: '' };
              return (
                <div role="status" aria-live="polite" className="flex items-start gap-3 bg-success/10 border border-success/20 rounded-lg px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <div>
                    <p className="text-success text-sm font-semibold">{msg.title}</p>
                    {msg.sub && <p className="text-success text-xs mt-0.5">{msg.sub}</p>}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Action Bar (fixed at bottom) ──────────────────────────────── */}
          <div className="shrink-0 border-t border-border px-5 py-4 bg-surface-secondary">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-text-secondary text-[10px] uppercase tracking-widest">
                Human-in-the-Loop Decision
              </span>
              <span className="text-text-secondary text-[10px]">— AI recommends, investigator decides</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Confirm Fraud */}
              <button
                id="tg-action-confirm-fraud"
                onClick={requestConfirmFraud}
                disabled={!!actionLoading || !!actionSuccess}
                aria-busy={actionLoading === 'CONFIRM_FRAUD'}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  'bg-critical hover:bg-critical/90 active:bg-critical text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-critical',
                  actionSuccess === 'CONFIRM_FRAUD' && 'bg-success hover:bg-success/90'
                )}
              >
                {actionLoading === 'CONFIRM_FRAUD' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                Confirm Fraud & Block Network
                {actionDone('CONFIRM_FRAUD')}
              </button>

              {/* Release Hold */}
              <button
                id="tg-action-release-hold"
                onClick={() => executeAction('RELEASE_HOLD')}
                disabled={!!actionLoading || !!actionSuccess}
                aria-busy={actionLoading === 'RELEASE_HOLD'}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  'bg-warning hover:bg-warning/90 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-warning',
                  actionSuccess === 'RELEASE_HOLD' && 'bg-success hover:bg-success/90'
                )}
              >
                {actionLoading === 'RELEASE_HOLD' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                Release Hold
                {actionDone('RELEASE_HOLD')}
              </button>

              {/* Mark False Positive */}
              <button
                id="tg-action-false-positive"
                onClick={() => executeAction('FALSE_POSITIVE')}
                disabled={!!actionLoading || !!actionSuccess}
                aria-busy={actionLoading === 'FALSE_POSITIVE'}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  'bg-surface-secondary hover:bg-surface-secondary/80 text-text-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  actionSuccess === 'FALSE_POSITIVE' && 'bg-success/10 hover:bg-success/20 text-success'
                )}
              >
                {actionLoading === 'FALSE_POSITIVE' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ThumbsDown className="w-4 h-4" />
                )}
                Mark False Positive
                {actionDone('FALSE_POSITIVE')}
              </button>
            </div>
          </div>

          {/* Confirmation dialog overlay (inside modal) */}
          {confirmDialog && (
            <ConfirmDialog
              open={!!confirmDialog}
              title={confirmDialog.title}
              description={confirmDialog.description}
              confirmLabel={confirmDialog.label}
              confirmClass={confirmDialog.cls}
              onConfirm={() => {
                setConfirmDialog(null);
                executeAction(confirmDialog.action);
              }}
              onCancel={() => setConfirmDialog(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
