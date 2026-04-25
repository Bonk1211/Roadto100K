import { useEffect, useMemo, useState } from 'react';
import type { Alert, AgentDecision, DashboardStats } from 'shared';
import { AlertTable } from '../components/AlertTable.js';
import { StatsBar } from '../components/StatsBar.js';
import { fetchAlerts, fetchStats, postDecision } from '../lib/api.js';
import { AlertDetail } from './AlertDetail.js';

const POLL_INTERVAL_MS = 5000;

interface Toast {
  message: string;
  tone: 'success' | 'error';
}

export function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'decided'>('all');
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const [a, s] = await Promise.all([fetchAlerts(), fetchStats()]);
        if (!active) return;
        setAlerts(a);
        setStats(s);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        // eslint-disable-next-line no-console
        console.error('refresh failed', err);
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

  const sorted = useMemo(
    () => [...alerts].sort((a, b) => b.score - a.score),
    [alerts],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted;
    if (filter === 'open') return sorted.filter((a) => a.status === 'open');
    return sorted.filter((a) => a.status !== 'open');
  }, [sorted, filter]);

  const selected = useMemo(
    () => alerts.find((a) => a.id === selectedId) ?? null,
    [alerts, selectedId],
  );

  // Auto-select the highest-risk open alert if nothing selected.
  useEffect(() => {
    if (selectedId !== null) return;
    const top = sorted.find((a) => a.status === 'open');
    if (top) setSelectedId(top.id);
  }, [sorted, selectedId]);

  async function handleDecide(alertId: string, action: AgentDecision) {
    try {
      const res = await postDecision(alertId, action);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? res.alert : a)));
      const verb =
        action === 'block'
          ? 'blocked transaction'
          : action === 'warn'
            ? 'sent warning to user'
            : 'cleared as false positive';
      setToast({
        message: `Successfully ${verb}${res.sms_sent ? ' · SMS sent' : ''}.`,
        tone: 'success',
      });
      const fresh = await fetchStats();
      setStats(fresh);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setToast({ message: 'Failed to record decision. See console.', tone: 'error' });
    } finally {
      window.setTimeout(() => setToast(null), 3500);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <StatsBar stats={stats} />

      <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2.1fr)_minmax(420px,1fr)]">
        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-section-heading text-text-primary">
                Live alert queue
              </h2>
              <p className="text-caption text-muted-text">
                {loading
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
            <AlertTable
              alerts={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        <div className="min-h-0">
          <AlertDetail alert={selected} onDecide={handleDecide} />
        </div>
      </div>

      {toast && (
        <div
          className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-lg px-5 py-4 shadow-elevated"
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
