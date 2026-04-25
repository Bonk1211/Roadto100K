import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAmount, demoPayee } from 'shared';
import AppShell from '../components/AppShell';
import BilingualToggle from '../components/BilingualToggle';
import FlowHeader from '../components/FlowHeader';
import ScamProtectionCard from '../components/ScamProtectionCard';
import TransferAmountCard from '../components/TransferAmountCard';
import TransferNoteField from '../components/TransferNoteField';
import TransferRecipientCard from '../components/TransferRecipientCard';
import { createSessionId } from '../lib/flow';
import { t, useLang } from '../lib/i18n';

const WALLET_BALANCE = 1240.5;
const INITIAL_AMOUNT_DIGITS = String(Math.round(demoAmount * 100));

export default function Transfer() {
  const navigate = useNavigate();
  const [lang, setLang] = useLang();
  const [amountDigits, setAmountDigits] = useState<string>(INITIAL_AMOUNT_DIGITS);
  const [note, setNote] = useState('Bantuan kecemasan');

  const numericAmount = parseAmountDigits(amountDigits);

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
      <FlowHeader
        title={t('transferTitle', lang)}
        onBack={() => navigate(-1)}
        theme="light"
        right={<BilingualToggle value={lang} onChange={setLang} />}
        step="Step 1 of 3"
      />

      <div className="-mt-5 space-y-5 rounded-t-[32px] bg-app-gray px-0 pt-0">
        <TransferRecipientCard
          payee={{ name: demoPayee.name, phone: '+60 12-*** *892' }}
          onChange={() => navigate('/payee', {
            state: {
              amount: numericAmount,
              note,
              sessionId: createSessionId(),
            },
          })}
        />

        <TransferAmountCard
          amount={formatAmountDigits(amountDigits)}
          balance={WALLET_BALANCE}
          onAmountChange={(value) => setAmountDigits(normalizeAmountDigits(value))}
          onMax={() => setAmountDigits(String(Math.round(WALLET_BALANCE * 100)))}
        />

        <TransferNoteField
          value={note}
          onChange={setNote}
          placeholder="Add a note (optional)"
        />

        <ScamProtectionCard
          title="Scam Protection"
          message="Only transfer to people you know. TNG will never call you to ask for a transfer or OTP."
        />
      </div>
    </AppShell>
  );
}

function normalizeAmountDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '0';
  return digits.replace(/^0+(?=\d)/, '');
}

function parseAmountDigits(value: string) {
  return Number.parseInt(value || '0', 10) / 100;
}

function formatAmountDigits(value: string) {
  const digits = normalizeAmountDigits(value);
  const padded = digits.padStart(3, '0');
  const integerPart = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  const decimalPart = padded.slice(-2);
  return `${integerPart}.${decimalPart}`;
}
