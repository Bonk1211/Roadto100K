import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoPayee, mockPayees, type Payee } from 'shared';
import AppShell from '../components/AppShell';
import BalanceSnapshotCard from '../components/BalanceSnapshotCard';
import BilingualToggle from '../components/BilingualToggle';
import BottomActionBar from '../components/BottomActionBar';
import FlowHeader from '../components/FlowHeader';
import RecipientSummaryCard from '../components/RecipientSummaryCard';
import { t, useLang } from '../lib/i18n';
import { useTransferSession } from '../lib/transfer-session';

export default function PayeeScreen() {
  const navigate = useNavigate();
  const [lang, setLang] = useLang();
  const {
    walletBalance,
    transfer,
    remainingBalance,
    setTransferPayee,
  } = useTransferSession();
  const [identifier, setIdentifier] = useState<string>(transfer.payee?.account ?? demoPayee.account);

  const payee = useMemo<Payee>(() => {
    return (
      mockPayees.find(
        (candidate) =>
          candidate.account === identifier ||
          candidate.phone === identifier ||
          candidate.id === identifier,
      ) ?? demoPayee
    );
  }, [identifier]);

  if (!transfer.amount) {
    navigate('/transfer', { replace: true });
    return null;
  }

  return (
    <AppShell
      footer={(
        <BottomActionBar>
          <button
            onClick={() => {
              setTransferPayee(payee);
              navigate('/confirm');
            }}
            className="btn-primary"
          >
            {t('reviewTransfer', lang)}
          </button>
        </BottomActionBar>
      )}
    >
      <div className="relative pb-16">
        <FlowHeader
          title={t('transferTitle', lang)}
          onBack={() => navigate(-1)}
          theme="light"
          right={<BilingualToggle value={lang} onChange={setLang} />}
          eyebrow="Choose payee"
          step="Step 2 of 3"
        />
        <div className="absolute inset-x-3 -bottom-12 z-40">
          <BalanceSnapshotCard
            walletBalance={walletBalance}
            amount={transfer.amount}
            remainingBalance={remainingBalance}
          />
        </div>
      </div>

      <div className="-mt-5 space-y-4 rounded-t-[32px] bg-app-gray px-3 pt-4 app-screen-enter motion-stagger">

        <section className="app-panel p-5">
          <label className="section-label mb-2 block">
            {t('recipientLabel', lang)}
          </label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t('recipientPlaceholder', lang)}
            className="app-input h-12 font-semibold"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {mockPayees.slice(0, 4).map((quickPayee) => (
              <button
                key={quickPayee.id}
                onClick={() => setIdentifier(quickPayee.account)}
                className="rounded-2xl border border-border-gray bg-white/90 px-3 py-2 text-left shadow-sm"
              >
                <div className="text-[12px] font-bold text-text-primary">{quickPayee.name}</div>
                <div className="text-[11px] font-mono text-muted-text">{quickPayee.account}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="app-panel p-5">
          <div className="section-label mb-3">{t('payeeLookup', lang)}</div>
          <RecipientSummaryCard
            name={payee.name}
            detail={payee.account}
            subdetail={`${t('accountAge', lang)}: ${payee.account_age_days} ${t('days', lang)}`}
            badge={payee.flagged_in_scam_graph ? undefined : 'Verified'}
          />

          <div className="mt-4 rounded-2xl border border-sky-blue bg-soft-blue-surface p-3 text-[12px] text-tng-blue">
            {t('payeeCheckNote', lang)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
