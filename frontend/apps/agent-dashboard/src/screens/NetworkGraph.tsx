import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ContainmentAccount,
  ContainmentExecutionResponse,
  NetworkEdge,
  NetworkGraph as Graph,
  NetworkNode,
} from 'shared';
import { executeContainment, fetchAlerts, fetchNetworkGraph } from '../lib/api.js';

type SimNode = NetworkNode &
  d3.SimulationNodeDatum & { x?: number; y?: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: NetworkEdge['type'];
  weight?: number;
};

const FILL = {
  stage3: '#DC2626',
  flagged: '#EF4444',
  normal: '#005BAC',
  device: '#071B33',
};

export function NetworkGraphScreen() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [selected, setSelected] = useState<NetworkNode | null>(null);
  const [containment, setContainment] = useState<ContainmentAccount[]>([]);
  const [result, setResult] = useState<ContainmentExecutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    Promise.all([fetchNetworkGraph(), fetchAlerts()])
      .then(([g, alerts]) => {
        setGraph(g);
        const stage3 = alerts.find(
          (alert) => alert.alert_type === 'mule_eviction' && alert.mule_stage === 3,
        );
        setContainment(stage3?.containment_accounts ?? []);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('graph fetch failed', err);
        setError('Network graph unavailable. Use seeded mock API for the containment demo.');
      });
  }, []);

  useEffect(() => {
    if (!graph || !svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const viewport = svg.append('g');
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 4])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    const nodes: SimNode[] = graph.nodes.map((n) => ({
      ...n,
      fx: n.id === 'p_scam_03' ? width / 2 : undefined,
      fy: n.id === 'p_scam_03' ? height / 2 : undefined,
    }));
    const links: SimLink[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
      weight: e.weight,
    }));

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => (d.type === 'transaction' ? 140 : 110))
          .strength(0.68),
      )
      .force('charge', d3.forceManyBody().strength(-430))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(42));

    const link = viewport
      .append('g')
      .attr('stroke-opacity', 0.72)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => edgeColor(d.type))
      .attr('stroke-dasharray', (d) => (d.type === 'transaction' ? null : '6 4'))
      .attr('stroke-width', (d) => (d.weight ? Math.max(1.5, Math.log10(d.weight)) : 2));

    const nodeGroup = viewport
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event, d) => setSelected(d))
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x ?? 0;
            d.fy = d.y ?? 0;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            if (d.id !== 'p_scam_03') {
              d.fx = null;
              d.fy = null;
            }
          }),
      );

    nodeGroup
      .append((d) => {
        const tag = d.type === 'device' ? 'rect' : 'circle';
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
      })
      .each(function (d) {
        const sel = d3.select(this);
        const fill =
          d.type === 'device'
            ? FILL.device
            : d.id === 'p_scam_03'
              ? FILL.stage3
              : d.flagged
                ? FILL.flagged
                : FILL.normal;
        const r = d.id === 'p_scam_03' ? 30 : d.flagged ? 22 : 18;
        if (d.type === 'device') {
          sel
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', r * 2)
            .attr('height', r * 2)
            .attr('rx', 4);
        } else {
          sel.attr('r', r);
        }
        sel.attr('fill', fill).attr('stroke', '#FFFFFF').attr('stroke-width', 3);
      });

    nodeGroup
      .append('text')
      .text((d) => (d.id === 'p_scam_03' ? 'STAGE 3 MULE' : d.label))
      .attr('y', (d) => (d.id === 'p_scam_03' ? 48 : 36))
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('fill', '#111827')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 4)
      .attr('stroke-linejoin', 'round');

    sim.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
      zoomRef.current = null;
    };
  }, [graph]);

  function zoomBy(factor: number) {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomRef.current.scaleBy, factor);
  }

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }

  const totalExposure = useMemo(
    () => containment.reduce((sum, account) => sum + account.rm_exposure, 0),
    [containment],
  );

  function toggleAccount(accountId: string) {
    setContainment((prev) =>
      prev.map((account) =>
        account.account_id === accountId
          ? { ...account, selected: account.selected === false }
          : account,
      ),
    );
  }

  async function runContainment() {
    const selectedIds = containment
      .filter((account) => account.selected !== false)
      .map((account) => account.account_id);
    try {
      setError(null);
      const res = await executeContainment('p_scam_03', selectedIds);
      setResult(res);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('Containment execution failed. Mock API endpoint may be offline.');
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-section-heading text-text-primary">
            Bulk network containment
          </h2>
          <p className="text-caption text-muted-text">
            Stage 3 mule account is pinned at the centre. Linked accounts are ranked by risk,
            connection reason, and total RM exposure.
          </p>
        </div>
        <div
          className="rounded-lg px-4 py-3 text-right"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <p className="text-small-label font-semibold" style={{ color: '#DC2626' }}>
            Network exposure
          </p>
          <p className="font-mono text-xl font-bold text-text-primary">
            RM {totalExposure.toLocaleString('en-MY')}
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-5 py-3 text-sm font-semibold"
          style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FDBA74' }}
        >
          {error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg bg-white shadow-card"
          style={{ border: '1px solid #E5E7EB', minHeight: 560 }}
        >
          {graph ? (
            <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <div className="flex h-full min-h-[560px] items-center justify-center text-muted-text">
              Loading network graph...
            </div>
          )}
          <ZoomControls onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onReset={resetZoom} />
          <Legend />
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <ContainmentPanel
            accounts={containment}
            result={result}
            onToggle={toggleAccount}
            onExecute={runContainment}
          />
          <NodeInfoPanel node={selected} />
        </div>
      </div>
    </div>
  );
}

function ContainmentPanel({
  accounts,
  result,
  onToggle,
  onExecute,
}: {
  accounts: ContainmentAccount[];
  result: ContainmentExecutionResponse | null;
  onToggle: (accountId: string) => void;
  onExecute: () => void;
}) {
  const selected = accounts.filter((account) => account.selected !== false);
  const total = selected.reduce((sum, account) => sum + account.rm_exposure, 0);

  return (
    <section
      className="rounded-lg bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-small-label uppercase tracking-wide text-muted-text">
            One-click lock
          </p>
          <h3 className="text-card-title text-text-primary">Contain linked accounts</h3>
        </div>
        <div className="text-right">
          <p className="text-small-label text-muted-text">Selected exposure</p>
          <p className="font-mono font-bold text-text-primary">
            RM {total.toLocaleString('en-MY')}
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {accounts.map((account) => (
          <label
            key={account.account_id}
            className="flex cursor-pointer items-start gap-3 rounded-md bg-app-gray p-3"
          >
            <input
              type="checkbox"
              checked={account.selected !== false}
              onChange={() => onToggle(account.account_id)}
              className="mt-1 h-4 w-4"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-text-primary">
                {account.display_name}
              </span>
              <span className="block text-caption text-muted-text">
                {labelConnection(account.connection_type)} - degree {account.degree}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-small-label font-bold" style={{ color: '#DC2626' }}>
                {account.risk_score}
              </span>
              <span className="block font-mono text-caption text-text-primary">
                RM {account.rm_exposure.toLocaleString('en-MY')}
              </span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={onExecute}
        disabled={selected.length === 0}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg font-bold text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: '#DC2626' }}
      >
        Execute Containment
      </button>

      {result && (
        <div
          className="mt-4 rounded-md p-3 text-caption"
          style={{ backgroundColor: '#ECFDF5', color: '#166534', border: '1px solid #BBF7D0' }}
        >
          <p className="font-bold">Incident {result.incident_id} executed.</p>
          <p className="mt-1">
            {result.contained_accounts.length} accounts suspended, withdrawals held,
            {` ${result.sns_sent} `}SNS notifications sent.
          </p>
        </div>
      )}
    </section>
  );
}

function Legend() {
  const items = [
    { color: FILL.stage3, label: 'Stage 3 mule', shape: 'circle' as const },
    { color: FILL.flagged, label: 'Linked high-risk account', shape: 'circle' as const },
    { color: FILL.device, label: 'Device fingerprint', shape: 'square' as const },
    { color: '#FF8A00', label: 'Shared attribute link', shape: 'line' as const },
  ];
  return (
    <div
      className="absolute bottom-3 left-3 flex flex-col gap-2 rounded-md p-3 text-caption"
      style={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #E5E7EB' }}
    >
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          {it.shape === 'circle' && (
            <span className="h-3 w-3 rounded-pill" style={{ backgroundColor: it.color }} />
          )}
          {it.shape === 'square' && <span className="h-3 w-3" style={{ backgroundColor: it.color }} />}
          {it.shape === 'line' && (
            <span
              className="block h-[2px] w-5"
              style={{
                background: `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 8px)`,
              }}
            />
          )}
          <span className="text-text-primary">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div
      className="absolute bottom-3 right-3 flex overflow-hidden rounded-md text-sm font-bold shadow-card"
      style={{ backgroundColor: 'rgba(255,255,255,0.96)', border: '1px solid #E5E7EB' }}
    >
      <button type="button" className="h-10 w-10 text-text-primary hover:bg-app-gray" onClick={onZoomOut} title="Zoom out">
        -
      </button>
      <button type="button" className="h-10 w-14 border-x text-text-primary hover:bg-app-gray" style={{ borderColor: '#E5E7EB' }} onClick={onReset} title="Reset zoom">
        1:1
      </button>
      <button type="button" className="h-10 w-10 text-text-primary hover:bg-app-gray" onClick={onZoomIn} title="Zoom in">
        +
      </button>
    </div>
  );
}

function NodeInfoPanel({ node }: { node: NetworkNode | null }) {
  if (!node) {
    return (
      <aside
        className="rounded-lg bg-white p-5 text-muted-text shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <p className="text-card-title text-text-primary">No node selected</p>
        <p className="mt-2 text-caption">
          Click a circle or square on the graph to inspect account metadata.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="rounded-lg bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <p className="text-small-label uppercase tracking-wide text-muted-text">
        {node.type === 'device' ? 'Device fingerprint' : 'Account'}
      </p>
      <h3 className="mt-1 text-card-title text-text-primary">{node.label}</h3>
      {node.flagged && (
        <span
          className="mt-2 inline-flex rounded-pill px-3 py-1 text-small-label font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
        >
          Flagged in scam graph
        </span>
      )}

      <dl className="mt-4 space-y-3">
        <Row label="ID" value={node.id} mono />
        {node.metadata &&
          Object.entries(node.metadata).map(([k, v]) => (
            <Row key={k} label={prettyKey(k)} value={String(v)} />
          ))}
      </dl>
    </aside>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-caption text-muted-text">{label}</dt>
      <dd className={`text-base font-semibold text-text-primary ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function edgeColor(type: NetworkEdge['type']): string {
  const map: Partial<Record<NetworkEdge['type'], string>> = {
    transaction: '#94A3B8',
    shared_device: '#FF8A00',
    shared_ip: '#0055D4',
    overlapping_timing: '#9D174D',
    same_card_bin: '#16A34A',
    shared_attribute: '#FF8A00',
  };
  return map[type] ?? '#94A3B8';
}

function labelConnection(type: string): string {
  return type.replace(/_/g, ' ');
}

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
