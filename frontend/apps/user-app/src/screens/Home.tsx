import { currentUser, mockTransactions } from 'shared';
import ActivityRow from '../components/ActivityRow';
import AppShell from '../components/AppShell';
import BilingualToggle from '../components/BilingualToggle';
import BottomTabBar from '../components/BottomTabBar';
import QuickActionGrid from '../components/QuickActionGrid';
import SafeSendBadge from '../components/SafeSendBadge';
import WalletCard from '../components/WalletCard';
import { formatRM } from '../lib/format';
import { t, useLang } from '../lib/i18n';

const BALANCE = 12450.8;

export default function Home() {
  const [lang, setLang] = useLang();
  const recent = mockTransactions
    .filter((tx) => tx.user_id === currentUser.id)
    .slice(0, 4);

  const dateLocale = lang === 'en' ? 'en-MY' : 'ms-MY';

  return (
    <AppShell contentClassName="px-0 pb-0" footer={<BottomTabBar lang={lang} />}>
      <section className="bg-[linear-gradient(180deg,#005BAC_0%,#004B91_100%)] px-4 pb-8 pt-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-white/75">{t('welcomeBack', lang)}</div>
            <div className="mt-1 text-[24px] font-extrabold leading-tight">{currentUser.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <BilingualToggle value={lang} onChange={setLang} />
            <SafeSendBadge size="sm" />
          </div>
        </div>
        <div className="mt-4 rounded-[22px] bg-white/10 px-4 py-3 text-[12px] text-white/80">
          Real-time protection is active while you pay, transfer, and review recipients.
        </div>
      </section>

      <div className="-mt-8 space-y-4 px-4 pb-4">
        <WalletCard balance={BALANCE} userName={currentUser.name} lang={lang} />

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
