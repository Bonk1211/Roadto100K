import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { currentUser, demoPayee, demoAmount, type Payee } from 'shared';
import { scoreTransaction } from '../lib/api';
import { formatRM, maskAccount } from '../lib/format';
import SafeSendBadge from '../components/SafeSendBadge';

interface NavState {
  payee?: Payee;
  amount?: number;
  note?: string;
}

export default function Confirm() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as NavState | null) ?? {};
  const payee: Payee = state.payee ?? demoPayee;
  const amount: number = state.amount ?? demoAmount;
  const note: string = state.note ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = !mockTransactionsKnown(payee.id);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await scoreTransaction({
        amount,
        payee_account_age_days: payee.account_age_days,
        is_new_payee: isNew,
        hour: new Date().getHours(),
        device_match: true,
        prior_txns_to_payee: 0,
        user_avg_30d: currentUser.user_avg_30d,
        payee_name: payee.name,
        payee_account: payee.account,
        user_id: currentUser.id,
      });

      if (result.band === 'high') {
        navigate('/intercept', {
          state: { payee, amount, note, score: result },
        });
      } else {
        navigate('/done', {
          state: { payee, amount, status: 'success' },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-frame flex flex-col">
      <header className="bg-tng-blue text-white px-4 pt-4 pb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 rounded-full grid place-items-center hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-[18px] font-bold">Confirm transfer</div>
          <div className="text-[12px] opacity-80">Please review carefully</div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 space-y-4">
        {/* Amount hero */}
        <div className="text-center py-2">
          <div className="text-[12px] font-semibold text-muted-text uppercase tracking-wider">
            You are sending
          </div>
          <div className="mt-2 text-[44px] font-extrabold text-text-primary leading-none tracking-tight">
            {formatRM(amount)}
          </div>
        </div>

        {/* Recipient card */}
        <div className="card p-4">
          <div className="text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-2">
            To
          </div>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-soft-blue-surface text-tng-blue grid place-items-center font-bold text-[18px] flex-shrink-0">
              {payee.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-card-title text-text-primary">{payee.name}</div>
                {isNew ? (
                  <span className="px-2 py-0.5 rounded-pill bg-pending-orange/15 text-pending-orange text-[11px] font-bold uppercase tracking-wider">
                    New payee
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-pill bg-success-green/15 text-success-green text-[11px] font-bold uppercase tracking-wider">
                    Known
                  </span>
                )}
              </div>
              <div className="text-[13px] text-muted-text font-mono mt-0.5">
                TnG · {maskAccount(payee.account)}
              </div>
              <div className="text-[12px] text-muted-text mt-1">
                Account opened {payee.account_age_days} days ago
              </div>
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div className="card divide-y divide-border-gray">
          <Row label="Transfer fee" value="Free" valueClass="text-success-green font-bold" />
          <Row label="From" value="TnG Wallet · Available" />
          {note && <Row label="Note" value={note} />}
          <Row
            label="Total"
            value={formatRM(amount)}
            valueClass="text-text-primary font-extrabold text-[18px]"
          />
        </div>

        {/* SafeSend trust strip */}
        <div className="flex items-center gap-2.5 px-1">
          <SafeSendBadge size="sm" />
          <span className="text-[12px] text-muted-text">
            Real-time scam check before money leaves your wallet.
          </span>
        </div>

        {error && (
          <div className="rounded-md bg-fraud-warning-bg border border-fraud-warning-border px-3 py-2 text-[13px] text-risk-red">
            {error}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={handleConfirm} disabled={loading} className="btn-primary">
          {loading ? 'Checking with SafeSend…' : `Confirm & Send ${formatRM(amount)}`}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-[13px] text-muted-text">{label}</span>
      <span className={`text-[14px] text-text-primary ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}

function mockTransactionsKnown(payeeId: string): boolean {
  // Demo logic: in this app, only `p_safe_*` count as known to the user.
  return payeeId.startsWith('p_safe_');
}
