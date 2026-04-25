import type { Alert, AgentDecision, MuleProfile } from 'shared';
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
          !
        </div>
        <p className="text-card-title text-text-primary">Select an alert</p>
        <p className="mt-2 text-caption">
          Click any row to inspect mule signals, AI explanation, and containment readiness.
        </p>
      </aside>
    );
  }

  const band = bandLabel(alert.score);
  const isMule = alert.alert_type === 'mule_eviction';

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
            {isMule ? `Mule eviction ${stageLabel(alert)}` : 'Sender interception'} - {alert.id}
          </p>
          <h2 className="mt-1 truncate text-section-heading text-text-primary">
            {alert.txn.payee_name}
          </h2>
          <p className="text-caption text-muted-text">
            Account {alert.txn.payee_account} from user {alert.txn.user_id}
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
        {isMule && alert.mule_profile ? (
          <MuleStagePanel profile={alert.mule_profile} exposure={alert.rm_at_risk ?? alert.txn.amount} />
        ) : (
          <TransactionPanel alert={alert} />
        )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-card-title text-text-primary">
              {isMule ? 'Mule risk signals' : 'Risk signals'}
            </h3>
            <ScamTypeChip scamType={alert.explanation.scam_type} />
          </div>
          <RiskSignalsList signals={alert.signals} />
        </section>

        {isMule && alert.containment_accounts && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-card-title text-text-primary">Containment preview</h3>
              <span className="text-small-label font-semibold text-muted-text">
                {alert.containment_accounts.length} linked accounts
              </span>
            </div>
            <div className="space-y-2">
              {alert.containment_accounts.slice(0, 4).map((account) => (
                <div
                  key={account.account_id}
                  className="flex items-center justify-between rounded-md bg-app-gray px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-text-primary">{account.display_name}</p>
                    <p className="text-caption text-muted-text">
                      {connectionLabel(account.connection_type)} - degree {account.degree}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-text-primary">
                      RM {account.rm_exposure.toLocaleString('en-MY')}
                    </p>
                    <p className="text-small-label font-semibold" style={{ color: '#DC2626' }}>
                      {account.risk_score}/100
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-caption text-muted-text">
              Open Network to execute the one-click containment demo.
            </p>
          </section>
        )}

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

function MuleStagePanel({ profile, exposure }: { profile: MuleProfile; exposure: number }) {
  return (
    <section>
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-small-label uppercase tracking-wide" style={{ color: '#DC2626' }}>
              Stage {profile.stage} auto-eviction
            </p>
            <h3 className="mt-1 text-card-title text-text-primary">
              Withdrawals blocked, funds held in escrow
            </h3>
          </div>
          <div className="text-right">
            <p className="text-small-label text-muted-text">Total exposure</p>
            <p className="font-mono text-xl font-bold text-text-primary">
              RM {exposure.toLocaleString('en-MY')}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-md bg-app-gray p-4">
        <Field label="Inbound senders, 6h" value={String(profile.unique_inbound_senders_6h)} warn />
        <Field label="Avg inbound gap" value={`${profile.avg_inbound_gap_minutes} min`} warn />
        <Field label="Inbound/outbound ratio" value={`${profile.inbound_outbound_ratio}%`} warn />
        <Field label="Merchant spend, 7d" value={`RM ${profile.merchant_spend_7d}`} warn />
        <Field label="Withdrawal status" value={profile.withdrawal_status.replace(/_/g, ' ')} warn />
        <Field label="Escrow amount" value={`RM ${profile.escrow_amount.toLocaleString('en-MY')}`} highlight />
      </div>
    </section>
  );
}

function TransactionPanel({ alert }: { alert: Alert }) {
  return (
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
        <Field label="User 30-day avg" value={`RM ${alert.txn.user_avg_30d.toLocaleString('en-MY')}`} />
        <Field label="Amount ratio" value={`${alert.txn.amount_ratio.toFixed(2)}x`} warn={alert.txn.amount_ratio > 3} />
        <Field label="Device" value={alert.txn.device_match ? 'Recognised' : 'Mismatch'} warn={!alert.txn.device_match} />
        <Field label="Prior transfers" value={String(alert.txn.prior_txns_to_payee)} warn={alert.txn.prior_txns_to_payee === 0} />
      </div>
    </section>
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
        className={`mt-1 capitalize ${mono ? 'font-mono' : ''} ${
          highlight ? 'text-txn-amount' : 'text-base font-semibold'
        }`}
        style={{ color: warn ? '#DC2626' : '#111827' }}
      >
        {value}
      </p>
    </div>
  );
}

function stageLabel(alert: Alert): string {
  return alert.mule_stage ? `Stage ${alert.mule_stage}` : '';
}

function connectionLabel(type: string): string {
  return type.replace(/_/g, ' ');
}
