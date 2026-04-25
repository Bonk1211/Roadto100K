import type { InvestigationAlert } from '../lib/investigations/types.js';
import { LoadingDots } from 'shared';
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
      className="rounded-[24px] bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[150px]" />
          <col className="w-[180px]" />
          <col className="w-[140px]" />
          <col className="w-[210px]" />
          <col className="w-[230px]" />
          <col className="w-[140px]" />
          <col className="w-[130px]" />
        </colgroup>
        <thead className="bg-app-gray text-small-label uppercase tracking-wide text-muted-text">
          <tr>
            <th className="px-5 py-3 font-semibold">Alert</th>
            <th className="px-5 py-3 font-semibold">Type</th>
            <th className="px-5 py-3 font-semibold">Stage</th>
            <th className="px-5 py-3 font-semibold">Account</th>
            <th className="px-5 py-3 font-semibold">Transfer</th>
            <th className="px-5 py-3 font-semibold">RM at risk</th>
            <th className="px-5 py-3 font-semibold">Severity</th>
          </tr>
        </thead>
        <tbody>
          {loading && alerts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-muted-text">
                <LoadingDots label="Loading queue" tone="muted" centered />
              </td>
            </tr>
          )}
          {!loading && alerts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-muted-text">
                No alerts matched.
              </td>
            </tr>
          )}
          {alerts.map((item) => {
            const selected = item.alert.id === selectedId;
            const rmAtRisk = item.alert.rm_at_risk ?? item.alert.txn.amount;
            const dbType = item.alert.alert_type ?? item.alertType;

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
                  <div className="truncate font-semibold text-text-primary">{item.alert.id}</div>
                  <div className="truncate text-caption text-muted-text">{item.alert.txn.txn_id}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="truncate font-semibold text-text-primary">{alertTypeLabel(dbType)}</div>
                  <div className="truncate text-caption text-muted-text">{dbType}</div>
                </td>
                <td className="px-5 py-4">
                  <StagePill stage={item.stage} />
                  <div className="mt-1 text-caption text-muted-text">{item.stageReason}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="truncate font-semibold text-text-primary">
                    {item.alert.txn.payee_account}
                  </div>
                  <div className="truncate text-caption text-muted-text">
                    {item.alert.txn.payee_name} - {item.linkedAccountCount} linked account
                    {item.linkedAccountCount === 1 ? '' : 's'}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="truncate font-mono text-caption font-semibold text-text-primary">
                    {item.alert.txn.user_id}
                  </div>
                  <div className="truncate font-mono text-caption text-muted-text">
                    -&gt; {item.alert.txn.payee_id}
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-base font-bold text-text-primary">
                  RM {rmAtRisk.toLocaleString('en-MY')}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <RiskScoreBadge score={item.alert.score} size="sm" />
                    <div>
                      <div className="font-semibold text-text-primary">
                        {bandLabel(item.alert.score)}
                      </div>
                      <div className="text-caption text-muted-text">
                        {item.alert.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
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

function alertTypeLabel(alertType: string): string {
  if (alertType === 'mule_eviction') return 'Mule eviction';
  if (alertType === 'bulk_containment') return 'Bulk containment';
  return 'Sender interception';
}

function bandLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'Elevated';
  return 'Monitor';
}
