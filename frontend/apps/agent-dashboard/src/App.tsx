import { useState } from 'react';
import { AgentOpsScreen } from './screens/AgentOpsScreen.js';
import { AlertsScreen } from './screens/AlertsScreen.js';
import { NetworkScreen } from './screens/NetworkScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { StatsScreen } from './screens/StatsScreen.js';

type Tab = 'agent-ops' | 'investigations' | 'network' | 'intelligence' | 'model';

const NAV: { id: Tab; label: string; description: string }[] = [
  {
    id: 'agent-ops',
    label: 'Agent Ops',
    description: 'Autonomous fraud verification team',
  },
  {
    id: 'investigations',
    label: 'Investigations',
    description: 'Queue, detail, containment',
  },
  {
    id: 'network',
    label: 'Network',
    description: 'Network graph',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    description: 'Risk mix and trends',
  },
  {
    id: 'model',
    label: 'Model Health',
    description: 'Retraining and coverage',
  },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('agent-ops');
  const active = NAV.find((item) => item.id === tab)!;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-app-gray">
      <TopNav tab={tab} onTab={setTab} />
      <PageHeader title={active.label} subtitle={active.description} />

      <main className="flex-1 overflow-auto px-8 py-6">
        {tab === 'agent-ops' && <AgentOpsScreen />}
        {tab === 'investigations' && <AlertsScreen />}
        {tab === 'network' && <NetworkScreen />}
        {tab === 'intelligence' && <StatsScreen />}
        {tab === 'model' && <SettingsScreen />}
      </main>
    </div>
  );
}

function TopNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <header
      className="flex h-16 shrink-0 items-center gap-6 px-6 text-white"
      style={{ background: 'linear-gradient(90deg, #071B33 0%, #0A2A4D 60%, #0A2A4D 100%)' }}
    >
      <div className="flex shrink-0 items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl font-bold"
          style={{ backgroundColor: '#FFE600', color: '#0055D4' }}
        >
          SS
        </div>
        <div className="leading-tight">
          <p className="text-feature-title">SafeSend</p>
          <p className="text-small-label text-white/60">Analyst console</p>
        </div>
      </div>

      <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
        {NAV.map((item) => {
          const isActive = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className="flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-small-label font-semibold transition-colors"
              style={{
                backgroundColor: isActive ? '#0055D4' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.78)',
                border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
              }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-pill"
                style={{
                  backgroundColor: isActive ? '#FFE600' : 'rgba(255,255,255,0.10)',
                  color: isActive ? '#0055D4' : '#FFFFFF',
                }}
              >
                <NavIcon id={item.id} />
              </span>
              <span className="text-base">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-pill px-3 py-1 text-small-label font-semibold"
          style={{ backgroundColor: '#ECFDF5', color: '#166534' }}
        >
          <span className="inline-block h-2 w-2 rounded-pill" style={{ backgroundColor: '#16A34A' }} />
          Pipeline live
        </span>
        <div className="leading-tight text-right">
          <p className="text-small-label font-semibold text-white">Agent Aisha</p>
          <p className="text-[10px] text-white/55">Fraud Ops · Shift PM</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-pill font-bold"
          style={{ backgroundColor: '#FFE600', color: '#0055D4' }}
        >
          A
        </div>
      </div>
    </header>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="flex items-end justify-between bg-white px-8 py-4"
      style={{ borderBottom: '1px solid #E5E7EB' }}
    >
      <div>
        <p className="text-small-label uppercase tracking-wide text-muted-text">
          SafeSend Agent Console
        </p>
        <h1 className="mt-1 text-page-title text-text-primary">{title}</h1>
        <p className="text-caption text-muted-text">{subtitle}</p>
      </div>
    </div>
  );
}

function NavIcon({ id }: { id: Tab }) {
  const commonProps = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (id === 'agent-ops') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3" />
        <circle cx="5" cy="6" r="1.5" />
        <circle cx="19" cy="6" r="1.5" />
        <circle cx="5" cy="18" r="1.5" />
        <circle cx="19" cy="18" r="1.5" />
        <path d="M6.4 7.2 9.8 10.2" />
        <path d="M17.6 7.2 14.2 10.2" />
        <path d="M6.4 16.8 9.8 13.8" />
        <path d="M17.6 16.8 14.2 13.8" />
      </svg>
    );
  }

  if (id === 'investigations') {
    return (
      <svg {...commonProps}>
        <path d="M4 5h16" />
        <path d="M4 12h10" />
        <path d="M4 19h7" />
        <circle cx="18" cy="12" r="3" />
      </svg>
    );
  }

  if (id === 'network') {
    return (
      <svg {...commonProps}>
        <circle cx="6" cy="7" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M8 8.5 10.5 16" />
        <path d="M16 7.5 13.5 16" />
        <path d="M8 7h8" />
      </svg>
    );
  }

  if (id === 'intelligence') {
    return (
      <svg {...commonProps}>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
        <path d="M3 19h18" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M4.9 4.9l2.8 2.8" />
      <path d="m16.3 16.3 2.8 2.8" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m4.9 19.1 2.8-2.8" />
      <path d="m16.3 7.7 2.8-2.8" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
