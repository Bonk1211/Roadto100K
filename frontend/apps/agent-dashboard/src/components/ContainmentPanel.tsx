import { useState } from 'react';
import type {
  ContainmentExecuteApiResponse,
  ContainmentPreviewResponse,
} from 'shared';
import { executeContainment, fetchContainmentPreview } from '../lib/api.js';

const RISK_COLORS = {
  critical: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  high: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  medium: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  low: { bg: '#ECFDF5', text: '#166534', border: '#86EFAC' },
} as const;

function bandFor(score: number): keyof typeof RISK_COLORS {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function ContainmentPanel() {
  const [accountInput, setAccountInput] = useState('');
  const [preview, setPreview] = useState<ContainmentPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContainmentExecuteApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchContainmentPreview(id.trim());
      setPreview(data);
      setSelected(new Set(data.linked_accounts.map((a) => a.account_id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Preview failed');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onExecute = async () => {
    if (!preview) return;
    setExecuting(true);
    setError(null);
    try {
      const ids = preview.linked_accounts
        .filter((a) => selected.has(a.account_id))
        .map((a) => a.account_id);
      const data = await executeContainment(
        preview.focal_account.account_id,
        ids,
      );
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const selectedExposure = preview
    ? preview.linked_accounts
        .filter((a) => selected.has(a.account_id))
        .reduce((sum, a) => sum + a.rm_exposure, 0)
    : 0;

  return (
    <section className="rounded-2xl border border-border-gray bg-white p-4 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-feature-title text-text-primary">Bulk Network Containment</h2>
          <p className="text-small-label text-muted-text">
            Surface 1st/2nd-degree linked accounts → one-click lock
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={accountInput}
          onChange={(e) => setAccountInput(e.target.value)}
          placeholder="Mule account_id (e.g. acc_mule_001)"
          className="flex-1 min-w-[260px] rounded-xl border border-border-gray px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void loadPreview(accountInput);
          }}
        />
        <button
          onClick={() => void loadPreview(accountInput)}
          disabled={loading || !accountInput.trim()}
          className="rounded-xl bg-[#1b61c9] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Preview Network'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-sm text-[#991B1B]">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Focal mule score" value={`${Math.round(preview.focal_account.risk_score)}/100`} />
            <Stat label="Linked accounts" value={preview.total_linked.toString()} />
            <Stat label="1st-degree" value={preview.first_degree_count.toString()} />
            <Stat
              label="Total RM exposure"
              value={`RM ${preview.total_rm_exposure.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-gray">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] text-left text-[11px] uppercase tracking-wider text-muted-text">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.size === preview.linked_accounts.length && preview.linked_accounts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(new Set(preview.linked_accounts.map((a) => a.account_id)));
                        } else {
                          setSelected(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Degree</th>
                  <th className="px-3 py-2">Connection</th>
                  <th className="px-3 py-2 text-right">Risk</th>
                  <th className="px-3 py-2 text-right">RM exposure</th>
                </tr>
              </thead>
              <tbody>
                {preview.linked_accounts.map((a) => {
                  const band = bandFor(a.risk_score);
                  const colors = RISK_COLORS[band];
                  return (
                    <tr key={a.account_id} className="border-t border-border-gray">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(a.account_id)}
                          onChange={() => toggle(a.account_id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{a.account_id}</td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: a.degree === 1 ? '#FEE2E2' : '#DBEAFE', color: a.degree === 1 ? '#991B1B' : '#1E40AF' }}
                        >
                          {a.degree === 1 ? '1st' : '2nd'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-text">{a.connection_type}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className="rounded-pill px-2 py-0.5 text-[11px] font-bold"
                          style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                        >
                          {Math.round(a.risk_score)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        RM {a.rm_exposure.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
                {preview.linked_accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-muted-text">
                      No linked accounts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8fafc] px-4 py-3">
            <div className="text-sm">
              <div className="font-semibold text-text-primary">
                {selected.size} of {preview.linked_accounts.length} selected
              </div>
              <div className="text-xs text-muted-text">
                RM {selectedExposure.toLocaleString('en-MY', { minimumFractionDigits: 2 })} exposure to contain
              </div>
            </div>
            <button
              onClick={() => void onExecute()}
              disabled={executing || selected.size === 0}
              className="rounded-xl bg-[#dc2626] px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              {executing ? 'Executing…' : `Execute Containment (${selected.size + 1})`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-[#86EFAC] bg-[#ECFDF5] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#166534]">
                Containment executed in {result.elapsed_ms}ms
              </div>
              <h3 className="mt-1 text-feature-title text-text-primary">
                {result.incident_report.incident_title}
              </h3>
            </div>
            <span className="rounded-pill bg-[#16A34A] px-3 py-1 text-xs font-bold text-white">
              {result.contained_count} contained
            </span>
          </div>
          <p className="mt-2 text-sm text-text-primary">{result.incident_report.pattern_description}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Containment ID" value={result.containment_id.slice(0, 8) + '…'} />
            <Stat label="Alert ID" value={result.alert_id.slice(0, 8) + '…'} />
            <Stat
              label="RM exposure"
              value={`RM ${result.total_rm_exposure.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`}
            />
            <Stat label="Actions" value={result.actions_taken.length.toString()} />
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-[#166534]">Compliance incident report</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs">
              {JSON.stringify(result.incident_report, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-border-gray">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-text">{label}</div>
      <div className="text-sm font-bold text-text-primary">{value}</div>
    </div>
  );
}
