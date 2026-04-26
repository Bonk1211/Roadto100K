import { api } from './api.js';

export type AgentName = 'txn' | 'behavior' | 'network' | 'policy' | 'victim';
export type Verdict = 'block' | 'warn' | 'clear' | 'inconclusive';
export type RunStatus = 'queued' | 'running' | 'decided' | 'failed';
export type FinalVerdict = 'block' | 'warn' | 'clear';

export interface AgentEvidence {
  signal: string;
  value: unknown;
}

export interface AgentFinding {
  agent_name: AgentName | string;
  agent_label: string;
  verdict: Verdict;
  confidence: number;
  evidence: AgentEvidence[];
  reasoning: string;
  latency_ms: number;
  created_at: string;
}

export interface AgentStream {
  agent_name: AgentName | string;
  partial_text: string;
  status: 'streaming' | 'done' | 'error' | string;
  started_at: string;
  updated_at: string;
}

export interface PipelineSignal {
  signal: string;
  label: string;
  weight: number;
}

export interface VerificationRun {
  run_id: string;
  alert_id: string;
  status: RunStatus;
  mode: 'mock' | 'bedrock' | 'rules' | string;
  started_at: string;
  completed_at: string | null;
  final_verdict: FinalVerdict | null;
  consensus_score: number | null;
  agreement_pct: number | null;
  total_latency_ms: number | null;
  arbiter_reasoning: string | null;
  alert_type: string | null;
  risk_score: number;
  rule_score?: number | null;
  ml_score?: number | null;
  composite_score?: number | null;
  amount: number;
  scam_type: string | null;
  stage: string | null;
  priority: string | null;
  triggered_signals?: PipelineSignal[];
  sender_account_id?: string | null;
  receiver_account_id?: string | null;
  user_display?: string | null;
  findings: AgentFinding[];
  streams?: AgentStream[];
}

export interface QueueDepth {
  unverified: number;
  queued: number;
  running: number;
  decided: number;
}

export interface AgentStatRow {
  agent_name: string;
  agent_label: string;
  runs: number;
  avg_latency_ms: number;
  avg_confidence: number;
  blocks: number;
  warns: number;
  clears: number;
  inconclusive: number;
}

export interface AgentStats {
  window_minutes: number;
  per_agent: AgentStatRow[];
  totals: {
    runs_decided: number;
    avg_total_ms: number;
    min_total_ms: number;
    max_total_ms: number;
    blocks: number;
    warns: number;
    clears: number;
  };
}

export const AGENT_ORDER: AgentName[] = ['txn', 'behavior', 'network', 'policy', 'victim'];

export const AGENT_META: Record<AgentName, { label: string; subtitle: string; icon: string }> = {
  txn: {
    label: 'Transaction',
    subtitle: 'amount · velocity · channel',
    icon: 'T',
  },
  behavior: {
    label: 'Behaviour',
    subtitle: 'device · age · session',
    icon: 'B',
  },
  network: {
    label: 'Network',
    subtitle: 'mule cluster · hops',
    icon: 'N',
  },
  policy: {
    label: 'Compliance',
    subtitle: 'BNM · AMLA · TnG SOP',
    icon: 'P',
  },
  victim: {
    label: 'Victim',
    subtitle: 'sender profile · coercion',
    icon: 'V',
  },
};

export async function fetchVerificationsRecent(limit = 50): Promise<VerificationRun[]> {
  const { data } = await api.get<{ runs: VerificationRun[] }>(
    `/api/verifications/recent?limit=${limit}`,
  );
  return data?.runs ?? [];
}

export async function fetchVerificationsActive(): Promise<VerificationRun[]> {
  const { data } = await api.get<{ runs: VerificationRun[] }>('/api/verifications/active');
  return data?.runs ?? [];
}

export async function fetchVerification(runId: string): Promise<VerificationRun | null> {
  try {
    const { data } = await api.get<VerificationRun>(`/api/verifications/${runId}`);
    return data;
  } catch {
    return null;
  }
}

