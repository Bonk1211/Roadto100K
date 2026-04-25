import axios from 'axios';
import type {
  Alert,
  AgentDecision,
  DashboardStats,
  NetworkGraph,
} from 'shared';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = axios.create({ baseURL, timeout: 8000 });

export async function fetchAlerts(): Promise<Alert[]> {
  const { data } = await api.get<Alert[]>('/api/alerts');
  return data;
}

export async function fetchStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/api/stats');
  return data;
}

export async function fetchNetworkGraph(): Promise<NetworkGraph> {
  const { data } = await api.get<NetworkGraph>('/api/network-graph');
  return data;
}

export interface DecisionResponse {
  ok: true;
  sms_sent: boolean;
  alert: Alert;
}

export async function postDecision(
  alertId: string,
  action: AgentDecision,
  agentId = 'agent_console',
): Promise<DecisionResponse> {
  const { data } = await api.post<DecisionResponse>(`/api/alerts/${alertId}/decision`, {
    action,
    agent_id: agentId,
  });
  return data;
}
