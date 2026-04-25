import { useEffect, useMemo, useState } from 'react';
import type { AgentDecision, DashboardStats, NetworkGraph } from 'shared';
import { StatsBar } from '../components/StatsBar.js';
import { fetchAlerts, fetchNetworkGraph, fetchStats, postDecision } from '../lib/api.js';
import { buildInvestigationAlerts } from '../lib/investigations/alertAdapter.js';
import { deriveContainmentCandidates } from '../lib/investigations/containmentAdapter.js';
import {
  DEFAULT_QUERY_STATE,
  runNaturalLanguageQuery,
} from '../lib/investigations/queryAdapter.js';
import type { InvestigationAlert, QueryResultState } from '../lib/investigations/types.js';
import { ContainmentPanel } from '../modules/investigations/ContainmentPanel.js';
import { InvestigationDetailPanel } from '../modules/investigations/InvestigationDetailPanel.js';
import { InvestigationQueuePanel } from '../modules/investigations/InvestigationQueuePanel.js';
import { InvestigationToolbar } from '../modules/investigations/InvestigationToolbar.js';
import { NlpQueryDrawer } from '../modules/investigations/NlpQueryDrawer.js';

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

  function resetQuery() {
    setQuery('');
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <StatsBar stats={stats} />

      <InvestigationToolbar
        filteredCount={filtered.length}
        totalCount={alerts.length}
        queryActive={query.trim().length > 0}
        queryState={queryState}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="grid flex-1 grid-cols-1 gap-6 2xl:grid-cols-[minmax(340px,1.15fr)_minmax(420px,1fr)_minmax(360px,0.9fr)]">
        <InvestigationQueuePanel
          alerts={filtered}
          selectedId={selected?.alert.id ?? null}
          loading={loading}
          onSelect={setSelectedId}
        />

        <div className="min-h-0">
          <InvestigationDetailPanel alert={selected} onDecide={handleDecide} />
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
