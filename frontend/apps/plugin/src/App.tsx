import { useState } from 'react';
import { sampleScamMessages, type ScanMessageResponse } from 'shared';
import ChatMockup from './components/ChatMockup';
import ScamSampleButton from './components/ScamSampleButton';
import WarningBanner from './components/WarningBanner';
import { scanMessage } from './lib/api';

const SCAMMER_NAMES: Record<string, string> = {
  msg_lhdn: '+60 11-2233 4455 (LHDN)',
  msg_prize: 'TnG Loyalty (unverified)',
  msg_invest: '+60 12-9988 7766',
};

export default function App() {
  const [activeId, setActiveId] = useState<string>(sampleScamMessages[0].id);
  const [customText, setCustomText] = useState('');
  const [usingCustom, setUsingCustom] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string>(sampleScamMessages[0].body);
  const [result, setResult] = useState<ScanMessageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Paste or pick a message first.');
      return;
    }
    if (usingCustom) setPendingMessage(text);
    setLoading(true);
    setError(null);
    try {
      const r = await scanMessage(text);
      setResult(r);
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
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-royal-blue text-electric-yellow grid place-items-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-[16px] font-extrabold text-text-primary leading-none">
                SafeSend Plugin
              </div>
              <div className="text-[11px] text-muted-text mt-0.5">
                Scam-message detector for WhatsApp & Telegram
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-pill bg-success-green/15 text-success-green text-[11px] font-bold uppercase tracking-wider">
              Connected to SafeSend
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[460px,1fr] gap-6 items-start">
        {/* Left: chat mockup */}
        <section className="h-[640px]">
          <ChatMockup
            scammerName={scammerName}
            pendingMessage={pendingMessage}
            matchedPhrases={result?.matched_phrases}
            contextMessages={
              usingCustom
                ? [
                    { direction: 'in', time: '10:14 AM', text: 'Hi…' },
                    { direction: 'out', time: '10:15 AM', text: 'Siapa?' },
                  ]
                : undefined
            }
          />
        </section>

        {/* Right: plugin panel */}
        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-border-gray shadow-card p-5">
            <div className="text-[11px] font-extrabold text-muted-text uppercase tracking-wider">
              Step 1
            </div>
            <h2 className="text-[18px] font-extrabold text-text-primary mt-1">
              Pick a sample scam, or paste your own
            </h2>
            <p className="text-[13px] text-muted-text mt-1">
              SafeSend scans the message for known scam language before you ever open
              your e-wallet.
            </p>

            <div className="mt-4 grid gap-2">
              {sampleScamMessages.map((m) => (
                <ScamSampleButton
                  key={m.id}
                  label={m.label}
                  preview={m.body}
                  active={!usingCustom && activeId === m.id}
                  onClick={() => handlePickSample(m.id, m.body)}
                />
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-[12px] font-bold uppercase tracking-wider text-muted-text mb-1.5">
                Or paste your own message
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
                rows={3}
                placeholder="Paste a WhatsApp / Telegram message here…"
                className="w-full rounded-md border border-border-gray bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-muted-text focus:outline-none focus:border-tng-blue resize-none"
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleAnalyse}
                disabled={loading}
                className="btn-yellow"
              >
                {loading ? 'Analysing…' : 'Analyse with SafeSend'}
              </button>
              <span className="text-[12px] text-muted-text">
                Calls <code className="font-mono text-[11px] bg-app-gray px-1.5 py-0.5 rounded">/api/scan-message</code>
              </span>
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-fraud-warning-bg border border-fraud-warning-border px-3 py-2 text-[13px] text-risk-red">
                {error}
              </div>
            )}
          </div>

          {result && (
            <div>
              <div className="text-[11px] font-extrabold text-muted-text uppercase tracking-wider mb-2">
                Step 2 · SafeSend verdict
              </div>
              <WarningBanner result={result} />
            </div>
          )}

          {!result && (
            <div className="bg-soft-blue-surface border border-sky-blue rounded-xl p-4 text-[13px] text-tng-blue">
              <div className="font-bold mb-1">Tip</div>
              Pick a sample on the left, then press <span className="font-bold">Analyse with SafeSend</span>{' '}
              to see how the plugin warns the user before they open TnG.
            </div>
          )}
        </section>
      </main>

      <footer className="max-w-[1100px] mx-auto px-6 py-6 text-[11px] text-muted-text">
        Demo only · SafeSend for Touch ’n Go FinHack 2026
      </footer>
    </div>
  );
}
