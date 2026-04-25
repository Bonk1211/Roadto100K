import { useState } from 'react';
import { injectTestAlert } from '../../lib/agentops.js';

type Profile = 'low_risk' | 'medium_risk' | 'high_risk';

interface Props {
  onInjected?: (alertId: string) => void;
}

const PROFILES: { id: Profile; label: string; tone: string }[] = [
  { id: 'high_risk', label: 'High-risk mule', tone: '#DC2626' },
  { id: 'medium_risk', label: 'Borderline', tone: '#F97316' },
  { id: 'low_risk', label: 'Likely clear', tone: '#16A34A' },
];

export function InjectAlertButton({ onInjected }: Props) {
  const [busy, setBusy] = useState<Profile | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function inject(profile: Profile) {
    setBusy(profile);
    setError(null);
    try {
      const res = await injectTestAlert(profile);
      setLast(res.alert_id);
      onInjected?.(res.alert_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Inject failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-lg bg-white p-4 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-feature-title text-text-primary">Inject test alert</p>
          <p className="text-caption text-muted-text">
            Push a synthetic alert into the queue. Worker picks it up within{' '}
            <span className="font-mono">2s</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => inject(p.id)}
              disabled={busy !== null}
              className="rounded-md px-3 py-2 text-small-label font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: p.tone }}
            >
              {busy === p.id ? 'Injecting…' : p.label}
            </button>
          ))}
        </div>
      </div>

      {last && !error && (
        <p className="mt-2 text-caption" style={{ color: '#166534' }}>
          ✓ Injected <span className="font-mono">{last}</span>. Watch the lanes.
        </p>
      )}
      {error && (
        <p className="mt-2 text-caption" style={{ color: '#DC2626' }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
