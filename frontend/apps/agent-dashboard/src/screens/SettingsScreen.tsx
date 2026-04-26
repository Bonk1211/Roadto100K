import { useEffect, useMemo, useState } from 'react';
import { LoadingDots } from 'shared';
import { getModelHealthViewModel } from '../lib/investigations/modelHealthAdapter.js';
import type {
  LabelSink,
  ModelHealthViewModel,
  ModelMetrics,
  RecentLabel,
  RetrainEvent,
  RetrainResult,
} from '../lib/investigations/types.js';

type Phase = 'idle' | 'reading' | 'training' | 'evaluating' | 'deploying' | 'complete';

const PHASE_ORDER: Phase[] = ['reading', 'training', 'evaluating', 'deploying', 'complete'];
const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Idle',
  reading: 'Read S3 + OSS',
  training: 'Training job',
  evaluating: 'Evaluate',
  deploying: 'Deploy endpoint',
  complete: 'Complete',
};
const PHASE_DURATION: Record<Phase, number> = {
  idle: 0,
  reading: 900,
  training: 1100,
  evaluating: 600,
  deploying: 500,
  complete: 4500,
};

export function SettingsScreen() {
  const model = useMemo(() => getModelHealthViewModel(), []);
  const [pulseTick, setPulseTick] = useState(0);

  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState(model.modelVersion);
  const [previousVersion, setPreviousVersion] = useState(model.previousVersion);
  const [labelsStaged, setLabelsStaged] = useState(model.labelsSinceRetrain);
  const [accuracyDelta, setAccuracyDelta] = useState(model.accuracyDelta);
  const [lastTrainedAt, setLastTrainedAt] = useState(model.lastTrainedAt);
  const [history, setHistory] = useState<RetrainEvent[]>(model.retrainHistory);
  const [bumpFlashAt, setBumpFlashAt] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<ModelMetrics>(model.currentMetrics);
  const [lastResult, setLastResult] = useState<RetrainResult | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setPulseTick((t) => (t + 1) % 4), 1500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === 'idle') return;
    const dur = PHASE_DURATION[phase];
    const t = window.setTimeout(() => {
      if (phase === 'complete') {
        setPhase('idle');
        return;
      }
      const i = PHASE_ORDER.indexOf(phase);
      const next = PHASE_ORDER[i + 1] ?? 'complete';
      if (next === 'complete') {
        const newVersion = bumpVersion(version);
        const ranAt = new Date().toISOString();
        const newDelta = +(0.8 + Math.random() * 1.2).toFixed(1);
        const before = metrics;
        const after: ModelMetrics = {
          accuracy:  +clamp(before.accuracy + newDelta, 0, 99.9).toFixed(1),
          precision: +clamp(before.precision + 0.015 + Math.random() * 0.02, 0, 0.999).toFixed(3),
          recall:    +clamp(before.recall    + 0.018 + Math.random() * 0.022, 0, 0.999).toFixed(3),
          f1:        +clamp(before.f1        + 0.016 + Math.random() * 0.02, 0, 0.999).toFixed(3),
          auc:       +clamp(before.auc       + 0.010 + Math.random() * 0.014, 0, 0.999).toFixed(3),
        };
        const durationMs = PHASE_DURATION.reading + PHASE_DURATION.training + PHASE_DURATION.evaluating + PHASE_DURATION.deploying;
        const event: RetrainEvent = {
          version: newVersion,
          ranAt,
          labelCount: labelsStaged,
          accuracyDelta: newDelta,
          durationMs,
        };
        const result: RetrainResult = {
          oldVersion: version,
          newVersion,
          ranAt,
          labelsConsumed: labelsStaged,
          durationMs,
          before,
          after,
          endpoint: model.endpoint,
        };
        setPreviousVersion(version);
        setVersion(newVersion);
        setHistory((h) => [event, ...h].slice(0, 4));
        setLabelsStaged(0);
        setLastTrainedAt(ranAt);
        setAccuracyDelta(newDelta);
        setBumpFlashAt(Date.now());
        setMetrics(after);
        setLastResult(result);
      }
      setPhase(next);
    }, dur);
    return () => window.clearTimeout(t);
  }, [phase, version, labelsStaged, metrics, model.endpoint]);

  function runRetrainDemo() {
    if (phase !== 'idle') return;
    setPhase('reading');
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <HeroStrip
        version={version}
        previousVersion={previousVersion}
        labelsStaged={labelsStaged}
        accuracyDelta={accuracyDelta}
        coverage={model.queueCoverage}
        agentLabels={model.loop.agentLabels}
        userLabels={model.loop.userLabels}
        bumpFlashAt={bumpFlashAt}
        phase={phase}
      />

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}
      >
        <div className="flex min-h-0 flex-col gap-3">
          <FeedbackLoopCard
            model={model}
            version={version}
            labelsStaged={labelsStaged}
            pulseTick={pulseTick}
            phase={phase}
          />
          <RecentLabelsCard rows={model.recentLabels} />
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <SinksCard sinks={model.sinks} phase={phase} />
          <LabelSplitCard model={model} />
          <RetrainScheduleCard
            nextRetrainAt={model.nextRetrainAt}
            nextWindow={model.nextWindow}
            lastTrainedAt={lastTrainedAt}
            phase={phase}
            history={history}
            version={version}
            metrics={metrics}
            onRun={runRetrainDemo}
          />
        </div>
      </div>

      {lastResult && (
        <RetrainResultModal result={lastResult} onClose={() => setLastResult(null)} />
      )}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function bumpVersion(v: string): string {
  return v.replace(/(\d+)$/, (n) => String(parseInt(n, 10) + 1));
}

