import type {
  AgentFinding,
  AgentName,
  AgentStatRow,
  VerificationRun,
} from '../../lib/agentops.js';
import {
  AGENT_META,
  formatLatency,
  shortAlertId,
  verdictPalette,
} from '../../lib/agentops.js';

interface Props {
  agent: AgentName;
  activeRun: VerificationRun | null;
  recent: { run: VerificationRun; finding: AgentFinding }[];
  stats: AgentStatRow | null;
}

export function AgentLane({ agent, activeRun, recent, stats }: Props) {
  const meta = AGENT_META[agent];
  const liveFinding = activeRun?.findings.find((f) => f.agent_name === agent) ?? null;
  const working = !!activeRun && !liveFinding;
  const palette = verdictPalette(liveFinding?.verdict ?? null);

  return (
    <div
      className="flex flex-col rounded-lg bg-white p-4 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-pill font-bold"
          style={{ backgroundColor: '#FFE600', color: '#0055D4' }}
        >
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-feature-title text-text-primary">{meta.label}</p>
          <p className="truncate text-caption text-muted-text">{meta.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-small-label uppercase text-muted-text">Avg</p>
          <p className="text-caption font-semibold text-text-primary">
            {stats ? formatLatency(stats.avg_latency_ms) : '—'}
          </p>
        </div>
      </header>

      <section className="mt-3 rounded-md p-3" style={{ backgroundColor: '#F9FAFB' }}>
        {working && activeRun ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-caption text-muted-text">
              <PulseDot />
              <span>
                Working <span className="font-mono">{shortAlertId(activeRun.alert_id)}</span>
              </span>
            </div>
            <ProgressBar />
          </div>
        ) : liveFinding && activeRun ? (
          <FindingRow run={activeRun} finding={liveFinding} live palette={palette} />
        ) : (
          <p className="text-caption text-muted-text">Awaiting next alert…</p>
        )}
      </section>

      <section className="mt-3 flex-1">
        <p className="text-small-label uppercase tracking-wide text-muted-text">
          Last verdicts
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {recent.length === 0 && (
            <li className="text-caption text-muted-text">No findings yet.</li>
          )}
          {recent.map(({ run, finding }) => (
            <li key={`${run.run_id}_${agent}`}>
              <FindingRow run={run} finding={finding} palette={verdictPalette(finding.verdict)} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-3 flex items-center justify-between text-caption text-muted-text">
        <span>{stats ? `${stats.runs} runs · ${stats.avg_confidence}% conf` : '—'}</span>
        <span>
          {stats ? `${stats.blocks}B / ${stats.warns}W / ${stats.clears}C` : '—'}
        </span>
      </footer>
    </div>
  );
}

interface RowProps {
  run: VerificationRun;
  finding: AgentFinding;
  palette: ReturnType<typeof verdictPalette>;
  live?: boolean;
}

function FindingRow({ run, finding, palette, live }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="rounded-pill px-2 py-0.5 text-small-label font-bold"
          style={{
            backgroundColor: palette.bg,
            color: palette.fg,
            border: `1px solid ${palette.border}`,
          }}
        >
          {palette.label}
        </span>
        <span className="font-mono text-caption text-text-primary">
          {shortAlertId(run.alert_id)}
        </span>
        {live && (
          <span
            className="rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: '#0055D4', color: '#FFFFFF' }}
          >
            Live
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-caption text-muted-text">
        <span className="font-semibold text-text-primary">{finding.confidence}%</span>
        <span>{formatLatency(finding.latency_ms)}</span>
      </div>
    </div>
  );
}

function PulseDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-pill opacity-75"
        style={{ backgroundColor: '#0055D4' }}
      />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-pill"
        style={{ backgroundColor: '#0055D4' }}
      />
    </span>
  );
}

function ProgressBar() {
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-pill"
      style={{ backgroundColor: '#E5E7EB' }}
    >
      <div className="h-full w-2/3 animate-pulse" style={{ backgroundColor: '#0055D4' }} />
    </div>
  );
}
