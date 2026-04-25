import { useEffect, useState } from 'react';
import { DEMO_QUERIES } from '../../lib/investigations/queryAdapter.js';
import type { QueryResultState } from '../../lib/investigations/types.js';

interface Props {
  isOpen: boolean;
  query: string;
  queryState: QueryResultState;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onReset: () => void;
}

export function NlpQueryDrawer({
  isOpen,
  query,
  queryState,
  onClose,
  onQueryChange,
  onReset,
}: Props) {
  const [mounted, setMounted] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setMounted(true);
    else {
      const timer = window.setTimeout(() => setMounted(false), 240);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-dark-security-blue/20">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close drawer" />
      <aside
        className={`h-full w-full max-w-[420px] transform bg-white shadow-elevated transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ borderLeft: '1px solid #E5E7EB' }}
      >
        <div className="flex items-center justify-between border-b border-border-gray px-5 py-4">
          <div>
            <p className="text-small-label uppercase tracking-wide text-muted-text">NLP query</p>
            <h3 className="text-card-title text-text-primary">Query drawer</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-pill"
            style={{ backgroundColor: '#F5F7FA', color: '#005BAC' }}
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Type a fraud query"
            className="h-12 w-full rounded-2xl border px-4 text-sm text-text-primary outline-none"
            style={{ borderColor: '#C7DCFB', backgroundColor: '#F8FBFF' }}
          />

          <div className="flex flex-wrap gap-2">
            {DEMO_QUERIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onQueryChange(item)}
                className="rounded-pill px-4 py-2 text-small-label font-semibold"
                style={{ backgroundColor: '#F5F7FA', color: '#0F172A', border: '1px solid #E5E7EB' }}
              >
                {item}
              </button>
            ))}
          </div>

          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E5E7EB' }}
          >
            <p className="font-semibold text-text-primary">{queryState.title}</p>
            <p className="mt-1 text-caption text-muted-text">{queryState.detail}</p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 rounded-2xl px-4 py-3 font-semibold"
              style={{ backgroundColor: '#EAF3FF', color: '#005BAC' }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl px-4 py-3 font-semibold"
              style={{ backgroundColor: '#005BAC', color: '#FFFFFF' }}
            >
              Close
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
