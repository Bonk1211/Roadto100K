import { useMemo, useState } from 'react';
import { LoadingDots } from 'shared';
import { getModelHealthViewModel } from '../lib/investigations/modelHealthAdapter.js';

export function SettingsScreen() {
  const model = useMemo(() => getModelHealthViewModel(), []);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');

  function runRetrainDemo() {
    setStatus('running');
    window.setTimeout(() => setStatus('done'), 1500);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
      <section
        className="bg-white p-6"
        style={{
          border: '1px solid #e0e2e6',
          borderRadius: 24,
          boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
        }}
      >
        <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>
          Model health
        </p>
        <h2 className="mt-2 text-section-heading" style={{ color: '#181d26' }}>Retraining</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Version" value={model.modelVersion} />
          <Metric label="Labels" value={String(model.labelsSinceRetrain)} />
          <Metric label="Accuracy" value={`+${model.accuracyDelta.toFixed(1)}%`} />
          <Metric label="Coverage" value={`${model.queueCoverage}%`} />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section
            className="p-5"
            style={{ backgroundColor: '#f8fafc', border: '1px solid #e0e2e6', borderRadius: 16 }}
          >
            <h3 className="text-card-title" style={{ color: '#181d26' }}>Cycle</h3>
            <ol className="mt-4 space-y-4">
              {['Decisions logged', 'Labels staged', 'Model retrained', 'Queue refreshed'].map(
                (item, index) => (
                  <li key={item} className="flex gap-3">
                    <span
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center text-small-label"
                      style={{ backgroundColor: '#eef4fc', color: '#1b61c9', borderRadius: 999, fontWeight: 600, border: '1px solid #cfe0f5' }}
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6" style={{ color: '#181d26' }}>{item}</p>
                  </li>
                ),
              )}
            </ol>
          </section>

          <aside
            className="bg-white p-5"
            style={{ border: '1px solid #e0e2e6', borderRadius: 16, boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px' }}
          >
            <p className="text-small-label uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>Window</p>
            <h3 className="mt-2 text-card-title" style={{ color: '#181d26' }}>{model.nextWindow}</h3>
            <p className="mt-2 text-caption" style={{ color: 'rgba(4,14,32,0.69)' }}>
              Last run: {new Date(model.lastTrainedAt).toLocaleString()}
            </p>

            <button
              type="button"
              onClick={runRetrainDemo}
              disabled={status === 'running'}
              className="mt-5 inline-flex h-12 w-full items-center justify-center text-white disabled:opacity-60"
              style={{
                backgroundColor: '#1b61c9',
                borderRadius: 12,
                fontWeight: 600,
                letterSpacing: '0.08px',
                boxShadow: 'rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
              }}
            >
              {status === 'running'
                ? <LoadingDots label="Running" tone="inverse" size="sm" />
                : status === 'done'
                  ? 'Completed'
                  : 'Run retrain demo'}
            </button>
          </aside>
        </div>
      </section>

      <section
        className="bg-white p-6"
        style={{
          border: '1px solid #e0e2e6',
          borderRadius: 24,
          boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px',
        }}
      >
        <p className="text-small-label uppercase" style={{ color: '#1b61c9', letterSpacing: '0.28px', fontWeight: 600 }}>Watch</p>
        <div className="mt-4 space-y-3 text-sm" style={{ color: '#181d26' }}>
          <p>Coverage under 90% needs review.</p>
          <p>Accuracy should rise after decisions land.</p>
          <p>Stage 3 spikes should trigger containment.</p>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="bg-white p-5"
      style={{ border: '1px solid #e0e2e6', borderRadius: 16, boxShadow: 'rgba(15,48,106,0.05) 0px 0px 20px' }}
    >
      <p className="text-small-label uppercase" style={{ color: 'rgba(4,14,32,0.55)', letterSpacing: '0.28px', fontWeight: 600 }}>{label}</p>
      <p className="mt-2 text-2xl" style={{ color: '#181d26', fontWeight: 600 }}>{value}</p>
    </div>
  );
}
