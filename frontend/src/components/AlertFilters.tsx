import { Filter } from 'lucide-react';
import type { RiskTier } from '../types/transaction';
import { cn } from '../utils/helpers';

export type StatusFilter = 'ALL' | 'MONITORING' | 'SIMULATED_HOLD' | 'RELEASED';
export type RiskFilter = 'ALL' | RiskTier;
export type TimeFilter = '1H' | '6H' | '24H' | '7D';

interface AlertFiltersProps {
  riskFilter: RiskFilter;
  setRiskFilter: (r: RiskFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  timeFilter: TimeFilter;
  setTimeFilter: (t: TimeFilter) => void;
}

export default function AlertFilters({
  riskFilter,
  setRiskFilter,
  statusFilter,
  setStatusFilter,
  timeFilter,
  setTimeFilter,
}: AlertFiltersProps) {
  const risks: { label: string; value: RiskFilter; colorClass: string }[] = [
    { label: 'ALL', value: 'ALL', colorClass: 'hover:bg-surface-secondary hover:text-text-primary' },
    { label: 'CRITICAL', value: 'CRITICAL', colorClass: 'hover:bg-critical/10 text-critical' },
    { label: 'ELEVATED', value: 'ELEVATED', colorClass: 'hover:bg-warning/10 text-warning' },
    { label: 'NORMAL', value: 'NORMAL', colorClass: 'hover:bg-success/10 text-success' },
  ];

  const statuses: { label: string; value: StatusFilter }[] = [
    { label: 'All Status', value: 'ALL' },
    { label: 'Monitoring', value: 'MONITORING' },
    { label: 'Simulated Hold', value: 'SIMULATED_HOLD' },
    { label: 'Released', value: 'RELEASED' },
  ];

  const times: { label: string; value: TimeFilter }[] = [
    { label: '1H', value: '1H' },
    { label: '6H', value: '6H' },
    { label: '24H', value: '24H' },
    { label: '7D', value: '7D' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-semibold text-text-subtle uppercase tracking-widest">Filters</span>
      </div>

      <div className="flex flex-wrap items-center gap-4 lg:gap-6">
        {/* Risk Filter */}
        <div className="flex items-center bg-surface p-1 rounded-lg border border-border shadow-sm transition-colors duration-200">
          {risks.map((r) => (
            <button
              key={r.value}
              onClick={() => setRiskFilter(r.value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none',
                riskFilter === r.value
                  ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                  : `text-text-secondary ${r.colorClass}`
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center bg-surface p-1 rounded-lg border border-border shadow-sm transition-colors duration-200">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none',
                statusFilter === s.value
                  ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Time Filter */}
        <div className="flex items-center bg-surface p-1 rounded-lg border border-border shadow-sm transition-colors duration-200">
          {times.map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeFilter(t.value)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none',
                timeFilter === t.value
                  ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
