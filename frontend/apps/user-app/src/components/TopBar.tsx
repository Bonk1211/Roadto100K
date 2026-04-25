import type { ReactNode } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  theme?: 'light' | 'brand' | 'security';
  badge?: ReactNode;
}

export default function TopBar({
  title,
  subtitle,
  onBack,
  right,
  theme = 'light',
  badge,
}: TopBarProps) {
  const themeClass =
    theme === 'security'
      ? 'text-white'
      : theme === 'brand'
        ? 'text-white'
        : 'text-text-primary';

  const backClass =
    theme === 'light'
      ? 'border border-white/60 bg-white/85 text-text-primary backdrop-blur'
      : 'border border-white/15 bg-white/12 text-white';

  return (
    <header className={['relative z-10 px-4 pt-5 pb-4', themeClass].join(' ')}>
      <div className="flex items-start gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Back"
            className={['mt-0.5 grid h-10 w-10 place-items-center rounded-full transition-colors', backClass].join(' ')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          {badge ? <div className="mb-2">{badge}</div> : null}
          <h1 className="text-[22px] font-extrabold leading-tight">{title}</h1>
          {subtitle ? (
            <p className={theme === 'light' ? 'mt-1 text-[12px] text-muted-text' : 'mt-1 text-[12px] text-white/75'}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}
