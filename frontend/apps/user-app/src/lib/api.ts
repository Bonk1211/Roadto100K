import axios from 'axios';
import type {
  ScreenTransactionRequest,
  ScreenTransactionResponse,
  UserChoice,
  UserChoiceResponse,
} from 'shared';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  timeout: 8000,
});

export async function screenTransaction(
  body: ScreenTransactionRequest,
): Promise<ScreenTransactionResponse> {
  const res = await api.post<ScreenTransactionResponse>('/api/screen-transaction', body);
  return res.data;
}

export async function submitUserChoice(body: {
  txn_id: string;
  user_id: string;
  choice: UserChoice;
}): Promise<UserChoiceResponse> {
  const res = await api.post<UserChoiceResponse>('/api/user-choice', {
    ...body,
    timestamp: new Date().toISOString(),
  });
  return res.data;
}
