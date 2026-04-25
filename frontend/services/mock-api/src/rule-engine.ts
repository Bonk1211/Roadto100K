import type { RiskSignal, Transaction } from 'shared';
import { mockPayees } from 'shared';

export interface ScoreInput {
  user_id: string;
  amount: number;
  payee_id: string;
  payee_account_age_days: number;
  is_new_payee: boolean;
  hour: number;
  device_match: boolean;
  prior_txns_to_payee: number;
  user_avg_30d: number;
}

const SCAM_GRAPH_IDS = new Set(
  mockPayees.filter((p) => p.flagged_in_scam_graph).map((p) => p.id),
);

export function evaluateSignals(input: ScoreInput): RiskSignal[] {
  const ratio = input.user_avg_30d > 0 ? input.amount / input.user_avg_30d : input.amount;
  const lateNight = input.hour < 6 || input.hour >= 22;

  return [
    {
      id: 'new_account',
      label: 'Payee account is less than 14 days old',
      triggered: input.payee_account_age_days < 14,
      weight: 25,
      detail: `Account age: ${input.payee_account_age_days} day${input.payee_account_age_days === 1 ? '' : 's'}`,
    },
    {
      id: 'first_transfer',
      label: 'First-ever transfer to this payee',
      triggered: input.is_new_payee || input.prior_txns_to_payee === 0,
      weight: 15,
      detail: `Prior transfers: ${input.prior_txns_to_payee}`,
    },
    {
      id: 'amount_spike',
      label: 'Transfer amount is more than 3× the user 30-day average',
      triggered: input.amount > 3 * input.user_avg_30d,
      weight: 25,
      detail: `Ratio: ${ratio.toFixed(2)}× (avg RM ${input.user_avg_30d.toFixed(2)})`,
    },
    {
      id: 'late_night',
      label: 'Late-night transaction (10pm – 6am)',
      triggered: lateNight,
      weight: 10,
      detail: `Hour: ${String(input.hour).padStart(2, '0')}:00`,
    },
    {
      id: 'device_mismatch',
      label: 'Transfer initiated from an unfamiliar device',
      triggered: !input.device_match,
      weight: 15,
      detail: input.device_match ? 'Known device' : 'Device fingerprint mismatch',
    },
    {
      id: 'scam_graph',
      label: 'Payee already appears in scam network graph',
      triggered: SCAM_GRAPH_IDS.has(input.payee_id),
      weight: 30,
      detail: SCAM_GRAPH_IDS.has(input.payee_id)
        ? 'Connected to known mule cluster'
        : 'No scam graph match',
    },
    {
      id: 'large_amount',
      label: 'Absolute amount above RM 5,000',
      triggered: input.amount > 5000,
      weight: 10,
      detail: `Amount: RM ${input.amount.toFixed(2)}`,
    },
  ];
}

export function transactionToScoreInput(txn: Transaction): ScoreInput {
  return {
    user_id: txn.user_id,
    amount: txn.amount,
    payee_id: txn.payee_id,
    payee_account_age_days: txn.payee_account_age_days,
    is_new_payee: txn.is_new_payee,
    hour: txn.hour_of_day,
    device_match: txn.device_match,
    prior_txns_to_payee: txn.prior_txns_to_payee,
    user_avg_30d: txn.user_avg_30d,
  };
}
