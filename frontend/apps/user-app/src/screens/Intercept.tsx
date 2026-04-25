import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingDots, currentUser, type ScamType } from 'shared';
import BilingualToggle from '../components/BilingualToggle';
import ExplainSheet from '../components/ExplainSheet';
import { formatRM } from '../lib/format';
import type { InterceptState } from '../lib/flow';
import { submitUserChoice } from '../lib/api';
import { useLang } from '../lib/i18n';

type Choice = 'cancel' | 'proceed' | 'report';

const SCAM_LABEL: Record<ScamType, { en: string; bm: string }> = {
  macau_scam: { en: 'Macau scam pattern', bm: 'Corak penipuan Macau' },
  investment_scam: { en: 'Investment scam pattern', bm: 'Corak penipuan pelaburan' },
  love_scam: { en: 'Love scam pattern', bm: 'Corak penipuan cinta' },
  account_takeover: { en: 'Account takeover signs', bm: 'Tanda akaun dirampas' },
  mule_account: { en: 'Mule account pattern', bm: 'Corak akaun mule' },
  false_positive: { en: 'Mixed signals', bm: 'Petunjuk bercampur' },
};

export default function Intercept() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as InterceptState | null;
  const [lang, setLang] = useLang();
  const [busyChoice, setBusyChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!state) {
    return (
      <div className="phone-frame p-6 text-center">
        <p className="text-text-primary">No transaction in flight.</p>
        <button className="btn-primary mt-4" onClick={() => navigate('/home')}>
          Return home
        </button>
      </div>
    );
  }

  const { payee, amount, screening } = state;
  const explanation = screening.bedrock_explanation;
  const scamType = explanation?.scam_type ?? 'macau_scam';
  const scamLabel = SCAM_LABEL[scamType] ?? SCAM_LABEL.macau_scam;

  const handleChoice = async (choice: Choice) => {
    setBusyChoice(choice);
    setError(null);
    try {
      await submitUserChoice({
        txn_id: screening.txn_id,
        user_id: currentUser.id,
        choice,
      });
      navigate('/done', {
        state: {
          payee,
          amount,
          status:
            choice === 'cancel'
              ? 'cancelled'
              : choice === 'report'
                ? 'reported'
                : 'overridden',
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save your choice';
      setError(msg);
      setBusyChoice(null);
    }
  };

  return (
    <div className="phone-frame flex flex-col">
      <header className="bg-dark-security-blue text-white px-4 pt-4 pb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-pill bg-electric-yellow text-royal-blue text-[11px] font-extrabold uppercase tracking-wider shadow-yellow-depth">
            🛡️ SafeSend Alert
          </span>
          <h1 className="mt-3 text-[22px] font-extrabold leading-tight">
            {lang === 'en'
              ? 'Hard stop - this transfer looks risky'
              : 'Henti dahulu - pemindahan ini kelihatan berisiko'}
          </h1>
          <div className="text-[12px] opacity-80 mt-1">
            {lang === 'en'
              ? 'SafeSend paused the payment before money left your wallet.'
              : 'SafeSend menghentikan bayaran ini sebelum wang keluar dari dompet anda.'}
          </div>
        </div>
        <BilingualToggle value={lang} onChange={setLang} />
      </header>

      <main className="flex-1 px-4 pt-4 pb-6 space-y-4">
        <div className="rounded-xl p-4 border-2 bg-[#FEF2F2] border-[#FCA5A5]">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-risk-red text-white grid place-items-center flex-shrink-0 shadow-card">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-risk-red">
                  {lang === 'en' ? 'High risk' : 'Risiko tinggi'} - {screening.final_score}/100
                </span>
                <span className="px-2 py-0.5 rounded-pill bg-risk-red text-white text-[10px] font-bold uppercase">
                  {lang === 'en' ? scamLabel.en : scamLabel.bm}
                </span>
              </div>
              <div className="mt-1 text-[15px] font-bold text-text-primary leading-snug">
                {lang === 'en'
                  ? `Transfer of ${formatRM(amount)} to ${payee.name}`
                  : `Pemindahan ${formatRM(amount)} kepada ${payee.name}`}
              </div>
              {screening.payee_info && (
                <div className="mt-1 text-[12px] text-muted-text">
                  {lang === 'en'
                    ? `Payee account age: ${screening.payee_info.account_age_days} days`
                    : `Usia akaun penerima: ${screening.payee_info.account_age_days} hari`}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 -mx-4 -mb-4 px-4 py-3 bg-electric-yellow/95 rounded-b-xl border-t-2 border-fraud-warning-border">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-royal-blue">
              {lang === 'en' ? 'Why we are warning you' : 'Mengapa kami beri amaran'}
            </div>
            <div className="text-[13.5px] font-semibold text-text-primary mt-1 leading-snug">
              {lang === 'en'
                ? explanation?.explanation_en
                : explanation?.explanation_bm}
            </div>
          </div>
        </div>

        <section className="card p-4">
          <div className="text-[13px] font-bold text-text-primary uppercase tracking-wider mb-2">
            {lang === 'en' ? 'Risk signals detected' : 'Petunjuk risiko dikesan'}
          </div>
          <ul className="space-y-2">
            {screening.triggered_signals.map((signal) => (
              <li
                key={signal.signal}
                className="flex items-start gap-2.5 bg-white border border-fraud-warning-border/50 rounded-md px-3 py-2.5"
              >
                <span className="mt-0.5 w-5 h-5 rounded-full bg-risk-red text-white grid place-items-center text-[11px] font-bold flex-shrink-0">
                  !
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text-primary">
                    {lang === 'en' ? signal.label_en : signal.label_bm}
                  </div>
                  <div className="text-[12px] text-muted-text mt-0.5">
                    +{signal.weight}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {error && (
          <div className="mt-4 rounded-md bg-fraud-warning-bg border border-fraud-warning-border px-3 py-2 text-[13px] text-risk-red">
            {error}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <button
          onClick={() => void handleChoice('cancel')}
          disabled={busyChoice !== null}
          className="btn-danger"
        >
          {busyChoice === 'cancel'
            ? <LoadingDots label={lang === 'en' ? 'Recording cancel' : 'Menyimpan'} tone="inverse" size="sm" />
            : lang === 'en'
              ? 'Cancel transfer'
              : 'Batalkan pemindahan'}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => void handleChoice('report')}
            disabled={busyChoice !== null}
            className="btn-secondary"
          >
            {busyChoice === 'report'
              ? <LoadingDots label={lang === 'en' ? 'Recording report' : 'Menyimpan'} tone="primary" size="sm" />
              : lang === 'en'
                ? 'Report as scam'
                : 'Lapor sebagai penipuan'}
          </button>
          <button
            onClick={() => void handleChoice('proceed')}
            disabled={busyChoice !== null}
            className="btn-ghost"
          >
            {busyChoice === 'proceed'
              ? <LoadingDots label={lang === 'en' ? 'Recording override' : 'Menyimpan'} tone="primary" size="sm" />
              : lang === 'en'
                ? 'Proceed anyway'
                : 'Teruskan juga'}
          </button>
        </div>
      </div>
    </div>
  );
}
