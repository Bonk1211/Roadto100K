import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import type { NetworkEdge, NetworkGraph as Graph, NetworkNode } from 'shared';
import { LoadingDots } from 'shared';
import type { InvestigationAlert } from '../../lib/investigations/types.js';

type SimNode = NetworkNode & d3.SimulationNodeDatum & { x?: number; y?: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & {
  type: NetworkEdge['type'];
  weight?: number;
};
type LayoutTarget = { x: number; y: number };
type WashChain = {
  id: string;
  nodeIds: string[];
  linkKeys: string[];
  flaggedNodeIds: string[];
  terminalType: 'completed_wash' | 'terminal_drop';
};

const FILL = {
  flagged: '#DC2626',
  normal: '#005BAC',
  device: '#071B33',
  focus: '#FF8A00',
  cashFlow: '#2563EB',
  shared: '#FF8A00',
};

interface Props {
  graph: Graph | null;
  focusAlert: InvestigationAlert | null;
}

export function NetworkGraphModule({ graph, focusAlert }: Props) {
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [chainSummary, setChainSummary] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const activeNode = hoveredNode ?? selectedNode;

  useEffect(() => {
    if (!graph || !svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const focusId = focusAlert?.focusNodeId;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.on('click', () => {
      setSelectedNode(null);
      setChainSummary(null);
      clearChainHighlight();
    });
    const viewport = svg.append('g');
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 4])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    const nodes: SimNode[] = graph.nodes.map((node) => ({ ...node }));
    nodesRef.current = nodes;
    const links: SimLink[] = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
    }));
    const washChains = buildWashChains(nodes, links);
    const layoutTargets = buildChainLayoutTargets(washChains, nodes, width, height);
    const outboundCount = new Map<string, number>();
    const inboundCount = new Map<string, number>();
    for (const edge of graph.edges.filter((edge) => isCashFlowEdge(edge.type))) {
      outboundCount.set(edge.source, (outboundCount.get(edge.source) ?? 0) + 1);
      inboundCount.set(edge.target, (inboundCount.get(edge.target) ?? 0) + 1);
    }

    const xLane = (node: SimNode) => {
      const target = layoutTargets.get(node.id);
      if (target) return target.x;
      if (node.type === 'device') return width * 0.5;
      const outbound = outboundCount.get(node.id) ?? 0;
      const inbound = inboundCount.get(node.id) ?? 0;
      if (outbound > 0 && inbound === 0) return width * 0.18;
      if (inbound > 0 && outbound === 0) return width * 0.82;
      if (inbound > outbound) return width * 0.68;
      if (outbound > inbound) return width * 0.32;
      return width * 0.5;
    };
    const yLane = (node: SimNode) => layoutTargets.get(node.id)?.y ?? height / 2;

    const marker = svg.append('defs').append('marker');
    marker
      .attr('id', 'cash-flow-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 14)
      .attr('refY', 0)
      .attr('markerWidth', 3.2)
      .attr('markerHeight', 3.2)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', FILL.cashFlow);

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => (isCashFlowEdge(link.type) ? 150 : 95))
          .strength((link) => (isCashFlowEdge(link.type) ? 0.82 : 0.38)),
      )
      .force('charge', d3.forceManyBody().strength(-520))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX<SimNode>(xLane).strength((node) => (layoutTargets.has(node.id) ? 0.68 : 0.34)))
      .force('y', d3.forceY<SimNode>(yLane).strength((node) => (layoutTargets.has(node.id) ? 0.58 : 0.08)))
      .force('collide', d3.forceCollide(38));

    const link = viewport
      .append('g')
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('data-link-key', (item) => linkKey(item))
      .attr('stroke', (item) => edgeColor(item.type))
      .attr('stroke-dasharray', (item) => (isCashFlowEdge(item.type) ? null : '6 4'))
      .attr('stroke-width', (item) => (item.weight ? Math.max(1.5, Math.min(7, Math.log10(item.weight))) : 2))
      .attr('marker-end', (item) => (isCashFlowEdge(item.type) ? 'url(#cash-flow-arrow)' : null));

    link.append('title').text((item) => {
      const source = endpointId(item.source);
      const target = endpointId(item.target);
      const exposure = item.weight ? `RM ${Math.round(item.weight).toLocaleString('en-MY')}` : 'No exposure value';
      return `${source} -> ${target}\n${labelConnection(item.type)}\n${exposure}`;
    });

    const nodeGroup = viewport
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('data-node-id', (node) => node.id)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, node) => setHoveredNode(node))
      .on('mouseleave', () => setHoveredNode(null))
      .on('click', (event, node) => {
        event.stopPropagation();
        setSelectedNode(node);
        highlightFraudChain(node.id);
      })
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
            updatePositions();
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
      .attr('class', 'node-shape')
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
      .attr('class', 'node-label')
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

    function updatePositions() {
      link
        .attr('x1', (item) => (item.source as SimNode).x ?? 0)
        .attr('y1', (item) => (item.source as SimNode).y ?? 0)
        .attr('x2', (item) => (item.target as SimNode).x ?? 0)
        .attr('y2', (item) => (item.target as SimNode).y ?? 0);
      nodeGroup.attr('transform', (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
    }

    function clearChainHighlight() {
      link
        .attr('stroke-opacity', 0.7)
        .attr('stroke', (item) => edgeColor(item.type))
        .attr('stroke-width', (item) => (item.weight ? Math.max(1.5, Math.min(7, Math.log10(item.weight))) : 2));
      nodeGroup.attr('opacity', 1);
      nodeGroup
        .select<SVGElement>('.node-shape')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', (node) => (node.id === focusId ? 4 : 3));
    }

    function highlightFraudChain(startId: string) {
      const matchingChains = washChains.filter((chain) => chain.nodeIds.includes(startId));
      if (matchingChains.length === 0) {
        clearChainHighlight();
        setChainSummary('No wash-cycle chain found for this node.');
        return;
      }
      const chain = mergeWashChains(matchingChains);
      for (const edge of links.filter((item) => !isCashFlowEdge(item.type))) {
        const source = endpointId(edge.source);
        const target = endpointId(edge.target);
        if (chain.nodeIds.has(source) && chain.nodeIds.has(target)) {
          chain.linkKeys.add(linkKey(edge));
        }
      }

      link
        .attr('stroke-opacity', (item) => (chain.linkKeys.has(linkKey(item)) ? 0.95 : 0.08))
        .attr('stroke', (item) => (chain.linkKeys.has(linkKey(item)) ? edgeColor(item.type) : '#CBD5E1'))
        .attr('stroke-width', (item) => {
          const base = item.weight ? Math.max(1.5, Math.min(7, Math.log10(item.weight))) : 2;
          return chain.linkKeys.has(linkKey(item)) ? base + 2 : 1;
        });
      nodeGroup.attr('opacity', (node) => (chain.nodeIds.has(node.id) ? 1 : 0.18));
      nodeGroup
        .select<SVGElement>('.node-shape')
        .attr('stroke', (node) => (chain.nodeIds.has(node.id) ? '#111827' : '#FFFFFF'))
        .attr('stroke-width', (node) => (chain.nodeIds.has(node.id) ? 5 : node.id === focusId ? 4 : 3));
      const completedCount = matchingChains.filter((item) => item.terminalType === 'completed_wash').length;
      const holdingCount = matchingChains.length - completedCount;
      setChainSummary(
        `${matchingChains.length} chain${matchingChains.length === 1 ? '' : 's'} - ${chain.nodeIds.size} nodes, ${chain.flaggedNodeIds.size} flagged, ${completedCount} cashout, ${holdingCount} holding`,
      );
    }

    sim.on('tick', updatePositions);
    sim.tick(220);
    updatePositions();
    fitGraphToView(nodes, width, height, svg, zoom);
    sim.alpha(0.08).restart();

    return () => {
      sim.stop();
      zoomRef.current = null;
      nodesRef.current = [];
    };
  }, [graph, focusAlert?.focusNodeId]);

  function zoomBy(factor: number) {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomRef.current.scaleBy, factor);
  }

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    if (nodesRef.current.length > 0) {
      fitGraphToView(nodesRef.current, svgRef.current.clientWidth, svgRef.current.clientHeight, svg, zoomRef.current);
      return;
    }
    svg.transition().duration(180).call(zoomRef.current.transform, d3.zoomIdentity);
  }

  return (
    <section className="h-full">
      <div
        ref={containerRef}
        className="relative h-full min-h-[720px] overflow-hidden rounded-[24px] bg-white shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        {graph ? (
          <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-text">
            <LoadingDots label="Loading graph" tone="muted" />
          </div>
        )}
        <ZoomControls onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onReset={resetZoom} />
        <Legend />
        {focusAlert && (
          <span
            className="absolute left-4 top-4 rounded-pill px-3 py-1 text-small-label font-semibold"
            style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}
          >
            {focusAlert.accountLabel}
          </span>
        )}
        {chainSummary && <ChainSummary summary={chainSummary} />}
        {activeNode && <NodeInfoPanel node={activeNode} pinned={selectedNode?.id === activeNode.id} />}
      </div>
    </section>
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
      className="absolute bottom-3 right-3 flex overflow-hidden rounded-xl text-sm font-bold shadow-card"
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

