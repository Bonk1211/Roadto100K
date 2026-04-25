import type { FraudQueryAlert } from '../lib/api.js';
import { RiskScoreBadge } from './RiskScoreBadge.js';

interface Props {
  alerts: FraudQueryAlert[];
}

export function FraudQueryResults({ alerts }: Props) {
  return (
    <div
      className="overflow-hidden rounded-lg bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-app-gray text-small-label uppercase tracking-wide text-muted-text">
          <tr>
            <th className="px-5 py-3 font-semibold">Score</th>
            <th className="px-5 py-3 font-semibold">Alert ID</th>
            <th className="px-5 py-3 font-semibold">Type</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Stage</th>
            <th className="px-5 py-3 font-semibold">Account age</th>
            <th className="px-5 py-3 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-12 text-center text-muted-text">
                No alerts matched the query.
              </td>
            </tr>
          )}
          {alerts.map((a) => (
            <tr
              key={a.alert_id}
              className="border-t"
              style={{ borderColor: '#E5E7EB' }}
            >
              <td className="px-5 py-4">
                <RiskScoreBadge score={a.risk_score} size="sm" />
              </td>
              <td className="px-5 py-4 font-mono text-caption text-text-primary">
                {a.alert_id}
              </td>
              <td className="px-5 py-4 text-text-primary">{a.alert_type}</td>
              <td className="px-5 py-4 font-mono font-bold text-text-primary">
                {a.amount != null ? `RM ${a.amount.toLocaleString('en-MY')}` : '—'}
              </td>
              <td className="px-5 py-4">
                <StatusPill status={a.status} />
              </td>
              <td className="px-5 py-4 text-caption text-muted-text">{a.stage ?? '—'}</td>
              <td className="px-5 py-4 text-caption text-muted-text">
                {a.account_age_days != null ? `${a.account_age_days}d` : '—'}
              </td>
              <td className="px-5 py-4 text-caption text-muted-text">
                {relativeTime(a.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    open: { bg: '#FEF3C7', fg: '#92400E' },
    blocked: { bg: '#FEF2F2', fg: '#DC2626' },
    warned: { bg: '#FFE600', fg: '#0055D4' },
    cleared: { bg: '#ECFDF5', fg: '#166534' },
  };
  const c = map[status] ?? { bg: '#E5E7EB', fg: '#374151' };
  return (
    <span
      className="inline-flex items-center rounded-pill px-3 py-1 text-small-label font-semibold capitalize"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {status}
    </span>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleString();
}