function HeroStrip({
  version, previousVersion, labelsStaged, accuracyDelta, coverage,
  agentLabels, userLabels, bumpFlashAt, phase,
}: {
  version: string; previousVersion: string; labelsStaged: number;
  accuracyDelta: number; coverage: number; agentLabels: number; userLabels: number;
  bumpFlashAt: number | null; phase: Phase;
}) {
  const flashing = bumpFlashAt !== null && Date.now() - bumpFlashAt < 4000;
  return (
    <section
      className="flex shrink-0 items-center gap-4 bg-white px-5 py-3"
      style={cardStyle}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className="text-small-label uppercase"
            style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}
          >
            Model health · F7
          </p>
          {phase === 'idle' ? (
            <span
              className="inline-flex items-center gap-2 px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: '#ECFDF5', color: '#166534', borderRadius: 999,
                fontWeight: 500, border: '1px solid #BBF7D0',
              }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-pill" style={{ backgroundColor: '#16A34A' }} />
              Loop healthy
            </span>
          ) : phase === 'complete' ? (
            <span
              className="inline-flex items-center gap-2 px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: '#ECFDF5', color: '#166534', borderRadius: 999,
                fontWeight: 600, border: '1px solid #BBF7D0',
              }}
            >
              ✓ Retrained · {version} deployed
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: '#FFFBEB', color: '#92400E', borderRadius: 999,
                fontWeight: 600, border: '1px solid #FDE68A',
              }}
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-pill" style={{ backgroundColor: '#92400E' }} />
              Retraining · {PHASE_LABEL[phase]}
            </span>
          )}
        </div>
        <h2 className="text-card-title leading-tight" style={{ color: '#181d26' }}>
          Decision → Label → Retrain → Model
        </h2>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-2">
        <Chip
          label="Version"
          value={version}
          sub={`prev ${previousVersion}`}
          flash={flashing}
        />
        <Chip
          label="Labels"
          value={String(labelsStaged)}
          sub={`agent ${agentLabels} · user ${userLabels}`}
          flash={flashing}
        />
        <Chip
          label="Accuracy"
          value={`+${accuracyDelta.toFixed(1)}%`}
          sub="vs prev"
          tone="good"
          flash={flashing}
        />
        <Chip label="Coverage" value={`${coverage}%`} sub="alerts queued" />
      </div>
    </section>
  );
}

