import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AgentStats, QueueDepth, VerificationRun } from '../../lib/agentops.js';
import { formatLatency } from '../../lib/agentops.js';
import { cycleSeries } from '../../lib/charts.js';

interface Props {
  stats: AgentStats | null;
  queue: QueueDepth | null;
  workerOnline: boolean;
  liveCount: number;
  recent: VerificationRun[];
}

const HUMAN_AVG_MS = 7 * 60 * 1000; // 7 minutes baseline analyst review

export function StatsHero({ stats, queue, workerOnline, liveCount, recent }: Props) {
  const totals = stats?.totals;
  const blocks = totals?.blocks ?? 0;
  const warns = totals?.warns ?? 0;
  const clears = totals?.clears ?? 0;
  const decided = totals?.runs_decided ?? 0;
  const avgMs = totals?.avg_total_ms ?? 0;
  const cycle = cycleSeries(recent);

  const speedup = avgMs > 0 ? Math.max(1, Math.round(HUMAN_AVG_MS / avgMs)) : 0;
  const blockPct = decided > 0 ? Math.round((blocks / decided) * 100) : 0;
  const warnPct = decided > 0 ? Math.round((warns / decided) * 100) : 0;
  const clearPct = decided > 0 ? Math.round((clears / decided) * 100) : 0;

  return (
    <div
      className="rounded-2xl p-6 shadow-card"
      style={{
        background: 'linear-gradient(135deg, #071B33 0%, #0A2A4D 55%, #0F3B82 100%)',
        color: '#FFFFFF',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: workerOnline ? 'rgba(255,230,0,0.18)' : 'rgba(255,255,255,0.10)',
              border: `1.5px solid ${workerOnline ? '#FFE600' : 'rgba(255,255,255,0.25)'}`,
            }}
          >
            <span className="text-[26px]">{workerOnline ? '🟢' : '⏸'}</span>
          </div>
          <div>
            <p className="text-small-label uppercase tracking-wide text-white/55">
              Agent team status
            </p>
            <p className="text-section-heading">
              {workerOnline ? 'Operating autonomously' : 'Idle'}
            </p>
            <p className="text-caption text-white/65">
              5 specialist agents · {liveCount > 0 ? `${liveCount} alert${liveCount === 1 ? '' : 's'} live` : 'awaiting next alert'}
            </p>
          </div>
        </div>

        <SpeedCompare avgMs={avgMs} humanMs={HUMAN_AVG_MS} speedup={speedup} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <BigNumber
          label="Cases decided"
          value={decided.toString()}
          sub={`Last ${stats?.window_minutes ?? 60} min`}
          tone="brand"
        />
        <BigNumberWithSpark
          label="Avg cycle"
          value={formatLatency(avgMs)}
          sub={
            avgMs > 0
              ? `Min ${formatLatency(totals?.min_total_ms ?? 0)} · Max ${formatLatency(totals?.max_total_ms ?? 0)}`
              : 'No runs yet'
          }
          spark={cycle}
        />
        <BigNumber
          label="Queue"
          value={`${queue?.unverified ?? 0}`}
          sub={`${queue?.queued ?? 0} queued · ${queue?.running ?? 0} running`}
          tone="muted"
        />
      </div>

      <div className="mt-6">
        <p className="text-small-label uppercase tracking-wide text-white/55">
          Verdict mix
        </p>
        <VerdictBar
          blocks={blocks}
          warns={warns}
          clears={clears}
          blockPct={blockPct}
          warnPct={warnPct}
          clearPct={clearPct}
          decided={decided}
        />
      </div>
    </div>
  );
}

interface BigNumberProps {
  label: string;
  value: string;
  sub: string;
  tone: 'brand' | 'muted';
}

function BigNumber({ label, value, sub, tone }: BigNumberProps) {
  const fg = tone === 'brand' ? '#FFE600' : '#FFFFFF';
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <p className="text-small-label uppercase tracking-wide text-white/55">{label}</p>
      <p className="mt-1 text-[42px] font-bold leading-none" style={{ color: fg }}>
        {value}
      </p>
      <p className="mt-2 text-caption text-white/65">{sub}</p>
    </div>
  );
}

