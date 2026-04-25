import { useLocation, useNavigate } from 'react-router-dom';

type TabKey = 'home' | 'pay' | 'rewards' | 'finance' | 'profile';

interface Tab {
  key: TabKey;
  label: string;
  to: string;
  icon: (active: boolean) => JSX.Element;
}

const tabs: Tab[] = [
  {
    key: 'home',
    label: 'Home',
    to: '/home',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z"
          stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={a ? 'currentColor' : 'none'} fillOpacity={a ? 0.12 : 0}/>
      </svg>
    ),
  },
  {
    key: 'pay',
    label: 'Pay',
    to: '/home',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    key: 'rewards',
    label: 'Rewards',
    to: '/home',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8 7.1 17.2 8 11.7 4 7.8l5.5-.8L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'finance',
    label: 'Finance',
    to: '/home',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 19V5M4 19h16M8 16v-6M12 16V8M16 16v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'profile',
    label: 'Profile',
    to: '/home',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey: TabKey = location.pathname.startsWith('/home') ? 'home' : 'home';

  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-white border-t border-border-gray pt-2 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <button
              key={t.key}
              onClick={() => navigate(t.to)}
              className="flex flex-col items-center gap-0.5 py-1.5"
            >
              <span className={active ? 'text-tng-blue' : 'text-muted-text'}>
                {t.icon(active)}
              </span>
              <span className={`text-[11px] font-semibold ${active ? 'text-tng-blue' : 'text-muted-text'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
