import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingDots, currentUser, type ScreenTransactionResponse } from 'shared';
import AppShell from '../components/AppShell';
import BalanceSnapshotCard from '../components/BalanceSnapshotCard';
import BilingualToggle from '../components/BilingualToggle';
import BottomActionBar from '../components/BottomActionBar';
import FlowHeader from '../components/FlowHeader';
import RecipientSummaryCard from '../components/RecipientSummaryCard';
import SafeSendBadge from '../components/SafeSendBadge';
import { formatRM, maskAccount } from '../lib/format';
import { screenTransaction, submitUserChoice } from '../lib/api';
import { useLang } from '../lib/i18n';
import { useTransferSession } from '../lib/transfer-session';

type PrefetchState = 'idle' | 'pending' | 'ready' | 'error';

export default function Confirm() {
  const navigate = useNavigate();
  const [lang, setLang] = useLang();
  const [prefetch, setPrefetch] = useState<PrefetchState>('idle');
  const [screening, setScreening] = useState<ScreenTransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [softWarning, setSoftWarning] = useState<ScreenTransactionResponse | null>(null);
  const [choicePending, setChoicePending] = useState<'cancel' | 'proceed' | null>(null);
  const [navPending, setNavPending] = useState(false);
  const fired = useRef(false);

  const {
    walletBalance,
    transfer,
    remainingBalance,
    setTransferScreening,
    completeTransfer,
  } = useTransferSession();

  const formattedTimestamp = useMemo(
    () => new Date().toLocaleString('en-MY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
    [],
  );

  if (!transfer.payee || transfer.amount <= 0) {
    navigate('/transfer', { replace: true });
    return null;
  }

  const { payee, amount, note, sessionId } = transfer;

  // ---------- Pre-fetch screening on mount ----------
  // Fires once, even under React StrictMode double-invoke. SafeSend score
  // lands while the user reads the summary, so /intercept (or /done) renders
  // instantly when they tap Confirm. Side effect: agent dashboard already
  // shows the 5-agent verification streaming by the time user decides.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    setPrefetch('pending');

    const ctrl = new AbortController();
    screenTransaction({
      user_id: currentUser.id,
      session_id: sessionId,
      payee_id: payee.account,
      payee_name: payee.name,
      amount,
      currency: 'MYR',
      device_id: currentUser.device_id,
      timestamp: new Date().toISOString(),
      user_avg_30d: currentUser.user_avg_30d,
    })
      .then((result) => {
        if (ctrl.signal.aborted) return;
        setScreening(result);
        setTransferScreening(result);
        setPrefetch('ready');
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'SafeSend pre-screen failed');
        setPrefetch('error');
        fired.current = false; // allow manual retry
      });

    return () => {
      ctrl.abort();
    };
  }, [amount, payee.account, payee.name, sessionId, setTransferScreening]);

  // ---------- Confirm uses cached result ----------
  const handleConfirm = async () => {
    if (prefetch === 'pending' || !screening) return; // button locked until ready

    if (screening.action === 'hard_intercept') {
      navigate('/intercept');
      return;
    }
    if (screening.action === 'soft_warn') {
      setSoftWarning(screening);
      return;
    }

    // proceed silently — log user choice + nav
    setNavPending(true);
    try {
      await submitUserChoice({
        txn_id: screening.txn_id,
        user_id: currentUser.id,
        choice: 'proceed',
      });
    } catch {
      // logging best-effort
    }
    completeTransfer('success');
    navigate('/done', { state: { status: 'success' } });
  };

  const handleSoftChoice = async (choice: 'cancel' | 'proceed') => {
    if (!softWarning) return;
    setChoicePending(choice);
    setError(null);
    try {
      await submitUserChoice({
        txn_id: softWarning.txn_id,
        user_id: currentUser.id,
        choice,
      });
      const status = choice === 'proceed' ? 'soft_warn_proceed' : 'soft_warn_cancelled';
      completeTransfer(status);
      navigate('/done', { state: { status } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your choice');
    } finally {
      setChoicePending(null);
    }
  };

  const buttonLabel = (() => {
    if (navPending) return null;
    if (prefetch === 'pending') return null; // dots
    if (prefetch === 'error') return lang === 'en' ? 'Retry SafeSend' : 'Cuba semula';
    if (screening?.action === 'hard_intercept') {
      return lang === 'en' ? 'Continue to SafeSend review' : 'Teruskan ke semakan SafeSend';
    }
    return `${lang === 'en' ? 'Confirm transfer' : 'Sahkan pemindahan'} ${formatRM(amount)}`;
  })();

  const onPrimary = () => {
    if (prefetch === 'error') {
      // retry
      setPrefetch('idle');
      setError(null);
      fired.current = false;
      setScreening(null);
      // bump effect by remount? simpler: re-run inline
      fired.current = true;
      setPrefetch('pending');
      screenTransaction({
        user_id: currentUser.id,
        session_id: sessionId,
        payee_id: payee.account,
        payee_name: payee.name,
        amount,
        currency: 'MYR',
        device_id: currentUser.device_id,
        timestamp: new Date().toISOString(),
        user_avg_30d: currentUser.user_avg_30d,
      })
        .then((r) => {
          setScreening(r);
          setTransferScreening(r);
          setPrefetch('ready');
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : 'SafeSend pre-screen failed');
          setPrefetch('error');
        });
      return;
    }
    void handleConfirm();
  };

  return (
    <AppShell
      footer={(
        <BottomActionBar>
          <button
            onClick={onPrimary}
            disabled={prefetch === 'pending' || navPending || !!softWarning}
            className="btn-primary"
          >
            {prefetch === 'pending' || navPending ? (
              <LoadingDots
                label={prefetch === 'pending' ? 'Running SafeSend pre-check' : 'Recording'}
                tone="inverse"
                size="sm"
              />
            ) : (
              buttonLabel
            )}
          </button>
        </BottomActionBar>
      )}
    >
      <FlowHeader
        title={lang === 'en' ? 'Confirm transfer' : 'Sahkan pemindahan'}
        onBack={() => navigate(-1)}
        theme="light"
        right={<BilingualToggle value={lang} onChange={setLang} />}
        eyebrow="Review & protect"
        step="Step 3 of 3"
      />

      <div className="-mt-5 space-y-4 rounded-t-[32px] bg-app-gray pt-4 app-screen-enter motion-stagger">
        <section className="app-panel overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#005BAC_0%,#004B91_100%)] px-5 py-5 text-white">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
              You are sending
            </div>
            <div className="mt-3 text-[44px] font-extrabold leading-none tracking-tight">
              {formatRM(amount)}
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85">
              <SafeSendBadge size="sm" />
              <PrefetchStatus state={prefetch} score={screening?.final_score} lang={lang} />
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-text">
              To
            </div>
            <div className="mt-3">
              <RecipientSummaryCard
                name={payee.name}
                detail={`TnG - ${maskAccount(payee.account)}`}
                subdetail={`Account opened ${payee.account_age_days} days ago`}
                badge={!payee.flagged_in_scam_graph ? 'Verified' : undefined}
              />
            </div>
          </div>
        </section>

        <section className="app-panel divide-y divide-border-gray/80 overflow-hidden">
          <Row label="From" value={`${currentUser.name} wallet`} />
          <Row label="Schedule" value={`Now - ${formattedTimestamp}`} />
          {note && <Row label="Note" value={note} />}
          <Row label="Total" value={formatRM(amount)} valueClass="text-[18px] font-extrabold text-text-primary" />
        </section>

        <BalanceSnapshotCard
          walletBalance={walletBalance}
          amount={amount}
          remainingBalance={remainingBalance}
        />

        <section className="app-panel flex items-start gap-3 p-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-soft-blue-surface text-tng-blue shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-bold text-text-primary">SafeSend preview</div>
            <div className="mt-1 text-[12px] text-muted-text">
              {prefetch === 'pending' && (lang === 'en'
                ? 'Pre-checking this payment with SafeSend before you tap Confirm…'
                : 'Menyemak bayaran ini dengan SafeSend sebelum anda tekan Sahkan…')}
              {prefetch === 'ready' && (lang === 'en'
                ? `SafeSend pre-check complete. Score ${screening?.final_score}/100. Tap Confirm to continue.`
                : `Semakan SafeSend selesai. Skor ${screening?.final_score}/100. Tekan Sahkan untuk teruskan.`)}
              {prefetch === 'error' && (lang === 'en'
                ? 'SafeSend pre-check failed. You can retry below.'
                : 'Semakan SafeSend gagal. Anda boleh cuba semula di bawah.')}
              {prefetch === 'idle' && (lang === 'en'
                ? 'SafeSend checks this payment against scam patterns before money leaves your wallet.'
                : 'SafeSend menyemak bayaran ini dengan corak penipuan sebelum wang keluar dari dompet anda.')}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-fraud-warning-border bg-fraud-warning-bg px-4 py-3 text-[13px] text-risk-red shadow-sm">
            {error}
          </div>
        )}
      </div>

      {softWarning && (
        <SoftWarningModal
          lang={lang}
          warning={softWarning}
          payeeName={payee.name}
          amount={amount}
          busy={choicePending !== null}
          onClose={() => setSoftWarning(null)}
          onCancel={() => void handleSoftChoice('cancel')}
          onProceed={() => void handleSoftChoice('proceed')}
          pendingChoice={choicePending}
        />
      )}
    </AppShell>
  );
}

