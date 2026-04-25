import axios from 'axios';
import type {
  ScreenTransactionRequest,
  ScreenTransactionResponse,
  UserChoice,
  UserChoiceResponse,
} from 'shared';

const baseURL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'https://kxizsxqc6udjjhkwtugm3lrwqu0ivknv.lambda-url.ap-southeast-1.on.aws';

export const api = axios.create({
  baseURL,
  timeout: 8000,
  headers: import.meta.env.VITE_API_KEY
    ? {
        'x-api-key': import.meta.env.VITE_API_KEY,
      }
    : undefined,
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
}): Promise<UserChoiceResponse | null> {
  try {
    const res = await api.post<UserChoiceResponse>('/api/user-choice', {
      ...body,
      timestamp: new Date().toISOString(),
    });
    return res.data;
  } catch (err) {
    // Logging is best-effort. Backend may not have the endpoint deployed —
    // do not block the user flow on it.
    console.warn('[submitUserChoice] logging failed (non-blocking)', err);
    return null;
  }
}
