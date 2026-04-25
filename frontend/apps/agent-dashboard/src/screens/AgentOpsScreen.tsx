import { useEffect, useMemo, useState } from 'react';
import { AgentLane } from '../components/agentops/AgentLane.js';
import { DecisionFeed } from '../components/agentops/DecisionFeed.js';
import { InjectAlertButton } from '../components/agentops/InjectAlertButton.js';
import { OpsMetricsBar } from '../components/agentops/OpsMetricsBar.js';
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
    // Distribute active runs across lanes deterministically.
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
      <OpsMetricsBar stats={stats} queue={queue} workerOnline={workerOnline} />

      <InjectAlertButton />

      <section>
        <header className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-section-heading text-text-primary">Agent team</h2>
            <p className="text-caption text-muted-text">
              5 specialist agents working in parallel. Each lane shows the agent's current alert
              and last 3 verdicts.
            </p>
          </div>
          <p className="text-caption text-muted-text">
            {lastFetched
              ? `Updated ${Math.max(0, Math.round((Date.now() - lastFetched) / 1000))}s ago`
              : 'Loading…'}
          </p>
        </header>

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

      <section className="min-h-[400px] flex-1">
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
