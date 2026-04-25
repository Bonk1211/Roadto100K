import { useEffect, useMemo, useState } from 'react';
import type { DashboardStats, NetworkGraph } from 'shared';
import { AlertTable } from '../components/AlertTable.js';
import { FraudQueryBar } from '../components/FraudQueryBar.js';
import { FraudQueryResults } from '../components/FraudQueryResults.js';
import { StatsBar } from '../components/StatsBar.js';
import {
  fetchAlerts,
  fetchNetworkGraph,
  fetchStats,
  type FraudQueryResponse,
} from '../lib/api.js';
import { buildInvestigationAlerts } from '../lib/investigations/alertAdapter.js';
import { deriveContainmentCandidates } from '../lib/investigations/containmentAdapter.js';
import type { InvestigationAlert } from '../lib/investigations/types.js';
import { ContainmentPanel } from '../modules/investigations/ContainmentPanel.js';

const POLL_INTERVAL_MS = 5000;

type FilterOption = 'all' | 'open' | 'decided';

interface Toast {
  message: string;
  tone: 'success' | 'error';
}

export function AlertsScreen() {
  const [alerts, setAlerts] = useState<InvestigationAlert[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
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

  const filtered = useMemo(() => {
    if (filter === 'open') return alerts.filter((item) => item.alert.status === 'open');
    if (filter === 'decided') return alerts.filter((item) => item.alert.status !== 'open');
    return alerts;
  }, [alerts, filter]);

  const selected = useMemo(
    () => filtered.find((item) => item.alert.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const containmentCandidates = useMemo(
    () => deriveContainmentCandidates(graph, selected?.alert ?? null),
    [graph, selected],
  );

  useEffect(() => {
    if (!selected && filtered.length > 0) {
      setSelectedId(filtered[0].alert.id);
    }
  }, [filtered, selected]);

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
                loading={loading}
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
