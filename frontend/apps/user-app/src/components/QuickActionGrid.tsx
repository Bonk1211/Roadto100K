import { useNavigate } from 'react-router-dom';
import type { UIlang } from 'shared';
import { t, type StringKey } from '../lib/i18n';

interface Action {
  key: string;
  labelKey: StringKey;
  icon: JSX.Element;
  to?: string;
}

interface Props {
  lang: UIlang;
}

const actions: Action[] = [
  {
    key: 'scan',
    labelKey: 'qaScan',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 13h2v2h-2zM15 15h2v2h-2z"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'pay',
    labelKey: 'qaPay',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 7h18v10H3zM3 11h18M7 15h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'transfer',
    labelKey: 'qaTransfer',
    to: '/transfer',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'reload',
    labelKey: 'qaReload',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      </svg>
    ),
  },
  {
    key: 'duitnow',
    labelKey: 'qaDuitNow',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'toll',
    labelKey: 'qaToll',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M5 20V9l7-5 7 5v11M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'parking',
    labelKey: 'qaParking',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M10 17V8h3.5a2.5 2.5 0 0 1 0 5H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'rewards',
    labelKey: 'qaRewards',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8 7.1 17.2 8 11.7 4 7.8l5.5-.8L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function QuickActionGrid({ lang }: Props) {
  const navigate = useNavigate();
  return (
    <div className="app-panel grid grid-cols-4 gap-x-2 gap-y-4 p-4">
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={() => a.to && navigate(a.to)}
          className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 active:bg-app-gray/70"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-soft-blue-surface text-tng-blue shadow-sm transition-transform group-active:scale-95">
            {a.icon}
          </span>
          <span className="text-[12px] font-semibold text-text-primary">{t(a.labelKey, lang)}</span>
        </button>
      ))}
    </div>
  );
}
