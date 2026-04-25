import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoPayee, demoAmount, mockPayees } from 'shared';

export default function Transfer() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(demoPayee.account);
  const [amount, setAmount] = useState<string>(String(demoAmount));
  const [note, setNote] = useState('Bantuan kecemasan');

  const onContinue = () => {
    const payee = mockPayees.find((p) => p.account === account) ?? demoPayee;
    const numericAmount = parseFloat(amount) || 0;
    navigate('/confirm', {
      state: {
        payee,
        amount: numericAmount,
        note,
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
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-[18px] font-bold">Transfer</div>
          <div className="text-[12px] opacity-80">DuitNow / Account number</div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 space-y-4">
        {/* Recipient input card */}
        <div className="bg-soft-blue-surface rounded-xl p-4 border border-sky-blue">
          <label className="block text-[12px] font-semibold text-tng-blue mb-2 uppercase tracking-wider">
            Recipient
          </label>
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="Phone or account number"
            className="w-full bg-white border border-border-gray rounded-md px-3 h-12 text-[16px] font-semibold text-text-primary placeholder:text-muted-text focus:outline-none focus:border-tng-blue"
          />
          <div className="mt-2 text-[12px] text-muted-text">
            We will look up the registered name in the next step.
          </div>
        </div>

        {/* Amount input card */}
        <div className="bg-soft-blue-surface rounded-xl p-4 border border-sky-blue">
          <label className="block text-[12px] font-semibold text-tng-blue mb-2 uppercase tracking-wider">
            Amount (MYR)
          </label>
          <div className="flex items-center bg-white border border-border-gray rounded-md px-3 h-14">
            <span className="text-[18px] font-bold text-muted-text mr-2">RM</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="flex-1 bg-transparent text-[24px] font-bold text-text-primary focus:outline-none"
            />
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {[100, 500, 1000, 8000].map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className="px-3 h-7 rounded-pill bg-white border border-border-gray text-[12px] font-semibold text-tng-blue"
              >
                RM {q.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="bg-soft-blue-surface rounded-xl p-4 border border-sky-blue">
          <label className="block text-[12px] font-semibold text-tng-blue mb-2 uppercase tracking-wider">
            Note (optional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is this for?"
            className="w-full bg-white border border-border-gray rounded-md px-3 h-11 text-[14px] text-text-primary placeholder:text-muted-text focus:outline-none focus:border-tng-blue"
          />
        </div>
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={onContinue}
          disabled={!account || !amount}
          className="btn-primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
