import { useState } from 'react';
import {
  injectTestAlert,
  pauseWorker,
  resumeWorker,
  type AgentStats,
  type QueueDepth,
  type WorkerState,
} from '../../lib/agentops.js';
import { fmtSec } from '../../lib/charts.js';

interface Props {
  stats: AgentStats | null;
  queue: QueueDepth | null;
  workerState: WorkerState | null;
  workerOnline: boolean;
  liveCount: number;
  onWorkerChanged: (s: WorkerState) => void;
}

const HUMAN_AVG_MS = 7 * 60 * 1000;

export function CommandBar({
  stats,
  queue,
  workerState,
  workerOnline,
  liveCount,
  onWorkerChanged,
}: Props) {
  const [busy, setBusy] = useState<'pause' | 'inject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paused = workerState?.paused === true;

  const totals = stats?.totals;
  const decided = totals?.runs_decided ?? 0;
  const avgMs = totals?.avg_total_ms ?? 0;
  const blocks = totals?.blocks ?? 0;
  const warns = totals?.warns ?? 0;
  const clears = totals?.clears ?? 0;
  const speedup = avgMs > 0 ? Math.max(1, Math.round(HUMAN_AVG_MS / avgMs)) : 0;
  const queueDepth =
    (queue?.unverified ?? 0) + (queue?.queued ?? 0) + (queue?.running ?? 0);

  async function toggle() {
    setBusy('pause');
    setError(null);
    try {
      const next = paused ? await resumeWorker() : await pauseWorker();
      onWorkerChanged(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'toggle failed');
    } finally {
      setBusy(null);
    }
  }

  async function inject(profile: 'high_risk' | 'medium_risk' | 'low_risk') {
    setBusy('inject');
    setError(null);
    try {
      await injectTestAlert(profile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'inject failed');
    } finally {
      setBusy(null);
    }
  }

  const statusDot = paused
    ? '#F59E0B'
    : workerOnline
      ? '#22C55E'
      : '#9CA3AF';
  const statusLabel = paused ? 'PAUSED' : workerOnline ? 'OPERATING' : 'IDLE';

  return (
    <header
      className="flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3 shadow-card"
      style={{
        background: 'linear-gradient(90deg, #071B33 0%, #0A2A4D 50%, #0F3B82 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.08)',
        minHeight: 76,
      }}
    >
      <StatusBlock
        dotColor={statusDot}
        label={statusLabel}
        sub={`5 agents · ${liveCount} live · ${queueDepth} in queue`}
        pulse={workerOnline && !paused}
      />

      <Divider />

      <KPI label="Decided" value={decided.toString()} accent="#FFE600" />
      <KPI label="Avg cycle" value={avgMs > 0 ? fmtSec(avgMs) : '—'} accent="#FFE600" />
      <KPI
        label="Speed"
        value={speedup > 0 ? `${speedup}× human` : '—'}
        accent="#22C55E"
      />

      <Divider />

      <VerdictTrio blocks={blocks} warns={warns} clears={clears} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {error && <span className="text-small-label text-rose-300">⚠ {error}</span>}
        <InjectMenu busy={busy === 'inject'} onPick={inject} />
        <button
          type="button"
          onClick={toggle}
          disabled={busy !== null}
          className="rounded-pill px-4 py-2 text-small-label font-bold transition-colors disabled:opacity-50"
          style={{
            backgroundColor: paused ? '#22C55E' : '#EF4444',
            color: '#FFFFFF',
          }}
        >
          {busy === 'pause' ? '…' : paused ? '▶ Resume' : '■ Stop'}
        </button>
      </div>
    </header>
  );
}

function StatusBlock({
  dotColor,
  label,
  sub,
  pulse,
}: {
  dotColor: string;
  label: string;
  sub: string;
  pulse: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-3 w-3">
        {pulse && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-pill opacity-70"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="relative inline-flex h-3 w-3 rounded-pill"
          style={{ backgroundColor: dotColor }}
        />
      </span>
      <div className="leading-tight">
        <p className="text-feature-title font-bold">{label}</p>
        <p className="text-small-label text-white/65">{sub}</p>
      </div>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
      <span className="text-card-title font-bold" style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

function VerdictTrio({
  blocks,
  warns,
  clears,
}: {
  blocks: number;
  warns: number;
  clears: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Pill icon="⛔" value={blocks} bg="#7F1D1D" fg="#FCA5A5" />
      <Pill icon="⚠" value={warns} bg="#78350F" fg="#FDE68A" />
      <Pill icon="✓" value={clears} bg="#14532D" fg="#86EFAC" />
    </div>
  );
}

function Pill({
  icon,
  value,
  bg,
  fg,
}: {
  icon: string;
  value: number;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-small-label font-bold"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span>{icon}</span>
      <span>{value}</span>
    </span>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="h-10 w-px"
      style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
    />
  );
}

function InjectMenu({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (p: 'high_risk' | 'medium_risk' | 'low_risk') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="rounded-pill px-3 py-2 text-small-label font-bold transition-colors disabled:opacity-50"
        style={{
          backgroundColor: '#FFE600',
          color: '#0055D4',
        }}
      >
        {busy ? '…' : '+ Inject'}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 flex w-48 flex-col gap-1 rounded-xl p-2 shadow-elevated"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
          onMouseLeave={() => setOpen(false)}
        >
          <ProfileButton
            color="#DC2626"
            label="High-risk mule"
            sub="risk 91 · RM 8,200"
            onClick={() => {
              setOpen(false);
              onPick('high_risk');
            }}
          />
          <ProfileButton
            color="#F59E0B"
            label="Borderline"
            sub="risk 58 · RM 1,800"
            onClick={() => {
              setOpen(false);
              onPick('medium_risk');
            }}
          />
          <ProfileButton
            color="#16A34A"
            label="Likely clear"
            sub="risk 22 · RM 120"
            onClick={() => {
              setOpen(false);
              onPick('low_risk');
            }}
          />
        </div>
      )}
    </div>
  );
}

function ProfileButton({
  color,
  label,
  sub,
  onClick,
}: {
  color: string;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-app-gray"
    >
      <span className="inline-block h-2 w-2 rounded-pill" style={{ backgroundColor: color }} />
      <div>
        <p className="text-small-label font-bold text-text-primary">{label}</p>
        <p className="text-[10px] text-muted-text">{sub}</p>
      </div>
    </button>
  );
}
