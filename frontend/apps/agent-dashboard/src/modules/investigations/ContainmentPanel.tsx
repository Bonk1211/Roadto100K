import { useEffect, useMemo, useState } from 'react';
import { LoadingDots } from 'shared';
import type { ContainmentCandidate } from '../../lib/investigations/types.js';

interface Props {
  candidates: ContainmentCandidate[];
  focusLabel?: string;
}

export function ContainmentPanel({ candidates, focusLabel }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [executionState, setExecutionState] = useState<'idle' | 'running' | 'done'>('idle');

  useEffect(() => {
    setSelectedIds(candidates.filter((candidate) => candidate.selectedByDefault).map((candidate) => candidate.id));
    setExecutionState('idle');
  }, [candidates]);

  const totalExposure = useMemo(
    () =>
      candidates
        .filter((candidate) => selectedIds.includes(candidate.id))
        .reduce((sum, candidate) => sum + candidate.rmExposure, 0),
    [candidates, selectedIds],
  );

  function toggleCandidate(id: string) {
    setExecutionState('idle');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function runContainment() {
    if (selectedIds.length === 0) return;
    setExecutionState('running');
    window.setTimeout(() => setExecutionState('done'), 1400);
  }

  return (
    <section
      className="rounded-[24px] bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-card-title text-text-primary">Containment</h3>
          <p className="text-caption text-muted-text">{focusLabel ?? 'No focus account'}</p>
        </div>
        <span className="text-sm font-semibold text-text-primary">
          RM {totalExposure.toLocaleString('en-MY')}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {candidates.length === 0 && (
          <div className="rounded-2xl bg-app-gray px-4 py-5 text-caption text-muted-text">
            No linked accounts.
          </div>
        )}

        {candidates.map((candidate) => {
          const selected = selectedIds.includes(candidate.id);
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => toggleCandidate(candidate.id)}
              className="flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-4 text-left transition-colors"
              style={{
                backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                border: `1px solid ${selected ? '#93C5FD' : '#E5E7EB'}`,
              }}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-primary">{candidate.label}</span>
                  <DegreeBadge degree={candidate.degree} />
                </div>
                <p className="mt-1 text-caption text-muted-text">{candidate.connectionReason}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-text-primary">{candidate.riskScore}/100</p>
                <p className="text-caption text-muted-text">
                  RM {candidate.rmExposure.toLocaleString('en-MY')}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-app-gray p-4">
        <Row label="Selected" value={String(selectedIds.length)} />
        <Row label="Exposure" value={`RM ${totalExposure.toLocaleString('en-MY')}`} />
      </div>

      <button
        type="button"
        onClick={runContainment}
        disabled={selectedIds.length === 0 || executionState === 'running'}
      className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl font-bold text-white disabled:opacity-60"
      style={{ backgroundColor: '#DC2626' }}
    >
      {executionState === 'running'
        ? <LoadingDots label="Executing" tone="inverse" size="sm" />
        : executionState === 'done'
            ? 'Executed'
            : 'Execute containment'}
      </button>
    </section>
  );
}

function DegreeBadge({ degree }: { degree: 1 | 2 }) {
  return (
    <span
      className="rounded-pill px-2 py-1 text-small-label font-semibold"
      style={{
        backgroundColor: degree === 1 ? '#DBEAFE' : '#F5F3FF',
        color: degree === 1 ? '#1D4ED8' : '#6D28D9',
      }}
    >
      {degree === 1 ? '1st-degree' : '2nd-degree'}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-caption text-muted-text">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}
