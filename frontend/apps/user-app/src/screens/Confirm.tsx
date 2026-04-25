import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingDots, currentUser, getStoredLanguage, type ScreenTransactionResponse } from 'shared';
import SafeSendBadge from '../components/SafeSendBadge';
import type { TransferConfirmState } from '../lib/flow';
import { formatRM, maskAccount } from '../lib/format';
import { screenTransaction, submitUserChoice } from '../lib/api';
import { useLang } from '../lib/i18n';

export default function Confirm() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as TransferConfirmState | null) ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [softWarning, setSoftWarning] = useState<ScreenTransactionResponse | null>(null);
  const [choicePending, setChoicePending] = useState<'cancel' | 'proceed' | null>(null);
  const lang = getStoredLanguage();

  const formattedTimestamp = useMemo(
    () => new Date().toLocaleString('en-MY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
    [],
  );

  if (!state?.payee) {
    navigate('/transfer', { replace: true });
    return null;
  }

  const { payee, amount, note, sessionId } = state;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await screenTransaction({
        user_id: currentUser.id,
        session_id: sessionId,
        payee_id: payee.account,
        payee_name: payee.name,
        amount,
        currency: 'MYR',
        device_id: currentUser.device_id,
        timestamp: new Date().toISOString(),
        user_avg_30d: currentUser.user_avg_30d,
      });

      if (result.action === 'hard_intercept') {
        navigate('/intercept', {
          state: {
            ...state,
            screening: result,
          },
        });
        return;
      }

      if (result.action === 'soft_warn') {
        setSoftWarning(result);
        return;
      }

      navigate('/done', {
        state: { payee, amount, status: 'success' },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction screening failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSoftChoice = async (choice: 'cancel' | 'proceed') => {
    if (!softWarning) return;
    setChoicePending(choice);
    setLoading(true);
    setError(null);
    try {
      await submitUserChoice({
        txn_id: softWarning.txn_id,
        user_id: currentUser.id,
        choice,
      });
      navigate('/done', {
        state: {
          payee,
          amount,
          status: choice === 'proceed' ? 'soft_warn_proceed' : 'soft_warn_cancelled',
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save your choice';
      setError(msg);
    } finally {
      setLoading(false);
      setChoicePending(null);
    }
  };

  return (
    <div className="phone-frame flex flex-col">
      <header className="bg-tng-blue text-white px-4 pt-4 pb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 rounded-full grid place-items-center hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-[18px] font-bold">
            {lang === 'en' ? 'Confirm transfer' : 'Sahkan pemindahan'}
          </div>
          <div className="text-[12px] opacity-80">
            {lang === 'en'
              ? 'Step 3 of 3 — SafeSend check before sending'
              : 'Langkah 3 / 3 — semakan SafeSend sebelum hantar'}
          </div>
        </div>
        <BilingualToggle value={lang} onChange={setLang} />
      </header>

      <main className="flex-1 px-4 pt-5 space-y-4">
        <div className="text-center py-2">
          <div className="text-[12px] font-semibold text-muted-text uppercase tracking-wider">
            You are sending
          </div>
          <div className="mt-2 text-[44px] font-extrabold text-text-primary leading-none tracking-tight">
            {formatRM(amount)}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] font-semibold text-muted-text uppercase tracking-wider mb-2">
            To
          </div>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-soft-blue-surface text-tng-blue grid place-items-center font-bold text-[18px] flex-shrink-0">
              {payee.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-card-title text-text-primary">{payee.name}</div>
              <div className="text-[13px] text-muted-text font-mono mt-0.5">
                TnG - {maskAccount(payee.account)}
              </div>
              <div className="text-[12px] text-muted-text mt-1">
                Account opened {payee.account_age_days} days ago
              </div>
            </div>
          </div>
        </div>

        <div className="card divide-y divide-border-gray">
          <Row label="From" value={`${currentUser.name} wallet`} />
          <Row label="Schedule" value={`Now - ${formattedTimestamp}`} />
          {note && <Row label="Note" value={note} />}
          <Row label="Total" value={formatRM(amount)} valueClass="text-text-primary font-extrabold text-[18px]" />
        </div>

        <div className="flex items-center gap-2.5 px-1">
          <SafeSendBadge size="sm" />
          <span className="text-[12px] text-muted-text">
            {lang === 'en'
              ? 'SafeSend checks this payment against scam patterns before money leaves your wallet.'
              : 'SafeSend menyemak bayaran ini dengan corak penipuan sebelum wang keluar dari dompet anda.'}
          </span>
        </div>

        {error && (
          <div className="rounded-md bg-fraud-warning-bg border border-fraud-warning-border px-3 py-2 text-[13px] text-risk-red">
            {error}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={handleConfirm} disabled={loading} className="btn-primary">
          {loading && !softWarning ? (
            <LoadingDots label="Running SafeSend screening" tone="inverse" size="sm" />
          ) : (
            `Confirm transfer ${formatRM(amount)}`
          )}
        </button>
      </div>

      {softWarning && (
        <SoftWarningModal
          lang={lang}
          warning={softWarning}
          payeeName={payee.name}
          amount={amount}
          busy={loading}
          onClose={() => setSoftWarning(null)}
          onCancel={() => void handleSoftChoice('cancel')}
          onProceed={() => void handleSoftChoice('proceed')}
          pendingChoice={choicePending}
        />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted-text">{label}</span>
      <span className={`text-[14px] text-right text-text-primary ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}

function SoftWarningModal({
  lang,
  warning,
  payeeName,
  amount,
  busy,
  pendingChoice,
  onClose,
  onCancel,
  onProceed,
}: {
  lang: 'bm' | 'en';
  warning: ScreenTransactionResponse;
  payeeName: string;
  amount: number;
  busy: boolean;
  pendingChoice: 'cancel' | 'proceed' | null;
  onClose: () => void;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-dark-security-blue/50 backdrop-blur-[1px] flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0">
      <div className="w-full max-w-sm rounded-[24px] bg-white border-2 border-fraud-warning-border shadow-elevated overflow-hidden">
        <div className="bg-electric-yellow px-4 py-4 border-b-2 border-fraud-warning-border">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-royal-blue">
            SafeSend soft warning
          </div>
          <div className="text-[18px] font-extrabold text-text-primary mt-1">
            {lang === 'en' ? 'Please double-check this transfer' : 'Sila semak semula pemindahan ini'}
          </div>
          <div className="text-[13px] text-text-primary mt-2">
            {lang === 'en' ? warning.soft_warning_en : warning.soft_warning_bm}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl bg-soft-blue-surface border border-sky-blue p-3">
            <div className="text-[12px] font-bold text-text-primary">
              {lang === 'en'
                ? `${formatRM(amount)} to ${payeeName}`
                : `${formatRM(amount)} kepada ${payeeName}`}
            </div>
            <div className="text-[11px] text-muted-text mt-1">
              Score {warning.final_score}/100
            </div>
          </div>

          <div className="space-y-2">
            {warning.triggered_signals.map((signal) => (
              <div key={signal.signal} className="rounded-lg border border-border-gray px-3 py-2">
                <div className="text-[13px] font-semibold text-text-primary">
                  {lang === 'en' ? signal.label_en : signal.label_bm}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button onClick={onCancel} disabled={busy} className="btn-secondary">
              {pendingChoice === 'cancel' ? (
                <LoadingDots
                  label={lang === 'en' ? 'Saving choice' : 'Menyimpan pilihan'}
                  tone="primary"
                  size="sm"
                />
              ) : lang === 'en' ? (
                'Cancel transfer'
              ) : (
                'Batalkan pemindahan'
              )}
            </button>
            <button onClick={onProceed} disabled={busy} className="btn-primary">
              {pendingChoice === 'proceed'
                ? (
                  <LoadingDots
                    label={lang === 'en' ? 'Saving choice' : 'Menyimpan pilihan'}
                    tone="inverse"
                    size="sm"
                  />
                )
                : lang === 'en'
                  ? 'Proceed with caution'
                  : 'Teruskan juga'}
            </button>
            <button onClick={onClose} disabled={busy} className="btn-ghost">
              {lang === 'en' ? 'Review again' : 'Semak sekali lagi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
