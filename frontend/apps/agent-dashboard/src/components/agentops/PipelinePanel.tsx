import type { VerificationRun } from '../../lib/agentops.js';

interface Props {
  run: VerificationRun | null;
}

const ALL_SIGNALS = [
  { signal: 'new_account',              label: 'Payee account < 14 days', weight: 20 },
  { signal: 'new_payee',                label: 'First transfer to payee', weight: 15 },
  { signal: 'amount_spike',             label: 'Amount > 3× user avg',     weight: 20 },
  { signal: 'late_night',               label: 'Late night (10pm–6am)',     weight: 10 },
  { signal: 'device_mismatch',          label: 'Device fingerprint mismatch', weight: 15 },
  { signal: 'payee_flagged',            label: 'Payee linked to flagged accounts', weight: 30 },
  { signal: 'round_amount',             label: 'Large round-number transfer', weight: 5 },
  { signal: 'payee_on_mule_watchlist',  label: 'Payee on mule watchlist',  weight: 30 },
];

export function PipelinePanel({ run }: Props) {
  if (!run) {
    return (
      <section
        className="rounded-2xl border border-dashed bg-white p-4 text-center text-caption"
        style={{ borderColor: '#e0e2e6', color: 'rgba(4,14,32,0.55)' }}
      >
        Pipeline trace appears here when a transaction enters verification.
      </section>
    );
  }

  const fired = new Set((run.triggered_signals ?? []).map((s) => s.signal));
  const ruleScore = run.rule_score ?? 0;
  const mlScore = run.ml_score ?? 0;
  const composite = run.composite_score ?? run.risk_score ?? 0;
  const modeLabel =
    run.mode === 'rules' ? 'Rules fast-path'
    : run.mode === 'mock' ? 'Mock streaming'
    : run.mode === 'bedrock' ? 'Bedrock streaming'
    : 'Streaming';

  return (
    <section
      className="rounded-2xl bg-white p-4"
      style={{
        border: '1px solid #e0e2e6',
        boxShadow: 'rgba(15,48,106,0.04) 0px 0px 16px',
      }}
    >
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-small-label uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px' }}>
            Detection pipeline
          </p>
          <p className="text-feature-title" style={{ color: '#181d26' }}>
            Rules → ML → Verification
          </p>
        </div>
        <ModeBadge mode={run.mode} label={modeLabel} />
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
        <Stage
          step="1"
          title="Rule engine"
          subtitle="8 signals · deterministic"
          score={ruleScore}
          tone="rules"
        >
          <div className="flex flex-wrap gap-1.5">
            {ALL_SIGNALS.map((s) => {
              const on = fired.has(s.signal);
              return (
                <span
                  key={s.signal}
                  title={s.label}
                  className="rounded-pill px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: on ? '#FEF2F2' : '#f8fafc',
                    color: on ? '#991B1B' : 'rgba(4,14,32,0.45)',
                    border: `1px solid ${on ? '#FCA5A5' : '#e0e2e6'}`,
                  }}
                >
                  {on ? '●' : '○'} {s.label.replace(/Payee account < 14 days/, '<14d')
                    .replace(/First transfer to payee/, 'first txn')
                    .replace(/Amount > 3× user avg/, '3× spike')
                    .replace(/Late night \(10pm–6am\)/, 'late night')
                    .replace(/Device fingerprint mismatch/, 'device mismatch')
                    .replace(/Payee linked to flagged accounts/, 'payee flagged')
                    .replace(/Large round-number transfer/, 'round amount')
                    .replace(/Payee on mule watchlist/, 'mule watchlist')} {on ? `+${s.weight}` : ''}
                </span>
              );
            })}
          </div>
        </Stage>

        <Stage
          step="2"
          title="AWS SageMaker"
          subtitle="Isolation Forest · ML"
          score={mlScore}
          tone="ml"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-caption">
              <span style={{ color: 'rgba(4,14,32,0.69)' }}>Anomaly score</span>
              <span style={{ color: '#181d26', fontWeight: 600 }}>{Math.round(mlScore)}/100</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-pill" style={{ backgroundColor: '#e0e2e6' }}>
              <div
                className="h-full rounded-pill transition-all duration-500"
                style={{
                  width: `${Math.min(100, mlScore)}%`,
                  background: 'linear-gradient(90deg, #16A34A 0%, #ca8a04 50%, #DC2626 100%)',
                }}
              />
            </div>
            <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.55)' }}>
              Composite = 0.4 × rules + 0.6 × ML →{' '}
              <span style={{ color: '#181d26', fontWeight: 600 }}>{Math.round(composite)}/100</span>
            </p>
          </div>
        </Stage>

        <Stage
          step="3"
          title="Agent verification"
          subtitle={modeLabel}
          score={Math.round(run.risk_score)}
          tone="agents"
        >
          <AgentRow run={run} />
        </Stage>
      </div>
    </section>
  );
}

