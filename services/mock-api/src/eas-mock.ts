import type { RiskBand, RiskSignal } from 'shared';
import { riskThresholds } from 'shared';
import type { ScoreInput } from './rule-engine.js';

/**
 * Deterministic pseudo-Isolation-Forest score.
 * Sums triggered signal weights, caps at 100, then adds a deterministic ±3 jitter
 * derived from a stable hash of the input so the same transaction always scores the same.
 */
export function scoreTransaction(input: ScoreInput, signals: RiskSignal[]): number {
  const raw = signals.filter((s) => s.triggered).reduce((sum, s) => sum + s.weight, 0);
  const capped = Math.min(raw, 100);
  const jitter = deterministicJitter(input);
  return clamp(Math.round(capped + jitter), 0, 100);
}

export function bandFor(score: number): RiskBand {
  if (score < riskThresholds.low) return 'low';
  if (score < riskThresholds.medium) return 'medium';
  return 'high';
}

function deterministicJitter(input: ScoreInput): number {
  const seedKey = `${input.user_id}|${input.payee_id}|${input.amount}|${input.hour}|${input.payee_account_age_days}`;
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Map to [-3, 3]
  const norm = ((h >>> 0) % 1000) / 1000;
  return Math.round((norm * 6 - 3) * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
