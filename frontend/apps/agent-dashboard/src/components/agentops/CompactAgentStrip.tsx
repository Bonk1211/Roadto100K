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

const ACCENT: Record<AgentName, { fg: string; bg: string; soft: string; ring: string }> = {
  txn: { fg: '#1b61c9', bg: '#eef4fc', soft: '#dbe7f8', ring: 'rgba(27,97,201,0.28)' },
  behavior: { fg: '#7c3aed', bg: '#f3eefe', soft: '#e3d7fb', ring: 'rgba(124,58,237,0.28)' },
  network: { fg: '#0d9488', bg: '#e6f7f4', soft: '#c8ede6', ring: 'rgba(13,148,136,0.28)' },
  policy: { fg: '#b45309', bg: '#fef5e7', soft: '#fbe4c2', ring: 'rgba(180,83,9,0.28)' },
  victim: { fg: '#be185d', bg: '#fdecf3', soft: '#f9d4e3', ring: 'rgba(190,24,93,0.28)' },
};

export function CompactAgentStrip({ activeRun, recentByAgent, statsByAgent }: Props) {
  const totalRuns = AGENT_ORDER.reduce((sum, a) => sum + (statsByAgent[a]?.runs ?? 0), 0);
  const avgLatency = (() => {
    const rows = AGENT_ORDER.map((a) => statsByAgent[a]).filter(Boolean) as AgentStatRow[];
    if (rows.length === 0) return null;
    const totalMs = rows.reduce((s, r) => s + r.avg_latency_ms * r.runs, 0);
    const totalRunsLocal = rows.reduce((s, r) => s + r.runs, 0);
    return totalRunsLocal > 0 ? Math.round(totalMs / totalRunsLocal) : null;
  })();
  const decided = activeRun ? activeRun.findings.length : 0;

  return (
    <div
      className="overflow-hidden bg-white"
      style={{
        border: '1px solid #e0e2e6',
        borderRadius: 16,
        boxShadow: 'rgba(15,48,106,0.06) 0px 4px 24px',
      }}
    >
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef4fc 100%)',
          borderBottom: '1px solid #e0e2e6',
          color: '#181d26',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #1b61c9 0%, #2d7ff9 100%)',
              borderRadius: 10,
              color: '#ffffff',
              boxShadow: 'rgba(27,97,201,0.32) 0px 2px 6px',
            }}
            aria-hidden
          >
            <TeamIcon />
          </span>
          <div className="leading-tight">
            <p
              className="text-small-label uppercase"
              style={{ letterSpacing: '0.32px', fontWeight: 700, color: '#1b61c9', fontSize: 11 }}
            >
              Agent team
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.55)' }}>
              5 specialists · consensus arbitration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeRun ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
              style={{
                backgroundColor: '#ffffff',
                color: '#1b61c9',
                borderRadius: 999,
                fontWeight: 600,
                border: '1px solid #cfe0f5',
                boxShadow: 'rgba(27,97,201,0.12) 0px 1px 3px',
              }}
            >
              <span
                className="inline-block h-2 w-2 animate-pulse rounded-pill"
                style={{ backgroundColor: '#1b61c9' }}
              />
              Reviewing {shortAlertId(activeRun.alert_id)} · {decided}/5
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
              style={{
                backgroundColor: '#ffffff',
                color: 'rgba(4,14,32,0.69)',
                borderRadius: 999,
                fontWeight: 500,
                border: '1px solid #e0e2e6',
              }}
            >
              <span className="inline-block h-2 w-2 rounded-pill" style={{ backgroundColor: '#9ca3af' }} />
              Awaiting next alert
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 divide-y md:grid-cols-5 md:divide-x md:divide-y-0" style={{ borderColor: '#e0e2e6' }}>
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

      {(totalRuns > 0 || avgLatency !== null) && (
        <footer
          className="flex items-center justify-between px-4 py-2 text-[11px]"
          style={{
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e0e2e6',
            color: 'rgba(4,14,32,0.69)',
          }}
        >
          <span className="flex items-center gap-3">
            <span>
              Team total ·{' '}
              <span style={{ color: '#181d26', fontWeight: 600 }}>{totalRuns}</span> runs
            </span>
            {avgLatency !== null && (
              <span>
                Avg latency ·{' '}
                <span className="font-mono" style={{ color: '#181d26', fontWeight: 600 }}>
                  {formatLatency(avgLatency)}
                </span>
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {AGENT_ORDER.map((a) => (
              <span
                key={a}
                className="inline-block h-1.5 w-4 rounded-pill"
                style={{ backgroundColor: ACCENT[a].fg, opacity: statsByAgent[a]?.runs ? 1 : 0.25 }}
                title={AGENT_META[a].label}
              />
            ))}
          </span>
        </footer>
      )}
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
  const accent = ACCENT[agent];
  const display = live ?? last;
  const verdict = working ? null : display?.verdict ?? null;
  const palette = verdictPalette(verdict);
  const showWorkingBg = working;
  const cellTint = showWorkingBg
    ? accent.bg
    : live
      ? palette.bg
      : '#ffffff';
  const borderTone = showWorkingBg
    ? accent.fg
    : live
      ? palette.border
      : accent.soft;
  return (
    <div
      className="group relative flex flex-col gap-2 p-3 transition-all duration-200"
      style={{
        backgroundColor: cellTint,
        borderTop: `3px solid ${borderTone}`,
      }}
    >
      {working && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] animate-pulse"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent.fg}, transparent)`,
          }}
        />
      )}
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center transition-transform group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${accent.fg} 0%, ${accent.fg}dd 100%)`,
            color: '#ffffff',
            borderRadius: 12,
            boxShadow: `${accent.ring} 0px 2px 8px`,
          }}
          aria-label={meta.label}
        >
          <AgentIcon agent={agent} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p
            className="truncate text-small-label uppercase"
            style={{ color: accent.fg, letterSpacing: '0.32px', fontWeight: 700, fontSize: 9.5 }}
          >
            {persona}
          </p>
          <p className="truncate text-feature-title" style={{ color: '#181d26' }}>{meta.label}</p>
        </div>
        {working ? (
          <Spinner color={accent.fg} />
        ) : (
          <span
            className="px-2 py-0.5 text-[10px]"
            style={{
              backgroundColor: palette.fg,
              color: '#ffffff',
              borderRadius: 999,
              fontWeight: 700,
              letterSpacing: '0.2px',
              boxShadow: `${palette.fg}33 0px 1px 4px`,
            }}
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
          <p className="italic" style={{ color: 'rgba(4,14,32,0.55)' }}>Awaiting first token…</p>
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
  return <span style={{ color: 'rgba(4,14,32,0.69)' }}>{WORKING_STEPS[i]}</span>;
}

function TeamIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AgentIcon({ agent }: { agent: AgentName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (agent) {
    case 'txn':
      return (
        <svg {...common}>
          <rect x={2} y={6} width={20} height={12} rx={2} />
          <circle cx={12} cy={12} r={2.5} />
          <path d="M6 10v.01" />
          <path d="M18 14v.01" />
        </svg>
      );
    case 'behavior':
      return (
        <svg {...common}>
          <rect x={6} y={2} width={12} height={20} rx={2.5} />
          <path d="M11 18h2" />
          <path d="M9 6h6" />
        </svg>
      );
    case 'network':
      return (
        <svg {...common}>
          <circle cx={12} cy={5} r={2.2} />
          <circle cx={5} cy={19} r={2.2} />
          <circle cx={19} cy={19} r={2.2} />
          <path d="M11 7 6.5 17" />
          <path d="M13 7l4.5 10" />
          <path d="M7 19h10" />
        </svg>
      );
    case 'policy':
      return (
        <svg {...common}>
          <path d="M12 3 4 6v6c0 4.5 3.2 8.4 8 9.5 4.8-1.1 8-5 8-9.5V6l-8-3z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'victim':
      return (
        <svg {...common}>
          <circle cx={12} cy={8} r={3.5} />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );
  }
}

function Spinner({ color = '#1b61c9' }: { color?: string }) {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-pill"
      style={{
        border: `2px solid ${color}29`,
        borderTopColor: color,
      }}
    />
  );
}
