import { useEffect, useMemo, useState } from 'react';
import { AgentLane } from '../components/agentops/AgentLane.js';
import { DecisionFeed } from '../components/agentops/DecisionFeed.js';
import { InjectAlertButton } from '../components/agentops/InjectAlertButton.js';
import { LiveCasePanel } from '../components/agentops/LiveCasePanel.js';
import { StatsHero } from '../components/agentops/StatsHero.js';
import {
  AGENT_ORDER,
  fetchAgentStats,
  fetchVerificationQueue,
  fetchVerificationsActive,
  fetchVerificationsRecent,
  type AgentFinding,
  type AgentName,
  type AgentStats,
  type QueueDepth,
  type VerificationRun,
} from '../lib/agentops.js';

const POLL_MS = 1500;
const RECENT_LIMIT = 30;
const RECENT_PER_LANE = 3;

export function AgentOpsScreen() {
  const [recent, setRecent] = useState<VerificationRun[]>([]);
  const [active, setActive] = useState<VerificationRun[]>([]);
  const [queue, setQueue] = useState<QueueDepth | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const [recentRuns, activeRuns, queueDepth, agentStats] = await Promise.all([
          fetchVerificationsRecent(RECENT_LIMIT),
          fetchVerificationsActive(),
          fetchVerificationQueue(),
          fetchAgentStats(60),
        ]);
        if (!alive) return;
        setRecent(recentRuns);
        setActive(activeRuns);
        setQueue(queueDepth);
        setStats(agentStats);
        setLastFetched(Date.now());
        setError(null);
      } catch (err: unknown) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch verification data — is local_pg_api running on port 4100?',
        );
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const workerOnline = useMemo(() => {
    if (!stats) return false;
    if (active.length > 0) return true;
    return stats.totals.runs_decided > 0;
  }, [stats, active]);

  const activeByAgent = useMemo(() => {
    const map: Record<AgentName, VerificationRun | null> = {
      txn: null,
      behavior: null,
      network: null,
      policy: null,
      victim: null,
    };
    if (active.length === 0) return map;
    AGENT_ORDER.forEach((agent, idx) => {
      map[agent] = active[idx % active.length];
    });
    return map;
  }, [active]);

  const recentByAgent = useMemo(() => {
    const map: Record<AgentName, { run: VerificationRun; finding: AgentFinding }[]> = {
      txn: [],
      behavior: [],
      network: [],
      policy: [],
      victim: [],
    };
    for (const run of recent) {
      if (run.status !== 'decided') continue;
      for (const f of run.findings) {
        const slot = map[f.agent_name as AgentName];
        if (slot && slot.length < RECENT_PER_LANE) {
          slot.push({ run, finding: f });
        }
      }
    }
    return map;
  }, [recent]);

  const statsByAgent = useMemo(() => {
    const map: Record<string, AgentStats['per_agent'][number]> = {};
    if (stats) {
      for (const a of stats.per_agent) {
        map[a.agent_name] = a;
      }
    }
    return map;
  }, [stats]);

  return (
    <div className="flex h-full flex-col gap-5">
      <StatsHero
        stats={stats}
        queue={queue}
        workerOnline={workerOnline}
        liveCount={active.length}
      />

      <section>
        <SectionHeader
          eyebrow="Step 1"
          title={active.length > 0 ? 'Live verification' : 'Live verification'}
          subtitle="Watch the team review one alert end-to-end."
        />
        <LiveCasePanel runs={active} />
      </section>

      <section>
        <SectionHeader
          eyebrow="Step 2"
          title="Push an alert into the queue"
          subtitle="Pick a profile to inject a synthetic transaction. Worker picks it up within 2s."
        />
        <InjectAlertButton />
      </section>

      <section>
        <SectionHeader
          eyebrow="Team"
          title="5 specialist agents on duty"
          subtitle="Each agent reviews one slice of the alert and emits a verdict with confidence."
          rightSlot={
            <p className="text-caption text-muted-text">
              {lastFetched
                ? `Updated ${Math.max(0, Math.round((Date.now() - lastFetched) / 1000))}s ago`
                : 'Loading…'}
            </p>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {AGENT_ORDER.map((agent) => (
            <AgentLane
              key={agent}
              agent={agent}
              activeRun={activeByAgent[agent]}
              recent={recentByAgent[agent]}
              stats={statsByAgent[agent] ?? null}
            />
          ))}
        </div>
      </section>

      <section className="min-h-[420px] flex-1">
        <SectionHeader
          eyebrow="History"
          title="All decisions"
          subtitle="alert → 5 agent verdicts → arbiter outcome"
        />
        <DecisionFeed runs={recent} />
      </section>

      {error && (
        <div
          className="fixed bottom-6 right-6 z-50 max-w-md rounded-2xl px-5 py-4 text-caption text-white shadow-elevated"
          style={{ backgroundColor: '#DC2626' }}
        >
          <p className="font-semibold">Worker unreachable</p>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  rightSlot,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p
            className="text-small-label uppercase tracking-wide"
            style={{ color: '#0055D4' }}
          >
            {eyebrow}
          </p>
        )}
        <h2 className="text-section-heading text-text-primary">{title}</h2>
        {subtitle && <p className="text-caption text-muted-text">{subtitle}</p>}
      </div>
      {rightSlot}
    </header>
  );
}
