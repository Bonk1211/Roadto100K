import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import BalanceSnapshotCard from '../components/BalanceSnapshotCard';
import BilingualToggle from '../components/BilingualToggle';
import BottomActionBar from '../components/BottomActionBar';
import FlowHeader from '../components/FlowHeader';
import RecipientSummaryCard from '../components/RecipientSummaryCard';
import type { DoneStatus } from '../lib/flow';
import { formatRM } from '../lib/format';
import { useLang } from '../lib/i18n';
import { useTransferSession } from '../lib/transfer-session';

const COPY: Record<
  DoneStatus,
  {
    badge: { en: string; bm: string };
    title: { en: string; bm: string };
    body: { en: string; bm: string };
    followup: { en: string; bm: string };
    tone: 'safe' | 'risk' | 'pending';
  }
> = {
  success: {
    badge: { en: 'Transfer complete', bm: 'Pemindahan selesai' },
    title: { en: 'Money sent successfully', bm: 'Wang berjaya dihantar' },
    body: {
      en: 'This transfer cleared without interruption and the recipient will receive funds shortly.',
      bm: 'Pemindahan ini selesai tanpa gangguan dan penerima akan menerima wang tidak lama lagi.',
    },
    followup: {
      en: 'SafeSend logged the screening result silently in the background.',
      bm: 'SafeSend merekodkan keputusan saringan ini secara senyap di latar belakang.',
    },
    tone: 'safe',
  },
  cancelled: {
    badge: { en: 'Transfer cancelled', bm: 'Pemindahan dibatalkan' },
    title: { en: 'Your money stayed in your wallet', bm: 'Wang anda kekal dalam dompet anda' },
    body: {
      en: 'No funds left your wallet. SafeSend recorded the stop so the case can be reviewed later if needed.',
      bm: 'Tiada wang keluar dari dompet anda. SafeSend merekodkan pemberhentian ini supaya kes boleh disemak semula jika perlu.',
    },
    followup: {
      en: 'When in doubt, pause first and verify the recipient independently.',
      bm: 'Jika anda ragu-ragu, berhenti dahulu dan sahkan penerima secara berasingan.',
    },
    tone: 'safe',
  },
  reported: {
    badge: { en: 'Reported to SafeSend', bm: 'Dilaporkan kepada SafeSend' },
    title: { en: 'Fraud team notified', bm: 'Pasukan fraud dimaklumkan' },
    body: {
      en: 'Your scam report was recorded and the recipient will stay under analyst review.',
      bm: 'Laporan penipuan anda telah direkodkan dan penerima akan terus disemak oleh penganalisis.',
    },
    followup: {
      en: 'This report helps SafeSend strengthen the queue and future warning decisions.',
      bm: 'Laporan ini membantu SafeSend mengukuhkan barisan semakan dan keputusan amaran pada masa hadapan.',
    },
    tone: 'pending',
  },
  overridden: {
    badge: { en: 'Transfer sent with override', bm: 'Pemindahan dihantar dengan override' },
    title: { en: 'You proceeded against a high-risk warning', bm: 'Anda meneruskan walaupun ada amaran berisiko tinggi' },
    body: {
      en: 'SafeSend recorded that you explicitly overrode the hard stop before money left your wallet.',
      bm: 'SafeSend merekodkan bahawa anda secara jelas mengatasi hard stop sebelum wang keluar dari dompet anda.',
    },
    followup: {
      en: 'If anything feels wrong later, contact TnG support immediately.',
      bm: 'Jika ada apa-apa yang terasa tidak betul kemudian, hubungi sokongan TnG dengan segera.',
    },
    tone: 'risk',
  },
  soft_warn_proceed: {
    badge: { en: 'Transfer sent after warning', bm: 'Pemindahan dihantar selepas amaran' },
    title: { en: 'You proceeded with caution', bm: 'Anda meneruskan dengan berhati-hati' },
    body: {
      en: 'SafeSend recorded that you chose to continue after a medium-risk warning.',
      bm: 'SafeSend merekodkan bahawa anda memilih untuk meneruskan selepas amaran risiko sederhana.',
    },
    followup: {
      en: 'Keep watching the recipient and contact support if anything changes.',
      bm: 'Terus awasi penerima dan hubungi sokongan jika ada apa-apa perubahan.',
    },
    tone: 'pending',
  },
  soft_warn_cancelled: {
    badge: { en: 'Transfer cancelled after warning', bm: 'Pemindahan dibatalkan selepas amaran' },
    title: { en: 'You stopped before money left', bm: 'Anda berhenti sebelum wang keluar' },
    body: {
      en: 'No money left your wallet, and the cautious cancellation was logged for later review.',
      bm: 'Tiada wang keluar dari dompet anda, dan pembatalan berhati-hati ini direkodkan untuk semakan kemudian.',
    },
    followup: {
      en: 'This helps SafeSend learn which medium-risk warnings deserve escalation.',
      bm: 'Ini membantu SafeSend belajar amaran risiko sederhana yang patut dinaikkan tahapnya.',
    },
    tone: 'safe',
  },
};

