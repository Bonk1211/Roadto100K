interface RecipientSummaryCardProps {
  name: string;
  detail: string;
  subdetail?: string;
  badge?: string;
}

export default function RecipientSummaryCard({
  name,
  detail,
  subdetail,
  badge,
}: RecipientSummaryCardProps) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-start gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-[linear-gradient(180deg,#F8FBFF_0%,#EAF3FF_100%)] text-[18px] font-bold text-tng-blue shadow-sm">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-card-title text-text-primary">{name}</div>
          {badge ? (
            <span className="rounded-pill bg-safe-notice-border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-success-green">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-[13px] font-mono text-muted-text">{detail}</div>
      </div>
    </div>
  );
}
