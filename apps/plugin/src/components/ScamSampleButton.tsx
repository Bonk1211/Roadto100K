interface Props {
  label: string;
  preview: string;
  active: boolean;
  onClick: () => void;
}

export default function ScamSampleButton({ label, preview, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left rounded-xl border p-3 transition-all',
        active
          ? 'bg-soft-blue-surface border-tng-blue shadow-card'
          : 'bg-white border-border-gray hover:border-tng-blue/50',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'w-1.5 h-1.5 rounded-full',
            active ? 'bg-tng-blue' : 'bg-muted-text/50',
          ].join(' ')}
        />
        <span className="text-[12px] font-bold uppercase tracking-wider text-tng-blue">
          {label}
        </span>
      </div>
      <div className="text-[12px] text-muted-text mt-1.5 line-clamp-2 leading-snug">
        {preview}
      </div>
    </button>
  );
}
