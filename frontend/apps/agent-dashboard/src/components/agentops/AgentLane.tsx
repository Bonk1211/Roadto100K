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

const PERSONA: Record<AgentName, { who: string; checks: string }> = {
  txn: { who: 'Watches the money', checks: 'Amount · velocity · channel' },
  behavior: { who: 'Watches the device', checks: 'Device · age · session' },
  network: { who: 'Watches the graph', checks: 'Mule cluster · hops · ratio' },
  policy: { who: 'Watches the rules', checks: 'BNM · AMLA · TnG SOP' },
  victim: { who: 'Watches the sender', checks: 'Profile · prior scams · coercion' },
};

export function AgentLane({ agent, activeRun, recent, stats }: Props) {
  const meta = AGENT_META[agent];
  const persona = PERSONA[agent];
  const liveFinding = activeRun?.findings.find((f) => f.agent_name === agent) ?? null;
  const working = !!activeRun && !liveFinding;
  const palette = verdictPalette(liveFinding?.verdict ?? null);

  const cardBorder = working
    ? '#BFDBFE'
    : liveFinding
      ? palette.border
      : '#E5E7EB';
  const headerBg = working
    ? '#EAF3FF'
    : liveFinding
      ? palette.bg
      : '#F9FAFB';

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-colors"
      style={{ border: `1.5px solid ${cardBorder}` }}
    >
      <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: headerBg }}>
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-card-title font-bold"
          style={{ backgroundColor: '#0055D4', color: '#FFE600' }}
        >
          {meta.icon}
          {working && (
            <span
              className="absolute -bottom-1 -right-1 inline-block h-3 w-3 animate-pulse rounded-pill border-2 border-white"
              style={{ backgroundColor: '#16A34A' }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-feature-title text-text-primary">{meta.label}</p>
          <p className="text-caption text-muted-text">{persona.who}</p>
        </div>
      </div>

      <div className="px-4 pt-3">
        <p className="text-small-label uppercase tracking-wide text-muted-text">Reviews</p>
        <p className="mt-0.5 text-caption text-text-primary">{persona.checks}</p>
      </div>

      <div
        className="mx-4 mt-3 rounded-xl p-3"
        style={{
          backgroundColor: working
            ? '#F0F7FF'
            : liveFinding
              ? palette.bg
              : '#F9FAFB',
          border: `1px dashed ${working ? '#BFDBFE' : liveFinding ? palette.border : '#E5E7EB'}`,
        }}
      >
        {working && activeRun ? (
          <WorkingState alertId={activeRun.alert_id} />
        ) : liveFinding && activeRun ? (
          <LiveVerdict
            verdict={liveFinding.verdict}
            confidence={liveFinding.confidence}
            alertId={activeRun.alert_id}
            latencyMs={liveFinding.latency_ms}
          />
        ) : (
          <p className="text-caption text-muted-text">
            <span className="font-semibold text-text-primary">Idle</span> · Awaiting next alert
          </p>
        )}
      </div>

      <div className="mt-3 px-4 pb-3">
        <p className="text-small-label uppercase tracking-wide text-muted-text">Last verdicts</p>
        <ul className="mt-2 space-y-1.5">
          {recent.length === 0 && (
            <li className="text-caption text-muted-text">No findings yet.</li>
          )}
          {recent.map(({ run, finding }) => (
            <li
              key={`${run.run_id}_${agent}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
              style={{ backgroundColor: '#F9FAFB' }}
            >
              <VerdictDot verdict={finding.verdict} />
              <span className="flex-1 truncate font-mono text-small-label text-text-primary">
                {shortAlertId(run.alert_id)}
              </span>
              <span className="font-semibold text-text-primary text-small-label">
                {finding.confidence}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="grid grid-cols-3 gap-1 border-t px-4 py-2 text-center text-small-label"
        style={{ borderColor: '#E5E7EB' }}
      >
        <Stat label="Avg" value={stats ? formatLatency(stats.avg_latency_ms) : '—'} />
        <Stat label="Runs" value={stats?.runs.toString() ?? '0'} />
        <Stat label="Conf" value={stats ? `${stats.avg_confidence}%` : '—'} />
      </div>
    </div>
  );
}

function WorkingState({ alertId }: { alertId: string }) {
  return (
    <div className="flex items-center gap-3">
      <Spinner />
      <div className="flex-1">
        <p className="text-caption font-bold text-text-primary">
          Reviewing <span className="font-mono">{shortAlertId(alertId)}</span>…
        </p>
        <p className="text-small-label text-muted-text">Calling Bedrock</p>
      </div>
    </div>
  );
}

function LiveVerdict({
  verdict,
  confidence,
  alertId,
  latencyMs,
}: {
  verdict: 'block' | 'warn' | 'clear' | 'inconclusive';
  confidence: number;
  alertId: string;
  latencyMs: number;
}) {
  const palette = verdictPalette(verdict);
  const icon = verdictIcon(verdict);
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[24px]"
        style={{ backgroundColor: palette.fg, color: '#FFFFFF' }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-card-title font-bold" style={{ color: palette.fg }}>
          {palette.label}
        </p>
        <p className="text-small-label text-muted-text">
          <span className="font-mono">{shortAlertId(alertId)}</span> · {confidence}% · {formatLatency(latencyMs)}
        </p>
        <ConfidenceBar pct={confidence} color={palette.fg} />
      </div>
    </div>
  );
}

function ConfidenceBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
      <div className="h-full rounded-pill" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, backgroundColor: color }} />
    </div>
  );
}

function VerdictDot({
  verdict,
}: {
  verdict: 'block' | 'warn' | 'clear' | 'inconclusive';
}) {
  const palette = verdictPalette(verdict);
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-[13px] font-bold"
      style={{ backgroundColor: palette.fg, color: '#FFFFFF' }}
      title={palette.label}
    >
      {verdictIcon(verdict)}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-text">{label}</p>
      <p className="font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-6 w-6 animate-spin rounded-pill"
      style={{
        border: '2.5px solid rgba(0,85,212,0.18)',
        borderTopColor: '#0055D4',
      }}
    />
  );
}

function verdictIcon(verdict: 'block' | 'warn' | 'clear' | 'inconclusive'): string {
  switch (verdict) {
    case 'block':
      return '⛔';
    case 'warn':
      return '⚠';
    case 'clear':
      return '✓';
    default:
      return '?';
  }
}
