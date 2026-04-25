import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAmount } from 'shared';
import AppShell from '../components/AppShell';
import BilingualToggle from '../components/BilingualToggle';
import TopBar from '../components/TopBar';
import { createSessionId } from '../lib/flow';
import { formatRM } from '../lib/format';
import { t, useLang } from '../lib/i18n';

export default function Transfer() {
  const navigate = useNavigate();
  const [lang, setLang] = useLang();
  const [amount, setAmount] = useState<string>(String(demoAmount));
  const [note, setNote] = useState('Bantuan kecemasan');

  const numericAmount = parseFloat(amount) || 0;

  const onContinue = () => {
    navigate('/payee', {
      state: {
        amount: numericAmount,
        note,
        sessionId: createSessionId(),
      },
    });
  };

  return (
    <AppShell
      footer={(
        <div className="sticky bottom-0 border-t border-white/70 bg-white/88 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button onClick={onContinue} disabled={numericAmount <= 0} className="btn-primary">
            {t('continueToPayee', lang)}
          </button>
        </div>
      )}
    >
      <TopBar
        title={t('transferTitle', lang)}
        subtitle={t('step1', lang)}
        onBack={() => navigate(-1)}
        theme="light"
        right={<BilingualToggle value={lang} onChange={setLang} />}
        badge={<div className="section-label">Send money</div>}
      />

      <div className="space-y-4 pt-2">
        <section className="app-panel overflow-hidden p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="section-label">{t('amountMyr', lang)}</div>
              <div className="mt-1 text-[14px] text-muted-text">Choose how much you want to send</div>
            </div>
            <div className="rounded-pill bg-soft-blue-surface px-3 py-1 text-[12px] font-bold text-tng-blue">
              DuitNow
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-sky-blue bg-[linear-gradient(180deg,#F8FBFF_0%,#EAF3FF_100%)] px-4 py-5 shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-text">Sending</div>
            <div className="mt-3 flex items-end gap-3">
              <span className="pb-2 text-[18px] font-bold text-muted-text">RM</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="min-w-0 flex-1 bg-transparent text-[42px] font-extrabold leading-none tracking-tight text-text-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[250, 800, 2500, 8000].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(String(quickAmount))}
                className={[
                  'rounded-pill border px-3 py-2 text-[12px] font-semibold shadow-sm transition-colors',
                  Number(amount) === quickAmount
                    ? 'border-tng-blue bg-tng-blue text-white'
                    : 'border-border-gray bg-white/90 text-tng-blue',
                ].join(' ')}
              >
                {formatRM(quickAmount)}
              </button>
            ))}
          </div>
        </section>

        <section className="app-panel p-5">
          <div className="section-label mb-2">{t('noteLabel', lang)}</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('notePlaceholder', lang)}
            className="app-input h-12"
          />
          <div className="mt-3 rounded-2xl bg-soft-blue-surface px-3 py-3 text-[12px] text-tng-blue">
            {t('noteHelper', lang)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
