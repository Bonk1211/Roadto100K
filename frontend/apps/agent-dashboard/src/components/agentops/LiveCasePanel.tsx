import { useEffect, useState } from 'react';
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts';
import type { VerificationRun } from '../../lib/agentops.js';
import { relativeTime } from '../../lib/agentops.js';
import { CHART_COLORS } from '../../lib/charts.js';

interface Props {
  runs: VerificationRun[];
}

export function LiveCasePanel({ runs }: Props) {
  if (runs.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="flex flex-col gap-3">
      {runs.map((run) => (
        <CaseCard key={run.run_id} run={run} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center"
      style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }}
    >
      <span className="text-[40px]">🛰️</span>
      <p className="mt-2 text-card-title text-text-primary">No live case right now</p>
      <p className="mt-1 max-w-sm text-caption text-muted-text">
        Worker idle. Click <span className="font-bold text-text-primary">+ Inject</span> in the
        top bar to push a synthetic alert. Team picks it up in &lt;2s.
      </p>
    </div>
  );
}

function CaseCard({ run }: { run: VerificationRun }) {
  const completedCount = run.findings.length;
  const progressPct = Math.round((completedCount / 5) * 100);
  const elapsedMs = useElapsed(run.started_at);
  const tally = countVerdicts(run.findings);

  return (
    <div
      className="flex items-stretch gap-4 overflow-hidden rounded-2xl bg-white p-4 shadow-elevated"
      style={{ border: '1px solid #BFDBFE' }}
    >
      <RadialProgress done={completedCount} total={5} elapsedMs={elapsedMs} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <PulseDot />
          <p className="text-small-label uppercase tracking-wide" style={{ color: '#0F3B82' }}>
            Live verification
          </p>
          <span className="text-caption text-muted-text">
            started {relativeTime(run.started_at)}
          </span>
        </div>

        <p className="mt-1 truncate text-card-title font-mono font-bold text-text-primary">
          {run.alert_id}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-caption">
          <Pill bg="#FEF2F2" fg="#B91C1C">Risk {Math.round(run.risk_score)}/100</Pill>
          <Pill bg="#FFFFFF" fg="#111827">RM {Math.round(run.amount).toLocaleString('en-MY')}</Pill>
          <Pill bg="#EAF3FF" fg="#0F3B82">
            {(run.alert_type ?? 'alert').replace(/_/g, ' ')}
          </Pill>
          {run.scam_type && (
            <Pill bg="#FFFBEB" fg="#92400E">{run.scam_type.replace(/_/g, ' ')}</Pill>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-small-label">
            <span className="font-bold text-text-primary">
              {completedCount}/5 agents reporting
            </span>
            {completedCount >= 5 && (
              <span className="rounded-pill px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: '#0055D4', color: '#FFFFFF' }}>
                Arbiter deciding…
              </span>
            )}
          </div>
          <div
            className="mt-1 h-2 w-full overflow-hidden rounded-pill"
            style={{ backgroundColor: '#E5E7EB' }}
          >
            <div
              className="h-full rounded-pill transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #0055D4 0%, #0EA5E9 100%)',
              }}
            />
          </div>
        </div>

        {completedCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-text">Tally</span>
            {tally.block > 0 && <TallyBadge label="BLOCK" count={tally.block} bg="#FEF2F2" fg="#B91C1C" />}
            {tally.warn > 0 && <TallyBadge label="WARN" count={tally.warn} bg="#FFFBEB" fg="#92400E" />}
            {tally.clear > 0 && <TallyBadge label="CLEAR" count={tally.clear} bg="#ECFDF5" fg="#166534" />}
            {tally.inconclusive > 0 && (
              <TallyBadge label="—" count={tally.inconclusive} bg="#F3F4F6" fg="#374151" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RadialProgress({
  done,
  total,
  elapsedMs,
}: {
  done: number;
  total: number;
  elapsedMs: number;
}) {
  const pct = Math.min(100, Math.round((done / total) * 100));
  const data = [{ name: 'progress', value: pct, fill: CHART_COLORS.brand }];
  return (
    <div className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="68%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          data={data}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: '#E5E7EB' }}
            dataKey="value"
            cornerRadius={12}
            fill={CHART_COLORS.brand}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[28px] font-bold leading-none text-text-primary">
          {done}
          <span className="text-card-title text-muted-text">/{total}</span>
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-text">
          agents in
        </p>
        <p className="text-caption font-bold" style={{ color: '#0055D4' }}>
          {fmtElapsed(elapsedMs)}
        </p>
      </div>
    </div>
  );
}

function TallyBadge({
  label,
  count,
  bg,
  fg,
}: {
  label: string;
  count: number;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="rounded-pill px-2.5 py-0.5 text-small-label font-bold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {count}× {label}
    </span>
  );
}

function Pill({
  children,
  bg,
  fg,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="rounded-pill px-2.5 py-1 text-small-label font-semibold"
      style={{ backgroundColor: bg, color: fg, border: '1px solid #E5E7EB' }}
    >
      {children}
    </span>
  );
}

function PulseDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-pill opacity-75"
        style={{ backgroundColor: '#EF4444' }}
      />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-pill"
        style={{ backgroundColor: '#EF4444' }}
      />
    </span>
  );
}

function useElapsed(startedAt: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, now - Date.parse(startedAt));
}

function fmtElapsed(ms: number): string {
  if (ms < 1000) return '0s';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

interface VerdictTally {
  block: number;
  warn: number;
  clear: number;
  inconclusive: number;
}

function countVerdicts(findings: VerificationRun['findings']): VerdictTally {
  const t: VerdictTally = { block: 0, warn: 0, clear: 0, inconclusive: 0 };
  for (const f of findings) {
    const v = f.verdict as keyof VerdictTally;
    if (v in t) t[v] += 1;
  }
  return t;
}
