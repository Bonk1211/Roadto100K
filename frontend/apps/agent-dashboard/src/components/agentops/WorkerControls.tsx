import { useState } from 'react';
import {
  pauseWorker,
  resumeWorker,
  type WorkerState,
} from '../../lib/agentops.js';

interface Props {
  state: WorkerState | null;
  liveCount: number;
  onChanged: (next: WorkerState) => void;
}

export function WorkerControls({ state, liveCount, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = state?.paused === true;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const next = paused ? await resumeWorker() : await pauseWorker();
      onChanged(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setBusy(false);
    }
  }

  const pillBg = paused ? '#FEF3C7' : '#ECFDF5';
  const pillFg = paused ? '#92400E' : '#166534';
  const pillDot = paused ? '#F59E0B' : '#16A34A';

  const btnBg = paused ? '#16A34A' : '#DC2626';
  const btnHover = paused ? '#15803D' : '#B91C1C';

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-[24px]"
          style={{
            backgroundColor: paused ? '#FEF3C7' : '#EAF3FF',
            border: `1.5px solid ${paused ? '#FDE68A' : '#BFDBFE'}`,
          }}
        >
          {paused ? '⏸' : '⚙️'}
        </div>
        <div className="min-w-0">
          <p className="text-feature-title text-text-primary">Live verification</p>
          <p className="text-caption text-muted-text">
            {paused
              ? 'Paused — worker idle, no new alerts will be picked up.'
              : 'Worker auto-claims open alerts. Pausing lets in-flight runs finish.'}
          </p>
          {state?.updated_at && (
            <p className="text-small-label text-muted-text">
              Last change {new Date(state.updated_at).toLocaleTimeString()} by{' '}
              <span className="font-mono">{state.updated_by ?? 'system'}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-pill px-3 py-1 text-small-label font-bold uppercase tracking-wide"
          style={{ backgroundColor: pillBg, color: pillFg }}
        >
          <span className="inline-block h-2 w-2 rounded-pill" style={{ backgroundColor: pillDot }} />
          {paused ? 'Paused' : 'Running'}
        </span>
        {liveCount > 0 && paused && (
          <span
            className="inline-flex items-center gap-1 rounded-pill px-3 py-1 text-small-label font-semibold"
            style={{ backgroundColor: '#EAF3FF', color: '#0F3B82' }}
          >
            {liveCount} run{liveCount === 1 ? '' : 's'} draining…
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = btnBg)}
          className="rounded-pill px-5 py-2 text-base font-bold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: btnBg }}
        >
          {busy ? '…' : paused ? '▶ Resume verification' : '■ Stop live verification'}
        </button>
      </div>

      {error && (
        <p className="w-full text-caption" style={{ color: '#DC2626' }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