export default function Done() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { status?: DoneStatus } | null) ?? {};
  const [lang, setLang] = useLang();
  const { walletBalance, transfer, remainingBalance, startFreshTransfer } = useTransferSession();
  const status: DoneStatus = state.status ?? 'success';
  const copy = COPY[status];
  const amount = transfer.amount ?? 0;
  const payee = transfer.payee;

  return (
    <AppShell
      footer={(
        <BottomActionBar className="space-y-2">
          <button onClick={() => navigate('/home')} className="btn-primary">
            {lang === 'en' ? 'Back to wallet' : 'Kembali ke dompet'}
          </button>
          {status !== 'success' && (
            <button
              onClick={() => {
                startFreshTransfer();
                navigate('/transfer');
              }}
              className="btn-ghost"
            >
              {lang === 'en' ? 'Start a new transfer' : 'Mulakan pemindahan baharu'}
            </button>
          )}
        </BottomActionBar>
      )}
    >
      <FlowHeader
        title={lang === 'en' ? 'Transfer result' : 'Keputusan pemindahan'}
        theme="light"
        right={<BilingualToggle value={lang} onChange={setLang} />}
        eyebrow="Outcome"
        step="Step 3 of 3"
      />

      <div className="-mt-5 flex flex-1 flex-col items-center rounded-t-[32px] bg-app-gray pt-6 text-center">
        <div
          className={[
            'mb-5 grid h-24 w-24 place-items-center rounded-full shadow-card',
            copy.tone === 'safe' ? 'bg-success-green/15 text-success-green' : '',
            copy.tone === 'risk' ? 'bg-risk-red/15 text-risk-red' : '',
            copy.tone === 'pending' ? 'bg-pending-orange/15 text-pending-orange' : '',
          ].join(' ')}
        >
          {copy.tone === 'safe' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {copy.tone === 'risk' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.41 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {copy.tone === 'pending' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <span
          className={[
            'rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
            copy.tone === 'safe' ? 'bg-success-green/15 text-success-green' : '',
            copy.tone === 'risk' ? 'bg-risk-red/15 text-risk-red' : '',
            copy.tone === 'pending' ? 'bg-pending-orange/15 text-pending-orange' : '',
          ].join(' ')}
        >
          {copy.badge[lang]}
        </span>

        <h1 className="mt-3 text-[24px] font-extrabold leading-tight text-text-primary">
          {copy.title[lang]}
        </h1>
        <p className="mt-2 max-w-xs text-[14px] text-muted-text">{copy.body[lang]}</p>
        <p className="mt-3 text-[12px] font-semibold text-muted-text">{copy.followup[lang]}</p>

        {amount > 0 && payee && (
          <>
            <div className="app-panel mt-6 w-full p-4 text-left">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-text">
                {status === 'cancelled' || status === 'soft_warn_cancelled'
                  ? lang === 'en'
                    ? 'Protected transaction'
                    : 'Transaksi yang dilindungi'
                  : lang === 'en'
                    ? 'Transaction'
                    : 'Transaksi'}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <RecipientSummaryCard
                    name={payee.name}
                    detail={`TnG · ${payee.account}`}
                  />
                </div>
                <div className="text-[20px] font-extrabold text-text-primary">
                  {formatRM(amount)}
                </div>
              </div>
            </div>

            <div className="mt-4 w-full text-left">
              <BalanceSnapshotCard
                walletBalance={walletBalance}
                amount={amount}
                remainingBalance={remainingBalance}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
