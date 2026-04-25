import { useEffect, useMemo, useState } from 'react';
import { AnalyticsStrip } from '../components/agentops/AnalyticsStrip.js';
import { CommandBar } from '../components/agentops/CommandBar.js';
import { CompactAgentStrip } from '../components/agentops/CompactAgentStrip.js';
import { DecisionFeed } from '../components/agentops/DecisionFeed.js';
import { LiveCasePanel } from '../components/agentops/LiveCasePanel.js';
import {
  AGENT_ORDER,
  fetchAgentStats,
  fetchVerificationQueue,
  fetchVerificationsActive,
  fetchVerificationsRecent,
  fetchWorkerState,
  type AgentFinding,
  type AgentName,
  type AgentStats,
  type AgentStatRow,
  type QueueDepth,
  type VerificationRun,
  type WorkerState,
} from '../lib/agentops.js';

const POLL_MS_IDLE = 1500;
const POLL_MS_ACTIVE = 400;
const RECENT_LIMIT = 30;
const RECENT_PER_LANE = 3;

export function AgentOpsScreen() {
  const [recent, setRecent] = useState<VerificationRun[]>([]);
  const [active, setActive] = useState<VerificationRun[]>([]);
  const [queue, setQueue] = useState<QueueDepth | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [workerState, setWorkerState] = useState<WorkerState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const [recentRuns, activeRuns, queueDepth, agentStats, wState] = await Promise.all([
          fetchVerificationsRecent(RECENT_LIMIT),
          fetchVerificationsActive(),
          fetchVerificationQueue(),
          fetchAgentStats(60),
          fetchWorkerState(),
        ]);
        if (!alive) return;
        setRecent(recentRuns);
        setActive(activeRuns);
        setQueue(queueDepth);
        setStats(agentStats);
        setWorkerState(wState);
        setError(null);
        const nextDelay = activeRuns.length > 0 ? POLL_MS_ACTIVE : POLL_MS_IDLE;
        timer = setTimeout(tick, nextDelay);
      } catch (err: unknown) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Worker unreachable — start local_pg_api on :4100',
        );
        timer = setTimeout(tick, POLL_MS_IDLE);
      }
    }

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const workerOnline = useMemo(() => {
    if (!stats) return false;
    if (active.length > 0) return true;
    return stats.totals.runs_decided > 0;
  }, [stats, active]);

  const primaryActiveRun = active[0] ?? null;

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
    const map: Record<string, AgentStatRow> = {};
    if (stats) {
      for (const a of stats.per_agent) {
        map[a.agent_name] = a;
      }
    }
    return map;
  }, [stats]);

  void AGENT_ORDER; // satisfy import while using it indirectly via children

  return (
    <div className="flex h-full flex-col gap-4">
      <CommandBar
        stats={stats}
        queue={queue}
        workerState={workerState}
        workerOnline={workerOnline}
        liveCount={active.length}
        onWorkerChanged={setWorkerState}
      />

      <div
        className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
      >
        <section className="flex min-h-0 flex-col gap-3">
          <LiveCasePanel runs={primaryActiveRun ? [primaryActiveRun] : []} />
          <CompactAgentStrip
            activeRun={primaryActiveRun}
            recentByAgent={recentByAgent}
            statsByAgent={statsByAgent}
          />
        </section>

        <section className="flex min-h-0 flex-col">
          <DecisionFeed runs={recent} />
        </section>
      </div>

      <AnalyticsStrip runs={recent} />

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