export async function fetchVerificationQueue(): Promise<QueueDepth> {
  const { data } = await api.get<QueueDepth>('/api/verifications/queue');
  return data;
}

export async function fetchAgentStats(windowMinutes = 60): Promise<AgentStats> {
  const { data } = await api.get<AgentStats>(
    `/api/agent-stats?window_minutes=${windowMinutes}`,
  );
  return data;
}

export interface InjectAlertResponse {
  ok: boolean;
  alert_id: string;
  txn_id: string;
  risk_score: number;
  profile: 'low_risk' | 'medium_risk' | 'high_risk' | string;
}

export async function injectTestAlert(
  profile: 'low_risk' | 'medium_risk' | 'high_risk' = 'high_risk',
): Promise<InjectAlertResponse> {
  const { data } = await api.post<InjectAlertResponse>('/api/verifications/inject', {
    profile,
  });
  return data;
}

export async function reverifyAlert(alertId: string): Promise<{ ok: boolean; alert_id: string }> {
  const { data } = await api.post<{ ok: boolean; alert_id: string }>(
    `/api/alerts/${alertId}/reverify`,
    {},
  );
  return data;
}

export interface WorkerState {
  paused: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export async function fetchWorkerState(): Promise<WorkerState> {
  const { data } = await api.get<WorkerState>('/api/worker/state');
  return data;
}

export async function pauseWorker(by = 'agent_console'): Promise<WorkerState> {
  const { data } = await api.post<WorkerState>('/api/worker/pause', { by });
  return data;
}

export async function resumeWorker(by = 'agent_console'): Promise<WorkerState> {
  const { data } = await api.post<WorkerState>('/api/worker/resume', { by });
  return data;
}

// ---------- helpers ----------

export function verdictPalette(verdict: Verdict | FinalVerdict | null | undefined): {
  bg: string;
  fg: string;
  border: string;
  label: string;
} {
  switch (verdict) {
    case 'block':
      return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FCA5A5', label: 'Block' };
    case 'warn':
      return { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A', label: 'Warn' };
    case 'clear':
      return { bg: '#ECFDF5', fg: '#166534', border: '#BBF7D0', label: 'Clear' };
    case 'inconclusive':
      return { bg: '#f8fafc', fg: 'rgba(4,14,32,0.69)', border: '#e0e2e6', label: 'Inconclusive' };
    default:
      return { bg: '#f8fafc', fg: 'rgba(4,14,32,0.55)', border: '#e0e2e6', label: '—' };
  }
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleString();
}

export function formatLatency(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function shortAlertId(alertId: string): string {
  if (!alertId) return '';
  if (alertId.length <= 12) return alertId;
  return `${alertId.slice(0, 6)}…${alertId.slice(-4)}`;
}

/** Format an account / user id for the decision feed.
 *  Recognizable demo accounts (acc_mule_001, u_demo_user) render full;
 *  raw uuids get masked to "***last4". Empty / null → "—". */
export function formatParty(id: string | null | undefined): string {
  if (!id) return '—';
  // Demo accounts already human-readable
  if (id.startsWith('acc_') || id.startsWith('u_') || id.startsWith('user_')) return id;
  if (id.length <= 14) return id;
  // UUID / long opaque id → mask
  return `***${id.slice(-4)}`;
}

/** Build "sender → receiver" label for the decision feed row. */
export function partiesLabel(run: VerificationRun): string {
  const from = formatParty(run.sender_account_id);
  const to = formatParty(run.receiver_account_id);
  if (from === '—' && to === '—') return shortAlertId(run.alert_id);
  return `${from} → ${to}`;
}

export function findingsByAgent(run: VerificationRun): Partial<Record<string, AgentFinding>> {
  const map: Record<string, AgentFinding> = {};
  for (const f of run.findings) {
    map[f.agent_name] = f;
  }
  return map;
}
