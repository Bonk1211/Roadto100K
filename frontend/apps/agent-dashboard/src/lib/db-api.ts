/**
 * Database API client for PostgreSQL RDS backend
 * Queries alerts, accounts, transactions, and mule cases from the database
 */

import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  timeout: 8000,
});

// Alerts
export async function getAlerts(status?: string, limit: number = 20) {
  try {
    const { data } = await api.get('/api/db/alerts', {
      params: { status, limit },
    });
    return data.data || [];
  } catch (e) {
    console.error('[db api] getAlerts error:', e);
    return [];
  }
}

export async function getAlert(alertId: string) {
  try {
    const { data } = await api.get(`/api/db/alerts/${alertId}`);
    return data.data || null;
  } catch (e) {
    console.error('[db api] getAlert error:', e);
    return null;
  }
}

export async function updateAlertStatus(
  alertId: string,
  status: string,
  agentId?: string,
  notes?: string,
) {
  try {
    const { data } = await api.post(`/api/db/alerts/${alertId}/update-status`, {
      status,
      agent_id: agentId,
      notes,
    });
    return data.data || null;
  } catch (e) {
    console.error('[db api] updateAlertStatus error:', e);
    throw e;
  }
}

// Accounts
export async function getAccounts(limit: number = 50) {
  try {
    const { data } = await api.get('/api/db/accounts', { params: { limit } });
    return data.data || [];
  } catch (e) {
    console.error('[db api] getAccounts error:', e);
    return [];
  }
}

// Transactions
export async function getTransactions(limit: number = 50) {
  try {
    const { data } = await api.get('/api/db/transactions', { params: { limit } });
    return data.data || [];
  } catch (e) {
    console.error('[db api] getTransactions error:', e);
    return [];
  }
}

// Mule Cases
export async function getMuleCases(status?: string, limit: number = 20) {
  try {
    const { data } = await api.get('/api/db/mule-cases', {
      params: { status, limit },
    });
    return data.data || [];
  } catch (e) {
    console.error('[db api] getMuleCases error:', e);
    return [];
  }
}

// Network Graph
export async function getNetworkGraph(limit: number = 100) {
  try {
    const { data } = await api.get('/api/db/network-graph', { params: { limit } });
    return data.data || { nodes: [], links: [] };
  } catch (e) {
    console.error('[db api] getNetworkGraph error:', e);
    return { nodes: [], links: [] };
  }
}

// Stats
export async function getDbStats() {
  try {
    const { data } = await api.get('/api/db/stats');
    return data.data || {};
  } catch (e) {
    console.error('[db api] getDbStats error:', e);
    return {};
  }
}