function ChainSummary({ summary }: { summary: string }) {
  return (
    <div
      className="absolute left-4 top-4 rounded-xl px-4 py-3 shadow-card"
      style={{ backgroundColor: 'rgba(255,255,255,0.96)', border: '1px solid #BFDBFE' }}
    >
      <p className="text-small-label font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
        Fraud chain
      </p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{summary}</p>
    </div>
  );
}

function Legend() {
  const items = [
    { color: FILL.cashFlow, label: 'Cash flow', shape: 'line' as const, dashed: false },
    { color: FILL.shared, label: 'Shared device/IP/timing', shape: 'line' as const, dashed: true },
    { color: '#16A34A', label: 'Same card BIN', shape: 'line' as const, dashed: true },
    { color: FILL.flagged, label: 'Flagged account', shape: 'circle' as const },
    { color: FILL.normal, label: 'Other account', shape: 'circle' as const },
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
            <span
              className="h-[3px] w-6"
              style={{
                background: item.dashed
                  ? `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 8px)`
                  : item.color,
              }}
            />
          )}
          <span className="text-text-primary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function NodeInfoPanel({ node, pinned }: { node: NetworkNode; pinned: boolean }) {
  return (
    <aside
      className="absolute right-4 top-4 z-10 w-[340px] rounded-[18px] bg-white p-5 shadow-elevated"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-small-label uppercase tracking-wide text-muted-text">
            {node.type === 'device' ? 'Device' : 'Account'}
          </p>
          <h4 className="mt-1 text-card-title text-text-primary">{node.label}</h4>
        </div>
        {pinned && (
          <span
            className="rounded-pill px-2 py-1 text-small-label font-semibold"
            style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
          >
            Pinned
          </span>
        )}
      </div>
      {node.flagged && (
        <span
          className="mt-3 inline-flex rounded-pill px-3 py-1 text-small-label font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
        >
          Flagged
        </span>
      )}
      <dl className="mt-4 space-y-3">
        <Row label="ID" value={node.id} />
        {node.metadata &&
          Object.entries(node.metadata).map(([key, value]) => (
            <Row key={key} label={prettyKey(key)} value={String(value)} />
          ))}
      </dl>
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

function buildWashChains(nodes: SimNode[], links: SimLink[]): WashChain[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, SimLink[]>();
  for (const link of links.filter((item) => isCashFlowEdge(item.type))) {
    const source = endpointId(link.source);
    outgoing.set(source, [...(outgoing.get(source) ?? []), link]);
  }

  const chains = new Map<string, WashChain>();
  const maxDepth = 16;
  const maxChains = 160;

  for (const origin of nodes.filter((node) => !node.flagged && node.type !== 'device')) {
    const firstDirtyEdges = (outgoing.get(origin.id) ?? []).filter((edge) => nodeById.get(endpointId(edge.target))?.flagged);
    for (const edge of firstDirtyEdges) {
      walkDirtyPath(origin.id, edge, [origin.id], [], new Set<string>());
    }
  }

  return [...chains.values()];

  function walkDirtyPath(
    originId: string,
    edge: SimLink,
    pathNodeIds: string[],
    pathLinkKeys: string[],
    usedLinkKeys: Set<string>,
  ) {
    if (chains.size >= maxChains || pathNodeIds.length > maxDepth) return;

    const edgeKey = linkKey(edge);
    if (usedLinkKeys.has(edgeKey)) return;

    const targetId = endpointId(edge.target);
    const targetNode = nodeById.get(targetId);
    if (!targetNode || targetNode.type === 'device') return;

    const nextNodeIds = [...pathNodeIds, targetId];
    const nextLinkKeys = [...pathLinkKeys, edgeKey];
    const nextUsedLinkKeys = new Set(usedLinkKeys).add(edgeKey);
    const flaggedNodeIds = nextNodeIds.filter((id) => nodeById.get(id)?.flagged);
    if (flaggedNodeIds.length === 0) return;

    if (!targetNode.flagged) {
      addChain({
        id: `${originId}:${nextLinkKeys.join('|')}`,
        nodeIds: nextNodeIds,
        linkKeys: nextLinkKeys,
        flaggedNodeIds,
        terminalType: 'completed_wash',
      });
      return;
    }

    const nextEdges = (outgoing.get(targetId) ?? []).filter((item) => !nextUsedLinkKeys.has(linkKey(item)));
    if (nextEdges.length === 0) {
      addChain({
        id: `${originId}:${nextLinkKeys.join('|')}`,
        nodeIds: nextNodeIds,
        linkKeys: nextLinkKeys,
        flaggedNodeIds,
        terminalType: 'terminal_drop',
      });
      return;
    }

    for (const nextEdge of nextEdges) {
      walkDirtyPath(originId, nextEdge, nextNodeIds, nextLinkKeys, nextUsedLinkKeys);
    }
  }

  function addChain(chain: WashChain) {
    const key = chain.linkKeys.join('|');
    if (!chains.has(key)) chains.set(key, chain);
  }
}

function buildChainLayoutTargets(
  chains: WashChain[],
  nodes: SimNode[],
  width: number,
  height: number,
): Map<string, LayoutTarget> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const totals = new Map<string, { x: number; y: number; count: number }>();
  const sortedChains = [...chains].sort((a, b) => b.flaggedNodeIds.length - a.flaggedNodeIds.length || b.nodeIds.length - a.nodeIds.length);
  const usableHeight = Math.max(220, height - 190);
  const topMargin = (height - usableHeight) / 2;

  sortedChains.forEach((chain, chainIndex) => {
    const y = topMargin + ((chainIndex + 1) / (sortedChains.length + 1)) * usableHeight;
    const lastIndex = Math.max(1, chain.nodeIds.length - 1);
    chain.nodeIds.forEach((nodeId, index) => {
      const node = nodeById.get(nodeId);
      if (!node) return;
      const ratio = index / lastIndex;
      const x = width * (0.12 + ratio * 0.76);
      const current = totals.get(nodeId) ?? { x: 0, y: 0, count: 0 };
      totals.set(nodeId, { x: current.x + x, y: current.y + y, count: current.count + 1 });
    });
  });

  const targetMap = new Map<string, LayoutTarget>();
  for (const [nodeId, target] of totals) {
    targetMap.set(nodeId, { x: target.x / target.count, y: target.y / target.count });
  }

  const deviceNodes = nodes.filter((node) => node.type === 'device');
  deviceNodes.forEach((node, index) => {
    targetMap.set(node.id, {
      x: width * 0.5,
      y: height * (0.18 + ((index + 1) / (deviceNodes.length + 1 || 1)) * 0.64),
    });
  });

  return targetMap;
}

