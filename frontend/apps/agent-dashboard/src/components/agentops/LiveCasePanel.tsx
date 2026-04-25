import { useEffect, useState } from 'react';
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts';
import type { VerificationRun } from '../../lib/agentops.js';
import { relativeTime } from '../../lib/agentops.js';

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
      className="flex items-center gap-2 px-3 py-2"
      style={{
        border: '1px dashed #e0e2e6',
        backgroundColor: '#ffffff',
        borderRadius: 12,
      }}
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center"
        style={{ backgroundColor: '#eef4fc', color: '#1b61c9', borderRadius: 999 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <p className="text-caption" style={{ color: '#181d26', fontWeight: 600 }}>
        No live case
      </p>
      <p className="truncate text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
        — worker idle. Use <span style={{ color: '#1b61c9', fontWeight: 600 }}>+ Inject alert</span> to push one.
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
      className="flex items-stretch gap-4 overflow-hidden bg-white p-5"
      style={{
        border: '1px solid #e0e2e6',
        borderRadius: 16,
        boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px, rgba(45,127,249,0.18) 0px 4px 12px',
      }}
    >
      <RadialProgress done={completedCount} total={5} elapsedMs={elapsedMs} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <PulseDot />
          <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
            Live verification
          </p>
          <span className="text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
            started {relativeTime(run.started_at)}
          </span>
        </div>

        <p className="mt-1 truncate text-card-title font-mono" style={{ color: '#181d26', fontWeight: 600 }}>
          {run.alert_id}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-caption">
          <Pill bg="#FEF2F2" fg="#B91C1C" border="#FCA5A5">Risk {Math.round(run.risk_score)}/100</Pill>
          <Pill bg="#ffffff" fg="#181d26" border="#e0e2e6">RM {Math.round(run.amount).toLocaleString('en-MY')}</Pill>
          <Pill bg="#eef4fc" fg="#1b61c9" border="#cfe0f5">
            {(run.alert_type ?? 'alert').replace(/_/g, ' ')}
          </Pill>
          {run.scam_type && (
            <Pill bg="#FFFBEB" fg="#92400E" border="#FDE68A">{run.scam_type.replace(/_/g, ' ')}</Pill>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-small-label">
            <span style={{ color: '#181d26', fontWeight: 600 }}>
              {completedCount}/5 agents reporting
            </span>
            {completedCount >= 5 && (
              <span className="px-2 py-0.5 text-[10px]" style={{ backgroundColor: '#1b61c9', color: '#ffffff', borderRadius: 999, fontWeight: 600 }}>
                Arbiter deciding…
              </span>
            )}
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-pill"
            style={{ backgroundColor: '#e0e2e6' }}
          >
            <div
              className="h-full rounded-pill transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #1b61c9 0%, #254fad 100%)',
              }}
            />
          </div>
        </div>

        {completedCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 500 }}>Tally</span>
            {tally.block > 0 && <TallyBadge label="Block" count={tally.block} bg="#FEF2F2" fg="#B91C1C" />}
            {tally.warn > 0 && <TallyBadge label="Warn" count={tally.warn} bg="#FFFBEB" fg="#92400E" />}
            {tally.clear > 0 && <TallyBadge label="Clear" count={tally.clear} bg="#ECFDF5" fg="#166534" />}
            {tally.inconclusive > 0 && (
              <TallyBadge label="—" count={tally.inconclusive} bg="#f8fafc" fg="rgba(4,14,32,0.69)" />
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
  const data = [{ name: 'progress', value: pct, fill: '#1b61c9' }];
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
            background={{ fill: '#e0e2e6' }}
            dataKey="value"
            cornerRadius={12}
            fill="#1b61c9"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[28px] leading-none" style={{ color: '#181d26', fontWeight: 600 }}>
          {done}
          <span className="text-card-title" style={{ color: 'rgba(4,14,32,0.55)' }}>/{total}</span>
        </p>
        <p className="mt-0.5 text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 500 }}>
          agents in
        </p>
        <p className="text-caption" style={{ color: '#1b61c9', fontWeight: 600 }}>
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
  border = '#e0e2e6',
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  border?: string;
}) {
  return (
    <span
      className="rounded-pill px-2.5 py-1 text-small-label"
      style={{ backgroundColor: bg, color: fg, border: `1px solid ${border}`, fontWeight: 500 }}
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
