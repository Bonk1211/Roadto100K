import { useState } from 'react';
import { AgentOpsScreen } from './screens/AgentOpsScreen.js';
import { NetworkScreen } from './screens/NetworkScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';

type Tab = 'agent-ops' | 'network' | 'model';

const NAV: { id: Tab; label: string; description: string }[] = [
  {
    id: 'agent-ops',
    label: 'Agent Ops',
    description: 'Autonomous fraud verification team',
  },
  {
    id: 'network',
    label: 'Network',
    description: 'Network graph',
  },
  {
    id: 'model',
    label: 'Model Health',
    description: 'Retraining and coverage',
  },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('agent-ops');

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ backgroundColor: '#f8fafc' }}>
      <TopNav tab={tab} onTab={setTab} />

      <main className="flex-1 overflow-auto px-8 py-6">
        {tab === 'agent-ops' && <AgentOpsScreen />}
        {tab === 'network' && <NetworkScreen />}
        {tab === 'model' && <SettingsScreen />}
      </main>
    </div>
  );
}

function TopNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <header
      className="flex h-16 shrink-0 items-center gap-6 px-6"
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e0e2e6',
        color: '#181d26',
      }}
    >
      <div className="flex shrink-0 items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center font-bold"
          style={{
            backgroundColor: '#1b61c9',
            color: '#ffffff',
            borderRadius: 12,
            letterSpacing: '0.12px',
            boxShadow: 'rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
          }}
        >
          SS
        </div>
        <div className="leading-tight">
          <p className="text-feature-title" style={{ color: '#181d26' }}>SafeSend</p>
          <p className="text-small-label" style={{ color: 'rgba(4,14,32,0.69)' }}>Analyst console</p>
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
              className="flex shrink-0 items-center gap-2 px-3 py-2 text-small-label transition-colors"
              style={{
                backgroundColor: isActive ? '#eef4fc' : 'transparent',
                color: isActive ? '#1b61c9' : 'rgba(4,14,32,0.69)',
                fontWeight: isActive ? 600 : 500,
                borderRadius: 12,
                letterSpacing: '0.08px',
              }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center"
                style={{ color: isActive ? '#1b61c9' : 'rgba(4,14,32,0.55)' }}
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
          className="inline-flex items-center gap-2 px-3 py-1 text-small-label"
          style={{
            backgroundColor: '#ECFDF5',
            color: '#166534',
            borderRadius: 999,
            fontWeight: 500,
            border: '1px solid #BBF7D0',
          }}
        >
          <span className="inline-block h-2 w-2 rounded-pill" style={{ backgroundColor: '#16A34A' }} />
          Pipeline live
        </span>
        <div className="leading-tight text-right">
          <p className="text-small-label" style={{ color: '#181d26', fontWeight: 600 }}>Agent Aisha</p>
          <p className="text-[10px]" style={{ color: 'rgba(4,14,32,0.55)' }}>Fraud Ops · Shift PM</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center font-bold"
          style={{
            backgroundColor: '#eef4fc',
            color: '#1b61c9',
            borderRadius: 999,
            border: '1px solid #e0e2e6',
          }}
        >
          A
        </div>
      </div>
    </header>
  );
}

function NavIcon({ id }: { id: Tab }) {
  const commonProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
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
