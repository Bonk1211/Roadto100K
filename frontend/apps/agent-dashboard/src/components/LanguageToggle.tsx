import type { UIlang } from 'shared';

interface Props {
  value: UIlang;
  onChange: (lang: UIlang) => void;
}

export function LanguageToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-pill p-1"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #C7DCFB' }}
    >
      {(['en', 'bm'] as const).map((lang) => {
        const active = value === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            className="h-7 rounded-pill px-3 text-small-label font-bold uppercase tracking-wide transition-colors"
            style={{
              backgroundColor: active ? '#0055D4' : 'transparent',
              color: active ? '#FFFFFF' : '#6B7280',
            }}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}