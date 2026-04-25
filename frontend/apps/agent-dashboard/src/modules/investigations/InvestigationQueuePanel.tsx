import type { InvestigationAlert } from '../../lib/investigations/types.js';
import { AlertTable } from '../../components/AlertTable.js';

interface Props {
  alerts: InvestigationAlert[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (alertId: string) => void;
}

export function InvestigationQueuePanel({
  alerts,
  selectedId,
  loading,
  onSelect,
}: Props) {
  return (
    <section className="flex min-h-0 flex-col gap-4">
      <h3 className="text-card-title text-text-primary">Queue</h3>
      <div className="min-h-0 flex-1 overflow-auto">
        <AlertTable
          alerts={alerts}
          selectedId={selectedId}
          onSelect={onSelect}
          loading={loading}
        />
      </div>
    </section>
  );
}
