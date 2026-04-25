import type { Alert, NetworkEdge, NetworkGraph, NetworkNode } from 'shared';
import type { ContainmentCandidate, InvestigationAlert } from './types.js';

export function deriveContainmentCandidates(
  graph: NetworkGraph | null,
  selectedAlert: Alert | InvestigationAlert | null,
): ContainmentCandidate[] {
  if (!graph || !selectedAlert) return [];
  const alert = 'alert' in selectedAlert ? selectedAlert.alert : selectedAlert;
  const focusId = alert.txn.payee_id;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const accountEdges = graph.edges.filter(
    (edge) => edge.source === focusId || edge.target === focusId,
  );

  const firstDegree = new Map<string, ContainmentCandidate>();
  for (const edge of accountEdges) {
    const otherId = edge.source === focusId ? edge.target : edge.source;
    const node = nodeById.get(otherId);
    if (!node || node.type !== 'account') continue;
    firstDegree.set(otherId, candidateFromNode(node, edge, 1, true, scoreFromNode(node)));
  }

  const sharedDevices = new Set<string>();
  for (const edge of accountEdges) {
    const otherId = edge.source === focusId ? edge.target : edge.source;
    const node = nodeById.get(otherId);
    if (node?.type === 'device') sharedDevices.add(otherId);
  }

  const secondDegree = new Map<string, ContainmentCandidate>();
  for (const deviceId of sharedDevices) {
    for (const edge of graph.edges) {
      if (edge.source !== deviceId && edge.target !== deviceId) continue;
      const otherId = edge.source === deviceId ? edge.target : edge.source;
      if (otherId === focusId || firstDegree.has(otherId)) continue;
      const node = nodeById.get(otherId);
      if (!node || node.type !== 'account') continue;
      secondDegree.set(
        otherId,
        candidateFromNode(node, edge, 2, node.flagged, Math.max(43, scoreFromNode(node) - 12)),
      );
    }
  }

  return [...firstDegree.values(), ...secondDegree.values()].sort((left, right) => {
    if (left.degree !== right.degree) return left.degree - right.degree;
    return right.riskScore - left.riskScore;
  });
}

function candidateFromNode(
  node: NetworkNode,
  edge: NetworkEdge,
  degree: 1 | 2,
  selectedByDefault: boolean,
  riskScore: number,
): ContainmentCandidate {
  return {
    id: node.id,
    label: node.label,
    accountRef: String(node.metadata?.account ?? node.id),
    degree,
    connectionReason: connectionReason(edge.type, degree),
    riskScore,
    rmExposure: Math.round((edge.weight ?? 3800) * (degree === 1 ? 1.2 : 0.75)),
    selectedByDefault,
    flagged: node.flagged,
  };
}

function connectionReason(type: NetworkEdge['type'], degree: 1 | 2): string {
  if (type === 'transaction') return 'Direct transaction';
  if (type === 'shared_device') return degree === 1 ? 'Shared device' : 'Device cluster';
  return degree === 1 ? 'Shared attribute' : 'Second-degree link';
}

function scoreFromNode(node: NetworkNode): number {
  if (node.flagged) return 82;
  return node.type === 'device' ? 58 : 64;
}