function Chip({
  label, value, sub, tone, flash,
}: {
  label: string; value: string; sub?: string; tone?: 'good'; flash?: boolean;
}) {
  return (
    <div
      className="px-3 py-1.5 transition-all"
      style={{
        backgroundColor: flash ? '#ECFDF5' : '#f8fafc',
        border: `1px solid ${flash ? '#86efac' : '#e0e2e6'}`,
        borderRadius: 10,
        minWidth: 130,
        boxShadow: flash ? '0 0 0 3px rgba(22,163,74,0.15)' : undefined,
      }}
    >
      <p className="text-[9px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>
        {label}
      </p>
      <p className="text-sm leading-tight" style={{ color: tone === 'good' ? '#166534' : '#181d26', fontWeight: 700 }}>
        {value}
      </p>
      {sub && (
        <p className="text-[9px]" style={{ color: 'rgba(4,14,32,0.55)' }}>{sub}</p>
      )}
    </div>
  );
}

function FeedbackLoopCard({
  model, version, labelsStaged, pulseTick, phase,
}: {
  model: ModelHealthViewModel; version: string; labelsStaged: number;
  pulseTick: number; phase: Phase;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white p-4" style={cardStyle}>
      <header className="mb-2 flex items-center justify-between">
        <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
          Feedback cycle
        </p>
        <span className="text-[11px]" style={{ color: 'rgba(4,14,32,0.55)' }}>
          {model.loop.retrainsThisWeek} retrains / week
        </span>
      </header>

      <div className="min-h-0 flex-1">
        <LoopDiagram
          model={model}
          version={version}
          labelsStaged={labelsStaged}
          pulseTick={pulseTick}
          phase={phase}
        />
      </div>
    </section>
  );
}

