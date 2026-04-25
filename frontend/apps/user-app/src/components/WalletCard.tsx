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
      className="relative overflow-hidden rounded-[28px] px-5 pb-6 pt-6 text-white shadow-elevated"
      style={{
        background: 'linear-gradient(145deg, #005BAC 0%, #004B91 45%, #003F7D 100%)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,230,0,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_30%)]" />
      <div className="absolute left-9 right-9 top-0 h-[5px] rounded-b-pill bg-electric-yellow opacity-90" />

      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider opacity-80">
            {t('tngWallet', lang)}
          </div>
          <div className="mt-1 text-[14px] font-medium opacity-90">Personal wallet</div>
        </div>
        <div className="relative group">
          <button
            aria-label="SafeSend"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/14 transition-all duration-200 hover:bg-white/22"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" fill="#FFE600" stroke="#FFE600" strokeWidth="1" />
              <path d="m9 12 2 2 4-4" stroke="#0055D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative mt-7">
        <div className="text-[12px] font-semibold opacity-80 uppercase tracking-wider">
          {t('availableBalance', lang)}
        </div>
        <div className="text-wallet-balance mt-1 tracking-tight">
          {formatRM(balance)}
        </div>
      </div>

      <div className="relative mt-6 flex gap-3">
        <button className="flex-1 h-11 rounded-pill bg-white text-tng-blue text-[13px] font-bold shadow-sm">
          {t('reload', lang)}
        </button>
        <button className="flex-1 h-11 rounded-pill border border-white/35 bg-white/10 text-white text-[13px] font-bold">
          {t('viewHistory', lang)}
        </button>
      </div>
    </div>
  );
}
