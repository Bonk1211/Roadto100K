import { useEffect, useState } from 'react';
import type { NetworkGraph } from 'shared';
import { fetchNetworkGraph } from '../lib/api.js';
import { NetworkGraphModule } from '../modules/investigations/NetworkGraphModule.js';

export function NetworkScreen() {
  const [graph, setGraph] = useState<NetworkGraph | null>(null);

  useEffect(() => {
    let active = true;

    fetchNetworkGraph()
      .then((result) => {
        if (!active) return;
        setGraph(result);
      })
      .catch((error) => {
        if (!active) return;
        console.error(error);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-full min-h-[760px] flex-col">
      <div className="min-h-0 flex-1">
        <NetworkGraphModule graph={graph} focusAlert={null} />
      </div>
    </div>
  );
}
