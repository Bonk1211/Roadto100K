export type ScamType =
  | 'macau_scam'
  | 'investment_scam'
  | 'love_scam'
  | 'account_takeover'
  | 'mule_account'
  | 'false_positive';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type AgentDecision = 'block' | 'warn' | 'clear';
export type UserChoice = 'cancel' | 'proceed' | 'report';

export type RiskBand = 'low' | 'medium' | 'high';
export type LanguageHint = 'BM' | 'EN' | 'auto';
export type UIlang = 'bm' | 'en';
export type ScreeningAction = 'proceed' | 'soft_warn' | 'hard_intercept';
export type AlertType = 'sender_interception' | 'mule_eviction';
export type MuleStage = 1 | 2 | 3;

export interface Payee {
  id: string;
  name: string;
  account: string;
  phone?: string;
  account_age_days: number;
  flagged_in_scam_graph: boolean;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  user_avg_30d: number;
  device_id: string;
}

export interface Transaction {
  txn_id: string;
  user_id: string;
  payee_id: string;
  payee_name: string;
  payee_account: string;
  amount: number;
  timestamp: string; // ISO
  hour_of_day: number;
  device_match: boolean;
  prior_txns_to_payee: number;
  is_new_payee: boolean;
  payee_account_age_days: number;
  user_avg_30d: number;
  amount_ratio: number;
}

export interface RiskSignal {
  id: string;
  label: string;
  triggered: boolean;
  weight: number;
  detail?: string;
}

export interface TriggeredSignal {
  signal: string;
  label_en: string;
  label_bm: string;
  weight: number;
}

export interface BedrockExplanation {
  explanation_en: string;
  explanation_bm: string;
  scam_type: ScamType;
  confidence: ConfidenceLevel;
}

export interface MuleProfile {
  account_id: string;
  stage: MuleStage;
  unique_inbound_senders_6h: number;
  avg_inbound_gap_minutes: number;
  inbound_outbound_ratio: number;
  merchant_spend_7d: number;
  withdrawal_status: 'active' | 'soft_blocked' | 'blocked';
  escrow_amount: number;
}

export interface ContainmentAccount {
  account_id: string;
  display_name: string;
  risk_score: number;
  connection_type:
    | 'direct_transaction'
    | 'shared_device'
    | 'shared_ip'
    | 'overlapping_timing'
    | 'same_card_bin';
  degree: 1 | 2;
  rm_exposure: number;
  selected?: boolean;
}

/**
 * Wire shape returned by `POST /api/score-transaction`.
 * Bedrock fields are flat (explanation_en/_bm/scam_type/confidence) to match
 * how the mock-api emits them; consumers that want a nested BedrockExplanation
 * can compose it from these fields. The nested form is kept on `Alert` because
 * `/api/alerts` returns persisted alerts with a richer payload.
 */
export interface ScoreResponse {
  alert_id?: string;
  score: number; // 0-100
  band: RiskBand;
  signals: RiskSignal[];
  explanation_en: string;
  explanation_bm: string;
  scam_type: ScamType;
  confidence: ConfidenceLevel;
  latency_ms: number;
}

export interface Alert {
  id: string;
  txn: Transaction;
  score: number;
  band: RiskBand;
  alert_type?: AlertType;
  mule_stage?: MuleStage;
  rm_at_risk?: number;
  mule_profile?: MuleProfile;
  containment_accounts?: ContainmentAccount[];
  signals: RiskSignal[];
  explanation: BedrockExplanation;
  status: 'open' | 'blocked' | 'warned' | 'cleared';
  created_at: string;
  decided_at?: string;
  decided_by?: string;
}

export interface DecisionLog {
  alert_id: string;
  decision: AgentDecision;
  timestamp: string;
  agent_id: string;
  sms_sent?: boolean;
}

export interface ScanMessageRequest {
  message_text: string;
  language_hint?: LanguageHint;
}

export interface MatchedPattern {
  pattern: string;
  category:
    | 'government_impersonation'
    | 'urgency'
    | 'transfer_instruction'
    | 'monetary_amount'
    | 'otp_request'
    | 'investment_pitch'
    | 'generic';
}

export interface AnalyseMessageResponse {
  request_id: string;
  is_scam: boolean;
  risk_level: RiskBand;
  confidence: number;
  matched_patterns: MatchedPattern[];
  warning_en: string;
  warning_bm: string;
  scam_type_hint: ScamType | null;
  education_url: string;
  processed_at: string;
}

export interface ScreenTransactionRequest {
  user_id: string;
  session_id: string;
  payee_id: string;
  payee_name?: string;
  amount: number;
  currency?: string;
  device_id: string;
  timestamp: string;
  user_avg_30d: number;
}

export interface ScreeningPayeeInfo {
  payee_id: string;
  account_age_days: number;
  is_new_payee: boolean;
  prior_txns_to_payee: number;
  flagged_in_network: boolean;
  linked_flagged_accounts: number;
}

export interface ScreenTransactionResponse {
  request_id: string;
  txn_id: string;
  action: ScreeningAction;
  final_score: number;
  rule_score: number;
  ml_score: number;
  triggered_signals: TriggeredSignal[];
  soft_warning_en?: string;
  soft_warning_bm?: string;
  bedrock_explanation?: BedrockExplanation;
  payee_info?: ScreeningPayeeInfo;
  processed_ms: number;
  timestamp: string;
}

export interface UserChoiceRequest {
  txn_id: string;
  user_id: string;
  choice: UserChoice;
  timestamp: string;
}

export interface UserChoiceResponse {
  ok: true;
  txn_id: string;
  choice: UserChoice;
  recorded_at: string;
}

export interface NetworkNode {
  id: string;
  type: 'account' | 'device';
  label: string;
  flagged: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface NetworkEdge {
  source: string;
  target: string;
  type:
    | 'transaction'
    | 'shared_device'
    | 'shared_attribute'
    | 'shared_ip'
    | 'overlapping_timing'
    | 'same_card_bin';
  weight?: number;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface DashboardStats {
  open_alerts: number;
  rm_at_risk: number;
  blocked_today: number;
  avg_response_ms: number;
  trend?: { label: string; value: number }[];
}

export interface ContainmentExecutionRequest {
  mule_account_id: string;
  account_ids: string[];
  agent_id: string;
}

export interface ContainmentExecutionResponse {
  ok: true;
  incident_id: string;
  contained_accounts: ContainmentAccount[];
  total_rm_exposure: number;
  sns_sent: number;
  incident_summary: string;
  executed_at: string;
}
