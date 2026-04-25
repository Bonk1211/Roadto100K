import { useMemo, useState } from 'react';
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
        className="rounded-[28px] bg-white p-6 shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <p className="text-small-label uppercase tracking-wide text-muted-text">
          Model health
        </p>
        <h2 className="mt-2 text-section-heading text-text-primary">Retraining</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Version" value={model.modelVersion} />
          <Metric label="Labels" value={String(model.labelsSinceRetrain)} />
          <Metric label="Accuracy" value={`+${model.accuracyDelta.toFixed(1)}%`} />
          <Metric label="Coverage" value={`${model.queueCoverage}%`} />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section
            className="rounded-[24px] p-5"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E5E7EB' }}
          >
            <h3 className="text-card-title text-text-primary">Cycle</h3>
            <ol className="mt-4 space-y-4">
              {['Decisions logged', 'Labels staged', 'Model retrained', 'Queue refreshed'].map(
                (item, index) => (
                  <li key={item} className="flex gap-3">
                    <span
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-small-label font-bold"
                      style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-text-primary">{item}</p>
                  </li>
                ),
              )}
            </ol>
          </section>

          <aside
            className="rounded-[24px] bg-white p-5 shadow-card"
            style={{ border: '1px solid #E5E7EB' }}
          >
            <p className="text-small-label uppercase tracking-wide text-muted-text">Window</p>
            <h3 className="mt-2 text-card-title text-text-primary">{model.nextWindow}</h3>
            <p className="mt-2 text-caption text-muted-text">
              Last run: {new Date(model.lastTrainedAt).toLocaleString()}
            </p>

            <button
              type="button"
              onClick={runRetrainDemo}
              disabled={status === 'running'}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: '#0055D4' }}
            >
              {status === 'running'
                ? 'Running...'
                : status === 'done'
                  ? 'Completed'
                  : 'Run retrain demo'}
            </button>
          </aside>
        </div>
      </section>

      <section
        className="rounded-[28px] bg-white p-6 shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <p className="text-small-label uppercase tracking-wide text-muted-text">Watch</p>
        <div className="mt-4 space-y-3 text-sm text-text-primary">
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
      className="rounded-[22px] bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <p className="text-small-label uppercase tracking-wide text-muted-text">{label}</p>
      <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}
