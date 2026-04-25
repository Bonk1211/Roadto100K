import type { Alert, AgentDecision } from 'shared';
import { ActionButtons } from '../components/ActionButtons.js';
import { ExplanationCard } from '../components/ExplanationCard.js';
import { RiskScoreBadge, bandLabel } from '../components/RiskScoreBadge.js';
import { RiskSignalsList } from '../components/RiskSignalsList.js';
import { ScamTypeChip } from '../components/ScamTypeChip.js';

interface Props {
  alert: Alert | null;
  onDecide: (alertId: string, action: AgentDecision) => Promise<void>;
}

export function AlertDetail({ alert, onDecide }: Props) {
  if (!alert) {
    return (
      <aside
        className="hidden h-full flex-col items-center justify-center rounded-lg bg-white p-8 text-center text-muted-text shadow-card xl:flex"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-pill"
          style={{ backgroundColor: '#EAF3FF', color: '#005BAC', fontSize: '28px' }}
        >
          ◎
        </div>
        <p className="text-card-title text-text-primary">Select an alert</p>
        <p className="mt-2 text-caption">
          Click any row in the alert queue to inspect transaction details, the
          AI explanation and take action.
        </p>
      </aside>
    );
  }

  const band = bandLabel(alert.score);

  return (
    <aside
      className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header
        className="flex items-start justify-between gap-4 px-6 py-5"
        style={{ borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-small-label uppercase tracking-wide text-muted-text">
            Alert {alert.id}
          </p>
          <h2 className="mt-1 truncate text-section-heading text-text-primary">
            {alert.txn.payee_name}
          </h2>
          <p className="text-caption text-muted-text">
            From user {alert.txn.user_id} · {new Date(alert.txn.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RiskScoreBadge score={alert.score} size="lg" />
          <span className="text-small-label font-semibold" style={{ color: band.color }}>
            {band.text}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section>
          <h3 className="mb-3 text-card-title text-text-primary">Transaction</h3>
          <div className="grid grid-cols-2 gap-4 rounded-md bg-app-gray p-4">
            <Field label="Amount" value={`RM ${alert.txn.amount.toLocaleString('en-MY')}`} highlight />
            <Field label="Payee account" value={alert.txn.payee_account} mono />
            <Field
              label="Account age"
              value={`${alert.txn.payee_account_age_days} days`}
              warn={alert.txn.payee_account_age_days < 14}
            />
            <Field
              label="Hour"
              value={`${String(alert.txn.hour_of_day).padStart(2, '0')}:00`}
              warn={alert.txn.hour_of_day < 6 || alert.txn.hour_of_day >= 22}
            />
            <Field
              label="User 30-day avg"
              value={`RM ${alert.txn.user_avg_30d.toLocaleString('en-MY')}`}
            />
            <Field
              label="Amount ratio"
              value={`${alert.txn.amount_ratio.toFixed(2)}×`}
              warn={alert.txn.amount_ratio > 3}
            />
            <Field
              label="Device"
              value={alert.txn.device_match ? 'Recognised' : 'Mismatch'}
              warn={!alert.txn.device_match}
            />
            <Field
              label="Prior transfers"
              value={String(alert.txn.prior_txns_to_payee)}
              warn={alert.txn.prior_txns_to_payee === 0}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <ScamTypeChip scamType={alert.explanation.scam_type} />
            <span className="text-caption text-muted-text">
              Predicted scam pattern (Bedrock + EAS)
            </span>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-card-title text-text-primary">Risk signals</h3>
          <RiskSignalsList signals={alert.signals} />
        </section>

        <section>
          <ExplanationCard explanation={alert.explanation} />
        </section>
      </div>

      <footer
        className="px-6 py-5"
        style={{ borderTop: '1px solid #E5E7EB', backgroundColor: '#F5F7FA' }}
      >
        <ActionButtons
          alertId={alert.id}
          status={alert.status}
          onDecide={(action) => onDecide(alert.id, action)}
        />
      </footer>
    </aside>
  );
}

interface FieldProps {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
  mono?: boolean;
}

function Field({ label, value, highlight, warn, mono }: FieldProps) {
  return (
    <div>
      <p className="text-small-label uppercase tracking-wide text-muted-text">
        {label}
      </p>
      <p
        className={`mt-1 ${mono ? 'font-mono' : ''} ${
          highlight ? 'text-txn-amount' : 'text-base font-semibold'
        }`}
        style={{ color: warn ? '#DC2626' : '#111827' }}
      >
        {value}
      </p>
    </div>
  );
}
