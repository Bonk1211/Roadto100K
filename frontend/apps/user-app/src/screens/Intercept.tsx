import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { currentUser } from 'shared';
import BilingualToggle from '../components/BilingualToggle';
import ExplainSheet from '../components/ExplainSheet';
import { formatRM } from '../lib/format';
import type { InterceptState } from '../lib/flow';
import { submitUserChoice } from '../lib/api';
import { useLang } from '../lib/i18n';

type Choice = 'cancel' | 'proceed' | 'report';

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
              ? 'We paused this transfer'
              : 'Kami hentikan pemindahan ini'}
          </h1>
          <p className="mt-1 text-[13px] opacity-85 leading-snug">
            {lang === 'en'
              ? 'Take a breath. We will walk through it together.'
              : 'Tarik nafas. Kita akan semak bersama-sama.'}
          </p>
        </div>
        <BilingualToggle value={lang} onChange={setLang} />
      </header>

      <main className="flex-1 px-4 pt-5 pb-6 -mt-4">
        <ExplainSheet
          lang={lang}
          payeeName={payee.name}
          amountFormatted={formatRM(amount)}
          score={screening.final_score}
          explanation={explanation}
          signals={screening.triggered_signals}
          busyChoice={busyChoice}
          onChoice={handleChoice}
          onSeeFullBreakdown={() =>
            navigate('/explain', { state })
          }
        />

        {error && (
          <div className="mt-4 rounded-md bg-fraud-warning-bg border border-fraud-warning-border px-3 py-2 text-[13px] text-risk-red">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
