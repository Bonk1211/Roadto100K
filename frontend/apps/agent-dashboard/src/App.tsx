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
    <div className="flex h-screen w-screen overflow-hidden bg-app-gray">
      <Sidebar tab={tab} onTab={setTab} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={active.label} subtitle={active.description} />

        <main className="flex-1 overflow-auto px-8 py-6">
          {tab === 'agent-ops' && <AgentOpsScreen />}
          {tab === 'investigations' && <AlertsScreen />}
          {tab === 'network' && <NetworkScreen />}
          {tab === 'intelligence' && <StatsScreen />}
          {tab === 'model' && <SettingsScreen />}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <aside
      className="flex h-full w-[276px] shrink-0 flex-col text-white"
      style={{ background: 'linear-gradient(180deg, #071B33 0%, #0A2A4D 100%)' }}
    >
      <div className="px-6 py-7">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl font-bold"
            style={{ backgroundColor: '#FFE600', color: '#0055D4' }}
          >
            SS
          </div>
          <div>
            <p className="text-card-title leading-none">SafeSend</p>
            <p className="mt-1 text-caption text-white/60">PRD v3 analyst console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3">
        {NAV.map((item) => {
          const isActive = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
              style={{
                backgroundColor: isActive ? '#0055D4' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.82)',
                border: isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
              }}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-pill"
                style={{
                  backgroundColor: isActive ? '#FFE600' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#0055D4' : '#FFFFFF',
                }}
              >
                <NavIcon id={item.id} />
              </span>
              <div>
                <p className="text-base font-semibold">{item.label}</p>
                <p
                  className="text-small-label"
                  style={{ color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.55)' }}
                >
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      <footer className="px-6 py-5 text-caption text-white/60">
        <p className="font-semibold text-white">Agent Aisha</p>
        <p>Fraud Operations · Shift PM</p>
      </footer>
    </aside>
  );
}

function TopBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header
      className="flex items-center justify-between bg-white px-8 py-5"
      style={{ borderBottom: '1px solid #E5E7EB' }}
    >
      <div>
        <p className="text-small-label uppercase tracking-wide text-muted-text">
          SafeSend Agent Console
        </p>
        <h1 className="mt-1 text-page-title text-text-primary">{title}</h1>
        <p className="text-caption text-muted-text">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <span
          className="inline-flex items-center gap-2 rounded-pill px-4 py-2 text-small-label font-semibold"
          style={{ backgroundColor: '#ECFDF5', color: '#166534' }}
        >
          <span
            className="inline-block h-2 w-2 rounded-pill"
            style={{ backgroundColor: '#16A34A' }}
          />
          Pipeline live
        </span>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-pill font-bold"
          style={{ backgroundColor: '#005BAC', color: '#FFFFFF' }}
        >
          A
        </div>
      </div>
    </header>
  );
}

function NavIcon({ id }: { id: Tab }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
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
