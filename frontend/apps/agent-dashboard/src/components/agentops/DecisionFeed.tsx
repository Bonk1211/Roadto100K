import { useState } from 'react';
import type { VerificationRun } from '../../lib/agentops.js';
import {
  AGENT_ORDER,
  formatLatency,
  relativeTime,
  shortAlertId,
  verdictPalette,
} from '../../lib/agentops.js';

interface Props {
  runs: VerificationRun[];
}

export function DecisionFeed({ runs }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-section-heading text-text-primary">Decision feed</p>
          <p className="text-caption text-muted-text">
            Auto-decisions from the agent team. Click a row to inspect findings.
          </p>
        </div>
        <span className="text-caption text-muted-text">{runs.length} runs</span>
      </header>

      <ul className="flex-1 overflow-auto">
        {runs.length === 0 && (
          <li className="px-5 py-12 text-center text-caption text-muted-text">
            No verifications yet. Inject a test alert or wait for live transactions.
          </li>
        )}

        {runs.map((run) => {
          const isOpen = expanded === run.run_id;
          const palette = verdictPalette(
            run.final_verdict ?? (run.status === 'running' ? null : null),
          );
          const isRunning = run.status === 'running';
          const findingsDone = run.findings.length;
          return (
            <li
              key={run.run_id}
              className="border-t"
              style={{ borderColor: '#F3F4F6' }}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : run.run_id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-app-gray"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {isRunning ? (
                    <span
                      className="rounded-pill px-3 py-1 text-small-label font-bold"
                      style={{
                        backgroundColor: '#EAF3FF',
                        color: '#0055D4',
                        border: '1px solid #BFDBFE',
                      }}
                    >
                      ANALYZING {findingsDone}/5
                    </span>
                  ) : (
                    <span
                      className="rounded-pill px-3 py-1 text-small-label font-bold"
                      style={{
                        backgroundColor: palette.bg,
                        color: palette.fg,
                        border: `1px solid ${palette.border}`,
                      }}
                    >
                      {palette.label}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-feature-title text-text-primary">
                      <span className="font-mono">{shortAlertId(run.alert_id)}</span>
                      {run.alert_type && (
                        <span className="ml-2 text-caption text-muted-text">
                          {run.alert_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </p>
                    <p className="text-caption text-muted-text">
                      {isRunning
                        ? `Started ${relativeTime(run.started_at)}`
                        : `Decided in ${formatLatency(run.total_latency_ms)} · ${run.agreement_pct ?? 0}% agree · ${relativeTime(run.completed_at ?? run.started_at)}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-caption">
                  <RiskPill score={run.risk_score} />
                  <span className="font-mono text-text-primary">
                    RM {Math.round(run.amount).toLocaleString('en-MY')}
                  </span>
                  <span
                    className="text-muted-text"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                  >
                    ▾
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="bg-app-gray px-5 py-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {AGENT_ORDER.map((agent) => {
                      const f = run.findings.find((x) => x.agent_name === agent);
                      const p = verdictPalette(f?.verdict ?? null);
                      return (
                        <div
                          key={agent}
                          className="rounded-md bg-white p-3 shadow-card"
                          style={{ border: '1px solid #E5E7EB' }}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-feature-title text-text-primary">
                              {f?.agent_label ?? agent}
                            </p>
                            <span
                              className="rounded-pill px-2 py-0.5 text-small-label font-bold"
                              style={{
                                backgroundColor: p.bg,
                                color: p.fg,
                                border: `1px solid ${p.border}`,
                              }}
                            >
                              {p.label}
                            </span>
                          </div>
                          {f ? (
                            <>
                              <p className="mt-2 text-caption text-text-primary">
                                {f.reasoning}
                              </p>
                              <ul className="mt-2 space-y-1">
                                {f.evidence.slice(0, 4).map((e, i) => (
                                  <li
                                    key={`${run.run_id}_${agent}_${i}`}
                                    className="flex items-center justify-between text-small-label"
                                  >
                                    <span className="text-muted-text">
                                      {e.signal.replace(/_/g, ' ')}
                                    </span>
                                    <span className="font-mono text-text-primary">
                                      {String(e.value)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-small-label text-muted-text">
                                {f.confidence}% confidence · {formatLatency(f.latency_ms)}
                              </p>
                            </>
                          ) : (
                            <p className="mt-2 text-caption text-muted-text">
                              Awaiting reply…
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {run.arbiter_reasoning && (
                    <div
                      className="mt-3 rounded-md p-3 text-caption"
                      style={{ backgroundColor: '#EAF3FF', color: '#0F3B82' }}
                    >
                      <p className="font-semibold">Arbiter</p>
                      <p>{run.arbiter_reasoning}</p>
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

function RiskPill({ score }: { score: number }) {
  const palette =
    score >= 71
      ? { bg: '#FEF2F2', fg: '#B91C1C' }
      : score >= 40
        ? { bg: '#FFFBEB', fg: '#92400E' }
        : { bg: '#ECFDF5', fg: '#166534' };
  return (
    <span
      className="rounded-pill px-2 py-0.5 text-small-label font-bold"
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      Risk {Math.round(score)}
    </span>
  );
}