function LoopDiagram({
  model, version, labelsStaged, pulseTick, phase,
}: {
  model: ModelHealthViewModel; version: string; labelsStaged: number;
  pulseTick: number; phase: Phase;
}) {
  const W = 720;
  const H = 320;
  const nodeFill = '#ffffff';
  const nodeStroke = '#cfe0f5';
  const accent = '#1b61c9';
  const muted = 'rgba(4,14,32,0.55)';

  const nodes = {
    agent:  { x: 70,  y: 70,  w: 150, h: 60, title: 'Agent action', sub: `${model.loop.agentLabels} labels · block/warn/clear` },
    user:   { x: 70,  y: 220, w: 150, h: 60, title: 'User choice',  sub: `${model.loop.userLabels} labels · cancel/proceed/report` },
    queue:  { x: 290, y: 145, w: 140, h: 60, title: 'Label queue',  sub: `${labelsStaged} merged` },
    sinks:  { x: 480, y: 70,  w: 170, h: 60, title: 'S3 + OSS sinks', sub: 'data sovereignty mirror' },
    train:  { x: 480, y: 220, w: 170, h: 60, title: 'SageMaker training', sub: 'job · Isolation Forest' },
    model:  { x: 280, y: 268, w: 160, h: 40, title: 'SageMaker endpoint', sub: version },
  };

  const isReading    = phase === 'reading';
  const isTraining   = phase === 'training';
  const isEvaluating = phase === 'evaluating';
  const isDeploying  = phase === 'deploying';
  const isComplete   = phase === 'complete';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={accent} />
        </marker>
        <marker id="arrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#16A34A" />
        </marker>
      </defs>

      <FlowEdge from={nodes.agent}  to={nodes.queue} active={pulseTick === 0 && phase === 'idle'} accent={accent} label="fraud / fp" />
      <FlowEdge from={nodes.user}   to={nodes.queue} active={pulseTick === 0 && phase === 'idle'} accent={accent} label="user label" />
      <FlowEdge from={nodes.queue}  to={nodes.sinks} active={(pulseTick === 1 && phase === 'idle') || isReading} accent={accent} label="write_label()" />
      <FlowEdge from={nodes.queue}  to={nodes.train} active={(pulseTick === 1 && phase === 'idle') || isReading || isTraining} accent={accent} label="train set" />
      <FlowEdge from={nodes.sinks}  to={nodes.train} active={isReading} accent={accent} label="merge S3+OSS" />
      <FlowEdge from={nodes.train}  to={nodes.model} active={(pulseTick === 2 && phase === 'idle') || isDeploying} accent={isDeploying ? '#16A34A' : accent} curved label={isDeploying ? 'deploy' : 'republish'} />
      <FlowEdge from={nodes.model}  to={nodes.queue} active={(pulseTick === 3 && phase === 'idle') || isComplete} accent="#16A34A" curved upward label={isComplete ? 'live!' : 'next inference'} />

      <LoopNode n={nodes.agent} fill={nodeFill} stroke={nodeStroke} accent={accent} muted={muted} icon="agent" />
      <LoopNode n={nodes.user}  fill={nodeFill} stroke={nodeStroke} accent={accent} muted={muted} icon="user" />
      <LoopNode n={nodes.queue} fill="#eef4fc" stroke="#cfe0f5" accent={accent} muted={muted} icon="queue" emphasis />
      <LoopNode
        n={nodes.sinks}
        fill={isReading ? '#FFFBEB' : nodeFill}
        stroke={isReading ? '#FDE68A' : nodeStroke}
        accent={isReading ? '#92400E' : accent}
        muted={muted}
        icon="db"
        emphasis={isReading}
      />
      <LoopNode
        n={nodes.train}
        fill={isTraining || isEvaluating ? '#FFFBEB' : nodeFill}
        stroke={isTraining || isEvaluating ? '#FDE68A' : nodeStroke}
        accent={isTraining || isEvaluating ? '#92400E' : accent}
        muted={muted}
        icon="cog"
        emphasis={isTraining || isEvaluating}
      />
      <LoopNode
        n={nodes.model}
        fill={isDeploying || isComplete ? '#86efac' : '#ECFDF5'}
        stroke={isDeploying || isComplete ? '#16A34A' : '#BBF7D0'}
        accent="#166534"
        muted={muted}
        compact
        emphasis={isDeploying || isComplete}
      />
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
        fill={fill} stroke={stroke} strokeWidth={emphasis ? 2.5 : 1}
      >
        {emphasis && (
          <animate attributeName="stroke-opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />
        )}
      </rect>
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
        <text x={n.x + n.w / 2} y={n.y + 30} fontSize={9} fill={muted} textAnchor="middle">
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
  const markerId = accent === '#16A34A' ? 'url(#arrowGreen)' : 'url(#arrow)';
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={active ? accent : '#cfe0f5'}
        strokeWidth={active ? 2 : 1.2}
        strokeDasharray={active ? '0' : '4 4'}
        markerEnd={markerId}
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

function SinksCard({ sinks, phase }: { sinks: LabelSink[]; phase: Phase }) {
  const reading = phase === 'reading';
  return (
    <section className="shrink-0 bg-white p-3" style={cardStyle}>
      <div className="flex items-center justify-between">
        <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
          Label sinks
        </p>
        <span className="text-[10px]" style={{ color: reading ? '#92400E' : 'rgba(4,14,32,0.55)' }}>
          {reading ? 'reading…' : 'dual-region mirror'}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {sinks.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between gap-2 px-2 py-1.5"
            style={{
              backgroundColor: reading ? '#FFFBEB' : '#f8fafc',
              border: `1px solid ${reading ? '#FDE68A' : '#e0e2e6'}`,
              borderRadius: 8,
              transition: 'all 200ms',
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <SinkDot status={s.status} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[11px]" style={{ color: '#181d26', fontWeight: 600 }}>{s.name}</p>
                <p className="text-[9px]" style={{ color: 'rgba(4,14,32,0.55)' }}>{s.region}</p>
              </div>
            </div>
            <div className="text-right leading-tight">
              <p className="text-[12px]" style={{ color: '#181d26', fontWeight: 700 }}>{s.writes24h}</p>
              <p className="text-[9px]" style={{ color: 'rgba(4,14,32,0.55)' }}>writes/24h</p>
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
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-pill opacity-60" style={{ backgroundColor: c.fg }} />
      <span className="relative inline-flex h-2 w-2 rounded-pill" style={{ backgroundColor: c.fg }} />
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
    <section className="shrink-0 bg-white p-3" style={cardStyle}>
      <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
        Label split
      </p>
      <div className="mt-2 space-y-2">
        <SplitBar
          left={{ label: 'fraud', pct: fraud, color: '#DC2626', sub: `${Math.round(fraud)}%` }}
          right={{ label: 'fp', pct: falsePositive, color: '#16A34A', sub: `${Math.round(falsePositive)}%` }}
        />
        <SplitBar
          left={{ label: 'agent', pct: agentShare, color: '#1b61c9', sub: `${Math.round(agentShare)}%` }}
          right={{ label: 'user', pct: userShare, color: '#7c3aed', sub: `${Math.round(userShare)}%` }}
        />
      </div>
    </section>
  );
}

function SplitBar({
  left, right,
}: {
  left: { label: string; pct: number; color: string; sub: string };
  right: { label: string; pct: number; color: string; sub: string };
}) {
  return (
    <div className="flex h-5 w-full overflow-hidden" style={{ borderRadius: 8, border: '1px solid #e0e2e6' }}>
      <div
        className="flex items-center justify-start px-2 text-[9px] font-bold text-white"
        style={{ backgroundColor: left.color, width: `${left.pct}%` }}
      >
        {left.label} {left.sub}
      </div>
      <div
        className="flex items-center justify-end px-2 text-[9px] font-bold text-white"
        style={{ backgroundColor: right.color, width: `${right.pct}%` }}
      >
        {right.label} {right.sub}
      </div>
    </div>
  );
}

function RecentLabelsCard({ rows }: { rows: RecentLabel[] }) {
  return (
    <section className="flex min-h-0 shrink-0 flex-col bg-white p-3" style={{ ...cardStyle, height: 220 }}>
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
          Live label stream
        </p>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px]"
          style={{
            backgroundColor: '#eef4fc', color: '#1b61c9', borderRadius: 999, fontWeight: 600, border: '1px solid #cfe0f5',
          }}
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-pill" style={{ backgroundColor: '#1b61c9' }} />
          Kinesis tail
        </span>
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0" style={{ backgroundColor: '#ffffff' }}>
            <tr className="text-[9px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px' }}>
              <th className="py-1 font-semibold">Time</th>
              <th className="py-1 font-semibold">Source</th>
              <th className="py-1 font-semibold">Action</th>
              <th className="py-1 font-semibold">Label</th>
              <th className="py-1 font-semibold">Txn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e0e2e6' }}>
                <td className="py-1 text-[10px]" style={{ color: 'rgba(4,14,32,0.69)' }}>
                  {new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-1">
                  <SourceTag source={r.source} actor={r.actor} />
                </td>
                <td className="py-1 text-[10px]" style={{ color: '#181d26' }}>{r.action}</td>
                <td className="py-1">
                  <LabelTag label={r.label} />
                </td>
                <td className="py-1 font-mono text-[9px]" style={{ color: 'rgba(4,14,32,0.55)' }}>{r.txnId}</td>
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
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px]"
      style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999, fontWeight: 600 }}
    >
      {source}·{actor}
    </span>
  );
}

function LabelTag({ label }: { label: 'fraud' | 'false_positive' }) {
  const c = label === 'fraud'
    ? { bg: '#FEF2F2', fg: '#B91C1C', border: '#FCA5A5' }
    : { bg: '#ECFDF5', fg: '#166534', border: '#BBF7D0' };
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[9px]"
      style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999, fontWeight: 700 }}
    >
      {label === 'false_positive' ? 'fp' : 'fraud'}
    </span>
  );
}

