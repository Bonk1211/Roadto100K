import { useState } from 'react';
import type { AgentDecision } from 'shared';
import { LoadingDots } from 'shared';

interface Props {
  alertId: string;
  status: 'open' | 'blocked' | 'warned' | 'cleared';
  onDecide: (action: AgentDecision) => Promise<void>;
}

export function ActionButtons({ alertId, status, onDecide }: Props) {
  const [pending, setPending] = useState<AgentDecision | null>(null);
  const decided = status !== 'open';

  async function run(action: AgentDecision) {
    setPending(action);
    try {
      await onDecide(action);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-alert-id={alertId}>
      {decided && (
        <p
          className="rounded-2xl px-4 py-3 text-caption font-semibold"
          style={{ backgroundColor: '#ECFDF5', color: '#166534' }}
        >
          Decision recorded. Alert is now <span className="uppercase tracking-wide">{status}</span>.
        </p>
      )}

      <button
        type="button"
        onClick={() => run('block')}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold text-white transition-colors disabled:opacity-60"
        style={{ backgroundColor: '#DC2626' }}
      >
        {pending === 'block' ? <LoadingDots label="Recording block" tone="inverse" size="sm" /> : 'Block / suspend now'}
      </button>

      <button
        type="button"
        onClick={() => run('warn')}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold transition-transform active:translate-y-[2px] disabled:opacity-60"
        style={{
          backgroundColor: '#FFE600',
          color: '#0055D4',
          boxShadow: '0 4px 0 #0055D4',
        }}
      >
        {pending === 'warn' ? <LoadingDots label="Sending warning" tone="primary" size="sm" /> : 'Warn and keep on watchlist'}
      </button>

      <button
        type="button"
        onClick={() => run('clear')}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:opacity-60"
        style={{ backgroundColor: '#EAF3FF', color: '#005BAC' }}
      >
        {pending === 'clear' ? <LoadingDots label="Clearing" tone="primary" size="sm" /> : 'Clear as false positive'}
      </button>
    </div>
  );
}
