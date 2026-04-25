import type { UIlang } from 'shared';

type Confidence = 'low' | 'medium' | 'high';

interface Props {
  confidence: Confidence;
  score?: number;
  lang: UIlang;
  size?: 'sm' | 'lg';
}

const CONFIG: Record<
  Confidence,
  { label: { en: string; bm: string }; segments: number; color: string; bg: string; sub: string }
> = {
  low: {
    label: { en: 'Low confidence', bm: 'Yakin rendah' },
    segments: 1,
    color: '#16A34A',
    bg: '#ECFDF5',
    sub: '#166534',
  },
  medium: {
    label: { en: 'Medium confidence', bm: 'Yakin sederhana' },
    segments: 2,
    color: '#F97316',
    bg: '#FFF7ED',
    sub: '#9A3412',
  },
  high: {
    label: { en: 'High confidence', bm: 'Sangat yakin' },
    segments: 3,
    color: '#DC2626',
    bg: '#FEF2F2',
    sub: '#991B1B',
  },
};

export default function ConfidenceMeter({ confidence, score, lang, size = 'lg' }: Props) {
  const cfg = CONFIG[confidence];
  const segH = size === 'lg' ? 12 : 8;
  const segGap = 4;
  const labelText = lang === 'en' ? cfg.label.en : cfg.label.bm;

  return (
    <div
      className="rounded-xl px-4 py-3 inline-flex flex-col gap-2"
      style={{ backgroundColor: cfg.bg }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`font-bold uppercase tracking-wider ${size === 'lg' ? 'text-[12px]' : 'text-[10px]'}`}
          style={{ color: cfg.sub }}
        >
          {lang === 'en' ? 'SafeSend AI' : 'SafeSend AI'}
        </span>
        {score != null && (
          <span
            className="text-[10px] font-mono font-bold opacity-60"
            style={{ color: cfg.sub }}
          >
            {score}/100
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5" aria-label={labelText}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="rounded-sm transition-colors"
            style={{
              width: size === 'lg' ? 28 : 20,
              height: segH,
              marginRight: i < 2 ? segGap : 0,
              backgroundColor: i < cfg.segments ? cfg.color : 'rgba(15,23,42,0.08)',
            }}
          />
        ))}
      </div>

      <span
        className={`font-bold ${size === 'lg' ? 'text-[14px]' : 'text-[12px]'}`}
        style={{ color: cfg.color }}
      >
        {labelText}
      </span>
    </div>
  );
}
