import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoPayee } from 'shared';
import AppShell from '../components/AppShell';
import BalanceSnapshotCard from '../components/BalanceSnapshotCard';
import BilingualToggle from '../components/BilingualToggle';
import FlowHeader from '../components/FlowHeader';
import ScamProtectionCard from '../components/ScamProtectionCard';
import TransferAmountCard from '../components/TransferAmountCard';
import TransferNoteField from '../components/TransferNoteField';
import TransferRecipientCard from '../components/TransferRecipientCard';
import { t, useLang } from '../lib/i18n';
import { useTransferSession } from '../lib/transfer-session';

export default function Transfer() {
  const navigate = useNavigate();
  const [lang, setLang] = useLang();
  const {
    walletBalance,
    transfer,
    remainingBalance,
    startFreshTransfer,
    updateTransfer,
  } = useTransferSession();
  const [hasFocusedAmount, setHasFocusedAmount] = useState(false);

  useEffect(() => {
    if (transfer.committed || transfer.status) {
      startFreshTransfer();
    }
  }, [startFreshTransfer, transfer.committed, transfer.status]);

  const amountDigits = amountToDigits(transfer.amount);
  const displayAmount = transfer.amount > 0 ? formatAmountDigits(amountDigits) : '';

  const onContinue = () => {
    navigate('/payee');
  };

  return (
    <AppShell
      footer={(
        <div className="sticky bottom-0 border-t border-white/70 bg-white/88 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button
            onClick={onContinue}
            disabled={transfer.amount <= 0 || transfer.amount > walletBalance}
            className="btn-primary"
          >
            {t('continueToPayee', lang)}
          </button>
        </div>
      )}
    >
      <div className="relative pb-14">
        <FlowHeader
          title={t('transferTitle', lang)}
          onBack={() => navigate(-1)}
          theme="light"
          right={<BilingualToggle value={lang} onChange={setLang} />}
          step="Step 1 of 3"
        />
        <div className="absolute inset-x-3 -bottom-10 z-40">
          <TransferRecipientCard
            payee={{ name: transfer.payee?.name ?? demoPayee.name, phone: '+60 12-*** *892' }}
            onChange={() => navigate('/payee')}
          />
        </div>
      </div>

      <div className="-mt-5 space-y-5 rounded-t-[32px] bg-app-gray px-3 pt-4 app-screen-enter motion-stagger">

        <TransferAmountCard
          amount={displayAmount}
          balance={walletBalance}
          onAmountChange={(value) => updateTransfer({ amount: parseAmountDigits(normalizeAmountDigits(value)) })}
          onMax={() => updateTransfer({ amount: walletBalance })}
          onAmountFocus={() => setHasFocusedAmount(true)}
          placeholder={hasFocusedAmount ? '' : '0.00'}
        />

        <BalanceSnapshotCard
          walletBalance={walletBalance}
          amount={transfer.amount}
          remainingBalance={remainingBalance}
        />

        <TransferNoteField
          value={transfer.note}
          onChange={(note) => updateTransfer({ note })}
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
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

function parseAmountDigits(value: string) {
  return Number.parseInt(value || '0', 10) / 100;
}

function formatAmountDigits(value: string) {
  const digits = normalizeAmountDigits(value) || '0';
  const padded = digits.padStart(3, '0');
  const integerPart = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  const decimalPart = padded.slice(-2);
  return `${integerPart}.${decimalPart}`;
}

function amountToDigits(amount: number) {
  if (amount <= 0) return '';
  return String(Math.round(amount * 100));
}
