import { useLocation, useNavigate } from 'react-router-dom';
import type { Payee } from 'shared';
import type { DoneStatus } from '../lib/flow';
import { formatRM } from '../lib/format';

interface NavState {
  payee?: Payee;
  amount?: number;
  status?: DoneStatus;
}

const COPY: Record<DoneStatus, {
  badge: string;
  title: string;
  body: string;
  tone: 'safe' | 'risk' | 'pending';
}> = {
  success: {
    badge: 'Transfer complete',
    title: 'Money sent successfully',
    body: 'The recipient will receive funds in seconds via DuitNow.',
    tone: 'safe',
  },
  cancelled: {
    badge: 'Transfer cancelled',
    title: 'Your money is safe',
    body: 'No funds left your wallet. Good call — when in doubt, always pause.',
    tone: 'safe',
  },
  reported: {
    badge: 'Reported to SafeSend',
    title: 'Thank you for reporting',
    body: 'Our fraud team has been notified and the recipient account will be reviewed.',
    tone: 'pending',
  },
  overridden: {
    badge: 'Transfer sent',
    title: 'You proceeded against our warning',
    body: 'If anything feels wrong later, contact TnG support immediately.',
    tone: 'risk',
  },
  soft_warn_proceed: {
    badge: 'Transfer sent',
    title: 'You proceeded after a warning',
    body: 'SafeSend recorded your choice. If anything feels off, contact TnG support immediately.',
    tone: 'pending',
  },
  soft_warn_cancelled: {
    badge: 'Transfer cancelled',
    title: 'You stopped after a warning',
    body: 'No money left your wallet, and SafeSend recorded the cancelled transfer for review.',
    tone: 'safe',
  },
};

export default function Done() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as NavState | null) ?? {};
  const status: DoneStatus = state.status ?? 'success';
  const copy = COPY[status];
  const amount = state.amount ?? 0;
  const payee = state.payee;

  return (
    <div className="phone-frame flex flex-col">
      <main className="flex-1 px-4 pt-12 pb-6 flex flex-col items-center text-center">
        {/* Hero icon */}
        <div
          className={[
            'w-20 h-20 rounded-full grid place-items-center mb-5',
            copy.tone === 'safe' ? 'bg-success-green/15 text-success-green' : '',
            copy.tone === 'risk' ? 'bg-risk-red/15 text-risk-red' : '',
            copy.tone === 'pending' ? 'bg-pending-orange/15 text-pending-orange' : '',
          ].join(' ')}
        >
          {copy.tone === 'safe' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {copy.tone === 'risk' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.41 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {copy.tone === 'pending' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        <span
          className={[
            'px-2.5 py-1 rounded-pill text-[11px] font-bold uppercase tracking-wider',
            copy.tone === 'safe' ? 'bg-success-green/15 text-success-green' : '',
            copy.tone === 'risk' ? 'bg-risk-red/15 text-risk-red' : '',
            copy.tone === 'pending' ? 'bg-pending-orange/15 text-pending-orange' : '',
          ].join(' ')}
        >
          {copy.badge}
        </span>

        <h1 className="text-[24px] font-extrabold text-text-primary mt-3 leading-tight">
          {copy.title}
        </h1>
        <p className="text-[14px] text-muted-text mt-2 max-w-xs">{copy.body}</p>

        {amount > 0 && payee && (
          <div className="mt-6 w-full card p-4 text-left">
            <div className="text-[11px] font-semibold text-muted-text uppercase tracking-wider">
              {status === 'cancelled' ? 'Would have sent' : 'Transaction'}
            </div>
            <div className="flex items-center justify-between mt-2">
              <div>
                <div className="text-[14px] font-semibold text-text-primary">{payee.name}</div>
                <div className="text-[12px] text-muted-text font-mono">
                  TnG · {payee.account}
                </div>
              </div>
              <div className="text-[20px] font-extrabold text-text-primary">
                {formatRM(amount)}
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <button onClick={() => navigate('/home')} className="btn-primary">
          Back to wallet
        </button>
        {status !== 'success' && (
          <button onClick={() => navigate('/transfer')} className="btn-ghost">
            Start a new transfer
          </button>
        )}
      </div>
    </div>
  );
}
