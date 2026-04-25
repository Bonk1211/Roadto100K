import type { AgentDecision } from 'shared';
import { ActionButtons } from '../components/ActionButtons.js';
import { ExplanationCard } from '../components/ExplanationCard.js';
import { RiskSignalsList } from '../components/RiskSignalsList.js';
import { RiskScoreBadge, bandLabel } from '../components/RiskScoreBadge.js';
import { ScamTypeChip } from '../components/ScamTypeChip.js';
import type { InvestigationAlert } from '../lib/investigations/types.js';

interface Props {
  alert: InvestigationAlert | null;
  onDecide: (alertId: string, action: AgentDecision) => Promise<void>;
}

export function AlertDetail({ alert, onDecide }: Props) {
  if (!alert) {
    return (
      <aside
        className="flex h-full flex-col items-center justify-center rounded-[24px] bg-white p-8 text-center text-muted-text shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-pill"
          style={{ backgroundColor: '#EAF3FF', color: '#005BAC', fontSize: '28px' }}
        >
          Q
        </div>
        <p className="text-card-title text-text-primary">Select an alert</p>
        <p className="mt-2 text-caption">Pick a queue row.</p>
      </aside>
    );
  }

  const riskBand = bandLabel(alert.alert.score);

  return (
    <aside
      className="flex h-full flex-col overflow-hidden rounded-[24px] bg-white shadow-card"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <header
        className="px-6 py-5"
        style={{
          borderBottom: '1px solid #E5E7EB',
          background:
            alert.stage === 'stage_3'
              ? 'linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)'
              : 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-small-label uppercase tracking-wide text-muted-text">
              {alert.alertLabel}
            </p>
            <h2 className="mt-1 text-section-heading text-text-primary">{alert.accountLabel}</h2>
            <p className="text-caption text-muted-text">
              {alert.transactionSummary} · {new Date(alert.alert.txn.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RiskScoreBadge score={alert.alert.score} size="lg" />
            <span className="text-small-label font-semibold" style={{ color: riskBand.color }}>
              {riskBand.text}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StageBadge stage={alert.stage} />
          <ScamTypeChip scamType={alert.alert.explanation.scam_type} />
          <Pill label={alert.alertType === 'mule_eviction' ? 'Receiver-side case' : 'Sender-side case'} />
          <Pill label={`RM ${alert.rmAtRisk.toLocaleString('en-MY')} at risk`} />
        </div>

        <div className="mt-4 rounded-2xl bg-white/75 p-4" style={{ border: '1px solid #E5E7EB' }}>
          <p className="text-small-label uppercase tracking-wide text-muted-text">Summary</p>
          <p className="mt-2 text-sm leading-6 text-text-primary">{alert.investigationSummary}</p>
          <p className="mt-2 text-caption font-semibold text-muted-text">{alert.recommendedAction}</p>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section>
          <h3 className="mb-3 text-card-title text-text-primary">Stage</h3>
          <div className="grid gap-3 xl:grid-cols-3">
            {alert.stageTimeline.map((step, index) => {
              const status = step.split(' - ')[0];
              return (
                <div
                  key={step}
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor:
                      status === 'Done' ? '#ECFDF5' : status === 'Active' ? '#EFF6FF' : '#F8FAFC',
                    border: `1px solid ${status === 'Done' ? '#86EFAC' : status === 'Active' ? '#BFDBFE' : '#E5E7EB'}`,
                  }}
                >
                  <p className="text-small-label uppercase tracking-wide text-muted-text">
                    Stage {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">
                    {step.replace(/^[A-Za-z]+\s-\s/, '')}
                  </p>
                  <p className="mt-2 text-caption text-muted-text">{status}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <InfoCard title="Account">
            <KeyValue label="Payee account" value={alert.alert.txn.payee_account} mono />
            <KeyValue label="Account age" value={`${alert.alert.txn.payee_account_age_days} days`} />
            <KeyValue label="Linked accounts" value={String(alert.linkedAccountCount)} />
            <KeyValue label="Stage reason" value={alert.stageReason} />
          </InfoCard>

          <InfoCard title="Transaction">
            <KeyValue label="Amount" value={`RM ${alert.alert.txn.amount.toLocaleString('en-MY')}`} />
            <KeyValue label="User 30-day average" value={`RM ${alert.alert.txn.user_avg_30d.toLocaleString('en-MY')}`} />
            <KeyValue label="Amount ratio" value={`${alert.alert.txn.amount_ratio.toFixed(2)}x`} />
            <KeyValue label="Device match" value={alert.alert.txn.device_match ? 'Recognised' : 'Mismatch'} />
          </InfoCard>
        </section>

        <section>
          <h3 className="mb-3 text-card-title text-text-primary">Signals</h3>
          <RiskSignalsList signals={alert.alert.signals} />
        </section>

        <section>
          <ExplanationCard
            explanation={alert.alert.explanation}
            heading="Bedrock explanation"
            subtitle={alert.alertType === 'mule_eviction' ? 'Stage rationale.' : 'Transfer rationale.'}
          />
        </section>
      </div>

      <footer
        className="px-6 py-5"
        style={{ borderTop: '1px solid #E5E7EB', backgroundColor: '#F8FAFC' }}
      >
        <ActionButtons
          alertId={alert.alert.id}
          status={alert.alert.status}
          onDecide={(action) => onDecide(alert.alert.id, action)}
        />
      </footer>
    </aside>
  );
}

function StageBadge({ stage }: { stage: InvestigationAlert['stage'] }) {
  const style =
    stage === 'stage_3'
      ? { bg: '#DC2626', fg: '#FFFFFF', label: 'Stage 3' }
      : stage === 'stage_2'
        ? { bg: '#FFEDD5', fg: '#C2410C', label: 'Stage 2' }
        : { bg: '#FEF3C7', fg: '#92400E', label: 'Stage 1' };
  return (
    <span
      className="inline-flex rounded-pill px-3 py-1 text-small-label font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {style.label}
    </span>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex rounded-pill px-3 py-1 text-small-label font-semibold"
      style={{ backgroundColor: '#FFFFFF', color: '#0F172A', border: '1px solid #E5E7EB' }}
    >
      {label}
    </span>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl bg-app-gray p-4"
      style={{ border: '1px solid #E5E7EB' }}
    >
      <h3 className="text-card-title text-text-primary">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function KeyValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-caption text-muted-text">{label}</span>
      <span className={`text-right text-sm font-semibold text-text-primary ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
