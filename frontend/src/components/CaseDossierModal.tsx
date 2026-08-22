import React, { useState } from 'react';
import { CaseDossier } from '../types/case';
import { apiService } from '../services/api';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react';

type VerificationResult = Awaited<ReturnType<typeof apiService.verifyAuditHash>>;

interface CaseDossierModalProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseDossier | null;
  onActionSuccess?: (caseId: string, action: string) => void;
}

export const CaseDossierModal: React.FC<CaseDossierModalProps> = ({ open, onClose, caseData, onActionSuccess }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!open || !caseData) return null;

  const transaction = caseData.transaction;
  const evidenceHash = caseData.evidence_hash ?? caseData.audit_hash ?? '';

  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvestigatorAction = async (action: 'DISMISS' | 'CONFIRM_FRAUD' | 'HOLD') => {
    try {
      setActioning(action);
      setActionError(null);
      await apiService.actionCase(caseData.case_id, action);
      onActionSuccess?.(caseData.case_id, action === 'HOLD' ? 'HOLD' : action === 'DISMISS' ? 'FALSE_POSITIVE' : 'CONFIRM_FRAUD');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update case status');
    } finally {
      setActioning(null);
    }
  };

  const handleVerifyOnChain = async () => {
    try {
      setVerifying(true);
      const res = await apiService.verifyAuditHash(caseData.id ?? caseData.case_id);
      setVerificationResult(res);
    } catch (err) {
      setVerificationResult({
        is_tampered: false,
        verdict: 'CHAIN_ERROR',
        on_chain_hash: null,
        local_hash: '',
        hashes_match: false,
        verification_available: false,
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${(caseData.risk_score ?? 0) >= 75 ? 'bg-red-950/60 text-red-400 border border-red-800' : 'bg-yellow-950/60 text-yellow-400 border border-yellow-800'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Case Dossier: {caseData.case_id || caseData.id}</h2>
              <p className="text-xs text-slate-400">Timestamp: {caseData.created_at || 'Just now'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm">
          {/* Risk Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-500">Risk Score</span>
              <p className={`text-xl font-bold mt-1 ${(caseData.risk_score ?? 0) >= 75 ? 'text-red-400' : 'text-yellow-400'}`}>
                {caseData.risk_score} / 100
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-500">Classification</span>
              <p className="text-sm font-semibold text-slate-200 mt-1 capitalize">{caseData.fraud_type || 'Velocity Anomaly'}</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-500">Status</span>
              <p className="text-sm font-semibold text-indigo-400 mt-1 capitalize">{caseData.status || 'Active Investigation'}</p>
            </div>
          </div>

          {/* AI Forensic Summary */}
          {caseData.ai_summary && (
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Forensic AI Summary</h3>
              <p className="text-slate-300 text-xs leading-relaxed">{caseData.ai_summary}</p>
            </div>
          )}

          {/* Transaction context */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 border border-slate-800 p-4 rounded-xl text-xs">
            <div><span className="text-slate-500">Transaction</span><p className="font-mono text-slate-200 mt-1">{caseData.tx_id ?? transaction?.tx_id ?? 'Unavailable'}</p></div>
            <div><span className="text-slate-500">Amount</span><p className="text-slate-200 mt-1">₹{Number(caseData.amount ?? transaction?.amount ?? 0).toLocaleString('en-IN')}</p></div>
            <div><span className="text-slate-500">Sender → Receiver</span><p className="font-mono text-slate-200 mt-1">{caseData.sender_account_id ?? transaction?.sender ?? 'Unknown'} → {caseData.receiver_account_id ?? transaction?.receiver ?? 'Unknown'}</p></div>
            <div><span className="text-slate-500">Triggered rules</span><p className="text-slate-200 mt-1">{caseData.triggered_rules?.length ?? 0}</p></div>
          </div>

          {((caseData.ai_explanations?.length ?? 0) > 0 || (caseData.triggered_rules?.length ?? 0) > 0) && (
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">AI Forensic Findings</h3>
              <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                {(caseData.triggered_rules ?? []).map((rule) => <li key={rule}>{rule}</li>)}
                {(caseData.ai_explanations ?? []).map((explanation, index) => <li key={`${explanation}-${index}`}>{explanation}</li>)}
              </ul>
            </div>
          )}

          {/* Blockchain Audit Hash */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cryptographic Audit Trail</span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tamper-Evident SHA-256
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={evidenceHash || 'Evidence hash pending'}
                className="bg-slate-900 text-slate-300 font-mono text-xs px-3 py-2 rounded-lg border border-slate-800 flex-1 select-all"
              />
              <button
                onClick={() => handleCopyHash(evidenceHash)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                title="Copy Hash"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleVerifyOnChain}
                disabled={verifying}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Verify on Polygon'}
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {caseData.blockchain_tx_hash && (
              <p className="text-xs text-slate-400">Blockchain transaction: <span className="font-mono text-slate-300 break-all">{caseData.blockchain_tx_hash}</span></p>
            )}

            {verificationResult && (() => {
              const verified = verificationResult.verdict === 'VERIFIED'
                || verificationResult.verdict === 'LOCAL_VERIFIED'
                || verificationResult.verdict === 'MOCK_VERIFIED';
              const displayedHash = verificationResult.on_chain_hash
                || verificationResult.local_hash
                || 'Verification query failed';
              return (
                <div className={`p-3 rounded-lg text-xs border ${verified ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-red-950/40 border-red-800 text-red-300'}`}>
                  {verified
                    ? verificationResult.verdict === 'MOCK_VERIFIED'
                      ? 'Cryptographic match confirmed in deterministic mock-chain mode.'
                      : 'Cryptographic match confirmed. Audit record is verified.'
                    : `Hash mismatch or record unconfirmed: ${displayedHash}`}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {actionError && <p className="text-xs text-red-300">{actionError}</p>}
          <div className="flex flex-wrap gap-2 ml-auto">
            <button onClick={() => handleInvestigatorAction('HOLD')} disabled={Boolean(actioning)} className="px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">{actioning === 'HOLD' ? 'Saving…' : 'Keep Under Review'}</button>
            <button onClick={() => handleInvestigatorAction('CONFIRM_FRAUD')} disabled={Boolean(actioning)} className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">{actioning === 'CONFIRM_FRAUD' ? 'Saving…' : 'Confirm Fraud'}</button>
            <button onClick={() => handleInvestigatorAction('DISMISS')} disabled={Boolean(actioning)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg disabled:opacity-50">{actioning === 'DISMISS' ? 'Saving…' : 'Dismiss'}</button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold rounded-lg transition-colors">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseDossierModal;