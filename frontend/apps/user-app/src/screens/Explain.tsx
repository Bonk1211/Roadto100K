import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoPayee, type ScreenTransactionResponse } from 'shared';
import AppShell from '../components/AppShell';
import BalanceSnapshotCard from '../components/BalanceSnapshotCard';
import BilingualToggle from '../components/BilingualToggle';
import BottomActionBar from '../components/BottomActionBar';
import FlowHeader from '../components/FlowHeader';
import RecipientSummaryCard from '../components/RecipientSummaryCard';
import { formatRM, maskAccount } from '../lib/format';
import { useLang } from '../lib/i18n';
import { useTransferSession } from '../lib/transfer-session';

const MOCK_AMOUNT = 8000;

const MOCK_SCREENING: ScreenTransactionResponse = {
  request_id: 'preview-request',
  txn_id: 'preview-txn',
  action: 'hard_intercept',
  final_score: 89,
  rule_score: 84,
  ml_score: 91,
  triggered_signals: [
    {
      signal: 'new_payee',
      label_en: 'This is a brand new recipient',
      label_bm: 'Ini ialah penerima yang sangat baharu',
      weight: 22,
    },
    {
      signal: 'young_account',
      label_en: 'Payee account is only 6 days old',
      label_bm: 'Akaun penerima baru berusia 6 hari',
      weight: 18,
    },
    {
      signal: 'unusual_amount',
      label_en: 'Amount is much higher than your normal transfer pattern',
      label_bm: 'Jumlah ini jauh lebih tinggi daripada corak pemindahan biasa anda',
      weight: 21,
    },
    {
      signal: 'late_hour',
      label_en: 'Transfer is happening at an unusual late hour',
      label_bm: 'Pemindahan berlaku pada waktu lewat yang luar biasa',
      weight: 12,
    },
  ],
  bedrock_explanation: {
    explanation_en:
      'This transfer looks risky because it sends a large amount to a very new recipient account that matches known scam behavior patterns.',
    explanation_bm:
      'Pemindahan ini kelihatan berisiko kerana ia menghantar jumlah yang besar ke akaun penerima yang sangat baharu dan menyerupai corak penipuan yang diketahui.',
    scam_type: 'macau_scam',
    confidence: 'high',
  },
  payee_info: {
    payee_id: demoPayee.id,
    account_age_days: demoPayee.account_age_days,
    is_new_payee: true,
    prior_txns_to_payee: 0,
    flagged_in_network: true,
    linked_flagged_accounts: 3,
  },
  processed_ms: 224,
  timestamp: new Date().toISOString(),
};

