import type { Payee } from 'shared';

interface TransferRecipientCardProps {
  payee: Pick<Payee, 'name' | 'phone'>;
  onChange?: () => void;
}

export default function TransferRecipientCard({
  payee,
  onChange,
}: TransferRecipientCardProps) {
  const initials = payee.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <section className="rounded-[24px] bg-white p-5 shadow-elevated">
      <div className="flex items-center gap-4">
        <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-soft-blue-surface text-[18px] font-extrabold text-tng-blue">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-card-title text-text-primary">{payee.name}</div>
            <span className="rounded-pill bg-safe-notice-border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-success-green">
              Verified
            </span>
          </div>
          <div className="mt-1 text-[14px] text-muted-text">{payee.phone ?? 'Recipient selected next'}</div>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="text-[14px] font-semibold text-tng-blue"
        >
          Change
        </button>
      </div>
    </section>
  );
}
