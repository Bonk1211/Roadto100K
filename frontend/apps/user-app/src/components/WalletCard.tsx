import type { UIlang } from 'shared';
import { formatRM } from '../lib/format';
import { t } from '../lib/i18n';

interface Props {
  balance: number;
  userName: string;
  lang: UIlang;
}

export default function WalletCard({ balance, userName, lang }: Props) {
  return (
    <div
      className="rounded-2xl p-6 text-white shadow-elevated relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #005BAC 0%, #003F7D 100%)',
      }}
    >
      <div className="absolute top-0 left-6 right-6 h-[3px] bg-electric-yellow rounded-b-pill opacity-90" />

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider opacity-80">
            {t('tngWallet', lang)}
          </div>
          <div className="text-[14px] font-medium opacity-90 mt-0.5">{userName}</div>
        </div>
        <button
          aria-label="Notifications"
          className="w-10 h-10 rounded-full bg-white/15 grid place-items-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 22a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="mt-5">
        <div className="text-[12px] font-semibold opacity-80 uppercase tracking-wider">
          {t('availableBalance', lang)}
        </div>
        <div className="text-wallet-balance mt-1 tracking-tight">
          {formatRM(balance)}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button className="flex-1 h-10 rounded-pill bg-white text-tng-blue text-[13px] font-bold">
          {t('reload', lang)}
        </button>
        <button className="flex-1 h-10 rounded-pill bg-white/15 text-white text-[13px] font-bold border border-white/30">
          {t('viewHistory', lang)}
        </button>
      </div>
    </div>
  );
}
