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
      className="flex h-full flex-col overflow-hidden bg-white"
      style={{
        border: '1px solid #e0e2e6',
        borderRadius: 16,
        boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
      }}
    >
      <header
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e0e2e6', color: '#181d26' }}
      >
        <p className="text-small-label uppercase" style={{ letterSpacing: '0.28px', fontWeight: 600, color: '#1b61c9' }}>Decision feed</p>
        <div className="inline-flex p-0.5" style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 999 }}>
          <FilterButton id="all" active={filter} onSelect={setFilter} count={decided.length} label="All" />
          <FilterButton id="block" active={filter} onSelect={setFilter} count={tally.block} label="Block" />
          <FilterButton id="warn" active={filter} onSelect={setFilter} count={tally.warn} label="Warn" />
          <FilterButton id="clear" active={filter} onSelect={setFilter} count={tally.clear} label="Clear" />
        </div>
      </header>

      <ul className="flex-1 overflow-auto">
        {visible.length === 0 && (
          <li className="px-5 py-12 text-center text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
            {decided.length === 0
              ? 'No verifications yet. Inject a test alert above to see live cycles.'
              : 'No matches for this filter.'}
          </li>
        )}

        {visible.map((run) => {
          const palette = verdictPalette(run.final_verdict);
          return (
            <li key={run.run_id} className="border-t" style={{ borderColor: '#e0e2e6' }}>
              <button
                type="button"
                onClick={() => setSelectedId(run.run_id)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-airtable-soft-surface"
              >
                <span
                  className="flex items-center gap-1 px-2.5 py-1 text-small-label"
                  style={{ backgroundColor: palette.fg, color: '#ffffff', borderRadius: 999, fontWeight: 600 }}
                >
                  {palette.label}
                </span>

                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate font-mono text-small-label" style={{ color: '#181d26', fontWeight: 600 }}>
                    {shortAlertId(run.alert_id)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.69)' }}>
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
                  <span className="text-[10px]" style={{ color: 'rgba(4,14,32,0.69)' }}>
                    {run.agreement_pct ?? 0}% agree
                  </span>
                </div>

                <span className="ml-1" aria-hidden style={{ color: 'rgba(4,14,32,0.55)' }}>
                  →
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
      style={{ backgroundColor: 'rgba(24, 29, 38, 0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: 24,
          boxShadow: 'rgba(15,48,106,0.08) 0px 16px 48px, rgba(45,127,249,0.22) 0px 8px 24px',
          border: '1px solid #e0e2e6',
        }}
      >
        <header
          className="flex items-center gap-3 px-6 py-4"
          style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e0e2e6', color: '#181d26' }}
        >
          <span
            className="flex items-center gap-1 px-3 py-1 text-small-label"
            style={{ backgroundColor: palette.fg, color: '#ffffff', borderRadius: 999, fontWeight: 600 }}
          >
            {palette.label}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-mono text-feature-title" style={{ color: '#181d26' }}>
              {shortAlertId(run.alert_id)}
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(4,14,32,0.69)' }}>
              Risk {Math.round(run.risk_score)} · RM {Math.round(run.amount).toLocaleString('en-MY')} · {relativeTime(run.completed_at ?? run.started_at)} · {run.agreement_pct ?? 0}% agree · {formatLatency(run.total_latency_ms ?? 0)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-small-label transition-colors hover:bg-airtable-soft-surface"
            style={{ color: 'rgba(4,14,32,0.69)', borderRadius: 999, fontWeight: 600 }}
            aria-label="Close detail"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5" style={{ backgroundColor: '#f8fafc' }}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {AGENT_ORDER.map((agent) => {
              const f = run.findings.find((x) => x.agent_name === agent);
              const meta = AGENT_META[agent];
              const p = verdictPalette(f?.verdict ?? null);
              return (
                <div
                  key={agent}
                  className="bg-white p-4"
                  style={{
                    border: `1px solid ${p.border === 'transparent' ? '#e0e2e6' : p.border}`,
                    borderRadius: 16,
                    boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center"
                      style={{ backgroundColor: '#eef4fc', color: '#1b61c9', borderRadius: 12, fontWeight: 600, border: '1px solid #cfe0f5' }}
                    >
                      {meta.icon}
                    </span>
                    <p className="text-feature-title" style={{ color: '#181d26' }}>
                      {meta.label}
                    </p>
                    <span
                      className="ml-auto px-2 py-0.5 text-small-label"
                      style={{ backgroundColor: p.fg, color: '#ffffff', borderRadius: 999, fontWeight: 600 }}
                    >
                      {p.label}
                    </span>
                  </div>
                  {f ? (
                    <>
                      <p className="mt-2 text-caption" style={{ color: '#181d26' }}>{f.reasoning}</p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill" style={{ backgroundColor: '#e0e2e6' }}>
                        <div
                          className="h-full rounded-pill"
                          style={{ width: `${f.confidence}%`, backgroundColor: p.fg }}
                        />
                      </div>
                      <p className="mt-1 text-small-label" style={{ color: 'rgba(4,14,32,0.69)' }}>
                        {f.confidence}% confidence · {formatLatency(f.latency_ms)}
                      </p>
                      {f.evidence.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {f.evidence.slice(0, 6).map((e, i) => (
                            <li
                              key={`${run.run_id}_${agent}_${i}`}
                              className="flex items-center justify-between gap-2 text-small-label"
                            >
                              <span style={{ color: 'rgba(4,14,32,0.69)' }}>
                                {e.signal.replace(/_/g, ' ')}
                              </span>
                              <span className="truncate font-mono" style={{ color: '#181d26' }}>
                                {String(e.value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-caption" style={{ color: 'rgba(4,14,32,0.55)' }}>Awaiting reply…</p>
                  )}
                </div>
              );
            })}
          </div>

          {run.arbiter_reasoning && (
            <div
              className="mt-4 flex items-start gap-3 p-4"
              style={{ backgroundColor: '#ffffff', color: '#181d26', borderRadius: 16, border: '1px solid #e0e2e6' }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center text-feature-title"
                style={{ backgroundColor: '#eef4fc', color: '#1b61c9', borderRadius: 12, fontWeight: 600 }}
              >
                A
              </span>
              <div className="flex-1">
                <p className="text-small-label uppercase" style={{ letterSpacing: '0.28px', fontWeight: 600, color: '#1b61c9' }}>
                  Arbiter
                </p>
                <p className="text-caption" style={{ color: '#181d26' }}>{run.arbiter_reasoning}</p>
              </div>
              <span
                className="px-3 py-1 text-small-label"
                style={{ backgroundColor: palette.fg, color: '#ffffff', borderRadius: 999, fontWeight: 600 }}
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
      className="px-2.5 py-1 text-[11px] transition-colors"
      style={{
        backgroundColor: isActive ? '#1b61c9' : 'transparent',
        color: isActive ? '#ffffff' : 'rgba(4,14,32,0.69)',
        borderRadius: 999,
        fontWeight: 600,
        letterSpacing: '0.08px',
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
      <div className="relative h-1.5 w-24 overflow-hidden rounded-pill" style={{ backgroundColor: '#e0e2e6' }}>
        <div
          className="h-full rounded-pill"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
        {avg > 0 && (
          <span
            className="absolute top-0 h-full w-0.5"
            style={{
              left: `${Math.max(0, Math.min(100, Math.round((avg / max) * 100)))}%`,
              backgroundColor: '#254fad',
              opacity: 0.55,
            }}
          />
        )}
      </div>
      <span className="font-mono text-small-label" style={{ color: '#181d26' }}>{formatLatency(ms)}</span>
    </div>
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
      className="relative flex h-7 w-7 items-center justify-center text-[11px]"
      style={{
        backgroundColor: isPending ? '#f8fafc' : palette.fg,
        color: isPending ? 'rgba(4,14,32,0.55)' : '#ffffff',
        border: `1px solid ${isPending ? '#e0e2e6' : palette.border === 'transparent' ? palette.fg : palette.border}`,
        borderRadius: 8,
        fontWeight: 600,
      }}
      title={`${meta.label}: ${palette.label}`}
    >
      {meta.icon}
    </span>
  );
}
