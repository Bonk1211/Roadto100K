import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Payee, ScoreResponse } from 'shared';
import BilingualToggle, { type Lang } from '../components/BilingualToggle';
import RiskSignalsList from '../components/RiskSignalsList';
import { formatRM } from '../lib/format';

interface NavState {
  payee: Payee;
  amount: number;
  score: ScoreResponse;
  note?: string;
}

const SCAM_TYPE_LABEL: Record<string, { en: string; bm: string }> = {
  macau_scam: { en: 'Macau scam pattern', bm: 'Corak penipuan Macau' },
  investment_scam: { en: 'Investment scam pattern', bm: 'Corak penipuan pelaburan' },
  love_scam: { en: 'Love scam pattern', bm: 'Corak penipuan cinta' },
  account_takeover: { en: 'Account takeover', bm: 'Akaun dirampas' },
  mule_account: { en: 'Mule account', bm: 'Akaun mule' },
  false_positive: { en: 'Possible false alarm', bm: 'Mungkin amaran palsu' },
};

export default function Intercept() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as NavState | null;
  const [lang, setLang] = useState<Lang>('en');

  if (!state) {
    return (
      <div className="phone-frame p-6 text-center">
        <p className="text-text-primary">No transaction in flight.</p>
        <button
          className="btn-primary mt-4"
          onClick={() => navigate('/home')}
        >
          Return home
        </button>
      </div>
    );
  }

  const { payee, amount, score } = state;
  const scamLabel = SCAM_TYPE_LABEL[score.scam_type] ?? SCAM_TYPE_LABEL.macau_scam;

  return (
    <div className="phone-frame flex flex-col">
      <header className="bg-dark-security-blue text-white px-4 pt-4 pb-4 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-pill bg-electric-yellow text-royal-blue text-[11px] font-extrabold uppercase tracking-wider">
            SafeSend Alert
          </div>
          <div className="text-[20px] font-extrabold mt-2 leading-tight">
            Hold on — this transfer looks risky
          </div>
          <div className="text-[12px] opacity-80 mt-1">
            {lang === 'en'
              ? 'We paused the payment so you can double-check.'
              : 'Kami berhentikan bayaran supaya anda boleh semak semula.'}
          </div>
        </div>
        <BilingualToggle value={lang} onChange={setLang} />
      </header>

      <main className="flex-1 px-4 pt-4 pb-6 space-y-4">
        {/* Fraud Warning Card — DESIGN section "Fraud Warning Card" */}
        <div
          className="rounded-xl p-4 border-2"
          style={{
            background: '#FEF2F2',
            borderColor: '#FCA5A5',
            borderRadius: 20,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-risk-red text-white grid place-items-center flex-shrink-0 shadow-card">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-risk-red">
                  High risk · {score.score}/100
                </span>
                <span className="px-2 py-0.5 rounded-pill bg-risk-red text-white text-[10px] font-bold uppercase">
                  {scamLabel[lang]}
                </span>
              </div>
              <div className="mt-1 text-[15px] font-bold text-text-primary leading-snug">
                {lang === 'en'
                  ? `Transfer of ${formatRM(amount)} to ${payee.name}`
                  : `Pemindahan ${formatRM(amount)} kepada ${payee.name}`}
              </div>
              <div className="mt-1 text-[12px] text-muted-text">
                {lang === 'en'
                  ? `Account opened only ${payee.account_age_days} days ago.`
                  : `Akaun ini baru didaftarkan ${payee.account_age_days} hari lepas.`}
              </div>
            </div>
          </div>

          {/* Yellow attention strip — DESIGN Enhanced Attention Variant */}
          <div className="mt-3 -mx-4 -mb-4 px-4 py-3 bg-electric-yellow/95 rounded-b-xl border-t-2 border-fraud-warning-border">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-royal-blue">
              {lang === 'en' ? 'Why we are warning you' : 'Mengapa kami beri amaran'}
            </div>
            <div className="text-[13.5px] font-semibold text-text-primary mt-1 leading-snug">
              {lang === 'en' ? score.explanation_en : score.explanation_bm}
            </div>
          </div>
        </div>

        {/* Bilingual side-by-side reading aid */}
        <details className="card p-4 group" open>
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <span className="text-[13px] font-bold text-text-primary uppercase tracking-wider">
              {lang === 'en' ? 'Read in both languages' : 'Baca dalam dua bahasa'}
            </span>
            <span className="text-tng-blue text-[12px] font-semibold group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
            <div className="rounded-md bg-app-gray p-3">
              <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">English</div>
              <div className="text-[13px] text-text-primary leading-relaxed">{score.explanation_en}</div>
            </div>
            <div className="rounded-md bg-app-gray p-3">
              <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">Bahasa Malaysia</div>
              <div className="text-[13px] text-text-primary leading-relaxed">{score.explanation_bm}</div>
            </div>
          </div>
        </details>

        {/* Risk signals */}
        <section className="card p-4">
          <div className="text-[13px] font-bold text-text-primary uppercase tracking-wider mb-2">
            {lang === 'en' ? 'Risk signals detected' : 'Petunjuk risiko dikesan'}
          </div>
          <RiskSignalsList signals={score.signals} />
        </section>

        {/* What you can do */}
        <section className="rounded-xl p-4 bg-soft-blue-surface border border-sky-blue">
          <div className="text-[13px] font-bold text-tng-blue uppercase tracking-wider">
            {lang === 'en' ? 'Tips before you continue' : 'Petua sebelum anda teruskan'}
          </div>
          <ul className="mt-2 space-y-1.5 text-[13px] text-text-primary">
            <li>· {lang === 'en'
              ? 'Call the recipient using a number you already trust.'
              : 'Telefon penerima menggunakan nombor yang anda percaya.'}</li>
            <li>· {lang === 'en'
              ? 'Government agencies never ask for e-wallet transfers.'
              : 'Agensi kerajaan tidak pernah meminta pemindahan e-dompet.'}</li>
            <li>· {lang === 'en'
              ? 'If unsure, cancel — you can always send later.'
              : 'Jika ragu, batalkan — anda boleh hantar kemudian.'}</li>
          </ul>
        </section>
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <button
          onClick={() => navigate('/done', { state: { payee, amount, status: 'cancelled' } })}
          className="btn-danger"
        >
          {lang === 'en' ? 'Cancel transfer' : 'Batalkan pemindahan'}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/done', { state: { payee, amount, status: 'reported' } })}
            className="btn-secondary"
          >
            {lang === 'en' ? 'Report as scam' : 'Lapor sebagai penipuan'}
          </button>
          <button
            onClick={() => navigate('/done', { state: { payee, amount, status: 'overridden' } })}
            className="btn-ghost"
          >
            {lang === 'en' ? 'Proceed anyway' : 'Teruskan saja'}
          </button>
        </div>
      </div>
    </div>
  );
}