function mergeWashChains(chains: WashChain[]) {
  const nodeIds = new Set<string>();
  const linkKeys = new Set<string>();
  const flaggedNodeIds = new Set<string>();
  for (const chain of chains) {
    chain.nodeIds.forEach((id) => nodeIds.add(id));
    chain.linkKeys.forEach((id) => linkKeys.add(id));
    chain.flaggedNodeIds.forEach((id) => flaggedNodeIds.add(id));
  }
  return { nodeIds, linkKeys, flaggedNodeIds };
}

function isCashFlowEdge(type: NetworkEdge['type']): boolean {
  return type === 'transaction';
}

function edgeColor(type: NetworkEdge['type']): string {
  if (isCashFlowEdge(type)) return FILL.cashFlow;
  if (type === 'same_card_bin') return '#16A34A';
  if (
    type === 'shared_device' ||
    type === 'shared_ip' ||
    type === 'overlapping_timing' ||
    type === 'shared_attribute'
  ) {
    return FILL.shared;
  }
  return '#94A3B8';
}

function labelConnection(type: string): string {
  return type.replace(/_/g, ' ');
}

function endpointId(endpoint: string | number | SimNode): string {
  if (typeof endpoint === 'object') return endpoint.id;
  return String(endpoint);
}

function linkKey(link: SimLink): string {
  return `${endpointId(link.source)}->${endpointId(link.target)}:${link.type}`;
}

function fitGraphToView(
  nodes: SimNode[],
  width: number,
  height: number,
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
) {
  const positioned = nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  if (positioned.length === 0 || width === 0 || height === 0) return;

  const minX = d3.min(positioned, (node) => node.x ?? 0) ?? 0;
  const maxX = d3.max(positioned, (node) => node.x ?? 0) ?? width;
  const minY = d3.min(positioned, (node) => node.y ?? 0) ?? 0;
  const maxY = d3.max(positioned, (node) => node.y ?? 0) ?? height;
  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);
  const padding = 96;
  const scale = Math.min(
    1.15,
    Math.max(0.18, Math.min((width - padding) / graphWidth, (height - padding) / graphHeight)),
  );
  const tx = width / 2 - scale * (minX + graphWidth / 2);
  const ty = height / 2 - scale * (minY + graphHeight / 2);

  svg
    .transition()
    .duration(220)
    .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

function prettyKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
