import { useEffect, useMemo, useState } from 'react';
import type { AgentName, VerificationRun, Verdict } from '../../lib/agentops.js';
import {
  AGENT_META,
  AGENT_ORDER,
  formatLatency,
  relativeTime,
  shortAlertId,
  verdictPalette,
} from '../../lib/agentops.js';
import { CHART_COLORS } from '../../lib/charts.js';

interface Props {
  runs: VerificationRun[];
}

type FilterKey = 'all' | 'block' | 'warn' | 'clear';

export function DecisionFeed({ runs }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const decided = runs.filter((r) => r.status === 'decided');
  const visible = decided.filter((r) =>
    filter === 'all' ? true : r.final_verdict === filter,
  );

  const selectedRun = useMemo(
    () => decided.find((r) => r.run_id === selectedId) ?? null,
    [decided, selectedId],
  );

  useEffect(() => {
    if (!selectedRun) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRun]);

  const tally = {
    block: decided.filter((r) => r.final_verdict === 'block').length,
    warn: decided.filter((r) => r.final_verdict === 'warn').length,
    clear: decided.filter((r) => r.final_verdict === 'clear').length,
  };

  const latencyMax = useMemo(() => {
    let m = 0;
    for (const r of decided) m = Math.max(m, r.total_latency_ms ?? 0);
    return m || 1;
  }, [decided]);
  const latencyAvg = useMemo(() => {
    if (decided.length === 0) return 0;
    let s = 0;
    for (const r of decided) s += r.total_latency_ms ?? 0;
    return s / decided.length;
  }, [decided]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header
        className="flex items-center justify-between gap-2 px-4 py-2.5"
        style={{ backgroundColor: '#0F3B82', color: '#FFFFFF' }}
      >
        <p className="text-small-label uppercase tracking-wide">Decision feed</p>
        <div className="inline-flex rounded-pill p-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
          <FilterButton id="all" active={filter} onSelect={setFilter} count={decided.length} label="All" />
          <FilterButton id="block" active={filter} onSelect={setFilter} count={tally.block} label="⛔" />
          <FilterButton id="warn" active={filter} onSelect={setFilter} count={tally.warn} label="⚠" />
          <FilterButton id="clear" active={filter} onSelect={setFilter} count={tally.clear} label="✓" />
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
          const palette = verdictPalette(run.final_verdict);
          return (
            <li key={run.run_id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
              <button
                type="button"
                onClick={() => setSelectedId(run.run_id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-app-gray"
              >
                <span
                  className="flex items-center gap-1 rounded-pill px-2 py-1 text-small-label font-bold"
                  style={{ backgroundColor: palette.fg, color: '#FFFFFF' }}
                >
                  <span className="text-[12px]">{verdictIcon(run.final_verdict)}</span>
                  {palette.label}
                </span>

                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate font-mono text-small-label font-bold text-text-primary">
                    {shortAlertId(run.alert_id)}
                  </p>
                  <p className="text-[10px] text-muted-text">
                    Risk {Math.round(run.risk_score)} · RM {Math.round(run.amount).toLocaleString('en-MY')} · {relativeTime(run.completed_at ?? run.started_at)}
                  </p>
                </div>

                <div className="hidden items-center gap-1 md:flex">
                  {AGENT_ORDER.map((agent) => {
                    const f = run.findings.find((x) => x.agent_name === agent);
                    return <AgentDot key={agent} agent={agent} verdict={f?.verdict ?? null} />;
                  })}
                </div>

                <div className="hidden flex-col items-end gap-0.5 md:flex">
                  <LatencyBar
                    ms={run.total_latency_ms ?? 0}
                    max={latencyMax}
                    avg={latencyAvg}
                  />
                  <span className="text-[10px] text-muted-text">
                    {run.agreement_pct ?? 0}% agree
                  </span>
                </div>

                <span className="ml-1 text-muted-text" aria-hidden>
                  ⤢
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedRun && (
        <DetailModal run={selectedRun} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function DetailModal({ run, onClose }: { run: VerificationRun; onClose: () => void }) {
  const palette = verdictPalette(run.final_verdict);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center gap-3 px-5 py-3"
          style={{ backgroundColor: '#0F3B82', color: '#FFFFFF' }}
        >
          <span
            className="flex items-center gap-1 rounded-pill px-3 py-1 text-small-label font-bold"
            style={{ backgroundColor: palette.fg, color: '#FFFFFF' }}
          >
            <span className="text-[12px]">{verdictIcon(run.final_verdict)}</span>
            {palette.label}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-mono text-feature-title">
              {shortAlertId(run.alert_id)}
            </p>
            <p className="text-[11px] text-white/70">
              Risk {Math.round(run.risk_score)} · RM {Math.round(run.amount).toLocaleString('en-MY')} · {relativeTime(run.completed_at ?? run.started_at)} · {run.agreement_pct ?? 0}% agree · {formatLatency(run.total_latency_ms ?? 0)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill px-3 py-1 text-small-label font-bold transition-colors hover:bg-white/10"
            style={{ color: '#FFFFFF' }}
            aria-label="Close detail"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-auto bg-app-gray px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                          {f.evidence.slice(0, 6).map((e, i) => (
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
              className="mt-4 flex items-start gap-3 rounded-xl p-3"
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
      </div>
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
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      className="rounded-pill px-2 py-0.5 text-[11px] font-bold transition-colors"
      style={{
        backgroundColor: isActive ? '#FFE600' : 'transparent',
        color: isActive ? '#0055D4' : 'rgba(255,255,255,0.85)',
      }}
    >
      {label} <span style={{ opacity: isActive ? 1 : 0.7 }}>{count}</span>
    </button>
  );
}

function LatencyBar({ ms, max, avg }: { ms: number; max: number; avg: number }) {
  if (!ms) return null;
  const pct = Math.max(4, Math.min(100, Math.round((ms / max) * 100)));
  const tone = ms < avg ? CHART_COLORS.clear : ms < avg * 1.5 ? CHART_COLORS.warn : CHART_COLORS.block;
  return (
    <div className="flex items-center gap-2" title={`Latency ${formatLatency(ms)} (avg ${formatLatency(avg)})`}>
      <div className="relative h-1.5 w-24 overflow-hidden rounded-pill" style={{ backgroundColor: '#E5E7EB' }}>
        <div
          className="h-full rounded-pill"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
        {avg > 0 && (
          <span
            className="absolute top-0 h-full w-0.5"
            style={{
              left: `${Math.max(0, Math.min(100, Math.round((avg / max) * 100)))}%`,
              backgroundColor: '#0F3B82',
              opacity: 0.55,
            }}
          />
        )}
      </div>
      <span className="font-mono text-small-label text-text-primary">{formatLatency(ms)}</span>
    </div>
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
