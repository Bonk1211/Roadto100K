import { currentUser, mockTransactions } from 'shared';
import AppShell from '../components/AppShell';
import BilingualToggle from '../components/BilingualToggle';
import BottomTabBar from '../components/BottomTabBar';
import QuickActionGrid from '../components/QuickActionGrid';
import SafeSendBadge from '../components/SafeSendBadge';
import TopBar from '../components/TopBar';
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
    <AppShell contentClassName="pt-1" footer={<BottomTabBar lang={lang} />}>

      <div className="space-y-4">
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
              <li
                key={tx.txn_id}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-app-gray/80"
              >
                <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-muted-text">
                        {new Date(tx.timestamp).toLocaleDateString(dateLocale, {
                            day: '2-digit',
                            month: 'short',
                        })}
                        {' · '}
                        {t('transferLabel', lang)}
                    </div>
                  <div className="truncate text-[14px] font-semibold text-text-primary">
                    {tx.payee_name}
                  </div>

                </div>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-text-primary">-{formatRM(tx.amount)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function StatusStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border-gray/70 bg-white/80 p-3 shadow-sm">
      <div className={['inline-flex rounded-pill px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]', accent].join(' ')}>
        {label}
      </div>
      <div className="mt-3 text-[18px] font-extrabold text-text-primary">{value}</div>
    </div>
  );
}
