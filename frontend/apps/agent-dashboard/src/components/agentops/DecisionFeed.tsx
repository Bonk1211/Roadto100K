import { useState } from 'react';
import type { AgentName, VerificationRun, Verdict } from '../../lib/agentops.js';
import {
  AGENT_META,
  AGENT_ORDER,
  formatLatency,
  relativeTime,
  shortAlertId,
  verdictPalette,
} from '../../lib/agentops.js';

interface Props {
  runs: VerificationRun[];
}

type FilterKey = 'all' | 'block' | 'warn' | 'clear';

export function DecisionFeed({ runs }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const decided = runs.filter((r) => r.status === 'decided');
  const visible = decided.filter((r) =>
    filter === 'all' ? true : r.final_verdict === filter,
  );

  const tally = {
    block: decided.filter((r) => r.final_verdict === 'block').length,
    warn: decided.filter((r) => r.final_verdict === 'warn').length,
    clear: decided.filter((r) => r.final_verdict === 'clear').length,
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-section-heading text-text-primary">Decision feed</p>
          <p className="text-caption text-muted-text">
            Each row: alert → 5 agent verdicts → arbiter. Click to inspect reasoning.
          </p>
        </div>

        <div className="inline-flex rounded-pill p-1" style={{ backgroundColor: '#F1F5F9' }}>
          <FilterButton id="all" active={filter} onSelect={setFilter} count={decided.length} label="All" />
          <FilterButton id="block" active={filter} onSelect={setFilter} count={tally.block} label="⛔ Block" />
          <FilterButton id="warn" active={filter} onSelect={setFilter} count={tally.warn} label="⚠ Warn" />
          <FilterButton id="clear" active={filter} onSelect={setFilter} count={tally.clear} label="✓ Clear" />
        </div>
      </header>

      <ul className="flex-1 overflow-auto">
        {visible.length === 0 && (
          <li className="px-5 py-12 text-center text-caption text-muted-text">
            {decided.length === 0
              ? 'No verifications yet. Inject a test alert above to see live cycles.'
              : 'No matches for this filter.'}
          </li>
        )}

        {visible.map((run) => {
          const isOpen = expanded === run.run_id;
          const palette = verdictPalette(run.final_verdict);
          return (
            <li key={run.run_id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : run.run_id)}
                className="flex w-full flex-col gap-2 px-5 py-3 text-left transition-colors hover:bg-app-gray"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <FlowChip
                    title={shortAlertId(run.alert_id)}
                    subtitle={`Risk ${Math.round(run.risk_score)} · RM ${Math.round(run.amount).toLocaleString('en-MY')}`}
                  />
                  <Arrow />
                  <div className="flex items-center gap-1.5">
                    {AGENT_ORDER.map((agent) => {
                      const f = run.findings.find((x) => x.agent_name === agent);
                      return <AgentDot key={agent} agent={agent} verdict={f?.verdict ?? null} />;
                    })}
                  </div>
                  <Arrow />
                  <span
                    className="flex items-center gap-2 rounded-pill px-3 py-1.5 text-feature-title font-bold"
                    style={{
                      backgroundColor: palette.fg,
                      color: '#FFFFFF',
                    }}
                  >
                    <span className="text-[16px]">{verdictIcon(run.final_verdict)}</span>
                    {palette.label}
                  </span>
                  <span className="ml-auto text-caption text-muted-text">
                    {run.agreement_pct ?? 0}% · {formatLatency(run.total_latency_ms)} · {relativeTime(run.completed_at ?? run.started_at)}
                  </span>
                  <span className="text-muted-text" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                    ▾
                  </span>
                </div>
                {!isOpen && run.arbiter_reasoning && (
                  <p className="ml-1 line-clamp-1 text-caption text-muted-text">
                    {run.arbiter_reasoning}
                  </p>
                )}
              </button>

              {isOpen && (
                <div className="bg-app-gray px-5 py-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {AGENT_ORDER.map((agent) => {
                      const f = run.findings.find((x) => x.agent_name === agent);
                      const meta = AGENT_META[agent];
                      const p = verdictPalette(f?.verdict ?? null);
                      return (
                        <div
                          key={agent}
                          className="rounded-xl bg-white p-3 shadow-card"
                          style={{ border: `1.5px solid ${p.border}` }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-pill font-bold"
                              style={{ backgroundColor: '#0055D4', color: '#FFE600' }}
                            >
                              {meta.icon}
                            </span>
                            <p className="text-feature-title text-text-primary">
                              {meta.label}
                            </p>
                            <span
                              className="ml-auto rounded-pill px-2 py-0.5 text-small-label font-bold"
                              style={{ backgroundColor: p.fg, color: '#FFFFFF' }}
                            >
                              {p.label}
                            </span>
                          </div>
                          {f ? (
                            <>
                              <p className="mt-2 text-caption text-text-primary">{f.reasoning}</p>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill" style={{ backgroundColor: '#F1F5F9' }}>
                                <div
                                  className="h-full rounded-pill"
                                  style={{ width: `${f.confidence}%`, backgroundColor: p.fg }}
                                />
                              </div>
                              <p className="mt-1 text-small-label text-muted-text">
                                {f.confidence}% confidence · {formatLatency(f.latency_ms)}
                              </p>
                              {f.evidence.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {f.evidence.slice(0, 3).map((e, i) => (
                                    <li
                                      key={`${run.run_id}_${agent}_${i}`}
                                      className="flex items-center justify-between gap-2 text-small-label"
                                    >
                                      <span className="text-muted-text">
                                        {e.signal.replace(/_/g, ' ')}
                                      </span>
                                      <span className="truncate font-mono text-text-primary">
                                        {String(e.value)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          ) : (
                            <p className="mt-2 text-caption text-muted-text">Awaiting reply…</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {run.arbiter_reasoning && (
                    <div
                      className="mt-3 flex items-start gap-3 rounded-xl p-3"
                      style={{ backgroundColor: '#0F3B82', color: '#FFFFFF' }}
                    >
                      <span className="text-[20px]">⚖️</span>
                      <div className="flex-1">
                        <p className="text-small-label uppercase tracking-wide text-white/70">
                          Arbiter
                        </p>
                        <p className="text-caption">{run.arbiter_reasoning}</p>
                      </div>
                      <span
                        className="rounded-pill px-3 py-1 text-small-label font-bold"
                        style={{ backgroundColor: palette.fg, color: '#FFFFFF' }}
                      >
                        {palette.label}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FilterButton({
  id,
  active,
  onSelect,
  count,
  label,
}: {
  id: FilterKey;
  active: FilterKey;
  onSelect: (k: FilterKey) => void;
  count: number;
  label: string;
}) {
  const isActive = id === active;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className="rounded-pill px-3 py-1 text-small-label font-semibold transition-colors"
      style={{
        backgroundColor: isActive ? '#0055D4' : 'transparent',
        color: isActive ? '#FFFFFF' : '#0055D4',
      }}
    >
      {label} <span style={{ opacity: isActive ? 1 : 0.65 }}>{count}</span>
    </button>
  );
}

function FlowChip({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#EAF3FF' }}>
      <p className="font-mono text-small-label font-bold text-text-primary">{title}</p>
      <p className="text-[10px] text-muted-text">{subtitle}</p>
    </div>
  );
}

function Arrow() {
  return (
    <span className="text-feature-title text-muted-text" aria-hidden>
      →
    </span>
  );
}

function AgentDot({
  agent,
  verdict,
}: {
  agent: AgentName;
  verdict: Verdict | null;
}) {
  const meta = AGENT_META[agent];
  const palette = verdictPalette(verdict);
  const isPending = verdict === null;
  return (
    <span
      className="relative flex h-8 w-8 items-center justify-center rounded-pill text-[12px] font-bold"
      style={{
        backgroundColor: isPending ? '#E5E7EB' : palette.fg,
        color: isPending ? '#6B7280' : '#FFFFFF',
        border: `1.5px solid ${isPending ? '#CBD5E1' : palette.border}`,
      }}
      title={`${meta.label}: ${palette.label}`}
    >
      {meta.icon}
    </span>
  );
}

function verdictIcon(verdict: 'block' | 'warn' | 'clear' | null): string {
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
