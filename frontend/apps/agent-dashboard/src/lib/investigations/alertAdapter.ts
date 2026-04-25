import type { Alert, NetworkGraph } from 'shared';
import { deriveContainmentCandidates } from './containmentAdapter.js';
import type { AlertStage, AlertType, InvestigationAlert } from './types.js';

const ALERT_OVERRIDES: Partial<
  Record<
    string,
    {
      alertType: AlertType;
      stage: AlertStage;
      linkedAccountCount: number;
      recommendedAction: string;
      investigationSummary: string;
    }
  >
> = {
  p_scam_03: {
    alertType: 'mule_eviction',
    stage: 'stage_3',
    linkedAccountCount: 6,
    recommendedAction: 'Review links and contain.',
    investigationSummary: 'Stage 3 mule pattern detected.',
  },
  p_scam_01: {
    alertType: 'sender_interception',
    stage: 'stage_3',
    linkedAccountCount: 4,
    recommendedAction: 'Confirm override risk.',
    investigationSummary: 'Hard-stop sender alert.',
  },
  p_scam_02: {
    alertType: 'sender_interception',
    stage: 'stage_2',
    linkedAccountCount: 3,
    recommendedAction: 'Warn and monitor.',
    investigationSummary: 'Medium-risk sender pattern.',
  },
  p_safe_02: {
    alertType: 'sender_interception',
    stage: 'stage_1',
    linkedAccountCount: 0,
    recommendedAction: 'Review as likely safe.',
    investigationSummary: 'Low-confidence queue example.',
  },
};

export function buildInvestigationAlerts(
  alerts: Alert[],
  graph: NetworkGraph | null,
): InvestigationAlert[] {
  return alerts
    .map((alert) => {
      const override = ALERT_OVERRIDES[alert.txn.payee_id];
      const stage =
        override?.stage ??
        stageFromAlert(alert) ??
        stageForScore(alert.score);
      const alertType =
        override?.alertType ??
        alert.alert_type ??
        (alert.explanation.scam_type === 'mule_account' ? 'mule_eviction' : 'sender_interception');
      const linkedAccountCount =
        override?.linkedAccountCount ??
        alert.containment_accounts?.length ??
        deriveContainmentCandidates(graph, alert).filter((candidate) => candidate.degree <= 2).length;

      return {
        alert,
        alertType,
        stage,
        stageLabel: stage.replace('_', ' ').toUpperCase(),
        stageReason: stageReason(alertType, stage),
        queueAccent: queueAccent(stage),
        rmAtRisk: Math.round(alert.rm_at_risk ?? alert.txn.amount),
        accountId: alert.txn.payee_account,
        accountLabel: alert.txn.payee_account,
        alertLabel:
          alertTypeLabel(alertType),
        focusNodeId: alert.txn.payee_id,
        linkedAccountCount,
        investigationSummary:
          override?.investigationSummary ??
          `${alert.txn.payee_name} triggered ${alert.signals.filter((signal) => signal.triggered).length} signals.`,
        transactionSummary:
          `RM ${alert.txn.amount.toLocaleString('en-MY')} from ${alert.txn.user_id}`,
        stageTimeline: stageTimeline(alertType, stage),
        recommendedAction:
          override?.recommendedAction ??
          (stage === 'stage_3'
            ? 'Escalate now.'
            : stage === 'stage_2'
              ? 'Warn and monitor.'
              : 'Track quietly.'),
      };
    })
    .sort((left, right) => right.alert.score - left.alert.score);
}

function stageForScore(score: number): AlertStage {
  if (score >= 80) return 'stage_3';
  if (score >= 60) return 'stage_2';
  return 'stage_1';
}

function stageFromAlert(alert: Alert): AlertStage | null {
  if (alert.stage === 'stage_1' || alert.stage === 'stage_2' || alert.stage === 'stage_3') {
    return alert.stage;
  }
  const profileStage = alert.mule_profile?.stage;
  const muleStage = alert.mule_stage;
  const stage = profileStage ?? muleStage;
  if (stage === 3) return 'stage_3';
  if (stage === 2) return 'stage_2';
  if (stage === 1) return 'stage_1';
  return null;
}

function alertTypeLabel(alertType: AlertType): string {
  if (alertType === 'mule_eviction') return 'Mule eviction';
  if (alertType === 'bulk_containment') return 'Bulk containment';
  return 'Sender interception';
}

function stageReason(alertType: AlertType, stage: AlertStage): string {
  if (alertType === 'mule_eviction' || alertType === 'bulk_containment') {
    if (stage === 'stage_3') return 'Auto-eviction';
    if (stage === 'stage_2') return 'Soft-block';
    return 'Watchlist';
  }
  if (stage === 'stage_3') return 'Hard intercept';
  if (stage === 'stage_2') return 'Soft warning';
  return 'Silent monitor';
}

function stageTimeline(alertType: AlertType, stage: AlertStage): string[] {
  const senderTimeline = ['Signals fired', 'Warning raised', 'Stopped or escalated'];
  const muleTimeline = ['Watchlist active', 'Agent alert', 'Eviction triggered'];
  const timeline = alertType === 'sender_interception' ? senderTimeline : muleTimeline;
  const index = stage === 'stage_1' ? 1 : stage === 'stage_2' ? 2 : 3;
  return timeline.map((step, current) => `${current < index ? 'Done' : current === index ? 'Active' : 'Next'} - ${step}`);
}

function queueAccent(stage: AlertStage): string {
  if (stage === 'stage_3') return '#DC2626';
  if (stage === 'stage_2') return '#FF8A00';
  return '#FFE600';
}
