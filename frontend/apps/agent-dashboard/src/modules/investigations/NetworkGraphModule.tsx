import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import type { NetworkEdge, NetworkGraph as Graph, NetworkNode } from 'shared';
import type { InvestigationAlert } from '../../lib/investigations/types.js';

type SimNode = NetworkNode & d3.SimulationNodeDatum & { x?: number; y?: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: NetworkEdge['type'];
  weight?: number;
};

const FILL = {
  flagged: '#DC2626',
  normal: '#005BAC',
  device: '#071B33',
  focus: '#FF8A00',
};

interface Props {
  graph: Graph | null;
  focusAlert: InvestigationAlert | null;
}

export function NetworkGraphModule({ graph, focusAlert }: Props) {
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!graph || !svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const focusId = focusAlert?.focusNodeId;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: SimNode[] = graph.nodes.map((node) => ({ ...node }));
    const links: SimLink[] = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
    }));

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => (link.source === focusId || link.target === focusId ? 95 : 130))
          .strength(0.7),
      )
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(42));

    const link = svg
      .append('g')
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (item) => (item.type === 'shared_device' ? '#FF8A00' : '#94A3B8'))
      .attr('stroke-dasharray', (item) => (item.type === 'shared_device' ? '6 4' : null))
      .attr('stroke-width', (item) => (item.weight ? Math.max(2, Math.log10(item.weight)) : 2));

    const nodeGroup = svg
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event, node) => setSelectedNode(node))
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, node) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            node.fx = node.x ?? 0;
            node.fy = node.y ?? 0;
          })
          .on('drag', (event, node) => {
            node.fx = event.x;
            node.fy = event.y;
          })
          .on('end', (event, node) => {
            if (!event.active) sim.alphaTarget(0);
            node.fx = null;
            node.fy = null;
          }),
      );

    nodeGroup
      .append((node) =>
        document.createElementNS('http://www.w3.org/2000/svg', node.type === 'device' ? 'rect' : 'circle'),
      )
      .each(function draw(node) {
        const selection = d3.select(this);
        const isFocus = node.id === focusId;
        const fill =
          node.type === 'device'
            ? FILL.device
            : isFocus
              ? FILL.focus
              : node.flagged
                ? FILL.flagged
                : FILL.normal;
        const radius = isFocus ? 26 : node.flagged ? 21 : 18;
        if (node.type === 'device') {
          selection.attr('x', -radius).attr('y', -radius).attr('width', radius * 2).attr('height', radius * 2).attr('rx', 6);
        } else {
          selection.attr('r', radius);
        }
        selection.attr('fill', fill).attr('stroke', '#FFFFFF').attr('stroke-width', isFocus ? 4 : 3);
      });

    nodeGroup
      .append('text')
      .text((node) => node.label)
      .attr('y', 38)
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
        .attr('x1', (item) => (item.source as SimNode).x ?? 0)
        .attr('y1', (item) => (item.source as SimNode).y ?? 0)
        .attr('x2', (item) => (item.target as SimNode).x ?? 0)
        .attr('y2', (item) => (item.target as SimNode).y ?? 0);
      nodeGroup.attr('transform', (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
    });

    return () => {
      sim.stop();
    };
  }, [graph, focusAlert?.focusNodeId]);

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-card-title text-text-primary">Network graph</h3>
        {focusAlert && (
          <span
            className="rounded-pill px-3 py-1 text-small-label font-semibold"
            style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}
          >
            {focusAlert.accountLabel}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[360px] overflow-hidden rounded-[24px] bg-white shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        {graph ? (
          <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-text">Loading graph...</div>
        )}
        <Legend />
      </div>

      <NodeInfoPanel node={selectedNode} />
    </section>
  );
}

function Legend() {
  const items = [
    { color: FILL.focus, label: 'Focus', shape: 'circle' as const },
    { color: FILL.flagged, label: 'Flagged', shape: 'circle' as const },
    { color: FILL.normal, label: 'Linked', shape: 'circle' as const },
    { color: FILL.device, label: 'Device', shape: 'square' as const },
  ];
  return (
    <div
      className="absolute bottom-3 left-3 flex gap-2 rounded-xl p-3 text-caption"
      style={{ backgroundColor: 'rgba(255,255,255,0.96)', border: '1px solid #E5E7EB' }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          {item.shape === 'circle' ? (
            <span className="h-3 w-3 rounded-pill" style={{ backgroundColor: item.color }} />
          ) : (
            <span className="h-3 w-3" style={{ backgroundColor: item.color }} />
          )}
          <span className="text-text-primary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function NodeInfoPanel({ node }: { node: NetworkNode | null }) {
  return (
    <aside
      className="rounded-[24px] bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      {!node ? (
        <p className="text-caption text-muted-text">Select a node.</p>
      ) : (
        <>
          <p className="text-small-label uppercase tracking-wide text-muted-text">
            {node.type === 'device' ? 'Device' : 'Account'}
          </p>
          <h4 className="mt-1 text-card-title text-text-primary">{node.label}</h4>
          <dl className="mt-4 space-y-3">
            <Row label="ID" value={node.id} />
            {node.metadata &&
              Object.entries(node.metadata).map(([key, value]) => (
                <Row key={key} label={prettyKey(key)} value={String(value)} />
              ))}
          </dl>
        </>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption text-muted-text">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function prettyKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
