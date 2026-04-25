import { useEffect, useState } from 'react';
import {
  getStoredLanguage,
  sampleScamMessages,
  setStoredLanguage,
  type AnalyseMessageResponse,
  type UIlang,
} from 'shared';
import ChatMockup from './components/ChatMockup';
import ScamSampleButton from './components/ScamSampleButton';
import WarningBanner from './components/WarningBanner';
import { analyseMessage } from './lib/api';

const SCAMMER_NAMES: Record<string, string> = {
  msg_lhdn: '+60 11-2233 4455 (LHDN)',
  msg_prize: 'TnG Loyalty (unverified)',
  msg_invest: '+60 12-9988 7766',
};

export default function App() {
  const [lang, setLang] = useState<UIlang>(getStoredLanguage());
  const [activeId, setActiveId] = useState<string>(sampleScamMessages[0].id);
  const [customText, setCustomText] = useState('');
  const [usingCustom, setUsingCustom] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string>(sampleScamMessages[0].body);
  const [result, setResult] = useState<AnalyseMessageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStoredLanguage(lang);
  }, [lang]);

  const handlePickSample = (id: string, body: string) => {
    setActiveId(id);
    setUsingCustom(false);
    setPendingMessage(body);
    setResult(null);
    setError(null);
  };

  const handleAnalyse = async () => {
    const text = usingCustom ? customText.trim() : pendingMessage;
    if (!text) {
      setError(lang === 'en' ? 'Paste or pick a message first.' : 'Tampal atau pilih mesej dahulu.');
      return;
    }
    if (usingCustom) setPendingMessage(text);
    setLoading(true);
    setError(null);
    try {
      const response = await analyseMessage(text, lang === 'bm' ? 'BM' : 'EN');
      setResult(response);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach SafeSend';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const scammerName = usingCustom
    ? '+60 (unknown sender)'
    : SCAMMER_NAMES[activeId] ?? '+60 (unknown sender)';

  return (
    <div className="min-h-screen w-full">
      <header className="border-b border-border-gray bg-white/80 backdrop-blur">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-royal-blue text-electric-yellow grid place-items-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-[16px] font-extrabold text-text-primary leading-none">
                SafeSend Plugin
              </div>
              <div className="text-[11px] text-muted-text mt-0.5">
                Scam-message detector for WhatsApp and Telegram
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-pill bg-success-green/15 text-success-green text-[11px] font-bold uppercase tracking-wider">
              Connected to SafeSend
            </span>
            <div className="inline-flex bg-white rounded-pill border border-border-gray p-1 shadow-card">
              {(['bm', 'en'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setLang(option)}
                  className={[
                    'px-3.5 h-7 rounded-pill text-[12px] font-bold uppercase tracking-wider transition-colors',
                    lang === option ? 'bg-royal-blue text-white' : 'text-muted-text',
                  ].join(' ')}
                >
                  {option === 'bm' ? 'BM' : 'EN'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[460px,1fr] gap-6 items-start">
        <section className="min-h-[540px] lg:h-[640px]">
          <ChatMockup
            scammerName={scammerName}
            pendingMessage={pendingMessage}
            matchedPhrases={result?.matched_patterns.map((pattern) => pattern.pattern)}
            contextMessages={
              usingCustom
                ? [
                    { direction: 'in', time: '10:14 AM', text: 'Hi...' },
                    { direction: 'out', time: '10:15 AM', text: 'Siapa?' },
                  ]
                : undefined
            }
          />
        </section>

        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-border-gray shadow-card p-5">
            <div className="text-[11px] font-extrabold text-muted-text uppercase tracking-wider">
              Step 1
            </div>
            <h2 className="text-[18px] font-extrabold text-text-primary mt-1">
              {lang === 'en'
                ? 'Pick the LHDN demo or paste your own message'
                : 'Pilih demo LHDN atau tampal mesej anda sendiri'}
            </h2>
            <p className="text-[13px] text-muted-text mt-1">
              {lang === 'en'
                ? 'SafeSend scans the message for known scam language before you ever open your e-wallet.'
                : 'SafeSend mengimbas mesej untuk bahasa penipuan yang diketahui sebelum anda membuka e-dompet.'}
            </p>

            <div className="mt-4 grid gap-2">
              {sampleScamMessages.map((message) => (
                <ScamSampleButton
                  key={message.id}
                  label={message.label}
                  preview={message.body}
                  active={!usingCustom && activeId === message.id}
                  onClick={() => handlePickSample(message.id, message.body)}
                />
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-[12px] font-bold uppercase tracking-wider text-muted-text mb-1.5">
                {lang === 'en' ? 'Or paste your own message' : 'Atau tampal mesej anda sendiri'}
              </label>
              <textarea
                value={customText}
                onFocus={() => setUsingCustom(true)}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  setUsingCustom(true);
                  setPendingMessage(e.target.value);
                  setResult(null);
                }}
                rows={4}
                placeholder={
                  lang === 'en'
                    ? 'Paste a WhatsApp or Telegram message here...'
                    : 'Tampal mesej WhatsApp atau Telegram di sini...'
                }
                className="w-full rounded-md border border-border-gray bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-muted-text focus:outline-none focus:border-tng-blue resize-none"
              />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <button onClick={handleAnalyse} disabled={loading} className="btn-yellow">
                {loading
                  ? lang === 'en'
                    ? 'Analysing...'
                    : 'Menganalisis...'
                  : lang === 'en'
                    ? 'Analyse with SafeSend'
                    : 'Analisis dengan SafeSend'}
              </button>
              <span className="text-[12px] text-muted-text">
                Calls <code className="font-mono text-[11px] bg-app-gray px-1.5 py-0.5 rounded">/api/analyse-message</code>
              </span>
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-fraud-warning-bg border border-fraud-warning-border px-3 py-2 text-[13px] text-risk-red">
                {error}
              </div>
            )}
          </div>

          {result ? (
            <div>
              <div className="text-[11px] font-extrabold text-muted-text uppercase tracking-wider mb-2">
                Step 2 - SafeSend verdict
              </div>
              <WarningBanner result={result} lang={lang} />
            </div>
          ) : (
            <div className="bg-soft-blue-surface border border-sky-blue rounded-xl p-4 text-[13px] text-tng-blue">
              <div className="font-bold mb-1">{lang === 'en' ? 'Tip' : 'Petua'}</div>
              {lang === 'en'
                ? 'Use the LHDN sample first for the hackathon flow, then try a safer message to see the green state.'
                : 'Guna sampel LHDN dahulu untuk aliran hackathon, kemudian cuba mesej yang lebih selamat untuk melihat keadaan hijau.'}
            </div>
          )}
        </section>
      </main>

      <footer className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 text-[11px] text-muted-text">
        Demo only - SafeSend for Touch 'n Go FinHack 2026
      </footer>
    </div>
  );
}