function RetrainScheduleCard({
  nextRetrainAt, nextWindow, lastTrainedAt, phase, history, version, metrics, onRun,
}: {
  nextRetrainAt: string; nextWindow: string; lastTrainedAt: string; phase: Phase;
  history: RetrainEvent[]; version: string; metrics: ModelMetrics; onRun: () => void;
}) {
  const countdown = useCountdown(nextRetrainAt);
  const running = phase !== 'idle';
  const completed = phase === 'complete';

  return (
    <section className="shrink-0 bg-white p-3" style={cardStyle}>
      <div className="flex items-center justify-between">
        <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
          Retrain schedule
        </p>
        <span className="text-[9px]" style={{ color: 'rgba(4,14,32,0.55)' }}>EventBridge · rate(1 day)</span>
      </div>

      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) 130px' }}>
        <div
          className="px-3 py-2"
          style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 10 }}
        >
          <p className="text-[9px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>
            Next retrain
          </p>
          <p className="text-base leading-tight" style={{ color: '#181d26', fontWeight: 700 }}>
            {countdown.label}
          </p>
          <p className="text-[9px]" style={{ color: 'rgba(4,14,32,0.55)' }}>
            window {nextWindow} · last {timeAgo(lastTrainedAt)}
          </p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-pill" style={{ backgroundColor: '#e0e2e6' }}>
            <div
              className="h-full rounded-pill transition-all duration-500"
              style={{ width: `${countdown.pct}%`, backgroundColor: '#1b61c9' }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="inline-flex items-center justify-center text-[11px] text-white disabled:opacity-90"
          style={{
            backgroundColor: completed ? '#16A34A' : '#181d26',
            borderRadius: 10,
            fontWeight: 600,
            padding: '0 10px',
            boxShadow: 'rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
            transition: 'background-color 200ms',
          }}
        >
          {phase === 'idle' && 'Run retrain demo'}
          {phase !== 'idle' && phase !== 'complete' && (
            <LoadingDots label={PHASE_LABEL[phase]} tone="inverse" size="sm" />
          )}
          {completed && `✓ Deployed ${version}`}
        </button>
      </div>

      <PhaseSteps phase={phase} />

      <LiveMetricsRow metrics={metrics} />

      <RetrainHistory history={history} />
    </section>
  );
}

