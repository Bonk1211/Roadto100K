import { useEffect, useMemo, useState } from 'react';
import { LoadingDots } from 'shared';
import { getModelHealthViewModel } from '../lib/investigations/modelHealthAdapter.js';
import type { LabelSink, ModelHealthViewModel, RecentLabel } from '../lib/investigations/types.js';

export function SettingsScreen() {
  const model = useMemo(() => getModelHealthViewModel(), []);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [pulseTick, setPulseTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPulseTick((t) => (t + 1) % 4), 1500);
    return () => window.clearInterval(id);
  }, []);

  function runRetrainDemo() {
    setStatus('running');
    window.setTimeout(() => setStatus('done'), 1800);
  }

  return (
    <div className="grid gap-6">
      <HeroMetrics model={model} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FeedbackLoopCard model={model} pulseTick={pulseTick} />
        <SinksCard sinks={model.sinks} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <LabelSplitCard model={model} />
        <RecentLabelsCard rows={model.recentLabels} />
      </div>

      <RetrainScheduleCard model={model} status={status} onRun={runRetrainDemo} />
    </div>
  );
}

function HeroMetrics({ model }: { model: ModelHealthViewModel }) {
  return (
    <section
      className="bg-white p-6"
      style={cardStyle}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
            Model health
          </p>
          <h2 className="mt-1 text-section-heading" style={{ color: '#181d26' }}>F7 · Feedback loop &amp; retraining</h2>
          <p className="mt-1 text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
            Agent &amp; user decisions become labels. Daily EventBridge cron retrains EAS model on merged S3 + OSS labels.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 px-3 py-1 text-small-label"
          style={{
            backgroundColor: '#ECFDF5',
            color: '#166534',
            borderRadius: 999,
            fontWeight: 500,
            border: '1px solid #BBF7D0',
          }}
        >
          <span className="inline-block h-2 w-2 rounded-pill" style={{ backgroundColor: '#16A34A' }} />
          Loop healthy
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active version"
          value={model.modelVersion}
          sub={`prev: ${model.previousVersion}`}
        />
        <Metric
          label="Labels staged"
          value={String(model.labelsSinceRetrain)}
          sub={`agent ${model.loop.agentLabels} · user ${model.loop.userLabels}`}
        />
        <Metric
          label="Accuracy delta"
          value={`+${model.accuracyDelta.toFixed(1)}%`}
          sub="vs previous version"
          tone="good"
        />
        <Metric
          label="Queue coverage"
          value={`${model.queueCoverage}%`}
          sub="alerts reaching agent"
        />
      </div>
    </section>
  );
}

function FeedbackLoopCard({ model, pulseTick }: { model: ModelHealthViewModel; pulseTick: number }) {
  return (
    <section className="bg-white p-6" style={cardStyle}>
      <header className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
            Cycle
          </p>
          <h3 className="mt-1 text-card-title" style={{ color: '#181d26' }}>Decision → Label → Retrain → Model</h3>
        </div>
        <span className="text-caption" style={{ color: 'rgba(4,14,32,0.55)' }}>
          {model.loop.retrainsThisWeek} retrains this week
        </span>
      </header>

      <LoopDiagram model={model} pulseTick={pulseTick} />
    </section>
  );
}

