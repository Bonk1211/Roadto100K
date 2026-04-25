import { useEffect, useState } from 'react';
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
  return (
    <div
      className="overflow-hidden rounded-2xl bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: '#0F3B82', color: '#FFFFFF' }}
      >
        <p className="text-small-label uppercase tracking-wide">Agent team</p>
        <p className="text-small-label text-white/70">
          {activeRun
            ? `Reviewing ${shortAlertId(activeRun.alert_id)}`
            : 'Awaiting next alert'}
        </p>
      </header>

      <div className="grid grid-cols-1 divide-y md:grid-cols-5 md:divide-x md:divide-y-0" style={{ borderColor: '#E5E7EB' }}>
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
              working={working}
              live={liveFinding}
              last={lastFinding}
              stats={stats}
              stream={stream}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CellProps {
  agent: AgentName;
  working: boolean;
  live: AgentFinding | null;
  last: AgentFinding | null;
  stats: AgentStatRow | null;
  stream: AgentStream | null;
}

function AgentCell({ agent, working, live, last, stats, stream }: CellProps) {
  const meta = AGENT_META[agent];
  const persona = PERSONA[agent];
  const display = live ?? last;
  const verdict = working ? null : display?.verdict ?? null;
  const palette = verdictPalette(verdict);
  const showWorkingBg = working;
  const cellTint = showWorkingBg
    ? '#EAF3FF'
    : live
      ? palette.bg
      : '#FFFFFF';
  const borderTone = showWorkingBg
    ? '#BFDBFE'
    : live
      ? palette.border
      : 'transparent';
  return (
    <div
      className="flex flex-col gap-2 p-3 transition-colors"
      style={{
        backgroundColor: cellTint,
        borderTop: `2px solid ${borderTone}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-pill text-small-label font-bold"
          style={{
            backgroundColor: '#0055D4',
            color: '#FFE600',
          }}
        >
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-small-label font-bold uppercase tracking-wide text-muted-text">
            {persona}
          </p>
          <p className="truncate text-feature-title text-text-primary">{meta.label}</p>
        </div>
        {working ? (
          <Spinner />
        ) : (
          <span
            className="rounded-pill px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: palette.fg, color: '#FFFFFF' }}
          >
            {palette.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-small-label">
        {working ? (
          <WorkingTicker />
        ) : display ? (
          <>
            <span className="font-bold text-text-primary">{display.confidence}%</span>
            <ConfidenceBar pct={display.confidence} color={palette.fg} />
            <span className="font-mono text-muted-text">{formatLatency(display.latency_ms)}</span>
          </>
        ) : (
          <span className="text-muted-text">No data yet</span>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-text">
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
    </div>
  );
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
        className="rounded-lg px-2 py-1.5 text-[10px] leading-snug"
        style={{ backgroundColor: '#F8FAFC', border: '1px dashed #BFDBFE', color: '#1E3A8A' }}
      >
        <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide" style={{ fontSize: 9 }}>
          Reasoning
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-pill"
            style={{ backgroundColor: '#EF4444' }}
            aria-label="streaming"
          />
        </p>
        {hasPartial ? (
          <p className="line-clamp-4 whitespace-pre-wrap text-text-primary">
            {stripJsonNoise(partial)}
            <span className="ml-0.5 inline-block h-2 w-1 animate-pulse" style={{ backgroundColor: '#0055D4' }} />
          </p>
        ) : (
          <p className="italic text-muted-text">Awaiting first token…</p>
        )}
      </div>
    );
  }
  if (!display) return null;
  const evidence = display.evidence?.slice(0, 3) ?? [];
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-[10px] leading-snug"
      style={{
        backgroundColor: live ? 'rgba(255,255,255,0.6)' : '#F8FAFC',
        border: '1px solid #E5E7EB',
        color: '#0F172A',
      }}
    >
      <p
        className="mb-1 font-bold uppercase tracking-wide text-muted-text"
        style={{ fontSize: 9 }}
      >
        Reasoning
      </p>
      <p className="line-clamp-3 text-text-primary">
        {display.reasoning?.trim() || 'No reasoning recorded.'}
      </p>
      {evidence.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {evidence.map((e, i) => (
            <span
              key={i}
              className="rounded-pill px-1.5 py-0.5 font-mono"
              style={{
                backgroundColor: '#EEF2FF',
                color: '#3730A3',
                fontSize: 9,
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
  return trimmed.length > 220 ? `${trimmed.slice(0, 220)}…` : trimmed;
}

function formatEvidenceValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    return Math.abs(v) >= 1000 ? v.toLocaleString() : String(v);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v.length > 24 ? `${v.slice(0, 24)}…` : v;
  const s = JSON.stringify(v);
  return s.length > 24 ? `${s.slice(0, 24)}…` : s;
}

function ConfidenceBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      className="h-1.5 flex-1 overflow-hidden rounded-pill"
      style={{ backgroundColor: '#E5E7EB' }}
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
      className="rounded-pill px-1.5 py-0.5 font-bold"
      style={{ backgroundColor: '#F1F5F9', color: c }}
    >
      {v}{label}
    </span>
  );
}

const WORKING_STEPS = [
  'Loading case context…',
  'Fetching evidence…',
  'Calling Bedrock…',
  'Scoring signals…',
  'Drafting verdict…',
];

function WorkingTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % WORKING_STEPS.length), 900);
    return () => clearInterval(id);
  }, []);
  return <span className="text-muted-text">{WORKING_STEPS[i]}</span>;
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-pill"
      style={{
        border: '2px solid rgba(0,85,212,0.18)',
        borderTopColor: '#0055D4',
      }}
    />
  );
}
