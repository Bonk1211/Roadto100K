import type { InvestigationAlert } from '../lib/investigations/types.js';
import { LoadingDots } from 'shared';
import { RiskScoreBadge } from './RiskScoreBadge.js';

interface Props {
  alerts: InvestigationAlert[];
  selectedId: string | null;
  freshIds?: Set<string>;
  onSelect: (alertId: string) => void;
  loading?: boolean;
}

export function AlertTable({ alerts, selectedId, freshIds, onSelect }: Props) {
  return (
    <div
      className="overflow-hidden rounded-[24px] bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-app-gray text-small-label uppercase tracking-wide text-muted-text">
          <tr>
            <th className="px-5 py-3 font-semibold">Score</th>
            <th className="px-5 py-3 font-semibold">User → Payee</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Scam type</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Latency</th>
            <th className="px-5 py-3 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {loading && alerts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-muted-text">
                <LoadingDots label="Loading queue" tone="muted" centered />
              </td>
            </tr>
          )}
          {!loading && alerts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-muted-text">
                No alerts yet — waiting for SafeSend to flag something.
              </td>
            </tr>
          )}
          {alerts.map((alert) => {
            const selected = alert.id === selectedId;
            const fresh = freshIds?.has(alert.id) ?? false;
            return (
              <tr
                key={item.alert.id}
                onClick={() => onSelect(item.alert.id)}
                className={`cursor-pointer border-t transition-colors ${selected ? 'bg-soft-blue-surface' : 'hover:bg-app-gray'
                  } ${fresh ? 'safesend-fresh-row' : ''}`}
                style={{ borderColor: '#E5E7EB' }}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <RiskScoreBadge score={alert.score} size="sm" />
                    {fresh && <NewPulse />}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-text-primary">{item.accountLabel}</div>
                  <div className="text-caption text-muted-text">
                    {item.alert.txn.payee_account} · {item.linkedAccountCount} linked account{item.linkedAccountCount === 1 ? '' : 's'}
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-base font-bold text-text-primary">
                  RM {item.rmAtRisk.toLocaleString('en-MY')}
                </td>
                <td className="px-5 py-4">
                  <ScamTypeChip scamType={alert.explanation.scam_type} />
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={alert.status} />
                </td>
                <td className="px-5 py-4">
                  <LatencyChip ms={alert.processed_ms} />
                </td>
                <td className="px-5 py-4 text-caption text-muted-text">
                  {relativeTime(item.alert.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NewPulse() {
  return (
    <span className="relative inline-flex items-center">
      <span
        className="absolute inline-flex h-full w-full rounded-pill opacity-75 animate-ping"
        style={{ backgroundColor: '#DC2626' }}
      />
      <span
        className="relative inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
        style={{ backgroundColor: '#DC2626' }}
      >
        NEW
      </span>
    </span>
  );
}

function LatencyChip({ ms }: { ms?: number }) {
  if (ms == null) {
    return <span className="text-caption text-muted-text">—</span>;
  }
  const tone = ms < 200 ? '#16A34A' : ms < 500 ? '#F97316' : '#DC2626';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-small-label font-bold font-mono"
      style={{ backgroundColor: '#F3F4F6', color: tone }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-pill"
        style={{ backgroundColor: tone }}
      />
      {ms}ms
    </span>
  );
}

function StatusPill({ status }: { status: Alert['status'] }) {
  const map: Record<Alert['status'], { bg: string; fg: string; label: string }> = {
    open: { bg: '#FEF3C7', fg: '#92400E', label: 'Open' },
    blocked: { bg: '#FEF2F2', fg: '#DC2626', label: 'Blocked' },
    warned: { bg: '#FFE600', fg: '#0055D4', label: 'Warned' },
    cleared: { bg: '#ECFDF5', fg: '#166534', label: 'Cleared' },
  };
  const c = map[status];
  return (
    <span
      className="inline-flex rounded-pill px-3 py-1 text-small-label font-semibold"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {colors.label}
    </span>
  );
}

function bandLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'Elevated';
  return 'Monitor';
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleString();
}
