import type { AgentDecision } from 'shared';
import { AlertDetail } from '../../screens/AlertDetail.js';
import type { InvestigationAlert } from '../../lib/investigations/types.js';

interface Props {
  alert: InvestigationAlert | null;
  onDecide: (alertId: string, action: AgentDecision) => Promise<void>;
}

export function InvestigationDetailPanel({ alert, onDecide }: Props) {
  return <AlertDetail alert={alert} onDecide={onDecide} />;
}
