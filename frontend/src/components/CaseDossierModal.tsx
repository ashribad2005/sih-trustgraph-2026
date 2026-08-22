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

  if (!open || !caseData) return null;

  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                value={caseData.audit_hash || '0x0000000000000000000000000000000000000000'}
                className="bg-slate-900 text-slate-300 font-mono text-xs px-3 py-2 rounded-lg border border-slate-800 flex-1 select-all"
              />
              <button
                onClick={() => handleCopyHash(caseData.audit_hash || '')}
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

            {verificationResult && (() => {
              const verified = verificationResult.verdict === 'VERIFIED'
                || verificationResult.verdict === 'LOCAL_VERIFIED';
              const displayedHash = verificationResult.on_chain_hash
                || verificationResult.local_hash
                || 'Verification query failed';
              return (
                <div className={`p-3 rounded-lg text-xs border ${verified ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-red-950/40 border-red-800 text-red-300'}`}>
                  {verified
                    ? 'Cryptographic match confirmed. Audit record is verified.'
                    : `Hash mismatch or record unconfirmed: ${displayedHash}`}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Dismiss Dossier
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseDossierModal;