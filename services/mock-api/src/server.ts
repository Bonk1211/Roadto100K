import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Alert, AgentDecision, Transaction } from 'shared';
import { mockPayees, mockTransactions, mockUsers } from 'shared';
import {
  addAlert,
  getStats,
  listAlerts,
  nextAlertId,
  recordDecision,
  recordResponseLatency,
} from './decisions.js';
import { bandFor, scoreTransaction } from './eas-mock.js';
import { explainScam } from './bedrock-mock.js';
import { getNetworkGraph } from './network-graph.js';
import { evaluateSignals, type ScoreInput } from './rule-engine.js';
import { scanMessage } from './scam-message-detector.js';

const PORT = Number(process.env.PORT ?? 4000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// ---- request logger ---------------------------------------------------------
app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ---- health -----------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mock-api', time: new Date().toISOString() });
});

// ---- score a transaction ----------------------------------------------------
app.post('/api/score-transaction', (req, res) => {
  const start = Date.now();
  const body = req.body ?? {};

  const input: ScoreInput = {
    user_id: String(body.user_id ?? 'u_unknown'),
    amount: Number(body.amount ?? 0),
    payee_id: String(body.payee_id ?? 'p_unknown'),
    payee_account_age_days: Number(body.payee_account_age_days ?? 9999),
    is_new_payee: Boolean(body.is_new_payee ?? false),
    hour: Number(body.hour ?? new Date().getHours()),
    device_match: body.device_match === undefined ? true : Boolean(body.device_match),
    prior_txns_to_payee: Number(body.prior_txns_to_payee ?? 0),
    user_avg_30d: Number(body.user_avg_30d ?? 0),
  };

  const signals = evaluateSignals(input);
  const score = scoreTransaction(input, signals);
  const band = bandFor(score);
  const explanation = explainScam(input, signals, score);

  const txn: Transaction = buildTransactionFromInput(input, body);
  const latencyMs = Date.now() - start;

  let alertId: string | undefined;
  if (band !== 'low') {
    alertId = nextAlertId();
    const alert: Alert = {
      id: alertId,
      txn,
      score,
      band,
      signals,
      explanation,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    addAlert(alert);
  }

  recordResponseLatency(latencyMs);

  res.json({
    alert_id: alertId,
    score,
    band,
    signals: signals.map((s) => ({
      id: s.id,
      label: s.label,
      triggered: s.triggered,
      weight: s.weight,
      detail: s.detail,
    })),
    explanation_en: explanation.explanation_en,
    explanation_bm: explanation.explanation_bm,
    scam_type: explanation.scam_type,
    confidence: explanation.confidence,
    latency_ms: latencyMs,
  });
});

// ---- scan a chat message ----------------------------------------------------
app.post('/api/scan-message', (req, res) => {
  const text = String(req.body?.text ?? '');
  res.json(scanMessage(text));
});

// ---- alerts -----------------------------------------------------------------
app.get('/api/alerts', (_req, res) => {
  res.json(listAlerts());
});

app.post('/api/alerts/:id/decision', (req, res) => {
  const action = req.body?.action as AgentDecision | undefined;
  const agentId = String(req.body?.agent_id ?? 'agent_unknown');
  if (action !== 'block' && action !== 'warn' && action !== 'clear') {
    return res
      .status(400)
      .json({ ok: false, error: 'action must be block | warn | clear' });
  }
  const result = recordDecision(req.params.id, action, agentId);
  if (!('alert' in result)) {
    return res.status(404).json(result);
  }
  return res.json({
    ok: true,
    sms_sent: result.sms_sent,
    alert: result.alert,
  });
});

// ---- network graph ----------------------------------------------------------
app.get('/api/network-graph', (_req, res) => {
  res.json(getNetworkGraph());
});

// ---- stats ------------------------------------------------------------------
app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

// ---- demo helpers (used by user-app + plugin) ------------------------------
app.get('/api/mock/users', (_req, res) => res.json(mockUsers));
app.get('/api/mock/payees', (_req, res) => res.json(mockPayees));
app.get('/api/mock/transactions', (_req, res) => res.json(mockTransactions));

// ---- error handler ----------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[mock-api] error:', err);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-api] listening on http://localhost:${PORT}`);
});

function buildTransactionFromInput(
  input: ScoreInput,
  raw: Record<string, unknown>,
): Transaction {
  const ratio = input.user_avg_30d > 0 ? input.amount / input.user_avg_30d : input.amount;
  const payee = mockPayees.find((p) => p.id === input.payee_id);
  return {
    txn_id: typeof raw.txn_id === 'string' ? raw.txn_id : `t_${Date.now()}`,
    user_id: input.user_id,
    payee_id: input.payee_id,
    payee_name:
      typeof raw.payee_name === 'string' ? raw.payee_name : payee?.name ?? 'Unknown payee',
    payee_account:
      typeof raw.payee_account === 'string'
        ? raw.payee_account
        : payee?.account ?? 'unknown',
    amount: input.amount,
    timestamp: new Date().toISOString(),
    hour_of_day: input.hour,
    device_match: input.device_match,
    prior_txns_to_payee: input.prior_txns_to_payee,
    is_new_payee: input.is_new_payee,
    payee_account_age_days: input.payee_account_age_days,
    user_avg_30d: input.user_avg_30d,
    amount_ratio: Math.round(ratio * 100) / 100,
  };
}