function LiveMetricsRow({ metrics }: { metrics: ModelMetrics }) {
  const items: Array<[string, string]> = [
    ['Acc', `${metrics.accuracy.toFixed(1)}%`],
    ['Prec', metrics.precision.toFixed(3)],
    ['Rec', metrics.recall.toFixed(3)],
    ['F1', metrics.f1.toFixed(3)],
    ['AUC', metrics.auc.toFixed(3)],
  ];
  return (
    <div className="mt-2 grid grid-cols-5 gap-1">
      {items.map(([k, v]) => (
        <div
          key={k}
          className="px-1.5 py-1 text-center"
          style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 6 }}
        >
          <p className="text-[8px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>{k}</p>
          <p className="text-[10px] leading-tight" style={{ color: '#181d26', fontWeight: 700 }}>{v}</p>
        </div>
      ))}
    </div>
  );
}

function PhaseSteps({ phase }: { phase: Phase }) {
  const currentIdx = PHASE_ORDER.indexOf(phase);
  return (
    <div className="mt-2 flex items-center gap-1">
      {PHASE_ORDER.slice(0, 4).map((p, i) => {
        const isDone = phase === 'complete' || (currentIdx >= 0 && currentIdx > i);
        const isCurrent = phase === p;
        const c = isDone
          ? { bg: '#ECFDF5', fg: '#166534', border: '#BBF7D0' }
          : isCurrent
            ? { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A' }
            : { bg: '#f8fafc', fg: 'rgba(4,14,32,0.45)', border: '#e0e2e6' };
        return (
          <span
            key={p}
            className="flex flex-1 items-center justify-center gap-1 px-1.5 py-1 text-[9px]"
            style={{
              backgroundColor: c.bg, color: c.fg,
              border: `1px solid ${c.border}`, borderRadius: 6, fontWeight: 600,
            }}
          >
            {isDone ? '✓' : isCurrent ? (
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-pill" style={{ backgroundColor: c.fg }} />
            ) : (i + 1)}
            <span className="truncate">{PHASE_LABEL[p]}</span>
          </span>
        );
      })}
    </div>
  );
}

function RetrainHistory({ history }: { history: RetrainEvent[] }) {
  if (history.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-[9px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>
        Recent runs
      </p>
      <ul className="mt-1 space-y-0.5">
        {history.slice(0, 3).map((h, i) => (
          <li
            key={`${h.version}-${h.ranAt}`}
            className="flex items-center justify-between gap-2 px-2 py-1 text-[10px]"
            style={{
              backgroundColor: i === 0 ? '#ECFDF5' : '#f8fafc',
              border: `1px solid ${i === 0 ? '#BBF7D0' : '#e0e2e6'}`,
              borderRadius: 6,
            }}
          >
            <span className="font-mono" style={{ color: '#181d26', fontWeight: 600 }}>{h.version}</span>
            <span style={{ color: 'rgba(4,14,32,0.69)' }}>{timeAgo(h.ranAt)}</span>
            <span style={{ color: 'rgba(4,14,32,0.69)' }}>{h.labelCount} labels</span>
            <span style={{ color: '#166534', fontWeight: 700 }}>+{h.accuracyDelta.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const diff = Math.max(0, Date.now() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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

const cardStyle: React.CSSProperties = {
  border: '1px solid #e0e2e6',
  borderRadius: 16,
  boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
};

function RetrainResultModal({ result, onClose }: { result: RetrainResult; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(15,48,106,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: 20,
          width: '100%',
          maxWidth: 640,
          boxShadow: 'rgba(15,48,106,0.25) 0px 24px 60px',
          animation: 'pop-in 220ms ease-out',
        }}
      >
        <style>{`
          @keyframes pop-in {
            from { opacity: 0; transform: translateY(10px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes count-up {
            from { transform: translateY(6px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        <header
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid #e0e2e6' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 place-items-center"
              style={{ backgroundColor: '#ECFDF5', color: '#16A34A', borderRadius: 999 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 12 10 18 20 6" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-small-label uppercase" style={{ color: '#166534', letterSpacing: '0.28px', fontWeight: 600 }}>
                Retrain complete
              </p>
              <h2 className="text-card-title" style={{ color: '#181d26' }}>SageMaker endpoint updated</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center"
            style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 999, color: '#181d26' }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </header>

        <div className="grid gap-4 px-6 py-5">
          <VersionDiff oldVersion={result.oldVersion} newVersion={result.newVersion} />

          <div className="grid grid-cols-5 gap-2">
            <MetricDiff label="Accuracy" before={`${result.before.accuracy.toFixed(1)}%`} after={`${result.after.accuracy.toFixed(1)}%`} delta={result.after.accuracy - result.before.accuracy} unit="%" />
            <MetricDiff label="Precision" before={result.before.precision.toFixed(3)} after={result.after.precision.toFixed(3)} delta={result.after.precision - result.before.precision} />
            <MetricDiff label="Recall" before={result.before.recall.toFixed(3)} after={result.after.recall.toFixed(3)} delta={result.after.recall - result.before.recall} />
            <MetricDiff label="F1" before={result.before.f1.toFixed(3)} after={result.after.f1.toFixed(3)} delta={result.after.f1 - result.before.f1} />
            <MetricDiff label="AUC" before={result.before.auc.toFixed(3)} after={result.after.auc.toFixed(3)} delta={result.after.auc - result.before.auc} />
          </div>

          <div
            className="grid grid-cols-3 gap-2 px-4 py-3"
            style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 12 }}
          >
            <Stat label="Labels consumed" value={String(result.labelsConsumed)} />
            <Stat label="Training time" value={`${(result.durationMs / 1000).toFixed(1)}s`} />
            <Stat label="Deployed" value={timeAgo(result.ranAt)} />
          </div>

          <div
            className="px-4 py-3"
            style={{ backgroundColor: '#181d26', borderRadius: 12, color: '#ffffff' }}
          >
            <p className="text-[10px] uppercase" style={{ color: '#cfe0f5', letterSpacing: '0.28px', fontWeight: 600 }}>
              Endpoint ARN
            </p>
            <p className="mt-1 break-all font-mono text-[11px]" style={{ color: '#ffffff' }}>
              {result.endpoint}
            </p>
          </div>
        </div>

        <footer
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: '1px solid #e0e2e6' }}
        >
          <p className="text-caption" style={{ color: 'rgba(4,14,32,0.55)' }}>
            Press Esc or click outside to dismiss
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-white"
            style={{
              backgroundColor: '#1b61c9',
              borderRadius: 10,
              fontWeight: 600,
              boxShadow: 'rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
            }}
          >
            Acknowledge
          </button>
        </footer>
      </div>
    </div>
  );
}

function VersionDiff({ oldVersion, newVersion }: { oldVersion: string; newVersion: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ backgroundColor: '#eef4fc', border: '1px solid #cfe0f5', borderRadius: 12 }}
    >
      <div className="flex-1">
        <p className="text-[10px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>Previous</p>
        <p className="font-mono text-sm" style={{ color: 'rgba(4,14,32,0.69)', textDecoration: 'line-through' }}>{oldVersion}</p>
      </div>
      <span style={{ color: '#1b61c9', fontSize: 24 }}>→</span>
      <div className="flex-1 text-right">
        <p className="text-[10px] uppercase" style={{ color: '#166534', letterSpacing: '0.28px', fontWeight: 600 }}>New · live</p>
        <p
          className="font-mono text-sm"
          style={{ color: '#166534', fontWeight: 700, animation: 'count-up 320ms ease-out' }}
        >
          {newVersion}
        </p>
      </div>
    </div>
  );
}

function MetricDiff({
  label, before, after, delta, unit,
}: {
  label: string; before: string; after: string; delta: number; unit?: string;
}) {
  const positive = delta >= 0;
  const color = positive ? '#16A34A' : '#B91C1C';
  const arrow = positive ? '▲' : '▼';
  const formatted = unit === '%'
    ? `${positive ? '+' : ''}${delta.toFixed(1)}${unit}`
    : `${positive ? '+' : ''}${delta.toFixed(3)}`;
  return (
    <div
      className="px-2 py-2 text-center"
      style={{ backgroundColor: '#ffffff', border: '1px solid #e0e2e6', borderRadius: 10 }}
    >
      <p className="text-[9px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>{label}</p>
      <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.69)', textDecoration: 'line-through' }}>{before}</p>
      <p className="text-base leading-tight" style={{ color: '#181d26', fontWeight: 700, animation: 'count-up 360ms ease-out' }}>
        {after}
      </p>
      <p className="text-[10px]" style={{ color, fontWeight: 700 }}>
        {arrow} {formatted}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: '#181d26', fontWeight: 700 }}>{value}</p>
    </div>
  );
}
