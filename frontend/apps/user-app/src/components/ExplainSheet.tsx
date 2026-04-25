import { useMemo, useState } from 'react';
import type {
  BedrockExplanation,
  ScamType,
  TriggeredSignal,
  UIlang,
} from 'shared';
import ConfidenceMeter from './ConfidenceMeter';
import ScamTypeEducation from './ScamTypeEducation';

type Choice = 'cancel' | 'proceed' | 'report';

interface Props {
  lang: UIlang;
  payeeName: string;
  amountFormatted: string;
  score: number;
  explanation?: BedrockExplanation;
  signals: TriggeredSignal[];
  busyChoice: Choice | null;
  onChoice: (choice: Choice) => void;
  onSeeFullBreakdown: () => void;
}

const SCAM_LABEL: Record<ScamType, { en: string; bm: string }> = {
  macau_scam: { en: 'Macau scam pattern', bm: 'Corak penipuan Macau' },
  investment_scam: { en: 'Investment scam pattern', bm: 'Corak penipuan pelaburan' },
  love_scam: { en: 'Love scam pattern', bm: 'Corak penipuan cinta' },
  account_takeover: { en: 'Account takeover signs', bm: 'Tanda akaun dirampas' },
  mule_account: { en: 'Mule account pattern', bm: 'Corak akaun mule' },
  false_positive: { en: 'Mixed signals', bm: 'Petunjuk bercampur' },
};

const SIGNAL_ICONS: Record<string, string> = {
  new_account: '🆕',
  first_transfer: '👤',
  amount_spike: '📊',
  late_night: '🌙',
  device_mismatch: '📱',
  scam_graph: '🕸️',
  large_amount: '💸',
};

export default function ExplainSheet({
  lang,
  payeeName,
  amountFormatted,
  score,
  explanation,
  signals,
  busyChoice,
  onChoice,
  onSeeFullBreakdown,
}: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const totalStages = 3;

  const scamType = explanation?.scam_type ?? 'macau_scam';
  const scamLabel = SCAM_LABEL[scamType] ?? SCAM_LABEL.macau_scam;
  const confidence = explanation?.confidence ?? 'high';

  const topSignals = useMemo(
    () =>
      [...signals]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3),
    [signals],
  );

  const next = () => setStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s));
  const back = () => setStage((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2) : s));

  return (
    <section
      className="rounded-t-sheet bg-white shadow-modal overflow-hidden"
      role="dialog"
      aria-label={lang === 'en' ? 'SafeSend explanation' : 'Penjelasan SafeSend'}
    >
      <header className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-border-gray">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalStages }).map((_, i) => (
            <span
              key={i}
              className="rounded-pill transition-all"
              style={{
                width: i === stage ? 24 : 6,
                height: 6,
                backgroundColor: i <= stage ? '#005BAC' : '#E5E7EB',
              }}
            />
          ))}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-text">
          {lang === 'en' ? `Step ${stage + 1} of ${totalStages}` : `Langkah ${stage + 1} / ${totalStages}`}
        </span>
      </header>

      <div className="px-5 py-5 min-h-[340px]">
        {stage === 0 && (
          <StageVerdict
            lang={lang}
            payeeName={payeeName}
            amountFormatted={amountFormatted}
            scamLabelText={lang === 'en' ? scamLabel.en : scamLabel.bm}
            explanationText={
              lang === 'en'
                ? explanation?.explanation_en ?? ''
                : explanation?.explanation_bm ?? ''
            }
            confidence={confidence}
            score={score}
          />
        )}
        {stage === 1 && (
          <StageSignals lang={lang} signals={topSignals} totalSignals={signals.length} />
        )}
        {stage === 2 && (
          <StageActions
            lang={lang}
            busyChoice={busyChoice}
            onChoice={onChoice}
            scamType={scamType}
          />
        )}
      </div>

      <footer className="px-5 pt-3 pb-4 border-t border-border-gray bg-app-gray flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={stage === 0 ? onSeeFullBreakdown : back}
          className="text-[13px] font-bold text-tng-blue px-3 py-2 rounded-md active:bg-soft-blue-surface"
        >
          {stage === 0
            ? lang === 'en'
              ? 'See full breakdown'
              : 'Lihat butiran penuh'
            : lang === 'en'
              ? '← Back'
              : '← Kembali'}
        </button>
        {stage < 2 ? (
          <button
            type="button"
            onClick={next}
            className="px-5 h-11 rounded-lg bg-tng-blue text-white text-[14px] font-bold active:bg-primary-pressed"
          >
            {stage === 0
              ? lang === 'en'
                ? 'See why →'
                : 'Lihat sebab →'
              : lang === 'en'
                ? 'My options →'
                : 'Pilihan saya →'}
          </button>
        ) : (
          <span className="text-[11px] text-muted-text">
            {lang === 'en' ? 'Choose below' : 'Pilih di bawah'}
          </span>
        )}
      </footer>
    </section>
  );
}

function StageVerdict({
  lang,
  payeeName,
  amountFormatted,
  scamLabelText,
  explanationText,
  confidence,
  score,
}: {
  lang: UIlang;
  payeeName: string;
  amountFormatted: string;
  scamLabelText: string;
  explanationText: string;
  confidence: 'high' | 'medium' | 'low';
  score: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-risk-red">
          {lang === 'en' ? 'We paused this transfer' : 'Kami hentikan pemindahan ini'}
        </p>
        <h2 className="mt-1 text-[20px] font-extrabold text-text-primary leading-snug">
          {amountFormatted} → {payeeName}
        </h2>
      </div>

      <div className="rounded-xl bg-fraud-warning-bg border border-fraud-warning-border p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-risk-red">
          {scamLabelText}
        </p>
        <p className="mt-2 text-[15px] font-semibold text-text-primary leading-snug">
          {explanationText}
        </p>
      </div>

      <ConfidenceMeter confidence={confidence} score={score} lang={lang} />
    </div>
  );
}

