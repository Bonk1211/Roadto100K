interface ActivityRowProps {
  avatarLabel: string;
  title: string;
  meta: string;
  amount: string;
  status?: string;
}

export default function ActivityRow({
  avatarLabel,
  title,
  meta,
  amount,
  status = 'Completed',
}: ActivityRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-3 active:bg-app-gray/80">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-soft-blue-surface font-bold text-tng-blue shadow-sm">
        {avatarLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-text-primary">{title}</div>
        <div className="mt-0.5 text-[12px] text-muted-text">{meta}</div>
      </div>
      <div className="text-right">
        <div className="text-[14px] font-bold text-text-primary">{amount}</div>
        <div className="mt-0.5 text-[11px] font-semibold text-success-green">{status}</div>
      </div>
    </li>
  );
}
