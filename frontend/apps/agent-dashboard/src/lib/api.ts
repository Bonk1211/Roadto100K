import axios from 'axios';
import type {
  Alert,
  AgentDecision,
  DashboardStats,
  NetworkGraph,
  RiskBand,
  RiskSignal,
  Transaction,
  BedrockExplanation,
  ScamType,
} from 'shared';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = axios.create({ baseURL, timeout: 8000 });

interface BackendAlert {
  alert_id: string;
  txn_id: string;
  alert_type?: string;
  account_id?: string;
  risk_score?: number;
  rule_score?: number;
  ml_score?: number;
  final_score?: number;
  stage?: string;
  status?: string;
  priority?: string;
  created_at?: string;
  resolved_at?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
  amount?: number;
  user_id?: string;
  sender_account_id?: string;
  receiver_account_id?: string;
  txn_timestamp?: string;
  is_first_transfer?: boolean;
  device_match?: boolean;
  account_age_days?: number;
  explanation_en?: string;
  explanation_bm?: string;
  scam_type?: string;
  confidence?: string | number;
  triggered_signals?: { signal_name?: string; signal_value?: string; points?: number }[];
}

interface BackendListAlertsResponse {
  alerts: BackendAlert[];
  total?: number;
  has_more?: boolean;
  next_cursor?: string | null;
}

interface BackendStats {
  open_alerts?: number;
  rm_at_risk_today?: number;
  rm_at_risk?: number;
  transactions_blocked?: number;
  blocked_today?: number;
  transactions_warned?: number;
  transactions_cleared?: number;
  avg_response_time_ms?: number;
  avg_response_ms?: number;
  model_accuracy_pct?: number;
}

const VALID_SCAM_TYPES: ScamType[] = [
  'macau_scam',
  'investment_scam',
  'love_scam',
  'account_takeover',
  'mule_account',
  'false_positive',
];

function bandFor(score: number): RiskBand {
  if (score < 40) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
}

function adaptScamType(s: string | undefined): ScamType {
  if (s && (VALID_SCAM_TYPES as string[]).includes(s)) return s as ScamType;
  return 'macau_scam';
}

function adaptConfidence(c: string | number | undefined): 'high' | 'medium' | 'low' {
  if (typeof c === 'number') return c >= 0.75 ? 'high' : c >= 0.5 ? 'medium' : 'low';
  if (c === 'high' || c === 'medium' || c === 'low') return c;
  return 'medium';
}

function adaptAlert(b: BackendAlert): Alert {
  const score = b.risk_score ?? b.final_score ?? 0;
  const ts = b.created_at ?? new Date().toISOString();
  const txnTs = b.txn_timestamp ?? ts;
  const hour = new Date(txnTs).getHours() || 0;
  const txn: Transaction = {
    txn_id: b.txn_id,
    user_id: b.sender_account_id ?? b.user_id ?? 'unknown',
    payee_id: b.receiver_account_id ?? b.account_id ?? 'unknown',
    payee_name: b.receiver_account_id ?? 'Unknown payee',
    payee_account: b.receiver_account_id ?? 'unknown',
    amount: Number(b.amount ?? 0),
    timestamp: txnTs,
    hour_of_day: hour,
    device_match: Boolean(b.device_match),
    prior_txns_to_payee: b.is_first_transfer ? 0 : 1,
    is_new_payee: Boolean(b.is_first_transfer),
    payee_account_age_days: Number(b.account_age_days ?? 0),
    user_avg_30d: 0,
    amount_ratio: 0,
  };

  const signals: RiskSignal[] = (b.triggered_signals ?? []).map((s, i) => ({
    id: s.signal_name ?? `signal_${i}`,
    label: s.signal_value ?? s.signal_name ?? 'signal',
    triggered: true,
    weight: Number(s.points ?? 0),
  }));

  const explanation: BedrockExplanation = {
    explanation_en: b.explanation_en ?? '',
    explanation_bm: b.explanation_bm ?? '',
    scam_type: adaptScamType(b.scam_type ?? b.alert_type),
    confidence: adaptConfidence(b.confidence),
  };

  const status =
    b.status === 'blocked' || b.status === 'warned' || b.status === 'cleared'
      ? b.status
      : 'open';

  return {
    id: b.alert_id,
    txn,
    score,
    band: bandFor(score),
    signals,
    explanation,
    status,
    created_at: ts,
    decided_at: b.decided_at ?? b.resolved_at ?? undefined,
    decided_by: b.decided_by ?? undefined,
  };
}

