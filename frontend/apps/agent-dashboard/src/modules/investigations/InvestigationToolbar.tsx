import type { QueryResultState } from '../../lib/investigations/types.js';

interface Props {
  filteredCount: number;
  totalCount: number;
  queryActive: boolean;
  queryState: QueryResultState;
  onOpenDrawer: () => void;
}

export function InvestigationToolbar({
  filteredCount,
  totalCount,
  queryActive,
  queryState,
  onOpenDrawer,
}: Props) {
  return (
    <section
      className="rounded-[24px] bg-white p-5 shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-small-label uppercase tracking-wide text-muted-text">
            Investigation workspace
          </p>
          <h2 className="mt-1 text-section-heading text-text-primary">Alert queue</h2>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="rounded-pill px-3 py-1 text-small-label font-semibold"
            style={{ backgroundColor: '#F5F7FA', color: '#005BAC' }}
          >
            {filteredCount}/{totalCount}
          </span>
          <button
            type="button"
            onClick={onOpenDrawer}
            className="inline-flex h-11 items-center justify-center rounded-2xl px-4 font-bold"
            style={{ backgroundColor: '#FFE600', color: '#0055D4', boxShadow: '0 4px 0 #0055D4' }}
          >
            Query
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className="rounded-pill px-3 py-1 text-small-label font-semibold"
          style={{ backgroundColor: queryActive ? '#EFF6FF' : '#ECFDF5', color: queryActive ? '#1D4ED8' : '#166534' }}
        >
          {queryActive ? 'Query mode' : 'Live mode'}
        </span>
        <span className="text-caption text-muted-text">{queryState.title}</span>
        <span className="text-caption text-muted-text">{queryState.detail}</span>
      </div>
    </section>
  );
}
