import type { Alert } from 'shared';

export type AlertType = 'sender_interception' | 'mule_eviction';
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
  lastTrainedAt: string;
  labelsSinceRetrain: number;
  accuracyDelta: number;
  queueCoverage: number;
  nextWindow: string;
}
