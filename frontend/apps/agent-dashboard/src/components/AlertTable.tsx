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
            <th className="px-5 py-3 font-semibold">Stage</th>
            <th className="px-5 py-3 font-semibold">Score</th>
            <th className="px-5 py-3 font-semibold">Account / Alert</th>
            <th className="px-5 py-3 font-semibold">RM exposure</th>
            <th className="px-5 py-3 font-semibold">Pattern</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-muted-text">
                No alerts loaded. Demo fallback should seed mule alerts before rehearsal.
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
                  <StagePill alert={alert} />
                </td>
                <td className="px-5 py-4">
                  <RiskScoreBadge score={alert.score} size="sm" />
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-text-primary">
                    {alert.txn.payee_name}
                  </div>
                  <div className="text-caption text-muted-text">
                    {typeLabel(alert)} / {alert.txn.payee_account}
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-base font-bold text-text-primary">
                  RM {(alert.rm_at_risk ?? alert.txn.amount).toLocaleString('en-MY')}
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

function StagePill({ alert }: { alert: Alert }) {
  if (alert.alert_type === 'mule_eviction' && alert.mule_stage) {
    const map = {
      1: { bg: '#FEFCE8', fg: '#A16207', label: 'Stage 1' },
      2: { bg: '#FFF7ED', fg: '#C2410C', label: 'Stage 2' },
      3: { bg: '#FEF2F2', fg: '#DC2626', label: 'Stage 3' },
    } satisfies Record<1 | 2 | 3, { bg: string; fg: string; label: string }>;
    const c = map[alert.mule_stage];
    return (
      <span
        className="inline-flex items-center rounded-pill px-3 py-1 text-small-label font-bold"
        style={{ backgroundColor: c.bg, color: c.fg }}
      >
        {c.label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-pill px-3 py-1 text-small-label font-semibold"
      style={{ backgroundColor: '#EAF3FF', color: '#005BAC' }}
    >
      Sender
    </span>
  );
}

function typeLabel(alert: Alert): string {
  if (alert.alert_type === 'mule_eviction') return 'Mule eviction';
  return 'Sender interception';
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
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleString();
}
