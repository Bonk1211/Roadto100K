import axios from 'axios';
import type { AnalyseMessageResponse, LanguageHint } from 'shared';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  timeout: 8000,
});

export async function analyseMessage(
  messageText: string,
  languageHint: LanguageHint = 'auto',
): Promise<AnalyseMessageResponse> {
  const res = await api.post<AnalyseMessageResponse>('/api/analyse-message', {
    message_text: messageText,
    language_hint: languageHint,
  });
  return res.data;
}
