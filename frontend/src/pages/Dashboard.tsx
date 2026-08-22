import { useState, useCallback, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import MetricsGrid from '../components/MetricsGrid';
import LiveAlertStream from '../components/LiveAlertStream';
import CaseDossierModal from '../components/CaseDossierModal';
import type { Alert, Case } from '../types/case';
import GlobalSearch from '../components/GlobalSearch';
import AlertFilters, { type RiskFilter, type StatusFilter, type TimeFilter } from '../components/AlertFilters';
import FraudActivityChart from '../components/FraudActivityChart';
import NetworkIntelligenceSummary from '../components/NetworkIntelligence';
import SystemStatus from '../components/SystemStatus';
import { useCases } from '../hooks/useCases';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { casesApi } from '../services/api';

const ALERT_REFRESH_MS = 30_000;

function fallbackDossier(alert: Alert): Case {
  return {
    id: alert.case_id,
    case_id: alert.case_id,
    tx_id: alert.tx_id,
    risk_score: alert.composite_risk_score,
    composite_risk_score: alert.composite_risk_score,
    risk_tier: alert.risk_tier,
    status: alert.status,
    created_at: alert.timestamp,
    sender_account_id: alert.sender_account_id,
    receiver_account_id: alert.receiver_account_id,
    amount: alert.amount,
    currency: alert.currency,
    graph_data: { nodes: [], edges: [] },
  };
}

export default function Dashboard() {
  const {
    cases: liveCases,
    loading: alertsLoading,
    error: alertsError,
    refreshCases: loadAlerts,
  } = useCases();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const {
    metrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refreshMetrics,
  } = useDashboardMetrics();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24H');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAlerts(liveCases);
  }, [liveCases]);

  useEffect(() => {
    intervalRef.current = setInterval(loadAlerts, ALERT_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadAlerts]);

  const handleAlertClick = useCallback(async (alert: Alert) => {
    try {
      const caseData = await casesApi.getCaseDetails(alert.case_id);
      setSelectedCase(caseData);
    } catch {
      // Keep the row actionable even if the detail request briefly fails.
      setSelectedCase(fallbackDossier(alert));
    }
    setDossierOpen(true);
  }, []);

  const handleCloseDossier = useCallback(() => {
    setDossierOpen(false);
    setTimeout(() => setSelectedCase(null), 300);
  }, []);

  const handleActionSuccess = useCallback((caseId: string, action: string) => {
    const statusMap: Record<string, Alert['status']> = {
      CONFIRM_FRAUD: 'CONFIRMED_FRAUD',
      RELEASE_HOLD: 'RELEASED',
      FALSE_POSITIVE: 'CLEARED',
    };
    const newStatus = statusMap[action];
    if (newStatus) {
      setAlerts((previous) => previous.map((alert) => (
        alert.case_id === caseId ? { ...alert, status: newStatus } : alert
      )));
    }
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    const query = searchQuery.trim().toLowerCase();
    if (query && ![
      alert.tx_id,
      alert.case_id,
      alert.sender_account_id,
      alert.receiver_account_id,
    ].some((value) => value.toLowerCase().includes(query))) {
      return false;
    }
    if (riskFilter !== 'ALL' && alert.risk_tier !== riskFilter) return false;
    if (statusFilter !== 'ALL' && alert.status !== statusFilter) return false;

    const hoursByFilter: Record<TimeFilter, number> = {
      '1H': 1,
      '6H': 6,
      '24H': 24,
      '7D': 24 * 7,
    };
    const ageHours = (Date.now() - new Date(alert.timestamp).getTime()) / 3_600_000;
    return !Number.isFinite(ageHours) || ageHours <= hoursByFilter[timeFilter];
  });

  const environmentLabel = alertsError ? 'Offline' : 'Live';

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 lg:px-6 py-5 flex flex-col gap-0">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" aria-hidden />
              <span className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">Live — Monitoring Active</span>
            </div>
            <h1 className="text-text-primary font-bold text-2xl tracking-tight">Fraud Intelligence</h1>
            <p className="text-text-secondary text-sm mt-0.5">Real-time monitoring across connected financial networks</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <GlobalSearch query={searchQuery} onQueryChange={setSearchQuery} />
            <nav aria-label="Dashboard sections" className="flex items-center gap-1 rounded-lg border border-border bg-surface-secondary p-1 text-[10px] font-semibold uppercase tracking-wider">
              <a className="rounded-md px-2 py-1 text-text-secondary hover:bg-surface hover:text-primary" href="#metrics">Overview</a>
              <a className="rounded-md px-2 py-1 text-text-secondary hover:bg-surface hover:text-primary" href="#analysis">Analysis</a>
              <a className="rounded-md px-2 py-1 text-text-secondary hover:bg-surface hover:text-primary" href="#alerts">Alerts</a>
            </nav>
            <div className="text-right ml-1">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Environment</p>
              <p className="text-xs text-text-primary font-mono font-semibold">TRUSTGRAPH v1.0 · {environmentLabel}</p>
            </div>
          </div>
        </div>

        <div id="metrics" className="scroll-mt-20">
          <MetricsGrid
            metrics={metrics}
            loading={metricsLoading}
            error={metricsError}
            onRetry={refreshMetrics}
          />
        </div>

        <div id="analysis" className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6 mb-6 scroll-mt-20">
          <FraudActivityChart alerts={alerts} />
          <NetworkIntelligenceSummary metrics={metrics} />
          <SystemStatus
            backendOnline={!alertsError && !metricsError}
            aiOnline={!metricsError}
            blockchainOnline={!metricsError}
            blockchainMode={metrics.blockchain_mode}
            hasLiveCases={alerts.length > 0}
          />
        </div>

        <div id="alerts" className="scroll-mt-20">
          <AlertFilters
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
          />

          <div className="mt-4 flex-1">
            <LiveAlertStream
              alerts={filteredAlerts}
              loading={alertsLoading}
              error={alertsError}
              onRetry={loadAlerts}
              onAlertClick={handleAlertClick}
            />
          </div>
        </div>
      </main>

      <CaseDossierModal
        caseData={selectedCase}
        open={dossierOpen}
        onClose={handleCloseDossier}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
}
