import type { InvestigationAlert, QueryResultState } from './types.js';

export const DEMO_QUERIES = [
  'Show me accounts that topped up from 3+ senders in 24 hours',
  'Find accounts registered in the last 7 days with transfers over RM 5,000',
  'Which payees received money from users flagged this week',
  'Show all accounts linked to device ID A4F2-91XX',
];

export const DEFAULT_QUERY_STATE: QueryResultState = {
  title: 'All alerts',
  detail: 'Queue ready.',
  matchingIds: [],
};

export function runNaturalLanguageQuery(
  query: string,
  alerts: InvestigationAlert[],
): QueryResultState {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return {
      title: 'All alerts',
      detail: 'Queue ready.',
      matchingIds: alerts.map((alert) => alert.alert.id),
    };
  }

  if (normalized.includes('senders')) {
    const matches = alerts.filter((alert) => alert.alertType === 'mule_eviction');
    return {
      title: 'Mule pattern',
      detail: `${matches.length} match${matches.length === 1 ? '' : 'es'}`,
      matchingIds: matches.map((alert) => alert.alert.id),
    };
  }

  if (normalized.includes('last 7 days') || normalized.includes('registered')) {
    const matches = alerts.filter(
      (alert) =>
        alert.alert.txn.payee_account_age_days <= 7 && alert.alert.txn.amount >= 5000,
    );
    return {
      title: 'New account screen',
      detail: `${matches.length} match${matches.length === 1 ? '' : 'es'}`,
      matchingIds: matches.map((alert) => alert.alert.id),
    };
  }

  if (normalized.includes('device') || normalized.includes('a4f2')) {
    const matches = alerts.filter((alert) => ['p_scam_01', 'p_scam_03'].includes(alert.accountId));
    return {
      title: 'Device cluster',
      detail: `${matches.length} linked account${matches.length === 1 ? '' : 's'}`,
      matchingIds: matches.map((alert) => alert.alert.id),
    };
  }

  if (normalized.includes('flagged')) {
    const matches = alerts.filter((alert) => alert.linkedAccountCount > 0);
    return {
      title: 'Flagged payees',
      detail: `${matches.length} result${matches.length === 1 ? '' : 's'}`,
      matchingIds: matches.map((alert) => alert.alert.id),
    };
  }

  const freeformMatches = alerts.filter((alert) => {
    const haystack = [
      alert.accountLabel,
      alert.alert.explanation.scam_type,
      alert.alert.txn.payee_account,
      alert.alert.txn.user_id,
      alert.alertLabel,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });

  return {
    title: freeformMatches.length > 0 ? 'Search result' : 'No exact match',
    detail:
      freeformMatches.length > 0
        ? `${freeformMatches.length} result${freeformMatches.length === 1 ? '' : 's'}`
        : 'Queue unchanged',
    matchingIds:
      freeformMatches.length > 0
        ? freeformMatches.map((alert) => alert.alert.id)
        : alerts.map((alert) => alert.alert.id),
  };
}
