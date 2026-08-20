import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ChevronRight, Radio, Inbox, AlertTriangle } from 'lucide-react';
import { cn, riskColors, riskEmoji, formatINR, relativeTime } from '../utils/helpers';
import { mockAlerts } from '../data/mockData';
import type { Alert } from '../types/case';
import type { RiskTier } from '../types/transaction';

// ── Row sub-component ─────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: Alert;
  onClick: (alert: Alert) => void;
  isNew?: boolean;
}

function AlertRow({ alert, onClick, isNew = false }: AlertRowProps) {
  const colors = riskColors[alert.risk_tier as RiskTier];

  const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
    MONITORING:      { label: 'Monitoring',       cls: 'text-text-primary bg-surface border-border',       dot: 'bg-text-muted' },
    SIMULATED_HOLD:  { label: 'Simulated Hold',   cls: 'text-warning bg-warning/10 border-warning/20',    dot: 'bg-warning' },
    RELEASED:        { label: 'Released',          cls: 'text-primary bg-primary/10 border-primary/20',          dot: 'bg-primary' },
    CONFIRMED_FRAUD: { label: 'Confirmed Fraud',   cls: 'text-critical bg-critical/10 border-critical/20',          dot: 'bg-critical' },
    CLEARED:         { label: 'Cleared',           cls: 'text-success bg-success/10 border-success/20', dot: 'bg-success' },
    FALSE_POSITIVE:  { label: 'False Positive',    cls: 'text-indigo-accent bg-indigo-accent/10 border-indigo-accent/20', dot: 'bg-indigo-accent' },
  };
  const status = statusConfig[alert.status] ?? { label: alert.status, cls: 'text-text-primary bg-surface border-border', dot: 'bg-text-muted' };

  return (
    <tr
      role="row"
      tabIndex={0}
      onClick={() => onClick(alert)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(alert)}
      aria-label={`Alert ${alert.tx_id}, risk ${alert.composite_risk_score}, ${alert.risk_tier}. Click to open case dossier.`}
      className={cn(
        'group cursor-pointer transition-all duration-200 border-b border-border last:border-0',
        'hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        isNew && 'animate-[slideInDown_0.3s_ease-out]',
        alert.risk_tier === 'CRITICAL' && 'hover:bg-critical/10',
        alert.risk_tier === 'ELEVATED' && 'hover:bg-warning/10',
      )}
    >
      {/* Left accent stripe */}
      <td className="w-1 p-0">
        <div className={cn('h-full w-0.5 mx-auto', colors.dot)} style={{ minHeight: 48 }} />
      </td>

      {/* Transaction ID */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-text-primary text-sm font-mono font-semibold group-hover:text-primary transition-colors">
            {alert.tx_id}
          </span>
          <span className="text-text-muted text-xs">{alert.case_id}</span>
        </div>
      </td>

      {/* Sender → Receiver */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
          <span className="text-text-secondary">{alert.sender_account_id}</span>
          <ChevronRight className="w-3 h-3 text-text-subtle" aria-label="to" />
          <span className="text-text-secondary">{alert.receiver_account_id}</span>
        </div>
        <span className="text-text-secondary text-[10px]">{relativeTime(alert.timestamp)}</span>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <span className="text-text-primary font-semibold text-sm">
          {formatINR(alert.amount)}
        </span>
      </td>

      {/* Risk score */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="inline-flex items-center gap-1.5">
          <span className="text-[10px]" aria-hidden>{riskEmoji[alert.risk_tier as RiskTier]}</span>
          <span className={cn('text-sm font-bold tabular-nums', colors.text)}>
            {alert.composite_risk_score}
          </span>
        </div>
      </td>

      {/* Risk tier badge */}
      <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
        <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase', colors.badge)}>
          {alert.risk_tier === 'CRITICAL' ? '🔴 CRITICAL' : alert.risk_tier === 'ELEVATED' ? '🟡 ELEVATED' : '🟢 NORMAL'}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
        <span className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
          status.cls
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', status.dot)} aria-hidden />
          {status.label}
        </span>
      </td>

      {/* Action arrow */}
      <td className="px-4 py-3 text-text-muted group-hover:text-primary transition-colors text-right">
        <ChevronRight className="w-4 h-4 ml-auto" aria-hidden />
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LiveAlertStreamProps {
  /** If not supplied, falls back to mock data */
  alerts?: Alert[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onAlertClick: (alert: Alert) => void;
}

export default function LiveAlertStream({
  alerts,
  loading = false,
  error = null,
  onRetry,
  onAlertClick,
}: LiveAlertStreamProps) {
  const [data, setData] = useState<Alert[]>(alerts ?? mockAlerts);
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());
  const prevAlertsRef = useRef<Set<string>>(new Set(data.map((a) => a.alert_id)));

  // Track newly added alerts for animation
  useEffect(() => {
    if (!alerts) return;
    const currentIds = new Set(alerts.map((a) => a.alert_id));
    const added = new Set([...currentIds].filter((id) => !prevAlertsRef.current.has(id)));
    if (added.size > 0) setNewAlertIds(added);
    prevAlertsRef.current = currentIds;
    setData(alerts);
    // Clear animation after 1s
    if (added.size > 0) setTimeout(() => setNewAlertIds(new Set()), 1000);
  }, [alerts]);

  return (
    <section aria-label="Live Alert Stream" className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
          <span className="w-1 h-3.5 rounded-full bg-critical inline-block" aria-hidden />
          Live Alert Stream
        </h2>
        <div className="flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-1.5 text-text-muted text-xs">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Updating…
            </div>
          )}
          <div className="flex items-center gap-1.5 text-text-muted text-[10px]">
            <Radio className="w-3 h-3 text-success" />
            <span className="text-success font-medium">{data.length} active alerts</span>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="bg-surface border border-border shadow-sm rounded-xl overflow-hidden flex-1 flex flex-col">
        {error ? (
          <ErrorState onRetry={onRetry} />
        ) : data.length === 0 && !loading ? (
          <EmptyState />
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full border-collapse" role="table" aria-label="Transaction alerts">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="w-1 p-0" aria-hidden />
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] text-text-muted font-semibold uppercase tracking-widest whitespace-nowrap">
                    Transaction / Case
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] text-text-muted font-semibold uppercase tracking-widest hidden sm:table-cell">
                    Sender → Receiver
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right text-[10px] text-text-muted font-semibold uppercase tracking-widest whitespace-nowrap">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-center text-[10px] text-text-muted font-semibold uppercase tracking-widest">
                    Score
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] text-text-muted font-semibold uppercase tracking-widest hidden md:table-cell">
                    Risk Tier
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] text-text-muted font-semibold uppercase tracking-widest hidden lg:table-cell">
                    Status
                  </th>
                  <th scope="col" className="w-8 p-0" aria-label="Open dossier" />
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0
                  ? Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
                  : data.map((alert) => (
                      <AlertRow
                        key={alert.alert_id}
                        alert={alert}
                        onClick={onAlertClick}
                        isNew={newAlertIds.has(alert.alert_id)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Helper states ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="w-1 p-0"><div className="h-12 w-0.5 bg-border mx-auto" /></td>
      {[140, 200, 80, 50, 90, 80].map((w, i) => (
        <td key={i} className={cn('px-4 py-3', i > 1 && i < 5 ? '' : '')}>
          <div className="h-4 bg-surface-secondary rounded animate-pulse" style={{ width: w }} />
        </td>
      ))}
      <td />
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 text-text-secondary">
      <Inbox className="w-10 h-10 mb-3 opacity-40" />
      <p className="text-sm font-medium">No active fraud alerts</p>
      <p className="text-xs mt-1 opacity-70 text-text-muted">The system is monitoring transactions in real time.</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 text-text-muted gap-3">
      <AlertTriangle className="w-10 h-10 text-critical/50" />
      <p className="text-sm font-medium text-text-secondary">Unable to load fraud alerts.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary text-text-primary text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
