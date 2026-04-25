import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  Alert,
  AgentDecision,
  AnalyseMessageResponse,
  ScreenTransactionResponse,
  ScreeningAction,
  ScreeningPayeeInfo,
  Transaction,
  TriggeredSignal,
  UserChoice,
} from 'shared';
import { mockPayees, mockTransactions, mockUsers } from 'shared';
import {
  addAlert,
  getStats,
  listAlerts,
  nextAlertId,
  recordDecision,
  recordResponseLatency,
} from './decisions.js';
import { explainScam } from './bedrock-mock.js';
import { bandFor, scoreTransaction } from './eas-mock.js';
import { getNetworkGraph } from './network-graph.js';
import { evaluateSignals, type ScoreInput } from './rule-engine.js';

const PORT = Number(process.env.PORT ?? 4000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mock-api', time: new Date().toISOString() });
});

app.post('/api/analyse-message', (req, res) => {
  const messageText = String(req.body?.message_text ?? '');
  const result = scanMessage(messageText);
  res.json(result);
});

app.post('/api/scan-message', (req, res) => {
  const result = scanMessage(String(req.body?.text ?? req.body?.message_text ?? ''));
  res.json(toLegacyScanResponse(result));
});

app.post('/api/screen-transaction', (req, res) => {
  const start = Date.now();
  const body = req.body ?? {};
  const transactionContext = buildTransactionContext(body);
  const signals = evaluateSignals(transactionContext.input);
  const ruleScore = clamp(
    signals.filter((signal) => signal.triggered).reduce((sum, signal) => sum + signal.weight, 0),
    0,
    100,
  );
  const mlScore = scoreTransaction(transactionContext.input, signals);
  const finalScore = Math.round(0.4 * ruleScore + 0.6 * mlScore);
  const action = actionFor(finalScore);
  const explanation = explainScam(transactionContext.input, signals, finalScore);
  const txn = buildTransactionFromContext(transactionContext, body);
  const latencyMs = Date.now() - start;
  const triggeredSignals = toTriggeredSignals(signals, transactionContext.input);
  const payeeInfo = buildPayeeInfo(transactionContext);

  let alertId: string | undefined;
  if (action !== 'proceed') {
    alertId = nextAlertId();
    const alert: Alert = {
      id: alertId,
      txn,
      score: finalScore,
      band: bandFor(finalScore),
      signals,
      explanation,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    addAlert(alert);
  }

  recordResponseLatency(latencyMs);

  const response: ScreenTransactionResponse = {
    request_id: crypto.randomUUID(),
    txn_id: txn.txn_id,
    action,
    final_score: finalScore,
    rule_score: ruleScore,
    ml_score: mlScore,
    triggered_signals: triggeredSignals,
    processed_ms: latencyMs,
    timestamp: new Date().toISOString(),
  };

  if (action === 'soft_warn') {
    response.soft_warning_en =
      'This transfer is larger than usual or includes suspicious signals. Please verify before confirming.';
    response.soft_warning_bm =
      'Pemindahan ini lebih besar dari biasa atau mempunyai petunjuk mencurigakan. Sila sahkan sebelum meneruskan.';
    response.payee_info = payeeInfo;
  }

  if (action === 'hard_intercept') {
    response.bedrock_explanation = explanation;
    response.payee_info = payeeInfo;
  }

  res.json(response);
});

app.post('/api/score-transaction', (req, res) => {
  const start = Date.now();
  const context = buildTransactionContext({
    ...req.body,
    timestamp: new Date().toISOString(),
    device_id: req.body?.device_id ?? 'legacy-device',
    session_id: req.body?.session_id ?? 'legacy-session',
    payee_id: req.body?.payee_id ?? req.body?.payee_account,
  });
  const signals = evaluateSignals(context.input);
  const score = scoreTransaction(context.input, signals);
  const explanation = explainScam(context.input, signals, score);
  const latencyMs = Date.now() - start;
  recordResponseLatency(latencyMs);
  res.json({
    alert_id: undefined,
    score,
    band: bandFor(score),
    signals,
    explanation_en: explanation.explanation_en,
    explanation_bm: explanation.explanation_bm,
    scam_type: explanation.scam_type,
    confidence: explanation.confidence,
    latency_ms: latencyMs,
  });
});

app.post('/api/user-choice', (req, res) => {
  const txnId = String(req.body?.txn_id ?? '');
  const choice = String(req.body?.choice ?? '') as UserChoice;
  if (!txnId || !['cancel', 'proceed', 'report'].includes(choice)) {
    return res.status(400).json({
      ok: false,
      error: 'txn_id and choice=cancel|proceed|report are required',
    });
  }

  return res.json({
    ok: true,
    txn_id: txnId,
    choice,
    recorded_at: new Date().toISOString(),
  });
});

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

app.get('/api/network-graph', (_req, res) => {
  res.json(getNetworkGraph());
});

app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

app.get('/api/mock/users', (_req, res) => res.json(mockUsers));
app.get('/api/mock/payees', (_req, res) => res.json(mockPayees));
app.get('/api/mock/transactions', (_req, res) => res.json(mockTransactions));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[mock-api] error:', err);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}`);
});

function actionFor(score: number): ScreeningAction {
  if (score < 40) return 'proceed';
  if (score <= 70) return 'soft_warn';
  return 'hard_intercept';
}

