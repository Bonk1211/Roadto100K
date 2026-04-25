import { useState } from 'react';
import { AlertsScreen } from './screens/AlertsScreen.js';
import { NetworkGraphScreen } from './screens/NetworkGraph.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { StatsScreen } from './screens/StatsScreen.js';

type Tab = 'alerts' | 'network' | 'stats' | 'settings';

const NAV: { id: Tab; label: string; icon: string; description: string }[] = [
  { id: 'alerts', label: 'Alerts', icon: '◉', description: 'Live queue + decisions' },
  { id: 'network', label: 'Network', icon: '◇', description: 'Scam graph explorer' },
  { id: 'stats', label: 'Stats', icon: '▤', description: 'Trends & breakdowns' },
  { id: 'settings', label: 'Settings', icon: '◧', description: 'Agent preferences' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('alerts');
  const active = NAV.find((n) => n.id === tab)!;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app-gray">
      <Sidebar tab={tab} onTab={setTab} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={active.label} subtitle={active.description} />

        <main className="flex-1 overflow-auto px-8 py-6">
          {tab === 'alerts' && <AlertsScreen />}
          {tab === 'network' && <NetworkGraphScreen />}
          {tab === 'stats' && <StatsScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <aside
      className="flex h-full w-[260px] shrink-0 flex-col text-white"
      style={{ backgroundColor: '#071B33' }}
    >
      <div className="px-6 py-7">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-lg font-bold"
            style={{ backgroundColor: '#FFE600', color: '#0055D4' }}
          >
            ✓
          </div>
          <div>
            <p className="text-card-title leading-none">SafeSend</p>
            <p className="mt-1 text-caption text-white/60">Agent console</p>
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
              className="mb-1 flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-colors"
              style={{
                backgroundColor: isActive ? '#0055D4' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.78)',
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-pill text-base"
                style={{
                  backgroundColor: isActive ? '#FFE600' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#0055D4' : '#FFFFFF',
                }}
              >
                {item.icon}
              </span>
              <div>
                <p className="text-base font-semibold">{item.label}</p>
                <p className="text-small-label" style={{ color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)' }}>
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
          Pipeline live · mock-api:4000
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
