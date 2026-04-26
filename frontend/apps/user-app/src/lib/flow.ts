export type DoneStatus =
  | 'success'
  | 'cancelled'
  | 'reported'
  | 'overridden'
  | 'soft_warn_proceed'
  | 'soft_warn_cancelled';

function generateFallbackId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sess-${crypto.randomUUID()}`;
  }

  return `sess-${generateFallbackId()}`;
}