function buildTransactionContext(raw: Record<string, unknown>) {
  const payeeIdentifier = String(raw.payee_id ?? '');
  const payee = findPayeeByIdentifier(payeeIdentifier);
  const userId = String(raw.user_id ?? 'u_unknown');
  const user = mockUsers.find((candidate) => candidate.id === userId);
  const timestamp = String(raw.timestamp ?? new Date().toISOString());
  const date = new Date(timestamp);
  const hour = Number.isNaN(date.getTime()) ? new Date().getHours() : date.getHours();
  const priorTransfers = mockTransactions.filter(
    (txn) => txn.user_id === userId && txn.payee_id === payee?.id,
  ).length;
  const input: ScoreInput = {
    user_id: userId,
    amount: Number(raw.amount ?? 0),
    payee_id: payee?.id ?? payeeIdentifier ?? 'p_unknown',
    payee_account_age_days: payee?.account_age_days ?? 9999,
    is_new_payee: priorTransfers === 0,
    hour,
    device_match: String(raw.device_id ?? '') === String(user?.device_id ?? ''),
    prior_txns_to_payee: priorTransfers,
    user_avg_30d: Number(raw.user_avg_30d ?? user?.user_avg_30d ?? 0),
  };

  return {
    input,
    payee,
    user,
    timestamp: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    deviceId: String(raw.device_id ?? ''),
    sessionId: String(raw.session_id ?? ''),
    payeeIdentifier,
  };
}

function buildTransactionFromContext(
  context: ReturnType<typeof buildTransactionContext>,
  raw: Record<string, unknown>,
): Transaction {
  const ratio =
    context.input.user_avg_30d > 0
      ? context.input.amount / context.input.user_avg_30d
      : context.input.amount;

  return {
    txn_id:
      typeof raw.txn_id === 'string'
        ? raw.txn_id
        : `TXN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`,
    user_id: context.input.user_id,
    payee_id: context.input.payee_id,
    payee_name:
      typeof raw.payee_name === 'string'
        ? raw.payee_name
        : context.payee?.name ?? 'Unknown payee',
    payee_account: context.payee?.account ?? context.payeeIdentifier ?? 'unknown',
    amount: context.input.amount,
    timestamp: context.timestamp,
    hour_of_day: context.input.hour,
    device_match: context.input.device_match,
    prior_txns_to_payee: context.input.prior_txns_to_payee,
    is_new_payee: context.input.is_new_payee,
    payee_account_age_days: context.input.payee_account_age_days,
    user_avg_30d: context.input.user_avg_30d,
    amount_ratio: Math.round(ratio * 100) / 100,
  };
}

function findPayeeByIdentifier(identifier: string) {
  return mockPayees.find(
    (payee) =>
      payee.id === identifier || payee.account === identifier || payee.phone === identifier,
  );
}

function buildPayeeInfo(
  context: ReturnType<typeof buildTransactionContext>,
): ScreeningPayeeInfo {
  return {
    payee_id: context.payeeIdentifier || context.input.payee_id,
    account_age_days: context.input.payee_account_age_days,
    is_new_payee: context.input.is_new_payee,
    prior_txns_to_payee: context.input.prior_txns_to_payee,
    flagged_in_network: Boolean(context.payee?.flagged_in_scam_graph),
    linked_flagged_accounts: context.payee?.flagged_in_scam_graph ? 4 : 0,
  };
}

function toTriggeredSignals(
  signals: ReturnType<typeof evaluateSignals>,
  input: ScoreInput,
): TriggeredSignal[] {
  const ratio =
    input.user_avg_30d > 0 ? Math.round((input.amount / input.user_avg_30d) * 10) / 10 : input.amount;
  const hourLabel = `${String(input.hour).padStart(2, '0')}:00`;

  return signals
    .filter((signal) => signal.triggered)
    .map((signal) => {
      switch (signal.id) {
        case 'new_account':
          return {
            signal: signal.id,
            label_en: `Payee account is only ${input.payee_account_age_days} days old`,
            label_bm: `Akaun penerima hanya ${input.payee_account_age_days} hari`,
            weight: signal.weight,
          };
        case 'first_transfer':
          return {
            signal: signal.id,
            label_en: 'You have never sent money here before',
            label_bm: 'Anda tidak pernah hantar wang ke sini sebelum ini',
            weight: signal.weight,
          };
        case 'amount_spike':
          return {
            signal: signal.id,
            label_en: `Amount is ${ratio}x your monthly average`,
            label_bm: `Jumlah adalah ${ratio}x purata bulanan anda`,
            weight: signal.weight,
          };
        case 'late_night':
          return {
            signal: signal.id,
            label_en: `Transaction at ${hourLabel}`,
            label_bm: `Transaksi pada pukul ${hourLabel}`,
            weight: signal.weight,
          };
        case 'device_mismatch':
          return {
            signal: signal.id,
            label_en: 'Transfer started from an unfamiliar device',
            label_bm: 'Pemindahan dimulakan daripada peranti yang tidak dikenali',
            weight: signal.weight,
          };
        case 'scam_graph':
          return {
            signal: signal.id,
            label_en: 'Payee linked to other flagged accounts',
            label_bm: 'Penerima dikaitkan dengan akaun lain yang ditandakan',
            weight: signal.weight,
          };
        case 'large_amount':
          return {
            signal: signal.id,
            label_en: 'Large round-number transfer amount',
            label_bm: 'Jumlah pemindahan besar dan berbentuk nombor bulat',
            weight: signal.weight,
          };
        default:
          return {
            signal: signal.id,
            label_en: signal.label,
            label_bm: signal.label,
            weight: signal.weight,
          };
      }
    });
}

function toLegacyScanResponse(result: AnalyseMessageResponse) {
  return {
    risk: result.risk_level,
    matched_phrases: result.matched_patterns.map((item) => item.pattern),
    explanation_en: result.warning_en,
    explanation_bm: result.warning_bm,
    scam_type: result.scam_type_hint,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
