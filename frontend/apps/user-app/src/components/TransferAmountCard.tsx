import { formatRM } from '../lib/format';

interface TransferAmountCardProps {
  amount: string;
  balance: number;
  onAmountChange: (value: string) => void;
  onMax: () => void;
}

export default function TransferAmountCard({
  amount,
  balance,
  onAmountChange,
  onMax,
}: TransferAmountCardProps) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-card">
      <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-text">
        Enter Amount
      </div>

      <div className="mt-6 flex items-end gap-2 text-[#98A2B3]">
        <span className="pb-2 text-[22px] font-bold">RM</span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent text-[56px] font-extrabold leading-none tracking-tight text-[#98A2B3] placeholder:text-[#98A2B3] focus:outline-none"
        />
      </div>

      <div className="mt-6 border-t border-[#E9EEF6] pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] text-muted-text">
            Wallet Balance: <span className="font-extrabold text-text-primary">{formatRM(balance)}</span>
          </div>
          <button
            type="button"
            onClick={onMax}
            className="rounded-pill bg-soft-blue-surface px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-tng-blue"
          >
            Max
          </button>
        </div>
      </div>
    </section>
  );
}
