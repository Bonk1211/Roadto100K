import { formatRM } from '../lib/format';

interface BalanceSnapshotCardProps {
  walletBalance: number;
  amount: number;
  remainingBalance: number;
}

export default function BalanceSnapshotCard({
  walletBalance,
  amount,
  remainingBalance,
}: BalanceSnapshotCardProps) {
  return (
    <section className="app-panel divide-y divide-border-gray/80 overflow-hidden">
      <Row label="Wallet balance" value={formatRM(walletBalance)} />
      <Row label="Transfer amount" value={formatRM(amount)} />
      <Row
        label="Remaining balance"
        value={formatRM(remainingBalance)}
        valueClass="text-[16px] font-extrabold text-text-primary"
      />
    </section>
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
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-[13px] text-muted-text">{label}</span>
      <span className={`text-right text-[14px] text-text-primary ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}
