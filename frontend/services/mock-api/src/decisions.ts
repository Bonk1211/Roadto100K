import type { AgentDecision, Alert, DecisionLog } from 'shared';
import { seedAlerts } from 'shared';

const alerts = new Map<string, Alert>();
const decisions: DecisionLog[] = [];
const responseTimesMs: number[] = [];

let alertSeq = 1000;

// Seed in-memory store with PRD demo alerts.
for (const alert of seedAlerts) {
  alerts.set(alert.id, structuredClone(alert));
}

export function listAlerts(): Alert[] {
  return Array.from(alerts.values()).sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}

export function getAlert(id: string): Alert | undefined {
  return alerts.get(id);
}

export function addAlert(alert: Alert): void {
  alerts.set(alert.id, alert);
}

export function nextAlertId(): string {
  alertSeq += 1;
  return `a_${alertSeq}`;
}

export function recordResponseLatency(ms: number): void {
  responseTimesMs.push(ms);
  if (responseTimesMs.length > 200) responseTimesMs.shift();
}

export interface DecideResult {
  ok: true;
  alert: Alert;
  log: DecisionLog;
  sms_sent: boolean;
}

export function recordDecision(
  alertId: string,
  action: AgentDecision,
  agentId: string,
): DecideResult | { ok: false; error: string } {
  const alert = alerts.get(alertId);
  if (!alert) return { ok: false, error: `Alert ${alertId} not found` };

  const now = new Date().toISOString();
  alert.status = action === 'block' ? 'blocked' : action === 'warn' ? 'warned' : 'cleared';
  alert.decided_at = now;
  alert.decided_by = agentId;

  const sms = action === 'block' || action === 'warn';
  const log: DecisionLog = {
    alert_id: alertId,
    decision: action,
    timestamp: now,
    agent_id: agentId,
    sms_sent: sms,
  };
  decisions.push(log);
  if (sms) {
    // eslint-disable-next-line no-console
    console.log(
      `[mock-sns] SMS to user ${alert.txn.user_id}: SafeSend ${action === 'block' ? 'blocked' : 'flagged'} a transaction of RM ${alert.txn.amount.toFixed(2)} to ${alert.txn.payee_name}.`,
    );
  }

  return { ok: true, alert, log, sms_sent: sms };
}

export function listDecisions(): DecisionLog[] {
  return [...decisions];
}

export function getStats() {
  const open = listAlerts().filter((a) => a.status === 'open');
  const todayStart = startOfTodayMs();
  const blockedToday = decisions.filter(
    (d) => d.decision === 'block' && Date.parse(d.timestamp) >= todayStart,
  ).length;
  const rmAtRisk = open.reduce((sum, a) => sum + a.txn.amount, 0);
  const avg =
    responseTimesMs.length === 0
      ? 180
      : Math.round(
          responseTimesMs.reduce((s, n) => s + n, 0) / responseTimesMs.length,
        );

  return {
    open_alerts: open.length,
    rm_at_risk: Math.round(rmAtRisk),
    blocked_today: blockedToday,
    avg_response_ms: avg,
  };
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
