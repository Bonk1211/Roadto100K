import { useEffect, useState } from 'react';
import type { NetworkGraph } from 'shared';
import { LoadingDots } from 'shared';
import { fetchNetworkGraph } from '../lib/api.js';
import { NetworkGraphModule } from '../modules/investigations/NetworkGraphModule.js';

export function NetworkScreen() {
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchNetworkGraph()
      .then((result) => {
        if (!active) return;
        setGraph(result);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        console.error(error);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-6">
      <section
        className="rounded-[24px] bg-white p-5 shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-small-label uppercase tracking-wide text-muted-text">
              Explorer
            </p>
            <h2 className="mt-1 text-section-heading text-text-primary">Network graph</h2>
          </div>
          <span
            className="rounded-pill px-3 py-1 text-small-label font-semibold"
            style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
          >
            {loading ? <LoadingDots label="Loading graph" tone="primary" size="sm" /> : 'Select a node'}
          </span>
        </div>
      </section>

      <div className="min-h-0 flex-1">
        <NetworkGraphModule graph={graph} focusAlert={null} />
      </div>
    </div>
  );
}
