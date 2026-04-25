import type { InvestigationAlert } from '../lib/investigations/types.js';
import { RiskScoreBadge } from './RiskScoreBadge.js';

interface Props {
  alerts: InvestigationAlert[];
  selectedId: string | null;
  onSelect: (alertId: string) => void;
  loading?: boolean;
}

export function AlertTable({ alerts, selectedId, onSelect, loading = false }: Props) {
  return (
    <div
      className="overflow-hidden rounded-[24px] bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-app-gray text-small-label uppercase tracking-wide text-muted-text">
          <tr>
            <th className="px-5 py-3 font-semibold">Type</th>
            <th className="px-5 py-3 font-semibold">Stage</th>
            <th className="px-5 py-3 font-semibold">Account</th>
            <th className="px-5 py-3 font-semibold">RM at risk</th>
            <th className="px-5 py-3 font-semibold">Severity</th>
            <th className="px-5 py-3 font-semibold">Flagged</th>
          </tr>
        </thead>
        <tbody>
          {loading && alerts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-muted-text">
                Loading queue...
              </td>
            </tr>
          )}
          {!loading && alerts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-muted-text">
                No alerts matched.
              </td>
            </tr>
          )}
          {alerts.map((item) => {
            const selected = item.alert.id === selectedId;
            return (
              <tr
                key={item.alert.id}
                onClick={() => onSelect(item.alert.id)}
                className={`cursor-pointer border-t transition-colors ${
                  selected ? 'bg-soft-blue-surface' : 'hover:bg-app-gray'
                }`}
                style={{
                  borderColor: '#E5E7EB',
                  boxShadow: selected ? `inset 4px 0 0 ${item.queueAccent}` : undefined,
                }}
              >
                <td className="px-5 py-4">
                  <div className="font-semibold text-text-primary">
                    {item.alertType === 'mule_eviction' ? 'Mule eviction' : 'Sender interception'}
                  </div>
                  <div className="text-caption text-muted-text">{item.alertLabel}</div>
                </td>
                <td className="px-5 py-4">
                  <StagePill stage={item.stage} />
                  <div className="mt-1 text-caption text-muted-text">{item.stageReason}</div>
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
                  <div className="flex items-center gap-3">
                    <RiskScoreBadge score={item.alert.score} size="sm" />
                    <div>
                      <div className="font-semibold text-text-primary">{bandLabel(item.alert.score)}</div>
                      <div className="text-caption text-muted-text">{item.alert.status.replace('_', ' ')}</div>
                    </div>
                  </div>
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

function StagePill({ stage }: { stage: InvestigationAlert['stage'] }) {
  const colors =
    stage === 'stage_3'
      ? { bg: '#FEF2F2', fg: '#DC2626', label: 'Stage 3' }
      : stage === 'stage_2'
        ? { bg: '#FFF7ED', fg: '#C2410C', label: 'Stage 2' }
        : { bg: '#FEF3C7', fg: '#92400E', label: 'Stage 1' };

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
