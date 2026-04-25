import type { VerificationRun, AgentName } from '../../lib/agentops.js';
import {
  AGENT_META,
  AGENT_ORDER,
  formatLatency,
  relativeTime,
  verdictPalette,
} from '../../lib/agentops.js';

interface Props {
  runs: VerificationRun[];
}

export function LiveCasePanel({ runs }: Props) {
  if (runs.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="flex flex-col gap-4">
      {runs.map((run) => (
        <CaseCard key={run.run_id} run={run} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl border-2 border-dashed p-8 text-center"
      style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: '#EAF3FF' }}>
        <span className="text-[28px]">🛰️</span>
      </div>
      <p className="mt-3 text-card-title text-text-primary">No live case right now</p>
      <p className="mt-1 text-caption text-muted-text">
        Worker is idle. Press a profile button below to inject a synthetic alert and watch the team verify it in real time.
      </p>
    </div>
  );
}

function CaseCard({ run }: { run: VerificationRun }) {
  const findingsByAgent = new Map(run.findings.map((f) => [f.agent_name, f]));
  const completedCount = run.findings.length;
  const progressPct = Math.round((completedCount / 5) * 100);
  const elapsedMs = Date.now() - Date.parse(run.started_at);
  const tally = countVerdicts(run.findings);

  return (
    <div
      className="overflow-hidden rounded-2xl bg-white shadow-elevated"
      style={{ border: '1px solid #BFDBFE' }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
        style={{ backgroundColor: '#EAF3FF' }}
      >
        <div className="flex items-center gap-3">
          <PulseDot />
          <div>
            <p className="text-small-label uppercase tracking-wide" style={{ color: '#0F3B82' }}>
              Live verification
            </p>
            <p className="text-card-title text-text-primary">
              <span className="font-mono">{run.alert_id}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-text">
          <Pill bg="#FFFFFF" fg="#0F3B82">
            {(run.alert_type ?? 'alert').replace(/_/g, ' ')}
          </Pill>
          <Pill bg="#FEF2F2" fg="#B91C1C">
            Risk {Math.round(run.risk_score)}/100
          </Pill>
          <Pill bg="#FFFFFF" fg="#111827">
            RM {Math.round(run.amount).toLocaleString('en-MY')}
          </Pill>
          <span className="text-muted-text">started {relativeTime(run.started_at)}</span>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <ProgressLabel done={completedCount} total={5} />
          <span className="ml-auto text-caption text-muted-text">
            {fmtElapsed(elapsedMs)} elapsed
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-pill"
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

        <div className="mt-5 grid grid-cols-5 gap-2">
          {AGENT_ORDER.map((agent) => (
            <AgentChip
              key={agent}
              agent={agent}
              finding={findingsByAgent.get(agent) ?? null}
            />
          ))}
        </div>

        {completedCount > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-small-label uppercase tracking-wide text-muted-text">
              Running tally
            </p>
            <div className="flex items-center gap-2 text-caption">
              {tally.block > 0 && <TallyBadge label="BLOCK" count={tally.block} bg="#FEF2F2" fg="#B91C1C" />}
              {tally.warn > 0 && <TallyBadge label="WARN" count={tally.warn} bg="#FFFBEB" fg="#92400E" />}
              {tally.clear > 0 && <TallyBadge label="CLEAR" count={tally.clear} bg="#ECFDF5" fg="#166534" />}
              {tally.inconclusive > 0 && (
                <TallyBadge label="—" count={tally.inconclusive} bg="#F3F4F6" fg="#374151" />
              )}
            </div>
            <p className="ml-auto text-caption text-muted-text">
              Arbiter waits for {Math.max(0, 5 - completedCount)} more
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentChip({
  agent,
  finding,
}: {
  agent: AgentName;
  finding: ReturnType<Map<string, unknown>['get']> | null;
}) {
  const meta = AGENT_META[agent];
  const f = finding as
    | {
        verdict: 'block' | 'warn' | 'clear' | 'inconclusive';
        confidence: number;
        latency_ms: number;
        reasoning: string;
      }
    | null;
  const palette = verdictPalette(f?.verdict ?? null);
  const isDone = !!f;

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors"
      style={{
        backgroundColor: isDone ? palette.bg : '#F9FAFB',
        border: `1.5px solid ${isDone ? palette.border : '#E5E7EB'}`,
      }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-pill text-base font-bold"
        style={{
          backgroundColor: isDone ? palette.fg : '#0055D4',
          color: '#FFFFFF',
        }}
      >
        {meta.icon}
      </span>
      <p className="text-small-label font-bold text-text-primary">{meta.label}</p>
      {isDone ? (
        <>
          <span
            className="rounded-pill px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: palette.fg, color: '#FFFFFF' }}
          >
            {palette.label}
          </span>
          <p className="text-small-label" style={{ color: palette.fg }}>
            {f.confidence}% · {formatLatency(f.latency_ms)}
          </p>
        </>
      ) : (
        <>
          <span
            className="rounded-pill px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: '#0055D4', color: '#FFFFFF' }}
          >
            WORKING…
          </span>
          <Loader />
        </>
      )}
    </div>
  );
}

function ProgressLabel({ done, total }: { done: number; total: number }) {
  if (done >= total) {
    return (
      <span className="rounded-pill px-3 py-1 text-small-label font-bold" style={{ backgroundColor: '#0055D4', color: '#FFFFFF' }}>
        Arbiter deciding…
      </span>
    );
  }
  return (
    <span className="text-feature-title text-text-primary">
      {done}/{total} agents reporting
    </span>
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
      style={{ backgroundColor: bg, color: fg, border: '1px solid #DBEAFE' }}
    >
      {children}
    </span>
  );
}

function PulseDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-pill opacity-75" style={{ backgroundColor: '#EF4444' }} />
      <span className="relative inline-flex h-3 w-3 rounded-pill" style={{ backgroundColor: '#EF4444' }} />
    </span>
  );
}

function Loader() {
  return (
    <div className="flex h-2 w-12 items-center gap-1">
      <Bar delay="0s" />
      <Bar delay="0.15s" />
      <Bar delay="0.3s" />
    </div>
  );
}

function Bar({ delay }: { delay: string }) {
  return (
    <span
      className="block h-2 w-2 animate-pulse rounded-pill"
      style={{ backgroundColor: '#0055D4', animationDelay: delay }}
    />
  );
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
