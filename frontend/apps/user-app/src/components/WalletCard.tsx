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
        <div className="relative group">
          <button
            aria-label="SafeSend"
            className="w-10 h-10 rounded-full bg-white/15 grid place-items-center transition-all duration-200 hover:bg-white/25"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" fill="#FFE600" stroke="#FFE600" strokeWidth="1" />
              <path d="m9 12 2 2 4-4" stroke="#0055D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-10 w-max max-w-[180px] rounded-xl bg-dark-security-blue px-3 py-2 text-[11px] font-semibold text-white shadow-elevated opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0">
            SafeSend is protecting this wallet
          </div>
        </div>
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
