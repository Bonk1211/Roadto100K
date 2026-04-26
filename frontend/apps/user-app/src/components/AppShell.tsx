import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  footer?: ReactNode;
  theme?: 'light' | 'security';
  contentClassName?: string;
}

export default function AppShell({
  children,
  footer,
  theme = 'light',
  contentClassName = '',
}: AppShellProps) {
  const security = theme === 'security';

  return (
    <div
      className={[
        'phone-frame flex h-full flex-col overflow-hidden',
        security ? 'bg-dark-security-blue text-white' : 'text-text-primary',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={[
            'absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl',
            security ? 'bg-electric-yellow/10' : 'bg-sky-blue/90',
          ].join(' ')}
        />
        <div
          className={[
            'absolute top-40 -left-20 h-64 w-64 rounded-full blur-3xl',
            security ? 'bg-royal-blue/30' : 'bg-white/90',
          ].join(' ')}
        />
        <div
          className={[
            'absolute bottom-24 right-[-72px] h-56 w-56 rounded-full blur-3xl',
            security ? 'bg-risk-red/10' : 'bg-electric-yellow/20',
          ].join(' ')}
        />
      </div>

      <div className="relative z-10 flex h-full min-h-0 w-full min-w-0 flex-col">
        <main className={['app-scroll-hidden flex-1 min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-5', contentClassName].join(' ').trim()}>
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}
