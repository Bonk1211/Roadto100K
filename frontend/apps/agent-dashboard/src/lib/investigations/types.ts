import type { Alert } from 'shared';

export type AlertType = 'sender_interception' | 'mule_eviction' | 'bulk_containment';
export type AlertStage = 'stage_1' | 'stage_2' | 'stage_3';

export interface InvestigationAlert {
  alert: Alert;
  alertType: AlertType;
  stage: AlertStage;
  stageLabel: string;
  stageReason: string;
  queueAccent: string;
  rmAtRisk: number;
  accountId: string;
  accountLabel: string;
  alertLabel: string;
  focusNodeId: string;
  linkedAccountCount: number;
  investigationSummary: string;
  transactionSummary: string;
  stageTimeline: string[];
  recommendedAction: string;
}

export interface ContainmentCandidate {
  id: string;
  label: string;
  accountRef: string;
  degree: 1 | 2;
  connectionReason: string;
  riskScore: number;
  rmExposure: number;
  selectedByDefault: boolean;
  flagged: boolean;
}

export interface QueryResultState {
  title: string;
  detail: string;
  matchingIds: string[];
}

export interface ModelHealthViewModel {
  modelVersion: string;
  previousVersion: string;
  lastTrainedAt: string;
  nextRetrainAt: string;
  labelsSinceRetrain: number;
  accuracyDelta: number;
  queueCoverage: number;
  nextWindow: string;
  loop: {
    agentLabels: number;
    userLabels: number;
    mergedLabels: number;
    retrainsThisWeek: number;
  };
  labelSplit: {
    fraud: number;
    falsePositive: number;
    agentShare: number;
    userShare: number;
  };
  sinks: LabelSink[];
  recentLabels: RecentLabel[];
  retrainHistory: RetrainEvent[];
  currentMetrics: ModelMetrics;
  endpoint: string;
}

export interface RetrainEvent {
  version: string;
  ranAt: string;
  labelCount: number;
  accuracyDelta: number;
  durationMs: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
}

export interface RetrainResult {
  oldVersion: string;
  newVersion: string;
  ranAt: string;
  labelsConsumed: number;
  durationMs: number;
  before: ModelMetrics;
  after: ModelMetrics;
  endpoint: string;
}

export interface LabelSink {
  name: string;
  region: string;
  status: 'healthy' | 'lagging' | 'down';
  lastWriteAt: string;
  writes24h: number;
}

export interface RecentLabel {
  id: string;
  ts: string;
  source: 'agent' | 'user';
  actor: string;
  action: string;
  label: 'fraud' | 'false_positive';
  txnId: string;
}
