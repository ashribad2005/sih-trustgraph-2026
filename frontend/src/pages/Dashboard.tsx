import { useState, useCallback, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import MetricsGrid from '../components/MetricsGrid';
import LiveAlertStream from '../components/LiveAlertStream';
import CaseDossierModal from '../components/CaseDossierModal';
import { mockCases } from '../data/mockData';
import type { Alert, Case } from '../types/case';
import GlobalSearch from '../components/GlobalSearch';
import AlertFilters, { type RiskFilter, type StatusFilter, type TimeFilter } from '../components/AlertFilters';
import FraudActivityChart from '../components/FraudActivityChart';
import NetworkIntelligenceSummary from '../components/NetworkIntelligence';
import SystemStatus from '../components/SystemStatus';
import { useCases } from '../hooks/useCases';
import { casesApi } from '../services/api';

// ── Auto-refresh interval (ms) ───────────────────────────────────────────────
// Set to 30 seconds for live polling. Use 0 to disable.
const ALERT_REFRESH_MS = 30_000;

export default function Dashboard() {
  const {
    alerts: liveCases,
    isLoading: alertsLoading,
    error: alertsError,
    refetch: loadAlerts,
    isUsingMockData,
  } = useCases();

  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Sync live cases into local state (allows optimistic updates)
  useEffect(() => {
    setAlerts(liveCases);
  }, [liveCases]);

  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24H');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-refresh polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (ALERT_REFRESH_MS > 0) {
      intervalRef.current = setInterval(loadAlerts, ALERT_REFRESH_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadAlerts]);

  // ── Open case dossier from alert click ────────────────────────────────────
  const handleAlertClick = useCallback(async (alert: Alert) => {
    // Try to fetch from the backend first
    try {
      const caseData = await casesApi.getCaseDetails(alert.case_id);
      setSelectedCase(caseData);
    } catch {
      // Fallback to mock data if backend unavailable
      const caseData = mockCases[alert.case_id] ?? null;
      setSelectedCase(caseData);
    }
    setDossierOpen(true);
  }, []);

  const handleCloseDossier = useCallback(() => {
    setDossierOpen(false);
    // Keep selectedCase so modal transition is smooth
    setTimeout(() => setSelectedCase(null), 300);
  }, []);

  const handleActionSuccess = useCallback((caseId: string, action: string) => {
    console.info(`[TRUSTGRAPH] Investigator action: ${action} on case ${caseId}`);

    // Map action → status for local optimistic update
    const statusMap: Record<string, import('../types/transaction').TransactionStatus> = {
      CONFIRM_FRAUD: 'CONFIRMED_FRAUD',
      RELEASE_HOLD: 'RELEASED',
      FALSE_POSITIVE: 'CLEARED',
    };
    const newStatus = statusMap[action];
    if (newStatus) {
      setAlerts((prev) =>
        prev.map((a) =>
          a.case_id === caseId ? { ...a, status: newStatus } : a
        )
      );
    }
  }, []);

  const filteredAlerts = alerts.filter(a => {
    // 1. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !a.tx_id.toLowerCase().includes(q) &&
        !a.case_id.toLowerCase().includes(q) &&
        !a.sender_account_id.toLowerCase().includes(q) &&
        !a.receiver_account_id.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    // 2. Risk Filter
    if (riskFilter !== 'ALL' && a.risk_tier !== riskFilter) return false;
    // 3. Status Filter
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    // Note: Time filter would be applied against actual timestamps here in prod
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 lg:px-6 py-5 flex flex-col gap-0">
        {/* Page title */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" aria-hidden />
              <span className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">Live — Monitoring Active</span>
            </div>
            <h1 className="text-text-primary font-bold text-2xl tracking-tight">
              Fraud Intelligence
            </h1>
            <p className="text-text-secondary text-sm mt-0.5">
              Real-time monitoring across connected financial networks
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 mt-1">
            <GlobalSearch query={searchQuery} onQueryChange={setSearchQuery} />
            <div className="text-right ml-4">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Environment</p>
              <p className="text-xs text-text-primary font-mono font-semibold">
                TRUSTGRAPH v1.0 · {isUsingMockData ? 'Mock' : 'Live'}
              </p>
            </div>
            <div className="w-px h-8 bg-border mx-2" />
            <div className="text-right">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Analyst</p>
              <p className="text-xs text-text-primary font-semibold">SOC-L2</p>
            </div>
          </div>
        </div>

        {/* Top Section: Metrics */}
        <MetricsGrid />

        {/* Middle Section: Dashboard Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6 mb-6">
          <FraudActivityChart />
          <NetworkIntelligenceSummary />
          <SystemStatus />
        </div>

        {/* Alerts Section Filters */}
        <AlertFilters 
          riskFilter={riskFilter} setRiskFilter={setRiskFilter}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          timeFilter={timeFilter} setTimeFilter={setTimeFilter}
        />

        {/* Live alerts — grows to fill remaining space */}
        <div className="mt-4 flex-1">
          <LiveAlertStream
            alerts={filteredAlerts}
            loading={alertsLoading}
            error={alertsError}
            onRetry={loadAlerts}
            onAlertClick={handleAlertClick}
          />
        </div>
      </main>

      {/* Case Dossier Modal */}
      <CaseDossierModal
        caseData={selectedCase}
        open={dossierOpen}
        onClose={handleCloseDossier}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
}
