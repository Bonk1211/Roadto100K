import type { NetworkGraph } from 'shared';
import { mockNetworkGraph } from 'shared';

export function getNetworkGraph(): NetworkGraph {
  return {
    nodes: mockNetworkGraph.nodes.map((n) => ({ ...n })),
    edges: mockNetworkGraph.edges.map((e) => ({ ...e })),
  };
}
