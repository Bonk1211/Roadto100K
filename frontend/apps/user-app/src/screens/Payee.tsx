import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { demoPayee, mockPayees, type Payee } from 'shared';
import type { TransferAmountState } from '../lib/flow';

export default function PayeeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as TransferAmountState | null) ?? null;
  const [identifier, setIdentifier] = useState<string>(demoPayee.account);

  const payee = useMemo<Payee>(() => {
    return (
      mockPayees.find(
        (candidate) =>
          candidate.account === identifier ||
          candidate.phone === identifier ||
          candidate.id === identifier,
      ) ?? demoPayee
    );
  }, [identifier]);

  if (!state?.amount) {
    navigate('/transfer', { replace: true });
    return null;
  }

  return (
    <div className="phone-frame flex flex-col">
      <header className="bg-tng-blue text-white px-4 pt-4 pb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 rounded-full grid place-items-center hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-[18px] font-bold">Transfer</div>
          <div className="text-[12px] opacity-80">Step 2 of 3 - choose payee</div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 space-y-4">
        <div className="card p-4">
          <label className="block text-[12px] font-semibold text-tng-blue mb-2 uppercase tracking-wider">
            Recipient phone or account
          </label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="60123456789 or account number"
            className="w-full bg-white border border-border-gray rounded-md px-3 h-12 text-[16px] font-semibold text-text-primary placeholder:text-muted-text focus:outline-none focus:border-tng-blue"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {mockPayees.slice(0, 4).map((quickPayee) => (
              <button
                key={quickPayee.id}
                onClick={() => setIdentifier(quickPayee.account)}
                className="px-3 py-2 rounded-lg border border-border-gray bg-white text-left"
              >
                <div className="text-[12px] font-bold text-text-primary">{quickPayee.name}</div>
                <div className="text-[11px] text-muted-text font-mono">{quickPayee.account}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-2">
            Payee lookup
          </div>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-soft-blue-surface text-tng-blue grid place-items-center font-bold text-[18px]">
              {payee.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-text-primary">{payee.name}</div>
              <div className="text-[13px] text-muted-text font-mono">{payee.account}</div>
              <div className="mt-1 text-[12px] text-muted-text">
                Account age: {payee.account_age_days} days
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-soft-blue-surface border border-sky-blue p-3 text-[12px] text-tng-blue">
            SafeSend will check this payee against scam patterns when you confirm the transfer.
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() =>
            navigate('/confirm', {
              state: {
                ...state,
                payee,
              },
            })
          }
          className="btn-primary"
        >
          Review transfer
        </button>
      </div>
    </div>
  );
}