function LoopDiagram({ model, pulseTick }: { model: ModelHealthViewModel; pulseTick: number }) {
  const W = 720;
  const H = 320;
  const nodeFill = '#ffffff';
  const nodeStroke = '#cfe0f5';
  const accent = '#1b61c9';
  const muted = 'rgba(4,14,32,0.55)';

  const nodes = {
    agent:  { x: 70,  y: 70,  w: 150, h: 60, title: 'Agent action', sub: `${model.loop.agentLabels} labels · block/warn/clear` },
    user:   { x: 70,  y: 220, w: 150, h: 60, title: 'User choice',  sub: `${model.loop.userLabels} labels · cancel/proceed/report` },
    queue:  { x: 290, y: 145, w: 140, h: 60, title: 'Label queue',  sub: `${model.loop.mergedLabels} merged` },
    sinks:  { x: 480, y: 70,  w: 170, h: 60, title: 'S3 + OSS sinks', sub: 'data sovereignty mirror' },
    train:  { x: 480, y: 220, w: 170, h: 60, title: 'EC2 /retrain',   sub: 'FastAPI · Isolation Forest' },
    model:  { x: 295, y: 290, w: 130, h: 22, title: 'EAS model',      sub: model.modelVersion },
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="320" style={{ display: 'block' }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={accent} />
        </marker>
      </defs>

      <FlowEdge from={nodes.agent}  to={nodes.queue} active={pulseTick === 0} accent={accent} label="fraud / false_positive" />
      <FlowEdge from={nodes.user}   to={nodes.queue} active={pulseTick === 0} accent={accent} label="user label" />
      <FlowEdge from={nodes.queue}  to={nodes.sinks} active={pulseTick === 1} accent={accent} label="write_label()" />
      <FlowEdge from={nodes.queue}  to={nodes.train} active={pulseTick === 1} accent={accent} label="train set" />
      <FlowEdge from={nodes.train}  to={nodes.model} active={pulseTick === 2} accent={accent} curved label="republish" />
      <FlowEdge from={nodes.sinks}  to={nodes.train} active={pulseTick === 2} accent={accent} label="merge S3+OSS" />
      <FlowEdge from={nodes.model}  to={nodes.queue} active={pulseTick === 3} accent="#16A34A" curved upward label="next inference" />

      <LoopNode n={nodes.agent} fill={nodeFill} stroke={nodeStroke} accent={accent} muted={muted} icon="agent" />
      <LoopNode n={nodes.user}  fill={nodeFill} stroke={nodeStroke} accent={accent} muted={muted} icon="user" />
      <LoopNode n={nodes.queue} fill="#eef4fc" stroke="#cfe0f5" accent={accent} muted={muted} icon="queue" emphasis />
      <LoopNode n={nodes.sinks} fill={nodeFill} stroke={nodeStroke} accent={accent} muted={muted} icon="db" />
      <LoopNode n={nodes.train} fill={nodeFill} stroke={nodeStroke} accent={accent} muted={muted} icon="cog" />
      <LoopNode n={nodes.model} fill="#ECFDF5" stroke="#BBF7D0" accent="#166534" muted={muted} compact />
    </svg>
  );
}

type NodeBox = { x: number; y: number; w: number; h: number; title: string; sub: string };

function LoopNode({
  n, fill, stroke, accent, muted, icon, compact, emphasis,
}: {
  n: NodeBox; fill: string; stroke: string; accent: string; muted: string;
  icon?: 'agent' | 'user' | 'queue' | 'db' | 'cog'; compact?: boolean; emphasis?: boolean;
}) {
  return (
    <g>
      <rect
        x={n.x} y={n.y} width={n.w} height={n.h}
        rx={compact ? 6 : 12} ry={compact ? 6 : 12}
        fill={fill} stroke={stroke} strokeWidth={emphasis ? 2 : 1}
      />
      {!compact && icon && (
        <g transform={`translate(${n.x + 12}, ${n.y + n.h / 2 - 9})`}>
          <NodeIcon kind={icon} color={accent} />
        </g>
      )}
      <text
        x={compact ? n.x + n.w / 2 : n.x + (icon ? 40 : 12)}
        y={compact ? n.y + 14 : n.y + 22}
        fontSize={compact ? 10 : 12}
        fontWeight={600}
        fill={accent}
        textAnchor={compact ? 'middle' : 'start'}
      >
        {n.title}
      </text>
      {!compact && (
        <text
          x={n.x + (icon ? 40 : 12)}
          y={n.y + 40}
          fontSize={10}
          fill={muted}
        >
          {n.sub}
        </text>
      )}
      {compact && (
        <text x={n.x + n.w / 2} y={n.y + 18} fontSize={9} fill={muted} textAnchor="middle">
          {n.sub}
        </text>
      )}
    </g>
  );
}

function NodeIcon({ kind, color }: { kind: 'agent' | 'user' | 'queue' | 'db' | 'cog'; color: string }) {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'agent') {
    return (
      <svg {...props}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      </svg>
    );
  }
  if (kind === 'user') {
    return (
      <svg {...props}>
        <rect x="4" y="5" width="16" height="12" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    );
  }
  if (kind === 'queue') {
    return (
      <svg {...props}>
        <rect x="4" y="5" width="16" height="3" />
        <rect x="4" y="11" width="16" height="3" />
        <rect x="4" y="17" width="16" height="3" />
      </svg>
    );
  }
  if (kind === 'db') {
    return (
      <svg {...props}>
        <ellipse cx="12" cy="6" rx="7" ry="2.5" />
        <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
        <path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
    </svg>
  );
}

function FlowEdge({
  from, to, active, accent, label, curved, upward,
}: {
  from: NodeBox; to: NodeBox; active: boolean; accent: string;
  label?: string; curved?: boolean; upward?: boolean;
}) {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2;
  const y2 = to.y + to.h / 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const path = curved
    ? `M ${x1} ${y1} Q ${mx} ${upward ? Math.min(y1, y2) - 60 : Math.max(y1, y2) + 40} ${x2} ${y2}`
    : `M ${x1} ${y1} L ${x2} ${y2}`;
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={active ? accent : '#cfe0f5'}
        strokeWidth={active ? 2 : 1.2}
        strokeDasharray={active ? '0' : '4 4'}
        markerEnd="url(#arrow)"
        opacity={active ? 1 : 0.6}
      >
        {active && (
          <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.6s" repeatCount="indefinite" />
        )}
      </path>
      {label && (
        <text x={mx} y={my - 6} fontSize={9} fill="rgba(4,14,32,0.55)" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

function SinksCard({ sinks }: { sinks: LabelSink[] }) {
  return (
    <section className="bg-white p-6" style={cardStyle}>
      <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
        Label sinks
      </p>
      <h3 className="mt-1 text-card-title" style={{ color: '#181d26' }}>Dual-region mirror</h3>
      <p className="mt-1 text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
        Every label written to AWS &amp; Alibaba — Malaysian data sovereignty story is real, not stub.
      </p>

      <ul className="mt-5 space-y-3">
        {sinks.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between gap-3 p-3"
            style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 12 }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 place-items-center"
                style={{ backgroundColor: sinkColor(s.status).bg, color: sinkColor(s.status).fg, borderRadius: 10 }}
              >
                <SinkDot status={s.status} />
              </span>
              <div className="leading-tight">
                <p className="text-small-label" style={{ color: '#181d26', fontWeight: 600 }}>{s.name}</p>
                <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.55)' }}>{s.region}</p>
              </div>
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm" style={{ color: '#181d26', fontWeight: 600 }}>{s.writes24h}</p>
              <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.55)' }}>writes / 24h</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SinkDot({ status }: { status: LabelSink['status'] }) {
  const c = sinkColor(status);
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-pill opacity-60" style={{ backgroundColor: c.fg }} />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-pill" style={{ backgroundColor: c.fg }} />
    </span>
  );
}

function sinkColor(status: LabelSink['status']) {
  if (status === 'healthy') return { bg: '#ECFDF5', fg: '#16A34A' };
  if (status === 'lagging') return { bg: '#FFFBEB', fg: '#92400E' };
  return { bg: '#FEF2F2', fg: '#B91C1C' };
}

function LabelSplitCard({ model }: { model: ModelHealthViewModel }) {
  const { fraud, falsePositive, agentShare, userShare } = model.labelSplit;
  return (
    <section className="bg-white p-6" style={cardStyle}>
      <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
        Label split
      </p>
      <h3 className="mt-1 text-card-title" style={{ color: '#181d26' }}>Class &amp; source mix</h3>

      <div className="mt-5 space-y-5">
        <SplitBar
          title="By class"
          left={{ label: 'fraud', pct: fraud, color: '#DC2626', sub: `${Math.round(fraud)}%` }}
          right={{ label: 'false_positive', pct: falsePositive, color: '#16A34A', sub: `${Math.round(falsePositive)}%` }}
        />
        <SplitBar
          title="By source"
          left={{ label: 'agent', pct: agentShare, color: '#1b61c9', sub: `${Math.round(agentShare)}%` }}
          right={{ label: 'user', pct: userShare, color: '#7c3aed', sub: `${Math.round(userShare)}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Mini label="Agent" value={String(model.loop.agentLabels)} color="#1b61c9" />
        <Mini label="User" value={String(model.loop.userLabels)} color="#7c3aed" />
        <Mini label="Merged" value={String(model.loop.mergedLabels)} color="#181d26" />
      </div>
    </section>
  );
}

function SplitBar({
  title, left, right,
}: {
  title: string;
  left: { label: string; pct: number; color: string; sub: string };
  right: { label: string; pct: number; color: string; sub: string };
}) {
  return (
    <div>
      <p className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>
        {title}
      </p>
      <div className="mt-2 flex h-7 w-full overflow-hidden" style={{ borderRadius: 10, border: '1px solid #e0e2e6' }}>
        <div
          className="flex items-center justify-start px-2 text-[10px] font-bold text-white"
          style={{ backgroundColor: left.color, width: `${left.pct}%` }}
        >
          {left.label} {left.sub}
        </div>
        <div
          className="flex items-center justify-end px-2 text-[10px] font-bold text-white"
          style={{ backgroundColor: right.color, width: `${right.pct}%` }}
        >
          {right.label} {right.sub}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 10 }}>
      <p className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>{label}</p>
      <p className="mt-1 text-lg" style={{ color, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function RecentLabelsCard({ rows }: { rows: RecentLabel[] }) {
  return (
    <section className="bg-white p-6" style={cardStyle}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
            Live label stream
          </p>
          <h3 className="mt-1 text-card-title" style={{ color: '#181d26' }}>Recent decisions → labels</h3>
        </div>
        <span
          className="inline-flex items-center gap-2 px-3 py-1 text-[10px]"
          style={{
            backgroundColor: '#eef4fc', color: '#1b61c9', borderRadius: 999, fontWeight: 600, border: '1px solid #cfe0f5',
          }}
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-pill" style={{ backgroundColor: '#1b61c9' }} />
          Kinesis tail
        </span>
      </div>

      <div className="mt-4 max-h-[320px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px' }}>
              <th className="py-2 font-semibold">Time</th>
              <th className="py-2 font-semibold">Source</th>
              <th className="py-2 font-semibold">Action</th>
              <th className="py-2 font-semibold">Label</th>
              <th className="py-2 font-semibold">Txn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e0e2e6' }}>
                <td className="py-2 text-[11px]" style={{ color: 'rgba(4,14,32,0.69)' }}>
                  {new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-2">
                  <SourceTag source={r.source} actor={r.actor} />
                </td>
                <td className="py-2 text-[11px]" style={{ color: '#181d26' }}>{r.action}</td>
                <td className="py-2">
                  <LabelTag label={r.label} />
                </td>
                <td className="py-2 font-mono text-[10px]" style={{ color: 'rgba(4,14,32,0.55)' }}>{r.txnId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourceTag({ source, actor }: { source: 'agent' | 'user'; actor: string }) {
  const c = source === 'agent'
    ? { bg: '#eef4fc', fg: '#1b61c9', border: '#cfe0f5' }
    : { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px]"
      style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999, fontWeight: 600 }}
    >
      {source} · {actor}
    </span>
  );
}

function LabelTag({ label }: { label: 'fraud' | 'false_positive' }) {
  const c = label === 'fraud'
    ? { bg: '#FEF2F2', fg: '#B91C1C', border: '#FCA5A5' }
    : { bg: '#ECFDF5', fg: '#166534', border: '#BBF7D0' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px]"
      style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999, fontWeight: 700 }}
    >
      {label}
    </span>
  );
}

function RetrainScheduleCard({
  model, status, onRun,
}: {
  model: ModelHealthViewModel; status: 'idle' | 'running' | 'done'; onRun: () => void;
}) {
  const countdown = useCountdown(model.nextRetrainAt);
  return (
    <section className="bg-white p-6" style={cardStyle}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
        <div>
          <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
            Schedule
          </p>
          <h3 className="mt-1 text-card-title" style={{ color: '#181d26' }}>EventBridge · rate(1 day)</h3>
          <p className="mt-2 text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
            Cron POSTs <span className="font-mono">/retrain</span> on EC2 FastAPI scorer. Scorer reads merged S3 + OSS labels and republishes the EAS model.
          </p>
        </div>

        <div
          className="p-5"
          style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 16 }}
        >
          <p className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>
            Next retrain
          </p>
          <p className="mt-2 text-2xl" style={{ color: '#181d26', fontWeight: 700 }}>
            {countdown.label}
          </p>
          <p className="mt-1 text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
            window {model.nextWindow} · last {new Date(model.lastTrainedAt).toLocaleString()}
          </p>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-pill" style={{ backgroundColor: '#e0e2e6' }}>
            <div
              className="h-full rounded-pill transition-all duration-500"
              style={{ width: `${countdown.pct}%`, backgroundColor: '#1b61c9' }}
            />
          </div>
        </div>

        <div
          className="p-5"
          style={{ backgroundColor: '#181d26', borderRadius: 16, color: '#ffffff' }}
        >
          <p className="text-[10px] uppercase" style={{ color: '#cfe0f5', letterSpacing: '0.28px', fontWeight: 600 }}>
            Manual trigger
          </p>
          <p className="mt-2 text-card-title">Run retrain now</p>
          <p className="mt-1 text-caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Demo invocation — same path EventBridge takes.
          </p>
          <button
            type="button"
            onClick={onRun}
            disabled={status === 'running'}
            className="mt-4 inline-flex h-11 w-full items-center justify-center text-white disabled:opacity-60"
            style={{
              backgroundColor: '#1b61c9',
              borderRadius: 10,
              fontWeight: 600,
              boxShadow: 'rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
            }}
          >
            {status === 'running' ? <LoadingDots label="Retraining" tone="inverse" size="sm" />
              : status === 'done' ? 'Completed · v3-demo.5'
              : 'Run retrain demo'}
          </button>
        </div>
      </div>
    </section>
  );
}

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const t = Date.parse(target);
  const dayMs = 24 * 60 * 60 * 1000;
  const remaining = Math.max(0, t - now);
  const elapsed = Math.min(dayMs, dayMs - remaining);
  const pct = Math.max(0, Math.min(100, (elapsed / dayMs) * 100));
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const label = remaining === 0 ? 'now' : `${h}h ${m}m ${String(s).padStart(2, '0')}s`;
  return { label, pct };
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' }) {
  return (
    <div
      className="bg-white p-4"
      style={{ border: '1px solid #e0e2e6', borderRadius: 14, boxShadow: 'rgba(15,48,106,0.04) 0px 0px 12px' }}
    >
      <p className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>{label}</p>
      <p
        className="mt-1 text-xl"
        style={{ color: tone === 'good' ? '#166534' : '#181d26', fontWeight: 700 }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px]" style={{ color: 'rgba(4,14,32,0.55)' }}>{sub}</p>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e0e2e6',
  borderRadius: 24,
  boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
};
