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
      ? '#16A34A'
      : '#9CA3AF';
  const statusLabel = paused ? 'Paused' : workerOnline ? 'Operating' : 'Idle';

  return (
    <header
      className="flex flex-wrap items-center gap-4 px-5 py-3"
      style={{
        backgroundColor: '#ffffff',
        color: '#181d26',
        border: '1px solid #e0e2e6',
        borderRadius: 16,
        boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
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

      <KPI label="Decided" value={decided.toString()} />
      <KPI label="Avg cycle" value={avgMs > 0 ? fmtSec(avgMs) : '—'} />
      <KPI label="Speed" value={speedup > 0 ? `${speedup}× human` : '—'} accent="#16A34A" />

      <Divider />

      <VerdictTrio blocks={blocks} warns={warns} clears={clears} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {error && <span className="text-small-label" style={{ color: '#DC2626' }}>⚠ {error}</span>}
        <InjectMenu busy={busy === 'inject'} onPick={inject} />
        <button
          type="button"
          onClick={toggle}
          disabled={busy !== null}
          className="px-4 py-2 text-small-label transition-colors disabled:opacity-50"
          style={{
            backgroundColor: paused ? '#16A34A' : '#DC2626',
            color: '#ffffff',
            borderRadius: 12,
            fontWeight: 600,
            letterSpacing: '0.08px',
            boxShadow: 'rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
          }}
        >
          {busy === 'pause' ? '…' : paused ? 'Resume' : 'Stop'}
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
        <p className="text-feature-title" style={{ color: '#181d26', fontWeight: 600 }}>{label}</p>
        <p className="text-small-label" style={{ color: 'rgba(4,14,32,0.69)' }}>{sub}</p>
      </div>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 500 }}>{label}</span>
      <span className="text-card-title" style={{ color: accent ?? '#181d26', fontWeight: 600 }}>
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
    <div className="flex items-center gap-2">
      <Pill label="Block" value={blocks} bg="#FEF2F2" fg="#B91C1C" border="#FCA5A5" />
      <Pill label="Warn" value={warns} bg="#FFFBEB" fg="#92400E" border="#FDE68A" />
      <Pill label="Clear" value={clears} bg="#ECFDF5" fg="#166534" border="#BBF7D0" />
    </div>
  );
}

function Pill({
  label,
  value,
  bg,
  fg,
  border,
}: {
  label: string;
  value: number;
  bg: string;
  fg: string;
  border: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-small-label"
      style={{ backgroundColor: bg, color: fg, border: `1px solid ${border}`, borderRadius: 999, fontWeight: 600 }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="h-10 w-px"
      style={{ backgroundColor: '#e0e2e6' }}
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
        className="px-4 py-2 text-small-label transition-colors disabled:opacity-50"
        style={{
          backgroundColor: '#1b61c9',
          color: '#ffffff',
          borderRadius: 12,
          fontWeight: 600,
          letterSpacing: '0.08px',
          boxShadow: 'rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
        }}
      >
        {busy ? '…' : '+ Inject alert'}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 flex w-52 flex-col gap-1 p-2"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e0e2e6',
            borderRadius: 16,
            boxShadow: 'rgba(15,48,106,0.08) 0px 16px 48px, rgba(45,127,249,0.18) 0px 4px 12px',
          }}
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
      className="flex items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-airtable-soft-surface"
      style={{ borderRadius: 12 }}
    >
      <span className="inline-block h-2 w-2 rounded-pill" style={{ backgroundColor: color }} />
      <div>
        <p className="text-small-label" style={{ color: '#181d26', fontWeight: 600 }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.69)' }}>{sub}</p>
      </div>
    </button>
  );
}
