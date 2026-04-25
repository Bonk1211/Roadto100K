export type Lang = 'en' | 'bm';

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
}

export default function BilingualToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex bg-white rounded-pill border border-border-gray p-1 shadow-card">
      {(['en', 'bm'] as const).map((l) => {
        const active = value === l;
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={[
              'px-3.5 h-7 rounded-pill text-[12px] font-bold uppercase tracking-wider transition-colors',
              active ? 'bg-royal-blue text-white' : 'text-muted-text',
            ].join(' ')}
          >
            {l === 'en' ? 'EN' : 'BM'}
          </button>
        );
      })}
    </div>
  );
}
