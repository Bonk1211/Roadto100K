import type { AgentName, FinalVerdict, VerificationRun } from './agentops.js';
import { AGENT_META, AGENT_ORDER } from './agentops.js';

export const CHART_COLORS = {
  block: '#EF4444',
  warn: '#F59E0B',
  clear: '#22C55E',
  inconclusive: '#94A3B8',
  brand: '#0055D4',
  brandSoft: '#0EA5E9',
  yellow: '#FFE600',
  ink: '#0F3B82',
  grid: '#E5E7EB',
  muted: '#94A3B8',
  surface: '#F8FAFC',
} as const;

export interface VerdictDonutSlice {
  name: string;
  value: number;
  color: string;
  key: FinalVerdict;
}

export function verdictDonut(runs: VerificationRun[]): VerdictDonutSlice[] {
  let block = 0;
  let warn = 0;
  let clear = 0;
  for (const r of runs) {
    if (r.status !== 'decided') continue;
    if (r.final_verdict === 'block') block += 1;
    else if (r.final_verdict === 'warn') warn += 1;
    else if (r.final_verdict === 'clear') clear += 1;
  }
  return [
    { name: 'Block', value: block, color: CHART_COLORS.block, key: 'block' },
    { name: 'Warn', value: warn, color: CHART_COLORS.warn, key: 'warn' },
    { name: 'Clear', value: clear, color: CHART_COLORS.clear, key: 'clear' },
  ];
}

export interface AgentBar {
  agent: AgentName;
  label: string;
  blocks: number;
  warns: number;
  clears: number;
  inconclusive: number;
  avgConfidence: number;
  avgLatencyMs: number;
}

export function agentBars(runs: VerificationRun[]): AgentBar[] {
  const init: Record<AgentName, AgentBar> = AGENT_ORDER.reduce(
    (acc, agent) => {
      acc[agent] = {
        agent,
        label: AGENT_META[agent].label,
        blocks: 0,
        warns: 0,
        clears: 0,
        inconclusive: 0,
        avgConfidence: 0,
        avgLatencyMs: 0,
      };
      return acc;
    },
    {} as Record<AgentName, AgentBar>,
  );

  const confSum: Record<AgentName, number> = AGENT_ORDER.reduce(
    (a, k) => ((a[k] = 0), a),
    {} as Record<AgentName, number>,
  );
  const latSum: Record<AgentName, number> = AGENT_ORDER.reduce(
    (a, k) => ((a[k] = 0), a),
    {} as Record<AgentName, number>,
  );
  const cnt: Record<AgentName, number> = AGENT_ORDER.reduce(
    (a, k) => ((a[k] = 0), a),
    {} as Record<AgentName, number>,
  );

  for (const r of runs) {
    if (r.status !== 'decided') continue;
    for (const f of r.findings) {
      const k = f.agent_name as AgentName;
      if (!init[k]) continue;
      cnt[k] += 1;
      confSum[k] += f.confidence;
      latSum[k] += f.latency_ms;
      if (f.verdict === 'block') init[k].blocks += 1;
      else if (f.verdict === 'warn') init[k].warns += 1;
      else if (f.verdict === 'clear') init[k].clears += 1;
      else if (f.verdict === 'inconclusive') init[k].inconclusive += 1;
    }
  }

  for (const k of AGENT_ORDER) {
    const n = cnt[k] || 1;
    init[k].avgConfidence = Math.round(confSum[k] / n);
    init[k].avgLatencyMs = Math.round(latSum[k] / n);
  }

  return AGENT_ORDER.map((k) => init[k]);
}

export interface CyclePoint {
  index: number;
  ts: number;
  label: string;
  cycleSec: number;
  agreement: number;
  verdict: FinalVerdict | null;
}

export function cycleSeries(runs: VerificationRun[]): CyclePoint[] {
  // Oldest -> newest, only decided
  const decided = runs
    .filter((r) => r.status === 'decided' && r.completed_at && r.total_latency_ms)
    .slice()
    .reverse();
  return decided.map((r, i) => ({
    index: i,
    ts: Date.parse(r.completed_at as string),
    label: new Date(r.completed_at as string).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    cycleSec: Math.round((r.total_latency_ms ?? 0) / 1000),
    agreement: r.agreement_pct ?? 0,
    verdict: r.final_verdict ?? null,
  }));
}

export interface ScamTypeBucket {
  type: string;
  block: number;
  warn: number;
  clear: number;
}

export function scamTypeBuckets(runs: VerificationRun[]): ScamTypeBucket[] {
  const map = new Map<string, ScamTypeBucket>();
  for (const r of runs) {
    if (r.status !== 'decided') continue;
    const key = (r.scam_type ?? r.alert_type ?? 'unknown').replace(/_/g, ' ');
    if (!map.has(key)) map.set(key, { type: key, block: 0, warn: 0, clear: 0 });
    const b = map.get(key)!;
    if (r.final_verdict === 'block') b.block += 1;
    else if (r.final_verdict === 'warn') b.warn += 1;
    else if (r.final_verdict === 'clear') b.clear += 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => b.block + b.warn + b.clear - (a.block + a.warn + a.clear),
  );
}

export interface AgentRadarPoint {
  agent: string;
  fullName: AgentName;
  confidence: number;
  fullMark: 100;
}

export function activeRunRadar(run: VerificationRun | null): AgentRadarPoint[] {
  return AGENT_ORDER.map((agent) => {
    const f = run?.findings.find((x) => x.agent_name === agent);
    return {
      agent: AGENT_META[agent].label,
      fullName: agent,
      confidence: f ? f.confidence : 0,
      fullMark: 100 as const,
    };
  });
}

export interface AgentConfidenceTrend {
  ts: number;
  label: string;
  confidence: number;
}

export function agentConfidenceTrend(
  runs: VerificationRun[],
  agent: AgentName,
  limit = 10,
): AgentConfidenceTrend[] {
  const out: AgentConfidenceTrend[] = [];
  const decided = runs
    .filter((r) => r.status === 'decided')
    .slice()
    .reverse();
  for (const r of decided) {
    const f = r.findings.find((x) => x.agent_name === agent);
    if (!f) continue;
    out.push({
      ts: Date.parse(r.completed_at ?? r.started_at),
      label: new Date(r.completed_at ?? r.started_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      confidence: f.confidence,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export interface AgentVerdictDonut {
  name: string;
  value: number;
  color: string;
}

export function agentVerdictDonut(bar: AgentBar): AgentVerdictDonut[] {
  return [
    { name: 'Block', value: bar.blocks, color: CHART_COLORS.block },
    { name: 'Warn', value: bar.warns, color: CHART_COLORS.warn },
    { name: 'Clear', value: bar.clears, color: CHART_COLORS.clear },
    { name: 'Incon.', value: bar.inconclusive, color: CHART_COLORS.inconclusive },
  ].filter((d) => d.value > 0);
}

export function fmtSec(ms: number): string {
  if (!ms) return '0s';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}
