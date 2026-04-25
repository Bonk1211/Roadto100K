import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  AgentFinding,
  AgentName,
  AgentStatRow,
  AgentStream,
  VerificationRun,
} from '../../lib/agentops.js';
import {
  AGENT_META,
  AGENT_ORDER,
  formatLatency,
  shortAlertId,
  verdictPalette,
} from '../../lib/agentops.js';

interface Props {
  activeRun: VerificationRun | null;
  recentByAgent: Record<AgentName, { run: VerificationRun; finding: AgentFinding }[]>;
  statsByAgent: Record<string, AgentStatRow>;
}

const PERSONA: Record<AgentName, string> = {
  txn: 'Money',
  behavior: 'Device',
  network: 'Graph',
  policy: 'Policy',
  victim: 'Sender',
};

export function CompactAgentStrip({ activeRun, recentByAgent, statsByAgent }: Props) {
  const defaultAgent =
    activeRun?.streams?.find((s) => s.status !== 'done')?.agent_name ??
    activeRun?.findings[0]?.agent_name ??
    AGENT_ORDER[0];
  const normalizedDefaultAgent = toAgentName(defaultAgent);
  const [expandedAgent, setExpandedAgent] = useState<AgentName>(normalizedDefaultAgent);

  useEffect(() => {
    setExpandedAgent(normalizedDefaultAgent);
  }, [normalizedDefaultAgent]);

  return (
    <div
      className="overflow-hidden bg-white"
      style={{
        border: '1px solid #e0e2e6',
        borderRadius: 16,
        boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
      }}
    >
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e0e2e6', color: '#181d26' }}
      >
        <p className="text-small-label uppercase" style={{ letterSpacing: '0.28px', fontWeight: 600, color: '#1b61c9' }}>Agent team</p>
        <p className="text-small-label" style={{ color: 'rgba(4,14,32,0.69)' }}>
          {activeRun
            ? `Reviewing ${shortAlertId(activeRun.alert_id)}`
            : 'Awaiting next alert'}
        </p>
      </header>

      <div className="grid grid-cols-1 divide-y md:hidden" style={{ borderColor: '#e0e2e6' }}>
        {AGENT_ORDER.map((agent) => {
          const liveFinding = activeRun?.findings.find((f) => f.agent_name === agent) ?? null;
          const stream = activeRun?.streams?.find((s) => s.agent_name === agent) ?? null;
          const working = !!activeRun && !liveFinding;
          const lastList = recentByAgent[agent] ?? [];
          const lastFinding = lastList[0]?.finding ?? null;
          const stats = statsByAgent[agent] ?? null;
          return (
            <AgentCell
              key={agent}
              agent={agent}
              expanded
              working={working}
              live={liveFinding}
              last={lastFinding}
              stats={stats}
              stream={stream}
            />
          );
        })}
      </div>

      <div
        className="hidden md:flex"
        style={{ minHeight: 260 }}
        onMouseLeave={() => setExpandedAgent(normalizedDefaultAgent)}
      >
        {AGENT_ORDER.map((agent, index) => {
          const liveFinding = activeRun?.findings.find((f) => f.agent_name === agent) ?? null;
          const stream = activeRun?.streams?.find((s) => s.agent_name === agent) ?? null;
          const working = !!activeRun && !liveFinding;
          const lastList = recentByAgent[agent] ?? [];
          const lastFinding = lastList[0]?.finding ?? null;
          const stats = statsByAgent[agent] ?? null;
          const expanded = expandedAgent === agent;
          return (
            <AgentCell
              key={agent}
              agent={agent}
              expanded={expanded}
              working={working}
              live={liveFinding}
              last={lastFinding}
              stats={stats}
              stream={stream}
              onHover={() => setExpandedAgent(toAgentName(agent))}
              style={{
                flex: expanded ? '1 1 0%' : '0 0 72px',
                minWidth: expanded ? 0 : 72,
                borderLeft: index === 0 ? 'none' : '1px solid #e0e2e6',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CellProps {
  agent: AgentName;
  expanded: boolean;
  working: boolean;
  live: AgentFinding | null;
  last: AgentFinding | null;
  stats: AgentStatRow | null;
  stream: AgentStream | null;
  onHover?: () => void;
  style?: CSSProperties;
}

function AgentCell({ agent, expanded, working, live, last, stats, stream, onHover, style }: CellProps) {
  const meta = AGENT_META[agent];
  const persona = PERSONA[agent];
  const display = live ?? last;
  const verdict = working ? null : display?.verdict ?? null;
  const palette = verdictPalette(verdict);
  const showWorkingBg = working;
  const cellTint = showWorkingBg
    ? '#eef4fc'
    : live
      ? palette.bg
      : '#ffffff';
  const borderTone = showWorkingBg
    ? '#1b61c9'
    : live
      ? palette.border
      : 'transparent';

  return (
    <div
      className="flex flex-col gap-2 overflow-hidden p-3 transition-all duration-700 ease-in-out"
      style={{
        backgroundColor: cellTint,
        borderTop: `2px solid ${borderTone}`,
        ...style,
      }}
      onMouseEnter={onHover}
      onFocus={onHover}
      tabIndex={onHover ? 0 : undefined}
    >
      <div className={`flex items-center ${expanded ? 'gap-2' : 'justify-center'}`}>
        <span
          className="flex h-9 w-9 items-center justify-center text-small-label"
          style={{
            backgroundColor: '#eef4fc',
            color: '#1b61c9',
            borderRadius: 12,
            fontWeight: 600,
            border: '1px solid #cfe0f5',
          }}
        >
          {meta.icon}
        </span>
        {expanded && (
          <>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-small-label uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>
                {persona}
              </p>
              <p className="truncate text-feature-title" style={{ color: '#181d26' }}>{meta.label}</p>
            </div>
            {working ? (
              <Spinner />
            ) : (
              <span
                className="px-2 py-0.5 text-[10px]"
                style={{ backgroundColor: palette.fg, color: '#ffffff', borderRadius: 999, fontWeight: 600 }}
              >
                {palette.label}
              </span>
            )}
          </>
        )}
      </div>

      {expanded && (
        <>
          <div className="flex items-center gap-2 text-small-label">
            {working ? (
              <WorkingTicker />
            ) : display ? (
              <>
                <span style={{ color: '#181d26', fontWeight: 600 }}>{display.confidence}%</span>
                <ConfidenceBar pct={display.confidence} color={palette.fg} />
                <span className="font-mono" style={{ color: 'rgba(4,14,32,0.69)' }}>{formatLatency(display.latency_ms)}</span>
              </>
            ) : (
              <span style={{ color: 'rgba(4,14,32,0.55)' }}>No data yet</span>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px]" style={{ color: 'rgba(4,14,32,0.69)' }}>
            <span>
              {stats ? (
                <>
                  {stats.runs} runs · avg {formatLatency(stats.avg_latency_ms)}
                </>
              ) : (
                '—'
              )}
            </span>
            {stats && (
              <span className="flex items-center gap-1">
                <Tally label="B" v={stats.blocks} c="#B91C1C" />
                <Tally label="W" v={stats.warns} c="#92400E" />
                <Tally label="C" v={stats.clears} c="#166534" />
              </span>
            )}
          </div>

          <ReasoningPanel working={working} display={display} live={!!live} stream={stream} />
        </>
      )}
    </div>
  );
}

function toAgentName(value: AgentName | string | null | undefined): AgentName {
  return AGENT_ORDER.includes(value as AgentName) ? (value as AgentName) : AGENT_ORDER[0];
}

function ReasoningPanel({
  working,
  display,
  live,
  stream,
}: {
  working: boolean;
  display: AgentFinding | null;
  live: boolean;
  stream: AgentStream | null;
}) {
  if (working) {
    const partial = stream?.partial_text ?? '';
    const hasPartial = partial.trim().length > 0;
    return (
      <div
        className="px-2 py-1.5 text-[10px] leading-snug"
        style={{ backgroundColor: '#f8fafc', border: '1px dashed #cfe0f5', color: '#254fad', borderRadius: 12 }}
      >
        <p className="mb-1 flex items-center gap-1 uppercase" style={{ fontSize: 9, letterSpacing: '0.28px', fontWeight: 600 }}>
          Reasoning
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-pill"
            style={{ backgroundColor: '#DC2626' }}
            aria-label="streaming"
          />
        </p>
        {hasPartial ? (
          <p className="line-clamp-4 whitespace-pre-wrap" style={{ color: '#181d26' }}>
            {stripJsonNoise(partial)}
            <span className="ml-0.5 inline-block h-2 w-1 animate-pulse" style={{ backgroundColor: '#1b61c9' }} />
          </p>
        ) : (
          <p className="italic" style={{ color: 'rgba(4,14,32,0.55)' }}>Awaiting first token...</p>
        )}
      </div>
    );
  }
  if (!display) return null;
  const evidence = display.evidence?.slice(0, 3) ?? [];
  return (
    <div
      className="px-2 py-1.5 text-[10px] leading-snug"
      style={{
        backgroundColor: live ? 'rgba(255,255,255,0.7)' : '#f8fafc',
        border: '1px solid #e0e2e6',
        color: '#181d26',
        borderRadius: 12,
      }}
    >
      <p
        className="mb-1 uppercase"
        style={{ fontSize: 9, letterSpacing: '0.28px', fontWeight: 600, color: 'rgba(4,14,32,0.55)' }}
      >
        Reasoning
      </p>
      <p className="line-clamp-3" style={{ color: '#181d26' }}>
        {display.reasoning?.trim() || 'No reasoning recorded.'}
      </p>
      {evidence.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {evidence.map((e, i) => (
            <span
              key={i}
              className="rounded-pill px-1.5 py-0.5 font-mono"
              style={{
                backgroundColor: '#eef4fc',
                color: '#254fad',
                fontSize: 9,
                fontWeight: 500,
              }}
              title={typeof e.value === 'object' ? JSON.stringify(e.value) : String(e.value)}
            >
              {e.signal}: {formatEvidenceValue(e.value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function stripJsonNoise(raw: string): string {
  // Bedrock returns a JSON object; while streaming we may see partial JSON.
  // Prefer extracting whatever has come in for the "reasoning" key; fall back
  // to showing what we have minus the leading brace/keys.
  const reasoningKey = raw.indexOf('"reasoning"');
  if (reasoningKey >= 0) {
    const colon = raw.indexOf(':', reasoningKey);
    if (colon >= 0) {
      const after = raw.slice(colon + 1).trimStart();
      if (after.startsWith('"')) {
        const tail = after.slice(1);
        // chop trailing closing-quote/brace if already arrived
        const endQuote = tail.lastIndexOf('"');
        return endQuote > 0 ? tail.slice(0, endQuote) : tail;
      }
      return after;
    }
  }
  const trimmed = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/^\s*\{\s*/, '');
  return trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
}

function formatEvidenceValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    return Math.abs(v) >= 1000 ? v.toLocaleString() : String(v);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v.length > 24 ? `${v.slice(0, 24)}...` : v;
  const s = JSON.stringify(v);
  return s.length > 24 ? `${s.slice(0, 24)}...` : s;
}

function ConfidenceBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      className="h-1.5 flex-1 overflow-hidden rounded-pill"
      style={{ backgroundColor: '#e0e2e6' }}
    >
      <div
        className="h-full rounded-pill"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

function Tally({ label, v, c }: { label: string; v: number; c: string }) {
  if (v === 0) return null;
  return (
    <span
      className="rounded-pill px-1.5 py-0.5"
      style={{ backgroundColor: '#f8fafc', color: c, fontWeight: 600, border: '1px solid #e0e2e6' }}
    >
      {v}{label}
    </span>
  );
}

const WORKING_STEPS = [
  'Loading case context...',
  'Fetching evidence...',
  'Calling Bedrock...',
  'Scoring signals...',
  'Drafting verdict...',
];

function WorkingTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % WORKING_STEPS.length), 900);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color: 'rgba(4,14,32,0.69)' }}>{WORKING_STEPS[i]}</span>;
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-pill"
      style={{
        border: '2px solid rgba(27,97,201,0.18)',
        borderTopColor: '#1b61c9',
      }}
    />
  );
}