export default function Explain() {
  const navigate = useNavigate();
  const [lang, setLang] = useLang();
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [scoreAnimated, setScoreAnimated] = useState(false);
  const { walletBalance, transfer, remainingBalance } = useTransferSession();

  const usingMockPreview = !transfer.screening || !transfer.payee;
  const payee = transfer.payee ?? demoPayee;
  const amount = transfer.amount > 0 ? transfer.amount : MOCK_AMOUNT;
  const screening = transfer.screening ?? MOCK_SCREENING;
  const previewRemainingBalance = usingMockPreview
    ? walletBalance - amount
    : remainingBalance;
  const explanation = screening.bedrock_explanation;

  useEffect(() => {
    const timeout = window.setTimeout(() => setScoreAnimated(true), 90);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <AppShell
      footer={(
        <BottomActionBar>
          <button onClick={() => navigate(-1)} className="btn-primary">
            {lang === 'en' ? 'Back to alert' : 'Kembali ke amaran'}
          </button>
        </BottomActionBar>
      )}
    >
      <FlowHeader
        title={lang === 'en' ? 'Potential Fraud' : 'Fraud Potensi'}
        onBack={() => navigate(-1)}
        theme="light"
        right={<BilingualToggle value={lang} onChange={setLang} />}
        step="Investigation detail"
      />

      <div className="space-y-4 pt-4 app-screen-enter motion-stagger">
        <section className="app-panel overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#005BAC_0%,#004B91_100%)] px-5 py-5 text-white">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/72">
              {lang === 'en' ? 'Transfer under review' : 'Pemindahan sedang disemak'}
            </div>
            <div className="mt-3 text-[40px] font-extrabold leading-none tracking-tight">
              {formatRM(amount)}
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-pill bg-white/12 px-3 py-1.5 text-[12px] font-semibold text-white/90">
              <span className="h-2 w-2 rounded-full bg-electric-yellow" />
              {usingMockPreview
                ? lang === 'en'
                  ? 'Mock preview'
                  : 'Pratonton mock'
                : lang === 'en'
                  ? 'Detailed SafeSend explanation'
                  : 'Penjelasan SafeSend terperinci'}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-text">
              {lang === 'en' ? 'Recipient' : 'Penerima'}
            </div>
            <div className="mt-3">
              <RecipientSummaryCard
                name={payee.name}
                detail={`TnG - ${maskAccount(payee.account)}`}
                subdetail={
                  lang === 'en'
                    ? `Risk score ${screening.final_score}/100`
                    : `Skor risiko ${screening.final_score}/100`
                }
                badge={!payee.flagged_in_scam_graph ? 'Verified' : undefined}
              />
            </div>
          </div>
        </section>

        <section className="app-panel space-y-4 p-4">
          <div>
            <div className="section-label">
              {lang === 'en' ? 'SafeSend verdict' : 'Keputusan SafeSend'}
            </div>
            <div className="mt-1 text-[18px] font-extrabold text-text-primary">
              {lang === 'en' ? 'Risk breakdown' : 'Pecahan risiko'}
            </div>
          </div>

          <div className="rounded-2xl p-3">
            <div className="flex items-start gap-4">
              <ConfidencePie
                confidence={explanation?.confidence ?? 'high'}
                score={screening.final_score}
                lang={lang}
                animated={scoreAnimated}
              />

              <div className="min-w-0 flex-1 space-y-3">
                <ScoreBar
                  label={lang === 'en' ? 'Rule engine' : 'Enjin peraturan'}
                  value={screening.rule_score}
                  color="#005BAC"
                  animated={scoreAnimated}
                />
                <ScoreBar
                  label={lang === 'en' ? 'AI model' : 'Model AI'}
                  value={screening.ml_score}
                  color="#0055D4"
                  animated={scoreAnimated}
                />
                <ScoreBar
                  label={lang === 'en' ? 'Final risk score' : 'Skor risiko akhir'}
                  value={screening.final_score}
                  color="#DC2626"
                  bold
                  animated={scoreAnimated}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-blue p-4">
            <div className="section-label">REASON</div>
            <div className="text-[14px] font-semibold leading-relaxed text-text-primary">
              {lang === 'en'
                ? explanation?.explanation_en ?? '-'
                : explanation?.explanation_bm ?? '-'}
            </div>
          </div>
        </section>

        <section className="app-panel p-4">
          <button
            type="button"
            onClick={() => setSignalsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="section-label">
              {lang === 'en'
                ? `Signals detected (${screening.triggered_signals.length})`
                : `Isyarat dikesan (${screening.triggered_signals.length})`}
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-soft-blue-surface text-tng-blue">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className={signalsOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
              >
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          <div
            className="collapsible-panel"
            data-open={signalsOpen ? 'true' : 'false'}
            style={{ marginTop: signalsOpen ? '0.75rem' : '0' }}
          >
            <div className="collapsible-inner">
              <ul className="space-y-2">
                {screening.triggered_signals.map((signal) => (
                  <li
                    key={signal.signal}
                    className="flex items-start gap-3 rounded-2xl border border-border-gray bg-white px-3 py-3"
                  >
                    <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-risk-red text-[11px] font-bold text-white">
                      +{signal.weight}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold leading-snug text-text-primary">
                        {lang === 'en' ? signal.label_en : signal.label_bm}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-text">
                        {signal.signal}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ScoreBar({
  label,
  value,
  color,
  bold,
  animated,
}: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
  animated: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const dots = 24;
  const activeDots = animated ? Math.max(1, Math.round((pct / 100) * dots)) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
        <span className={bold ? 'font-bold text-text-primary' : 'font-semibold text-muted-text'}>
          {label}
        </span>
        <span className="font-mono text-[13px] font-bold" style={{ color }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: dots }).map((_, index) => (
          <span
            key={`${label}-${index}`}
            className="h-1.5 flex-1 rounded-pill transition-all duration-500"
            style={{
              backgroundColor: index < activeDots ? color : '#D9DEE7',
              transitionDelay: `${index * 18}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ConfidencePie({
  confidence,
  score = 0,
  lang,
  animated,
}: {
  confidence: 'low' | 'medium' | 'high';
  score?: number;
  lang: 'en' | 'bm';
  animated: boolean;
}) {
  const value = Math.max(0, Math.min(100, score));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (value / 100) * circumference;
  const visibleOffset = animated ? dashOffset : circumference;
  const color = confidence === 'high' ? '#DC2626' : confidence === 'medium' ? '#F97316' : '#16A34A';
  const track = confidence === 'high' ? '#FEE2E2' : confidence === 'medium' ? '#FFEDD5' : '#DCFCE7';
  const label =
    confidence === 'high'
      ? lang === 'en' ? 'High confidence' : 'Keyakinan tinggi'
      : confidence === 'medium'
        ? lang === 'en' ? 'Medium confidence' : 'Keyakinan sederhana'
        : lang === 'en' ? 'Low confidence' : 'Keyakinan rendah';

  return (
    <div className="flex flex-col items-center rounded-2xl  bg-white px-3 py-3 shadow-sm">
      <div className="relative h-[72px] w-[72px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r={radius} stroke={track} strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={visibleOffset}
            style={{ transition: 'stroke-dashoffset 850ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[18px] font-extrabold leading-none text-text-primary">
            {Math.round(value)}
          </div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-text">
            /100
          </div>
        </div>
      </div>
      <div className="mt-1 text-center text-[11px] font-semibold leading-tight" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
