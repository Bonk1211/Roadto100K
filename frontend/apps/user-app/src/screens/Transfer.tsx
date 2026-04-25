import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAmount } from 'shared';
import { createSessionId } from '../lib/flow';
import { formatRM } from '../lib/format';

export default function Transfer() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>(String(demoAmount));
  const [note, setNote] = useState('Bantuan kecemasan');

  const numericAmount = parseFloat(amount) || 0;

  const onContinue = () => {
    navigate('/payee', {
      state: {
        amount: numericAmount,
        note,
        sessionId: createSessionId(),
      },
    });
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
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-[18px] font-bold">Transfer</div>
          <div className="text-[12px] opacity-80">Step 1 of 3 - enter amount</div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 space-y-4">
        <div className="card p-4">
          <div className="text-[12px] font-semibold text-tng-blue uppercase tracking-wider mb-2">
            Amount (MYR)
          </div>
          <div className="flex items-center bg-soft-blue-surface rounded-xl px-4 h-20 border border-sky-blue">
            <span className="text-[18px] font-bold text-muted-text mr-3">RM</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="flex-1 bg-transparent text-[36px] font-extrabold text-text-primary focus:outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {[250, 800, 2500, 8000].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(String(quickAmount))}
                className="px-3 h-8 rounded-pill bg-white border border-border-gray text-[12px] font-semibold text-tng-blue"
              >
                {formatRM(quickAmount)}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[12px] font-semibold text-tng-blue uppercase tracking-wider mb-2">
            Note
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is this transfer for?"
            className="w-full bg-white border border-border-gray rounded-md px-3 h-11 text-[14px] text-text-primary placeholder:text-muted-text focus:outline-none focus:border-tng-blue"
          />
          <div className="mt-2 text-[12px] text-muted-text">
            SafeSend will use the next step to check who you are sending to before final confirmation.
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={onContinue} disabled={numericAmount <= 0} className="btn-primary">
          Continue to payee
        </button>
      </div>
    </div>
  );
}
