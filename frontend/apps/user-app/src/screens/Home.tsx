import { currentUser, mockTransactions } from 'shared';
import ActivityRow from '../components/ActivityRow';
import AppShell from '../components/AppShell';
import BilingualToggle from '../components/BilingualToggle';
import BottomTabBar from '../components/BottomTabBar';
import QuickActionGrid from '../components/QuickActionGrid';
import WalletCard from '../components/WalletCard';
import { formatRM } from '../lib/format';
import { t, useLang } from '../lib/i18n';
import { useTransferSession } from '../lib/transfer-session';

export default function Home() {
  const [lang, setLang] = useLang();
  const { walletBalance } = useTransferSession();
  const recent = mockTransactions
    .filter((tx) => tx.user_id === currentUser.id)
    .slice(0, 4);

  const dateLocale = lang === 'en' ? 'en-MY' : 'ms-MY';

  return (
    <AppShell contentClassName="px-0 pb-[112px]" footer={<BottomTabBar lang={lang} />}>
      <section className="bg-[linear-gradient(180deg,#005BAC_0%,#004B91_100%)] px-4 pb-10 pt-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-white/75">{t('welcomeBack', lang)}</div>
            <div className="mt-1 text-[24px] font-extrabold leading-tight">{currentUser.name}</div>
          </div>
          <div className="shrink-0 pt-0.5">
            <BilingualToggle value={lang} onChange={setLang} />
          </div>
        </div>
      </section>

      <div className="-mt-5 px-4 pb-5 space-y-5 px-4 pb-4 app-screen-enter motion-stagger">
        <WalletCard balance={walletBalance} userName={currentUser.name} lang={lang} />

        <QuickActionGrid lang={lang} />

        <section className="app-panel overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="section-label">{t('recentActivity', lang)}</div>
              <div className="mt-1 text-[15px] font-bold text-text-primary">Your latest transfers</div>
            </div>
            <button className="rounded-pill bg-soft-blue-surface px-3 py-1.5 text-[12px] font-semibold text-tng-blue">
              {t('seeAll', lang)}
            </button>
          </div>

          <ul className="px-2 pb-2">
            {recent.map((tx) => (
              <ActivityRow
                key={tx.txn_id}
                avatarLabel={tx.payee_name.charAt(0)}
                title={tx.payee_name}
                meta={`${new Date(tx.timestamp).toLocaleDateString(dateLocale, {
                  day: '2-digit',
                  month: 'short',
                })} · ${t('transferLabel', lang)}`}
                amount={`-${formatRM(tx.amount)}`}
              />
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
