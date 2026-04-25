import { useLocation, useNavigate } from 'react-router-dom';
import type { ScamType } from 'shared';
import BilingualToggle from '../components/BilingualToggle';
import ConfidenceMeter from '../components/ConfidenceMeter';
import ScamTypeEducation from '../components/ScamTypeEducation';
import { formatRM } from '../lib/format';
import type { InterceptState } from '../lib/flow';
import { useLang } from '../lib/i18n';

const SAFER_TIPS: Record<ScamType, { en: string[]; bm: string[] }> = {
  macau_scam: {
    en: [
      'Hang up and call the agency directly using the number on their official website',
      'Real LHDN/police never ask for e-wallet transfers',
      'If unsure, walk into the nearest branch in person',
    ],
    bm: [
      'Tutup talian dan telefon agensi terus melalui nombor di laman web rasmi',
      'LHDN/polis sebenar tidak pernah minta pemindahan e-dompet',
      'Jika ragu-ragu, pergi ke cawangan terdekat secara peribadi',
    ],
  },
  investment_scam: {
    en: [
      'Check the company on the SC Malaysia investor alert list',
      'Reject any "guaranteed" return promises',
      'Withdraw a small amount first to test the platform',
    ],
    bm: [
      'Semak syarikat dalam senarai amaran pelabur SC Malaysia',
      'Tolak janji pulangan "dijamin"',
      'Cuba keluarkan jumlah kecil dahulu untuk uji platform',
    ],
  },
  love_scam: {
    en: [
      'Insist on a video call before sending any money',
      'Reverse-image search their photos',
      'Tell a family member or friend before transferring',
    ],
    bm: [
      'Desak panggilan video sebelum hantar wang',
      'Cari gambar mereka secara terbalik',
      'Beritahu ahli keluarga atau kawan sebelum hantar',
    ],
  },
  account_takeover: {
    en: [
      'Change your password and re-pair your trusted device',
      'Call your telco to confirm no SIM-swap',
      'Review recent logins in the SafeSend security tab',
    ],
    bm: [
      'Tukar kata laluan dan pasang semula peranti dipercayai',
      'Telefon telco anda untuk sahkan tiada SIM-swap',
      'Semak log masuk terbaru dalam tab keselamatan SafeSend',
    ],
  },
  mule_account: {
    en: [
      'Verify the receiver using a verified business directory',
      'Ask why their account is brand new',
      'Avoid receivers with no transaction history',
    ],
    bm: [
      'Sahkan penerima menggunakan direktori perniagaan yang sah',
      'Tanya mengapa akaun mereka baru',
      'Elakkan penerima tanpa sejarah transaksi',
    ],
  },
  false_positive: {
    en: [
      'Make a quick call to the recipient to confirm',
      'Send a smaller amount first as a test',
    ],
    bm: [
      'Buat panggilan pantas kepada penerima untuk sahkan',
      'Hantar jumlah lebih kecil dahulu sebagai ujian',
    ],
  },
};

