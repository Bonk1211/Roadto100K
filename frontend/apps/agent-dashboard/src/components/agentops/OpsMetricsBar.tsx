import type { AgentStats, QueueDepth } from '../../lib/agentops.js';
import { formatLatency } from '../../lib/agentops.js';

interface Props {
  stats: AgentStats | null;
  queue: QueueDepth | null;
  workerOnline: boolean;
}

export function OpsMetricsBar({ stats, queue, workerOnline }: Props) {
  const totals = stats?.totals;
  const decided = totals?.runs_decided ?? 0;
  const avgMs = totals?.avg_total_ms ?? 0;
  const blocks = totals?.blocks ?? 0;
  const warns = totals?.warns ?? 0;
  const clears = totals?.clears ?? 0;
  const humanMin = avgMs > 0 ? Math.max(1, Math.round((avgMs / 1000) * 100) / 60) : null;

  return (
    <div
      className="grid grid-cols-2 gap-4 rounded-lg bg-white p-5 shadow-card md:grid-cols-6"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <Tile label="Worker" value={workerOnline ? 'Online' : 'Idle'} tone={workerOnline ? 'good' : 'muted'}>
        <span
          className="inline-block h-2 w-2 rounded-pill"
          style={{ backgroundColor: workerOnline ? '#16A34A' : '#9CA3AF' }}
        />
        <span>5 agents · {stats?.window_minutes ?? 60}m window</span>
      </Tile>

      <Tile label="Queue depth" value={(queue?.unverified ?? 0).toString()} tone="muted">
        <span>{queue?.queued ?? 0} queued · {queue?.running ?? 0} live</span>
      </Tile>

      <Tile label="Decided" value={decided.toString()} tone="good">
        <span>
          {blocks} block · {warns} warn · {clears} clear
        </span>
      </Tile>

      <Tile label="Avg cycle" value={formatLatency(avgMs)} tone="brand">
        <span>p95 ≤ {formatLatency(totals?.max_total_ms ?? 0)}</span>
      </Tile>

      <Tile
        label="Human equivalent"
        value={humanMin != null ? `${humanMin}× faster` : '—'}
        tone="brand"
      >
        <span>vs ~7m manual review</span>
      </Tile>

      <Tile label="Mode" value={workerOnline ? 'Autonomous' : 'Paused'} tone="muted">
        <span>No agent input required</span>
      </Tile>
    </div>
  );
}

interface TileProps {
  label: string;
  value: string;
  tone: 'good' | 'brand' | 'muted';
  children?: React.ReactNode;
}

function Tile({ label, value, tone, children }: TileProps) {
  const fg =
    tone === 'good' ? '#166534' : tone === 'brand' ? '#0055D4' : '#374151';
  return (
    <div>
      <p className="text-small-label uppercase tracking-wide text-muted-text">{label}</p>
      <p className="mt-1 text-card-title font-bold" style={{ color: fg }}>
        {value}
      </p>
      {children && (
        <p className="mt-1 flex items-center gap-2 text-caption text-muted-text">
          {children}
        </p>
      )}
    </div>
  );
}
