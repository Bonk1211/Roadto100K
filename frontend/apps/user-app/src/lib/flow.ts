export type DoneStatus =
  | 'success'
  | 'cancelled'
  | 'reported'
  | 'overridden'
  | 'soft_warn_proceed'
  | 'soft_warn_cancelled';

export function createSessionId(): string {
  return `sess-${crypto.randomUUID()}`;
}