export default function Explain() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as InterceptState | null;
  const [lang, setLang] = useLang();

  if (!state) {
    return (
      <div className="phone-frame p-6 text-center">
        <p className="text-text-primary">
          {lang === 'en' ? 'No alert in flight.' : 'Tiada amaran dalam tindakan.'}
        </p>
        <button className="btn-primary mt-4" onClick={() => navigate('/home')}>
          {lang === 'en' ? 'Go home' : 'Pulang ke utama'}
        </button>
      </div>
    );
  }

  const { payee, amount, screening } = state;
  const explanation = screening.bedrock_explanation;
  const scamType = explanation?.scam_type ?? 'macau_scam';
  const tips = SAFER_TIPS[scamType] ?? SAFER_TIPS.false_positive;

  return (
    <div className="phone-frame flex flex-col">
      <header className="bg-dark-security-blue text-white px-4 pt-4 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="text-[12px] font-bold opacity-80 hover:opacity-100"
          >
            ← {lang === 'en' ? 'Back to alert' : 'Kembali ke amaran'}
          </button>
          <h1 className="mt-1 text-[20px] font-extrabold leading-tight">
            {lang === 'en' ? 'Full breakdown' : 'Butiran penuh'}
          </h1>
          <p className="text-[12px] opacity-80 mt-0.5">
            {lang === 'en'
              ? 'Every reason SafeSend flagged this transfer'
              : 'Setiap sebab SafeSend menanda pemindahan ini'}
          </p>
        </div>
        <BilingualToggle value={lang} onChange={setLang} />
      </header>

      <main className="flex-1 px-4 pt-4 pb-6 space-y-4">
        <section className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-text">
            {lang === 'en' ? 'Transaction' : 'Transaksi'}
          </p>
          <p className="mt-1 text-[18px] font-extrabold text-text-primary">
            {formatRM(amount)} → {payee.name}
          </p>
          <p className="mt-0.5 text-[12px] font-mono text-muted-text">
            {payee.account}
          </p>
        </section>

        <section className="card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-text">
                {lang === 'en' ? 'AI verdict' : 'Keputusan AI'}
              </p>
              <p className="mt-1 text-[16px] font-bold text-text-primary">
                {lang === 'en' ? 'Risk score' : 'Skor risiko'}
              </p>
            </div>
            <ConfidenceMeter
              confidence={explanation?.confidence ?? 'high'}
              score={screening.final_score}
              lang={lang}
              size="sm"
            />
          </div>

          <ScoreBar
            label={lang === 'en' ? 'Rule engine' : 'Enjin peraturan'}
            value={screening.rule_score}
            color="#005BAC"
          />
          <ScoreBar
            label={lang === 'en' ? 'AI model (EAS)' : 'Model AI (EAS)'}
            value={screening.ml_score}
            color="#0055D4"
          />
          <ScoreBar
            label={lang === 'en' ? 'Final composite' : 'Skor gabungan'}
            value={screening.final_score}
            color="#DC2626"
            bold
          />
        </section>

        <section className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-text mb-2">
            {lang === 'en' ? 'Bedrock explanation' : 'Penjelasan Bedrock'}
          </p>
          <div className="space-y-3">
            <LangBlock
              tag="EN"
              body={explanation?.explanation_en ?? '—'}
              active={lang === 'en'}
            />
            <LangBlock
              tag="BM"
              body={explanation?.explanation_bm ?? '—'}
              active={lang === 'bm'}
            />
          </div>
        </section>

        <section className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-text mb-2">
            {lang === 'en'
              ? `All risk signals (${screening.triggered_signals.length})`
              : `Semua petunjuk risiko (${screening.triggered_signals.length})`}
          </p>
          <ul className="space-y-2">
            {screening.triggered_signals.map((s) => (
              <li
                key={s.signal}
                className="flex items-start gap-3 px-3 py-2.5 rounded-md bg-app-gray border border-border-gray"
              >
                <span className="mt-0.5 w-6 h-6 rounded-full bg-risk-red text-white grid place-items-center text-[11px] font-bold flex-shrink-0">
                  +{s.weight}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-text-primary leading-snug">
                    {lang === 'en' ? s.label_en : s.label_bm}
                  </p>
                  <p className="text-[10px] font-mono text-muted-text mt-0.5">
                    {s.signal}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-safe-notice-bg border border-safe-notice-border p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-safe-notice-text mb-2">
            {lang === 'en' ? 'What would make this safer' : 'Apa boleh buatkan ini lebih selamat'}
          </p>
          <ul className="space-y-2">
            {(lang === 'en' ? tips.en : tips.bm).map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-[13px] text-text-primary">
                <span className="text-success-green leading-none mt-1">✓</span>
                <span className="leading-snug">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <ScamTypeEducation scamType={scamType} lang={lang} />

        <section className="rounded-xl bg-soft-blue-surface border border-sky-blue p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-tng-blue mb-1.5">
            {lang === 'en' ? 'Need help?' : 'Perlu bantuan?'}
          </p>
          <p className="text-[13px] text-text-primary leading-relaxed">
            {lang === 'en'
              ? 'Talk to a SafeSend agent 24/7 — call 015-555-1234 or chat in the app.'
              : 'Hubungi ejen SafeSend 24/7 — telefon 015-555-1234 atau sembang dalam aplikasi.'}
          </p>
        </section>
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={() => navigate(-1)} className="btn-primary">
          {lang === 'en' ? 'Back to alert' : 'Kembali ke amaran'}
        </button>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className={bold ? 'font-bold text-text-primary' : 'text-muted-text font-semibold'}>
          {label}
        </span>
        <span className="font-mono font-bold" style={{ color }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="h-2 w-full rounded-pill bg-border-gray overflow-hidden">
        <div
          className="h-full rounded-pill transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function LangBlock({ tag, body, active }: { tag: string; body: string; active: boolean }) {
  return (
    <div
      className="rounded-md p-3"
      style={{
        backgroundColor: active ? '#EAF3FF' : '#F5F7FA',
        border: active ? '1px solid #BFDBFE' : '1px solid #E5E7EB',
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider mb-1"
        style={{ color: active ? '#005BAC' : '#6B7280' }}
      >
        {tag}
      </p>
      <p className="text-[13px] text-text-primary leading-relaxed">{body}</p>
    </div>
  );
}
