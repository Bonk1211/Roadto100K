import type { Alert } from 'shared';
import { RiskScoreBadge } from './RiskScoreBadge.js';
import { ScamTypeChip } from './ScamTypeChip.js';

interface Props {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (alertId: string) => void;
}

export function AlertTable({ alerts, selectedId, onSelect }: Props) {
  return (
    <div
      className="overflow-hidden rounded-lg bg-white shadow-card"
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
            <th className="px-5 py-3 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-muted-text">
                No alerts yet — waiting for SafeSend to flag something.
              </td>
            </tr>
          )}
          {alerts.map((alert) => {
            const selected = alert.id === selectedId;
            return (
              <tr
                key={alert.id}
                onClick={() => onSelect(alert.id)}
                className={`cursor-pointer border-t transition-colors ${
                  selected ? 'bg-soft-blue-surface' : 'hover:bg-app-gray'
                }`}
                style={{ borderColor: '#E5E7EB' }}
              >
                <td className="px-5 py-4">
                  <RiskScoreBadge score={alert.score} size="sm" />
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-text-primary">
                    {alert.txn.user_id}{' '}
                    <span className="text-muted-text">→</span>{' '}
                    {alert.txn.payee_name}
                  </div>
                  <div className="text-caption text-muted-text">
                    {alert.txn.payee_account} ·{' '}
                    {alert.txn.is_new_payee ? 'new payee' : 'recurring payee'}
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-base font-bold text-text-primary">
                  RM {alert.txn.amount.toLocaleString('en-MY')}
                </td>
                <td className="px-5 py-4">
                  <ScamTypeChip scamType={alert.explanation.scam_type} />
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={alert.status} />
                </td>
                <td className="px-5 py-4 text-caption text-muted-text">
                  {relativeTime(alert.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
      className="inline-flex items-center rounded-pill px-3 py-1 text-small-label font-semibold"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
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