function BigNumberWithSpark({
  label,
  value,
  sub,
  spark,
}: {
  label: string;
  value: string;
  sub: string;
  spark: { index: number; cycleSec: number }[];
}) {
  return (
    <div
      className="flex flex-col rounded-xl p-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <p className="text-small-label uppercase tracking-wide text-white/55">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-[42px] font-bold leading-none" style={{ color: '#FFE600' }}>
          {value}
        </p>
        {spark.length >= 2 && (
          <div className="h-[42px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFE600" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#FFE600" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    background: '#0F3B82',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 8,
                    color: '#FFFFFF',
                    fontSize: 11,
                    padding: '4px 8px',
                  }}
                  cursor={{ stroke: 'rgba(255,255,255,0.4)', strokeWidth: 1 }}
                  formatter={(v: number) => [`${v}s`, 'Cycle']}
                  labelFormatter={() => ''}
                />
                <Area
                  type="monotone"
                  dataKey="cycleSec"
                  stroke="#FFE600"
                  strokeWidth={2}
                  fill="url(#heroSpark)"
                  dot={false}
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <p className="mt-2 text-caption text-white/65">{sub}</p>
    </div>
  );
}

interface SpeedProps {
  avgMs: number;
  humanMs: number;
  speedup: number;
}

function SpeedCompare({ avgMs, humanMs, speedup }: SpeedProps) {
  if (avgMs <= 0) return null;
  const agentBarPct = Math.max(4, Math.min(100, Math.round((avgMs / humanMs) * 100)));
  return (
    <div className="min-w-[300px] rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
      <p className="text-small-label uppercase tracking-wide text-white/55">Speed vs analyst</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[36px] font-bold leading-none" style={{ color: '#FFE600' }}>
          {speedup}×
        </span>
        <span className="text-caption text-white/70">
          faster than 7-min<br />human review
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <SpeedRow label="Agents" widthPct={agentBarPct} value={fmtTime(avgMs)} color="#FFE600" />
        <SpeedRow label="Human" widthPct={100} value="~7m" color="#94A3B8" />
      </div>
    </div>
  );
}

function SpeedRow({
  label,
  widthPct,
  value,
  color,
}: {
  label: string;
  widthPct: number;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-small-label">
      <span className="w-14 shrink-0 text-white/65">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-pill" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
        <div className="h-full rounded-pill" style={{ width: `${widthPct}%`, backgroundColor: color }} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-white">{value}</span>
    </div>
  );
}

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

interface VerdictBarProps {
  blocks: number;
  warns: number;
  clears: number;
  blockPct: number;
  warnPct: number;
  clearPct: number;
  decided: number;
}

function VerdictBar({
  blocks,
  warns,
  clears,
  blockPct,
  warnPct,
  clearPct,
  decided,
}: VerdictBarProps) {
  if (decided === 0) {
    return (
      <p className="mt-2 text-caption text-white/55">
        No decisions yet. Inject a test alert below to see verdicts.
      </p>
    );
  }
  return (
    <>
      <div
        className="mt-2 flex h-3.5 w-full overflow-hidden rounded-pill"
        style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
      >
        {blockPct > 0 && (
          <div className="h-full" style={{ width: `${blockPct}%`, backgroundColor: '#EF4444' }} title={`${blocks} blocked`} />
        )}
        {warnPct > 0 && (
          <div className="h-full" style={{ width: `${warnPct}%`, backgroundColor: '#F59E0B' }} title={`${warns} warned`} />
        )}
        {clearPct > 0 && (
          <div className="h-full" style={{ width: `${clearPct}%`, backgroundColor: '#22C55E' }} title={`${clears} cleared`} />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-caption">
        <Legend dot="#EF4444" label="Blocked" count={blocks} pct={blockPct} />
        <Legend dot="#F59E0B" label="Warned" count={warns} pct={warnPct} />
        <Legend dot="#22C55E" label="Cleared" count={clears} pct={clearPct} />
      </div>
    </>
  );
}

function Legend({
  dot,
  label,
  count,
  pct,
}: {
  dot: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-white/85">
      <span className="inline-block h-2.5 w-2.5 rounded-pill" style={{ backgroundColor: dot }} />
      <span className="font-semibold">{label}</span>
      <span className="text-white/60">
        {count} · {pct}%
      </span>
    </span>
  );
}
