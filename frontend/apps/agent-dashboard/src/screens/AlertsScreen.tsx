import { useEffect, useMemo, useState } from 'react';
import type { Alert, AgentDecision, DashboardStats } from 'shared';
import { AlertTable } from '../components/AlertTable.js';
import { FraudQueryBar } from '../components/FraudQueryBar.js';
import { FraudQueryResults } from '../components/FraudQueryResults.js';
import { StatsBar } from '../components/StatsBar.js';
import {
  fetchAlerts,
  fetchStats,
  postDecision,
  type FraudQueryResponse,
} from '../lib/api.js';
import { AlertDetail } from './AlertDetail.js';

const POLL_INTERVAL_MS = 5000;

interface Toast {
  message: string;
  tone: 'success' | 'error';
}

export function AlertsScreen() {
  const [alerts, setAlerts] = useState<InvestigationAlert[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [queryState, setQueryState] = useState<QueryResultState>(DEFAULT_QUERY_STATE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryResults, setQueryResults] = useState<FraudQueryResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const [rawAlerts, rawStats, rawGraph] = await Promise.all([
          fetchAlerts(),
          fetchStats(),
          fetchNetworkGraph(),
        ]);
        if (!active) return;
        setGraph(rawGraph);
        setAlerts(buildInvestigationAlerts(rawAlerts, rawGraph));
        setStats(rawStats);
        setLoading(false);
      } catch (error) {
        if (!active) return;
        console.error('refresh failed', error);
        setLoading(false);
      }
    }

    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const computedQueryState = useMemo(
    () => runNaturalLanguageQuery(query, alerts),
    [alerts, query],
  );

  useEffect(() => {
    setQueryState(computedQueryState);
  }, [computedQueryState]);

  const filtered = useMemo(() => {
    const allowed = new Set(queryState.matchingIds);
    if (allowed.size === 0) return alerts;
    return alerts.filter((alert) => allowed.has(alert.alert.id));
  }, [alerts, queryState.matchingIds]);

  const selected = useMemo(
    () => filtered.find((alert) => alert.alert.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const containmentCandidates = useMemo(
    () => deriveContainmentCandidates(graph, selected),
    [graph, selected],
  );

  useEffect(() => {
    if (!selected && filtered.length > 0) {
      setSelectedId(filtered[0].alert.id);
    }
  }, [filtered, selected]);

  async function handleDecide(alertId: string, action: AgentDecision) {
    try {
      const result = await postDecision(alertId, action);
      setAlerts((prev) =>
        buildInvestigationAlerts(
          prev.map((item) => (item.alert.id === alertId ? result.alert : item.alert)),
          graph,
        ),
      );
      setToast({
        message:
          action === 'block'
            ? 'Block recorded.'
            : action === 'warn'
              ? 'Warning recorded.'
              : 'Alert cleared.',
        tone: 'success',
      });
      setStats(await fetchStats());
    } catch (error) {
      console.error(error);
      setToast({ message: 'Action failed.', tone: 'error' });
    } finally {
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  const showingQuery = queryResults !== null;

  return (
    <div className="flex h-full flex-col gap-6">
      <StatsBar stats={stats} />

      <FraudQueryBar onResults={setQueryResults} />

      <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2.1fr)_minmax(420px,1fr)]">
        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-section-heading text-text-primary">
                {showingQuery ? 'Query results' : 'Live alert queue'}
              </h2>
              <p className="text-caption text-muted-text">
                {showingQuery
                  ? `${queryResults!.count} match${queryResults!.count === 1 ? '' : 'es'} for "${queryResults!.question}"`
                  : loading
                    ? 'Loading flagged transactions…'
                    : `${filtered.length} alert${filtered.length === 1 ? '' : 's'} · refreshes every ${POLL_INTERVAL_MS / 1000}s`}
              </p>
            </div>
            <div
              className="inline-flex rounded-pill p-1"
              style={{ backgroundColor: '#EAF3FF' }}
            >
              {(['all', 'open', 'decided'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFilter(opt)}
                  className="rounded-pill px-4 py-1 text-small-label font-semibold capitalize transition-colors"
                  style={{
                    backgroundColor: filter === opt ? '#005BAC' : 'transparent',
                    color: filter === opt ? '#FFFFFF' : '#005BAC',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {showingQuery ? (
              <FraudQueryResults alerts={queryResults!.alerts} />
            ) : (
              <AlertTable
                alerts={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        </div>

        <div className="min-h-0">
          <ContainmentPanel
            candidates={containmentCandidates}
            focusLabel={selected?.accountLabel}
          />
        </div>
      </div>

      <NlpQueryDrawer
        isOpen={drawerOpen}
        query={query}
        queryState={queryState}
        onClose={() => setDrawerOpen(false)}
        onQueryChange={setQuery}
        onReset={resetQuery}
      />

      {toast && (
        <div
          className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-4 shadow-elevated"
          style={{
            backgroundColor: toast.tone === 'success' ? '#0055D4' : '#DC2626',
            color: '#FFFFFF',
            maxWidth: 420,
          }}
        >
          <p className="font-semibold">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