function StageSignals({
  lang,
  signals,
  totalSignals,
}: {
  lang: UIlang;
  signals: TriggeredSignal[];
  totalSignals: number;
}) {
  const moreCount = totalSignals - signals.length;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-tng-blue">
          {lang === 'en' ? 'What we noticed' : 'Apa yang kami perasan'}
        </p>
        <h3 className="mt-1 text-[18px] font-extrabold text-text-primary">
          {lang === 'en'
            ? 'These signals stood out'
            : 'Petunjuk ini menonjol'}
        </h3>
        <p className="text-[12px] text-muted-text mt-1 leading-relaxed">
          {lang === 'en'
            ? 'No single reason — these add up to a high-risk pattern.'
            : 'Bukan satu sebab sahaja — semua ini menjadikan corak berisiko tinggi.'}
        </p>
      </div>

      <ul className="space-y-2.5">
        {signals.map((s) => (
          <li
            key={s.signal}
            className="flex items-center gap-3 rounded-xl bg-soft-blue-surface px-3.5 py-3 border border-sky-blue"
          >
            <span className="text-[24px] flex-shrink-0" aria-hidden>
              {SIGNAL_ICONS[s.signal] ?? '⚠️'}
            </span>
            <p className="flex-1 text-[14px] font-semibold text-text-primary leading-snug">
              {lang === 'en' ? s.label_en : s.label_bm}
            </p>
            <span className="text-[10px] font-bold text-tng-blue bg-white rounded-pill px-2 py-1 flex-shrink-0">
              +{s.weight}
            </span>
          </li>
        ))}
      </ul>

      {moreCount > 0 && (
        <p className="text-[12px] text-muted-text text-center">
          {lang === 'en'
            ? `+${moreCount} more signal${moreCount === 1 ? '' : 's'} — see full breakdown`
            : `+${moreCount} petunjuk lagi — lihat butiran penuh`}
        </p>
      )}
    </div>
  );
}

function StageActions({
  lang,
  busyChoice,
  onChoice,
  scamType,
}: {
  lang: UIlang;
  busyChoice: Choice | null;
  onChoice: (c: Choice) => void;
  scamType: ScamType;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-tng-blue">
          {lang === 'en' ? 'Your options' : 'Pilihan anda'}
        </p>
        <h3 className="mt-1 text-[18px] font-extrabold text-text-primary">
          {lang === 'en'
            ? 'How would you like to proceed?'
            : 'Bagaimana anda mahu teruskan?'}
        </h3>
        <p className="text-[12px] text-muted-text mt-1 leading-relaxed">
          {lang === 'en'
            ? 'Take a moment. Verify with the recipient before deciding.'
            : 'Luangkan masa. Sahkan dengan penerima sebelum membuat keputusan.'}
        </p>
      </div>

      <ScamTypeEducation scamType={scamType} lang={lang} />

      <div className="grid grid-cols-1 gap-2.5">
        <ActionRow
          tone="primary"
          icon="🛡️"
          title={lang === 'en' ? 'Cancel transfer' : 'Batalkan pemindahan'}
          subtitle={
            lang === 'en'
              ? 'Recommended — keep your money safe'
              : 'Disyorkan — pastikan wang anda selamat'
          }
          onClick={() => onChoice('cancel')}
          loading={busyChoice === 'cancel'}
          disabled={busyChoice !== null}
        />
        <ActionRow
          tone="report"
          icon="🚨"
          title={lang === 'en' ? 'Report as scam' : 'Lapor sebagai penipuan'}
          subtitle={
            lang === 'en'
              ? 'Cancel + send details to SafeSend'
              : 'Batal + hantar butiran ke SafeSend'
          }
          onClick={() => onChoice('report')}
          loading={busyChoice === 'report'}
          disabled={busyChoice !== null}
        />
        <ActionRow
          tone="ghost"
          icon="⚠️"
          title={lang === 'en' ? 'Proceed anyway' : 'Teruskan juga'}
          subtitle={
            lang === 'en'
              ? "I'm sure — I trust this recipient"
              : 'Saya yakin — saya percayai penerima ini'
          }
          onClick={() => onChoice('proceed')}
          loading={busyChoice === 'proceed'}
          disabled={busyChoice !== null}
        />
      </div>
    </div>
  );
}

function ActionRow({
  tone,
  icon,
  title,
  subtitle,
  onClick,
  loading,
  disabled,
}: {
  tone: 'primary' | 'report' | 'ghost';
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const styles =
    tone === 'primary'
      ? {
          bg: '#005BAC',
          fg: '#FFFFFF',
          sub: 'rgba(255,255,255,0.85)',
          border: '#003F7D',
        }
      : tone === 'report'
        ? {
            bg: '#FFE600',
            fg: '#0055D4',
            sub: '#0055D4',
            border: '#0055D4',
          }
        : {
            bg: '#FFFFFF',
            fg: '#111827',
            sub: '#6B7280',
            border: '#E5E7EB',
          };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-transform active:scale-[0.99] disabled:opacity-60"
      style={{
        backgroundColor: styles.bg,
        color: styles.fg,
        border: `1px solid ${styles.border}`,
        boxShadow: tone === 'report' ? '0 4px 0 #0055D4' : undefined,
      }}
    >
      <span className="text-[24px] flex-shrink-0" aria-hidden>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold leading-tight">{loading ? '…' : title}</p>
        <p className="text-[12px] mt-0.5 leading-snug" style={{ color: styles.sub }}>
          {subtitle}
        </p>
      </div>
    </button>
  );
}
