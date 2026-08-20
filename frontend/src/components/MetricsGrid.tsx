import { useEffect, useState } from 'react';
import {
  IndianRupee,
  ScanLine,
  Siren,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { cn, formatINR } from '../utils/helpers';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import type { DashboardMetrics } from '../types/case';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetricCardProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  subLabel?: string;
  accent?: 'blue' | 'indigo' | 'red' | 'emerald';
  danger?: boolean;
  loading?: boolean;
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function MetricCard({ id, icon, label, value, subLabel, accent = 'blue', danger = false, loading = false }: MetricCardProps) {
  const accentClasses: Record<string, string> = {
    blue: 'text-primary bg-primary/10 border-primary/20',
    indigo: 'text-indigo-accent bg-indigo-accent/10 border-indigo-accent/20',
    red: 'text-critical bg-critical/10 border-critical/20',
    emerald: 'text-success bg-success/10 border-success/20',
  };

  const valueAccent: Record<string, string> = {
    blue: 'text-text-primary',
    indigo: 'text-text-primary',
    red: 'text-critical',
    emerald: 'text-text-primary',
  };

  return (
    <article
      id={id}
      aria-label={`${label}: ${value}`}
      className={cn(
        'relative group bg-surface border rounded-xl p-5 shadow-sm',
        'hover:border-text-muted transition-all duration-300',
        danger ? 'border-critical/30 shadow-md shadow-critical/10' : 'border-border',
        danger && 'ring-1 ring-critical/30 animate-[pulse_3s_ease-in-out_infinite]',
      )}
    >
      {danger && (
        <div className="absolute inset-0 rounded-xl bg-critical/5 pointer-events-none" aria-hidden />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('p-2 rounded-lg border', accentClasses[accent])}>
            {icon}
          </div>
          {danger && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-critical/10 border border-critical/20">
              <span className="w-1.5 h-1.5 rounded-full bg-critical animate-pulse" aria-hidden />
              <span className="text-critical text-[10px] font-bold tracking-widest uppercase">Alert</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 mb-2">
            <div className="h-8 bg-surface-secondary rounded animate-pulse w-3/4" />
            <div className="h-3 bg-surface-secondary rounded animate-pulse w-1/2" />
          </div>
        ) : (
          <>
            <p className={cn('text-3xl font-bold tracking-tight mb-1', valueAccent[accent])}>
              {value}
            </p>
            {subLabel && (
              <p className="text-text-muted text-[11px] font-medium uppercase tracking-wider">{subLabel}</p>
            )}
          </>
        )}

        <p className="text-text-subtle text-xs font-semibold uppercase tracking-widest mt-3">
          {label}
        </p>
      </div>
    </article>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface MetricsGridProps {
  /** Optional override for testing or SSR */
  metrics?: DashboardMetrics;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function MetricsGrid({ metrics: propsMetrics, loading = false, error = null, onRetry }: MetricsGridProps) {
  const { metrics: hookMetrics, isLoading: hookLoading, error: hookError, refetch, isUsingMockData } = useDashboardMetrics();
  
  // Use props if provided, otherwise use hook data
  const data = propsMetrics ?? hookMetrics;
  const isLoading = loading || hookLoading;
  const isError = error || hookError;

  if (isError) {
    return (
      <section aria-label="System Metrics" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader />
        </div>
        <div className="flex items-center justify-between bg-critical/10 border border-critical/20 rounded-xl p-5">
          <p className="text-critical text-sm">Unable to load system metrics.</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="System Metrics" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader />
        {isLoading && (
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <RefreshCw className="w-3 h-3 animate-spin" /> Refreshing…
          </div>
        )}
        {isUsingMockData && (
          <span className="text-[10px] text-warning font-medium uppercase tracking-widest">Demo Data</span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          id="metric-monitored-volume"
          icon={<IndianRupee className="w-4 h-4" />}
          label="Total Monitored Volume"
          value={formatINR(data.total_monitored_volume_inr, true)}
          subLabel="Across all rails"
          accent="blue"
          loading={isLoading}
        />

        <MetricCard
          id="metric-screened-transactions"
          icon={<ScanLine className="w-4 h-4" />}
          label="Screened Transactions"
          value={data.total_screened_transactions.toLocaleString('en-IN')}
          subLabel="Last 24 hours"
          accent="indigo"
          loading={isLoading}
        />

        <MetricCard
          id="metric-high-risk-cases"
          icon={<Siren className="w-4 h-4" />}
          label="Active High-Risk Cases"
          value={`🔴 ${data.active_high_risk_cases}`}
          subLabel="Require immediate review"
          accent="red"
          danger
          loading={isLoading}
        />

        <MetricCard
          id="metric-interception-rate"
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Network Interception Rate"
          value={`${data.network_interception_rate.toFixed(1)}%`}
          subLabel={<span className="flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5 inline" /> vs last 7d</span> as unknown as string}
          accent="emerald"
          loading={isLoading}
        />
      </div>
    </section>
  );
}

function SectionHeader() {
  return (
    <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
      <span className="w-1 h-3.5 rounded-full bg-primary inline-block" aria-hidden />
      System Metrics
    </h2>
  );
}
