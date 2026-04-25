import { useState } from 'react';
import { fraudQuery, type FraudQueryResponse } from '../lib/api.js';

interface Props {
  onResults: (res: FraudQueryResponse | null) => void;
}

const EXAMPLES = [
  'High-risk open alerts above RM 1000',
  'Mule eviction alerts in last 24 hours',
  'Accounts that received from new payees over RM 5000',
  'Transactions with device mismatch and amount over RM 3000',
];

export function FraudQueryBar({ onResults }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<FraudQueryResponse | null>(null);

  async function run(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fraudQuery(q.trim());
      setLast(res);
      onResults(res);
    } catch (err: unknown) {
      let msg = 'Query failed';
      if (err && typeof err === 'object' && 'message' in err) {
        msg = String((err as { message: unknown }).message);
      }
      setError(msg);
      onResults(null);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery('');
    setLast(null);
    setError(null);
    onResults(null);
  }

  return (
    <div
      className="rounded-lg bg-white p-4 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-pill font-bold"
          style={{ backgroundColor: '#FFE600', color: '#0055D4' }}
        >
          ⌕
        </div>
        <div className="flex-1">
          <p className="text-small-label uppercase tracking-wide text-muted-text">
            Fraud query · Bedrock NL → SQL
          </p>
          <p className="text-caption text-muted-text">
            Ask in English or BM. Results filter the alert queue below.
          </p>
        </div>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "Show accounts that topped up from 3+ senders today"'
          className="flex-1 rounded-md border px-4 py-2 text-base"
          style={{ borderColor: '#D1D5DB' }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md px-5 py-2 text-base font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: '#005BAC' }}
        >
          {loading ? 'Querying…' : 'Run'}
        </button>
        {(last || error) && (
          <button
            type="button"
            onClick={clear}
            className="rounded-md px-4 py-2 text-base font-semibold"
            style={{ backgroundColor: '#EAF3FF', color: '#005BAC' }}
          >
            Clear
          </button>
        )}
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQuery(ex);
              run(ex);
            }}
            disabled={loading}
            className="rounded-pill px-3 py-1 text-small-label font-semibold"
            style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-caption" style={{ color: '#DC2626' }}>
          ⚠ {error}
        </p>
      )}

      {last && !error && (
        <div
          className="mt-3 rounded-md p-3 text-caption"
          style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}
        >
          <p className="font-semibold">{last.summary || last.spec.summary}</p>
          <p>
            {last.count} match{last.count === 1 ? '' : 'es'} · {last.elapsed_ms}ms ·{' '}
            <span className="font-mono text-text-primary">
              {last.spec.filters
                .map(
                  (f) => `${f.field} ${f.op} ${JSON.stringify(f.value)}`,
                )
                .join(' AND ')}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