function PrefetchStatus({
  state,
  score,
  lang,
}: {
  state: PrefetchState;
  score?: number;
  lang: 'bm' | 'en';
}) {
  if (state === 'pending') return <span>{lang === 'en' ? 'Pre-screening…' : 'Sedang menyemak…'}</span>;
  if (state === 'ready')
    return (
      <span>
        {lang === 'en' ? 'Pre-screened' : 'Selesai disemak'}
        {typeof score === 'number' ? ` · ${score}/100` : ''}
      </span>
    );
  if (state === 'error') return <span>{lang === 'en' ? 'Pre-check failed' : 'Gagal'}</span>;
  return <span>{lang === 'en' ? 'Live transfer screening' : 'Semakan langsung'}</span>;
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
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-[13px] text-muted-text">{label}</span>
      <span className={`text-right text-[14px] text-text-primary ${valueClass ?? ''}`}>{value}</span>
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
    <div className="absolute inset-0 flex items-end justify-center bg-dark-security-blue/55 px-3 pb-3 backdrop-blur-[1px] sm:items-center sm:pb-0">
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border-2 border-fraud-warning-border bg-white shadow-elevated">
        <div className="border-b-2 border-fraud-warning-border bg-electric-yellow px-4 py-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-royal-blue">
            SafeSend soft warning
          </div>
          <div className="mt-1 text-[18px] font-extrabold text-text-primary">
            {lang === 'en' ? 'Please double-check this transfer' : 'Sila semak semula pemindahan ini'}
          </div>
          <div className="mt-2 text-[13px] text-text-primary">
            {lang === 'en' ? warning.soft_warning_en : warning.soft_warning_bm}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-2xl border border-sky-blue bg-soft-blue-surface p-3">
            <div className="text-[12px] font-bold text-text-primary">
              {lang === 'en'
                ? `${formatRM(amount)} to ${payeeName}`
                : `${formatRM(amount)} kepada ${payeeName}`}
            </div>
            <div className="mt-1 text-[11px] text-muted-text">
              Score {warning.final_score}/100
            </div>
          </div>

          <div className="space-y-2">
            {warning.triggered_signals.map((signal) => (
              <div key={signal.signal} className="rounded-2xl border border-border-gray px-3 py-2">
                <div className="text-[13px] font-semibold text-text-primary">
                  {lang === 'en' ? signal.label_en : signal.label_bm}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
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
              {pendingChoice === 'proceed' ? (
                <LoadingDots
                  label={lang === 'en' ? 'Saving choice' : 'Menyimpan pilihan'}
                  tone="inverse"
                  size="sm"
                />
              ) : lang === 'en' ? (
                'Proceed with caution'
              ) : (
                'Teruskan juga'
              )}
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
