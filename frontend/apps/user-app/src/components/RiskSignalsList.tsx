import type { RiskSignal } from 'shared';

interface Props {
  signals: RiskSignal[];
}

export default function RiskSignalsList({ signals }: Props) {
  const triggered = signals.filter((s) => s.triggered);
  if (triggered.length === 0) {
    return (
      <p className="text-[13px] text-muted-text">No risk signals triggered.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {triggered.map((s) => (
        <li
          key={s.id}
          className="flex items-start gap-2.5 bg-white border border-fraud-warning-border/50 rounded-md px-3 py-2.5"
        >
          <span className="mt-0.5 w-5 h-5 rounded-full bg-risk-red text-white grid place-items-center text-[11px] font-bold flex-shrink-0">
            !
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-text-primary">{s.label}</div>
            {s.detail && (
              <div className="text-[12px] text-muted-text mt-0.5">{s.detail}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