export async function fetchAlerts(): Promise<Alert[]> {
  const { data } = await api.get<BackendListAlertsResponse | BackendAlert[]>('/api/alerts');
  const list = Array.isArray(data) ? data : data?.alerts ?? [];
  return list.map(adaptAlert);
}

export async function fetchStats(): Promise<DashboardStats> {
  const { data } = await api.get<BackendStats>('/api/stats');
  return {
    open_alerts: data.open_alerts ?? 0,
    rm_at_risk: Math.round(Number(data.rm_at_risk_today ?? data.rm_at_risk ?? 0)),
    blocked_today: data.transactions_blocked ?? data.blocked_today ?? 0,
    avg_response_ms: data.avg_response_time_ms ?? data.avg_response_ms ?? 0,
  };
}

export async function fetchNetworkGraph(): Promise<NetworkGraph> {
  const { data } = await api.get<NetworkGraph>('/api/network-graph');
  return data;
}

export interface DecisionResponse {
  ok: true;
  sms_sent: boolean;
  alert: Alert;
}

interface BackendActionResponse {
  ok?: boolean;
  alert?: BackendAlert;
  alert_id?: string;
  txn_id?: string;
  status?: string;
  sms_sent?: boolean;
}

export async function postDecision(
  txnId: string,
  action: AgentDecision,
  agentId = 'agent_console',
): Promise<DecisionResponse> {
  const { data } = await api.post<BackendActionResponse>(
    `/api/alerts/${txnId}/action`,
    { action, agent_id: agentId },
  );
  const adapted: Alert = data.alert
    ? adaptAlert(data.alert)
    : {
        id: data.alert_id ?? txnId,
        txn: {
          txn_id: data.txn_id ?? txnId,
          user_id: '',
          payee_id: '',
          payee_name: '',
          payee_account: '',
          amount: 0,
          timestamp: new Date().toISOString(),
          hour_of_day: 0,
          device_match: false,
          prior_txns_to_payee: 0,
          is_new_payee: false,
          payee_account_age_days: 0,
          user_avg_30d: 0,
          amount_ratio: 0,
        },
        score: 0,
        band: 'low',
        signals: [],
        explanation: {
          explanation_en: '',
          explanation_bm: '',
          scam_type: 'macau_scam',
          confidence: 'medium',
        },
        status:
          action === 'block' ? 'blocked' : action === 'warn' ? 'warned' : 'cleared',
        created_at: new Date().toISOString(),
      };
  return { ok: true, sms_sent: Boolean(data.sms_sent), alert: adapted };
}

export interface FraudQueryAlert {
  alert_id: string;
  txn_id: string;
  alert_type: string;
  risk_score: number;
  status: string;
  stage?: string;
  priority?: string;
  created_at: string;
  resolved_at?: string | null;
  amount?: number;
  sender_account_id?: string;
  receiver_account_id?: string;
  txn_timestamp?: string;
  is_first_transfer?: boolean;
  device_match?: boolean;
  account_age_days?: number;
}

export interface FraudQueryResponse {
  request_id: string;
  question: string;
  summary: string;
  spec: {
    filters: { field: string; op: string; value: unknown }[];
    sort_by: string;
    limit: number;
    summary?: string;
  };
  alerts: FraudQueryAlert[];
  count: number;
  elapsed_ms: number;
}

export async function fraudQuery(query: string): Promise<FraudQueryResponse> {
  const { data } = await api.post<FraudQueryResponse>(
    '/api/fraud-query',
    { query },
    { timeout: 20000 },
  );
  return data;
}
