import axios from 'axios';
import type { ScanMessageResponse } from 'shared';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  timeout: 8000,
});

export async function scanMessage(text: string): Promise<ScanMessageResponse> {
  const res = await api.post<ScanMessageResponse>('/api/scan-message', { text });
  return res.data;
}
