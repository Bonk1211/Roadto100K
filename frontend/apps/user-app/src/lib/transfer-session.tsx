import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { demoPayee, type Payee, type ScreenTransactionResponse } from 'shared';
import { DoneStatus, createSessionId } from './flow';

const INITIAL_WALLET_BALANCE = 12450.8;

export interface TransferDraft {
  sessionId: string;
  amount: number;
  note: string;
  payee: Payee | null;
  screening: ScreenTransactionResponse | null;
  status: DoneStatus | null;
  committed: boolean;
}

interface TransferSessionValue {
  walletBalance: number;
  transfer: TransferDraft;
  remainingBalance: number;
  startFreshTransfer: () => void;
  updateTransfer: (patch: Partial<TransferDraft>) => void;
  setTransferPayee: (payee: Payee) => void;
  setTransferScreening: (screening: ScreenTransactionResponse | null) => void;
  completeTransfer: (status: DoneStatus) => void;
}

interface TransferSessionState {
  walletBalance: number;
  transfer: TransferDraft;
}

const TransferSessionContext = createContext<TransferSessionValue | null>(null);

function createDraft(): TransferDraft {
  return {
    sessionId: createSessionId(),
    amount: 0,
    note: 'Transfer funds',
    payee: demoPayee,
    screening: null,
    status: null,
    committed: false,
  };
}

function shouldDeduct(status: DoneStatus) {
  return status === 'success' || status === 'overridden' || status === 'soft_warn_proceed';
}

export function TransferSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<TransferSessionState>(() => ({
    walletBalance: INITIAL_WALLET_BALANCE,
    transfer: createDraft(),
  }));

  const startFreshTransfer = useCallback(() => {
    setSession((current) => ({
      ...current,
      transfer: createDraft(),
    }));
  }, []);

  const updateTransfer = useCallback((patch: Partial<TransferDraft>) => {
    setSession((current) => ({
      ...current,
      transfer: {
        ...current.transfer,
        ...patch,
      },
    }));
  }, []);

  const setTransferPayee = useCallback((payee: Payee) => {
    setSession((current) => ({
      ...current,
      transfer: {
        ...current.transfer,
        payee,
      },
    }));
  }, []);

  const setTransferScreening = useCallback((screening: ScreenTransactionResponse | null) => {
    setSession((current) => ({
      ...current,
      transfer: {
        ...current.transfer,
        screening,
      },
    }));
  }, []);

  const completeTransfer = useCallback((status: DoneStatus) => {
    setSession((current) => {
      const deduct = shouldDeduct(status) && !current.transfer.committed;
      return {
        walletBalance: deduct
          ? current.walletBalance - current.transfer.amount
          : current.walletBalance,
        transfer: {
          ...current.transfer,
          status,
          committed: current.transfer.committed || shouldDeduct(status),
        },
      };
    });
  }, []);

  const value = useMemo<TransferSessionValue>(() => ({
    walletBalance: session.walletBalance,
    transfer: session.transfer,
    remainingBalance: session.walletBalance - session.transfer.amount,
    startFreshTransfer,
    updateTransfer,
    setTransferPayee,
    setTransferScreening,
    completeTransfer,
  }), [
    session,
    startFreshTransfer,
    updateTransfer,
    setTransferPayee,
    setTransferScreening,
    completeTransfer,
  ]);

  return (
    <TransferSessionContext.Provider value={value}>
      {children}
    </TransferSessionContext.Provider>
  );
}

export function useTransferSession() {
  const context = useContext(TransferSessionContext);

  if (!context) {
    throw new Error('useTransferSession must be used inside TransferSessionProvider');
  }

  return context;
}
