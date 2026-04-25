import { useState } from 'react';
import type { AgentDecision } from 'shared';

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
          className="rounded-md px-4 py-3 text-caption font-semibold"
          style={{ backgroundColor: '#ECFDF5', color: '#166534' }}
        >
          Decision recorded — alert is now{' '}
          <span className="uppercase tracking-wide">{status}</span>. Re-deciding
          will overwrite the log.
        </p>
      )}

      <button
        type="button"
        onClick={() => run('block')}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg font-bold text-white transition-colors disabled:opacity-60"
        style={{ backgroundColor: '#DC2626' }}
      >
        {pending === 'block' ? 'Blocking…' : 'Block transaction'}
      </button>

      <button
        type="button"
        onClick={() => run('warn')}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg font-bold transition-transform active:translate-y-[2px] disabled:opacity-60"
        style={{
          backgroundColor: '#FFE600',
          color: '#0055D4',
          boxShadow: '0 4px 0 #0055D4',
        }}
      >
        {pending === 'warn' ? 'Sending warning…' : 'Issue warning to user'}
      </button>

      <button
        type="button"
        onClick={() => run('clear')}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-60"
        style={{ backgroundColor: '#EAF3FF', color: '#005BAC' }}
      >
        {pending === 'clear' ? 'Clearing…' : 'Clear as false positive'}
      </button>
    </div>
  );
}
