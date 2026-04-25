import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import type { NetworkGraph as Graph, NetworkNode, NetworkEdge } from 'shared';
import { fetchNetworkGraph } from '../lib/api.js';

type SimNode = NetworkNode &
  d3.SimulationNodeDatum & { x?: number; y?: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: NetworkEdge['type'];
  weight?: number;
};

const FILL = {
  flagged: '#DC2626',
  normal: '#005BAC',
  device: '#071B33',
};

export function NetworkGraphScreen() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [selected, setSelected] = useState<NetworkNode | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchNetworkGraph().then(setGraph).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('graph fetch failed', err);
    });
  }, []);

  useEffect(() => {
    if (!graph || !svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
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
          .distance(110)
          .strength(0.6),
      )
      .force('charge', d3.forceManyBody().strength(-380))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(36));

    // Edges
    const link = svg
      .append('g')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => (d.type === 'shared_device' ? '#FF8A00' : '#94A3B8'))
      .attr('stroke-dasharray', (d) =>
        d.type === 'shared_device' ? '6 4' : null,
      )
      .attr('stroke-width', (d) => (d.weight ? Math.max(1.5, Math.log10(d.weight)) : 1.5));

    // Nodes
    const nodeGroup = svg
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
            d.fx = null;
            d.fy = null;
          }),
      );

    nodeGroup
      .append((d) => {
        // Devices = square, accounts = circle
        const tag = d.type === 'device' ? 'rect' : 'circle';
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
      })
      .each(function (d) {
        const sel = d3.select(this);
        const fill =
          d.type === 'device'
            ? FILL.device
            : d.flagged
              ? FILL.flagged
              : FILL.normal;
        const r = d.flagged ? 22 : 18;
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
      .text((d) => d.label)
      .attr('y', 36)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 600)
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
    };
  }, [graph]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-section-heading text-text-primary">
          Scam network graph
        </h2>
        <p className="text-caption text-muted-text">
          Force-directed view of flagged payee accounts, their shared device
          fingerprints, and recent victim transactions. Click a node for detail.
          Dashed orange edges = shared device.
        </p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg bg-white shadow-card"
          style={{ border: '1px solid #E5E7EB', minHeight: 520 }}
        >
          <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="xMidYMid meet" />
          <Legend />
        </div>

        <NodeInfoPanel node={selected} />
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { color: FILL.flagged, label: 'Flagged account', shape: 'circle' as const },
    { color: FILL.normal, label: 'Normal account', shape: 'circle' as const },
    { color: FILL.device, label: 'Device fingerprint', shape: 'square' as const },
    { color: '#FF8A00', label: 'Shared device link', shape: 'line' as const },
  ];
  return (
    <div
      className="absolute bottom-3 left-3 flex flex-col gap-2 rounded-md p-3 text-caption"
      style={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #E5E7EB' }}
    >
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          {it.shape === 'circle' && (
            <span
              className="h-3 w-3 rounded-pill"
              style={{ backgroundColor: it.color }}
            />
          )}
          {it.shape === 'square' && (
            <span
              className="h-3 w-3"
              style={{ backgroundColor: it.color }}
            />
          )}
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

function NodeInfoPanel({ node }: { node: NetworkNode | null }) {
  if (!node) {
    return (
      <aside
        className="rounded-lg bg-white p-5 text-muted-text shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <p className="text-card-title text-text-primary">No node selected</p>
        <p className="mt-2 text-caption">
          Click a circle (account) or square (device) on the graph to inspect
          its metadata.
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
      <dd
        className={`text-base font-semibold text-text-primary ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
