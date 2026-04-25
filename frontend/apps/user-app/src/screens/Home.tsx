import { currentUser, mockTransactions } from 'shared';
import BilingualToggle from '../components/BilingualToggle';
import WalletCard from '../components/WalletCard';
import QuickActionGrid from '../components/QuickActionGrid';
import BottomTabBar from '../components/BottomTabBar';
import SafeSendBadge from '../components/SafeSendBadge';
import { formatRM } from '../lib/format';
import { t, useLang } from '../lib/i18n';

const BALANCE = 12450.8;

export default function Home() {
  const [lang, setLang] = useLang();
  const recent = mockTransactions
    .filter((t) => t.user_id === currentUser.id)
    .slice(0, 4);

  const dateLocale = lang === 'en' ? 'en-MY' : 'ms-MY';

  return (
    <div className="phone-frame flex flex-col">
      <div className="bg-tng-blue h-[64px] flex items-end px-5 pb-3 text-white">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 grid place-items-center text-[13px] font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="text-[11px] opacity-80">{t('welcomeBack', lang)}</div>
              <div className="text-[14px] font-bold leading-none">{currentUser.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BilingualToggle value={lang} onChange={setLang} />
            <SafeSendBadge size="sm" />
          </div>
        </div>
      </div>

      <main className="flex-1 px-4 pt-4 pb-6 space-y-4">
        <WalletCard balance={BALANCE} userName={currentUser.name} lang={lang} />

        <QuickActionGrid lang={lang} />

        <div className="rounded-xl p-4 bg-soft-blue-surface border border-sky-blue flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-royal-blue text-electric-yellow grid place-items-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-text-primary">{t('safeSendOn', lang)}</div>
            <div className="text-[12px] text-muted-text">{t('safeSendOnSub', lang)}</div>
          </div>
        </div>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-gray">
            <div className="text-card-title text-text-primary">{t('recentActivity', lang)}</div>
            <button className="text-[13px] font-semibold text-tng-blue">{t('seeAll', lang)}</button>
          </div>
          <ul>
            {recent.map((tx) => (
              <li
                key={tx.txn_id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border-gray last:border-b-0"
              >
                <div className="w-10 h-10 rounded-full bg-soft-blue-surface text-tng-blue grid place-items-center font-bold">
                  {tx.payee_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-text-primary truncate">
                    {tx.payee_name}
                  </div>
                  <div className="text-[12px] text-muted-text">
                    {new Date(tx.timestamp).toLocaleDateString(dateLocale, {
                      day: '2-digit',
                      month: 'short',
                    })}
                    {' · '}
                    {t('transferLabel', lang)}
                  </div>
                </div>
                <div className="text-[14px] font-bold text-text-primary">
                  -{formatRM(tx.amount)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <BottomTabBar lang={lang} />
    </div>
  );
}
