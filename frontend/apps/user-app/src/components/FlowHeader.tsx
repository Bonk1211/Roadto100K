import type { ReactNode } from 'react';
import TopBar from './TopBar';

interface FlowHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  theme?: 'light' | 'security';
  step?: string;
  eyebrow?: string;
}

export default function FlowHeader({
  title,
  subtitle,
  onBack,
  right,
  theme = 'light',
  step,
}: FlowHeaderProps) {
  const surfaceTheme = theme === 'security' ? 'security' : 'brand';
  const badge = (
    <div className="flex flex-wrap items-center gap-2">
      {step ? (
        <div
          className={
            theme === 'security'
              ? 'rounded-pill border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85'
              : 'rounded-pill border border-white/10 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white'
          }
        >
          {step}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={[
        'relative z-30',
        theme === 'security'
          ? '-mx-4 bg-dark-security-blue px-4'
          : '-mx-4 bg-[linear-gradient(180deg,#005BAC_0%,#004B91_100%)] px-4 pb-10 shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]',
      ].join(' ')}
    >
      <TopBar
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        right={right}
        theme={surfaceTheme}
        badge={badge}
      />
    </div>
  );
}
