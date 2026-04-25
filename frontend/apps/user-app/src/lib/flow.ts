import type { Payee, ScreenTransactionResponse } from 'shared';

export interface TransferAmountState {
  amount: number;
  note: string;
  sessionId: string;
}

export interface TransferConfirmState extends TransferAmountState {
  payee: Payee;
}

export interface InterceptState extends TransferConfirmState {
  screening: ScreenTransactionResponse;
}

export type DoneStatus =
  | 'success'
  | 'cancelled'
  | 'reported'
  | 'overridden'
  | 'soft_warn_proceed'
  | 'soft_warn_cancelled';

export interface DoneState {
  payee?: Payee;
  amount?: number;
  status?: DoneStatus;
}

export function createSessionId(): string {
  return `sess-${crypto.randomUUID()}`;
}
