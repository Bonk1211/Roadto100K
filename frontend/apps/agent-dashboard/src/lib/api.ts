import axios from 'axios';
import type {
  Alert,
  AgentDecision,
  ContainmentExecutionResponse,
  DashboardStats,
  NetworkGraph,
} from 'shared';

const baseURL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:4000';

export const api = axios.create({ baseURL, timeout: 8000 });
if (import.meta.env.VITE_API_KEY) {
  api.defaults.headers.common['x-api-key'] = import.meta.env.VITE_API_KEY;
}

export async function fetchAlerts(): Promise<Alert[]> {
  const { data } = await api.get<Alert[] | { alerts: Alert[] }>('/api/alerts');
  return Array.isArray(data) ? data : data.alerts;
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

export async function executeContainment(
  muleAccountId: string,
  accountIds: string[],
  agentId = 'agent_console',
): Promise<ContainmentExecutionResponse> {
  const { data } = await api.post<ContainmentExecutionResponse>('/api/containment/execute', {
    mule_account_id: muleAccountId,
    account_ids: accountIds,
    agent_id: agentId,
  });
  return data;
}