function Stage({
  step,
  title,
  subtitle,
  score,
  tone,
  children,
}: {
  step: string;
  title: string;
  subtitle: string;
  score: number;
  tone: 'rules' | 'ml' | 'agents';
  children: React.ReactNode;
}) {
  const accent =
    tone === 'rules' ? { bg: '#eef4fc', fg: '#1b61c9' }
    : tone === 'ml' ? { bg: '#FEF3C7', fg: '#92400E' }
    : { bg: '#ECFDF5', fg: '#166534' };

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center text-[11px] font-bold"
            style={{ backgroundColor: accent.bg, color: accent.fg, borderRadius: 8 }}
          >
            {step}
          </span>
          <div className="leading-tight">
            <p className="text-small-label" style={{ color: '#181d26', fontWeight: 600 }}>
              {title}
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.55)' }}>
              {subtitle}
            </p>
          </div>
        </div>
        <span
          className="rounded-pill px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: accent.bg, color: accent.fg }}
        >
          {Math.round(score)}/100
        </span>
      </div>
      <div className="min-h-0">{children}</div>
    </div>
  );
}

function ModeBadge({ mode, label }: { mode: string; label: string }) {
  const colors =
    mode === 'rules'
      ? { bg: '#eef4fc', fg: '#1b61c9', border: '#cfe0f5' }
      : mode === 'mock'
        ? { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A' }
        : { bg: '#ECFDF5', fg: '#166534', border: '#BBF7D0' };
  return (
    <span
      className="rounded-pill px-3 py-1 text-[11px] font-bold"
      style={{ backgroundColor: colors.bg, color: colors.fg, border: `1px solid ${colors.border}` }}
    >
      {label}
    </span>
  );
}

const AGENT_LABELS: Record<string, string> = {
  txn: 'Txn',
  behavior: 'Behaviour',
  network: 'Network',
  policy: 'Compliance',
  victim: 'Victim',
};

function AgentRow({ run }: { run: VerificationRun }) {
  const findingMap: Record<string, string> = {};
  for (const f of run.findings) {
    findingMap[f.agent_name] = f.verdict;
  }
  const order = ['txn', 'behavior', 'network', 'policy', 'victim'];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {order.map((agent) => {
        const verdict = findingMap[agent];
        const isStreaming = (run.streams ?? []).find(
          (s) => s.agent_name === agent && s.status === 'streaming',
        );
        const colors = verdictColors(verdict, !!isStreaming);
        return (
          <span
            key={agent}
            className="flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.fg, border: `1px solid ${colors.border}` }}
          >
            {isStreaming && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-pill" style={{ backgroundColor: colors.fg }} />}
            {AGENT_LABELS[agent] ?? agent}
            {verdict && <span style={{ opacity: 0.7 }}>· {verdict}</span>}
          </span>
        );
      })}
      {run.final_verdict && (
        <span
          className="rounded-pill px-2 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: '#181d26',
            color: '#ffffff',
            marginLeft: 4,
          }}
        >
          → {run.final_verdict.toUpperCase()}
          {run.agreement_pct ? ` ${run.agreement_pct}%` : ''}
        </span>
      )}
    </div>
  );
}

function verdictColors(verdict: string | undefined, streaming: boolean) {
  if (streaming) return { bg: '#eef4fc', fg: '#1b61c9', border: '#cfe0f5' };
  switch (verdict) {
    case 'block': return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FCA5A5' };
    case 'warn':  return { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A' };
    case 'clear': return { bg: '#ECFDF5', fg: '#166534', border: '#BBF7D0' };
    case 'inconclusive': return { bg: '#f8fafc', fg: 'rgba(4,14,32,0.69)', border: '#e0e2e6' };
    default:      return { bg: '#ffffff', fg: 'rgba(4,14,32,0.45)', border: '#e0e2e6' };
  }
}
