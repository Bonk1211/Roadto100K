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
  eyebrow,
}: FlowHeaderProps) {
  const badge = (
    <div className="flex flex-wrap items-center gap-2">
      {eyebrow ? (
        <div
          className={
            theme === 'security'
              ? 'rounded-pill bg-electric-yellow px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-royal-blue shadow-yellow-depth'
              : 'section-label'
          }
        >
          {eyebrow}
        </div>
      ) : null}
      {step ? (
        <div
          className={
            theme === 'security'
              ? 'rounded-pill border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85'
              : 'rounded-pill border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-tng-blue shadow-sm'
          }
        >
          {step}
        </div>
      ) : null}
    </div>
  );

  return (
    <TopBar
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      right={right}
      theme={theme}
      badge={badge}
    />
  );
}
