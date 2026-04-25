import type { RiskSignal } from 'shared';

interface Props {
  signals: RiskSignal[];
}

export function RiskSignalsList({ signals }: Props) {
  return (
    <ul className="divide-y" style={{ borderColor: '#E5E7EB' }}>
      {signals.map((s) => (
        <li key={s.id} className="flex items-start gap-3 py-3">
          <Indicator triggered={s.triggered} />
          <div className="flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p
                className={`text-base ${
                  s.triggered ? 'font-semibold text-text-primary' : 'text-muted-text'
                }`}
              >
                {s.label}
              </p>
              <span
                className="text-small-label font-semibold"
                style={{ color: s.triggered ? '#DC2626' : '#9CA3AF' }}
              >
                +{s.weight}
              </span>
            </div>
            {s.detail && (
              <p className="mt-1 text-caption text-muted-text">{s.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Indicator({ triggered }: { triggered: boolean }) {
  return (
    <span
      className="mt-[6px] inline-block h-2.5 w-2.5 shrink-0 rounded-pill"
      style={{ backgroundColor: triggered ? '#DC2626' : '#D1D5DB' }}
      aria-hidden
    />
  );
}
