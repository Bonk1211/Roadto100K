/**
 * PostgreSQL integration for mock-api
 * Queries the SafeSend database
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

loadDatabaseEnv();

const DATABASE_URL = process.env.DATABASE_URL;

let sql: postgres.Sql | null = null;

function loadDatabaseEnv() {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), 'backend/.env'),
    resolve(process.cwd(), '../backend/.env'),
    resolve(sourceDir, '../../../../backend/.env'),
    resolve(sourceDir, '../../../.env'),
    resolve(process.cwd(), '.env'),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      if (!key || process.env[key] !== undefined) continue;

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
}

export function initDb() {
  if (!DATABASE_URL) {
    console.warn('[db] DATABASE_URL not set, skipping PostgreSQL connection');
    return false;
  }

  try {
    sql = postgres(DATABASE_URL, { 
      idle_timeout: 30,
      max: 10,
    });
    console.log('[db] PostgreSQL connected');
    return true;
  } catch (e) {
    console.error('[db] Connection failed:', e);
    return false;
  }
}

export async function getAlerts(status?: string, limit: number = 20) {
  if (!sql) throw new Error('Database not initialized');

  if (status) {
    return sql`SELECT * FROM alerts WHERE status = ${status} LIMIT ${limit}`;
  }

  return sql`SELECT * FROM alerts LIMIT ${limit}`;
}

export async function getAlert(alertId: string) {
  if (!sql) throw new Error('Database not initialized');
  const [alert] = await sql`SELECT * FROM alerts WHERE alert_id = ${alertId}`;
  if (!alert) return null;

  // Join with explanation
  const [explanation] = await sql`SELECT * FROM bedrock_explanations WHERE alert_id = ${alertId}`;
  return { ...alert, explanation };
}

export async function getAccounts(limit: number = 50) {
  if (!sql) throw new Error('Database not initialized');
  return sql`SELECT * FROM accounts LIMIT ${limit}`;
}

export async function getAccount(accountId: string) {
  if (!sql) throw new Error('Database not initialized');
  const [account] = await sql`SELECT * FROM accounts WHERE account_id = ${accountId}`;
  return account || null;
}

export async function getTransactions(limit: number = 50) {
  if (!sql) throw new Error('Database not initialized');
  return sql`SELECT * FROM transactions LIMIT ${limit}`;
}

export async function getTransaction(txnId: string) {
  if (!sql) throw new Error('Database not initialized');
  const [txn] = await sql`SELECT * FROM transactions WHERE txn_id = ${txnId}`;
  return txn || null;
}

export async function getMuleCases(status?: string, limit: number = 20) {
  if (!sql) throw new Error('Database not initialized');

  if (status) {
    return sql`SELECT * FROM mule_cases WHERE status = ${status} LIMIT ${limit}`;
  }

  return sql`SELECT * FROM mule_cases LIMIT ${limit}`;
}

export async function getMuleCase(caseId: string) {
  if (!sql) throw new Error('Database not initialized');
  const [muleCase] = await sql`SELECT * FROM mule_cases WHERE mule_case_id = ${caseId}`;
  return muleCase || null;
}

export async function getNetworkGraph(limit: number = 100) {
  if (!sql) throw new Error('Database not initialized');
  
  const nodes = await sql`
    SELECT 
      account_id as id,
      user_id as label,
      account_type as type,
      status,
      (SELECT COUNT(*) FROM risk_scores WHERE account_id = accounts.account_id) as alert_count
    FROM accounts
    LIMIT ${limit}
  `;

  const links = await sql`SELECT * FROM network_links LIMIT ${limit}`;

  return { nodes, links };
}

export async function updateAlertStatus(alertId: string, status: string, agentId: string, notes: string = '') {
  if (!sql) throw new Error('Database not initialized');
  
  const resolved_at = status !== 'open' ? new Date().toISOString() : null;
  
  const [updated] = await sql`
    UPDATE alerts 
    SET status = ${status}, resolved_at = ${resolved_at}
    WHERE alert_id = ${alertId}
    RETURNING *
  `;

  // Record the agent action
  if (updated && agentId) {
    const actionId = `action_${Date.now()}`;
    await sql`
      INSERT INTO agent_actions (action_id, alert_id, agent_id, action_type, decision_label, notes)
      VALUES (${actionId}, ${alertId}, ${agentId}, 'decision', ${status}, ${notes})
    `;
  }

  return updated || null;
}

export async function getStats() {
  if (!sql) throw new Error('Database not initialized');
  
  const [alertStats] = await sql`
    SELECT 
      COUNT(*) as total_alerts,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_alerts,
      SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_alerts,
      AVG(risk_score) as avg_risk_score
    FROM alerts
  `;

  const [accountStats] = await sql`
    SELECT 
      COUNT(*) as total_accounts,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_accounts,
      SUM(CASE WHEN status = 'soft_blocked' THEN 1 ELSE 0 END) as soft_blocked,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended
    FROM accounts
  `;

  return { ...alertStats, ...accountStats };
}

export async function closeDb() {
  if (sql) {
    await sql.end();
    sql = null;
  }
}
