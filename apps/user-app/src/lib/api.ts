import axios from 'axios';
import type { ScoreResponse } from 'shared';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  timeout: 8000,
});

export interface ScoreTransactionRequest {
  amount: number;
  payee_account_age_days: number;
  is_new_payee: boolean;
  hour: number;
  device_match: boolean;
  prior_txns_to_payee: number;
  user_avg_30d: number;
  payee_name?: string;
  payee_account?: string;
  payee_id?: string;
  user_id?: string;
}

export async function scoreTransaction(
  body: ScoreTransactionRequest,
): Promise<ScoreResponse> {
  const res = await api.post<ScoreResponse>('/api/score-transaction', body);
  return res.data;
}
