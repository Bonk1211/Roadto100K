import { useLocation, useNavigate } from 'react-router-dom';
import type { Payee } from 'shared';
import BilingualToggle from '../components/BilingualToggle';
import type { DoneStatus } from '../lib/flow';
import { formatRM } from '../lib/format';
import { t, useLang, type StringKey } from '../lib/i18n';

interface NavState {
  payee?: Payee;
  amount?: number;
  status?: DoneStatus;
}

const COPY: Record<
  DoneStatus,
  {
    badgeKey: StringKey;
    titleKey: StringKey;
    bodyKey: StringKey;
    tone: 'safe' | 'risk' | 'pending';
  }
> = {
  success: {
    badgeKey: 'doneBadgeSuccess',
    titleKey: 'doneTitleSuccess',
    bodyKey: 'doneBodySuccess',
    tone: 'safe',
  },
  cancelled: {
    badgeKey: 'doneBadgeCancelled',
    titleKey: 'doneTitleCancelled',
    bodyKey: 'doneBodyCancelled',
    tone: 'safe',
  },
  reported: {
    badgeKey: 'doneBadgeReported',
    titleKey: 'doneTitleReported',
    bodyKey: 'doneBodyReported',
    tone: 'pending',
  },
  overridden: {
    badgeKey: 'doneBadgeOverridden',
    titleKey: 'doneTitleOverridden',
    bodyKey: 'doneBodyOverridden',
    tone: 'risk',
  },
  soft_warn_proceed: {
    badgeKey: 'doneBadgeOverridden',
    titleKey: 'doneTitleSoftProceed',
    bodyKey: 'doneBodySoftProceed',
    tone: 'pending',
  },
  soft_warn_cancelled: {
    badgeKey: 'doneBadgeCancelled',
    titleKey: 'doneTitleSoftCancelled',
    bodyKey: 'doneBodySoftCancelled',
    tone: 'safe',
  },
};

export default function Done() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as NavState | null) ?? {};
  const [lang, setLang] = useLang();
  const status: DoneStatus = state.status ?? 'success';
  const copy = COPY[status];
  const amount = state.amount ?? 0;
  const payee = state.payee;

  return (
    <div className="phone-frame flex flex-col">
      <div className="flex justify-end px-4 pt-3">
        <BilingualToggle value={lang} onChange={setLang} />
      </div>
      <main className="flex-1 px-4 pt-6 pb-6 flex flex-col items-center text-center">
        <div
          className={[
            'w-20 h-20 rounded-full grid place-items-center mb-5',
            copy.tone === 'safe' ? 'bg-success-green/15 text-success-green' : '',
            copy.tone === 'risk' ? 'bg-risk-red/15 text-risk-red' : '',
            copy.tone === 'pending' ? 'bg-pending-orange/15 text-pending-orange' : '',
          ].join(' ')}
        >
          {copy.tone === 'safe' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {copy.tone === 'risk' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.41 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {copy.tone === 'pending' && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <span
          className={[
            'px-2.5 py-1 rounded-pill text-[11px] font-bold uppercase tracking-wider',
            copy.tone === 'safe' ? 'bg-success-green/15 text-success-green' : '',
            copy.tone === 'risk' ? 'bg-risk-red/15 text-risk-red' : '',
            copy.tone === 'pending' ? 'bg-pending-orange/15 text-pending-orange' : '',
          ].join(' ')}
        >
          {t(copy.badgeKey, lang)}
        </span>

        <h1 className="text-[24px] font-extrabold text-text-primary mt-3 leading-tight">
          {t(copy.titleKey, lang)}
        </h1>
        <p className="text-[14px] text-muted-text mt-2 max-w-xs">{t(copy.bodyKey, lang)}</p>

        {amount > 0 && payee && (
          <div className="mt-6 w-full card p-4 text-left">
            <div className="text-[11px] font-semibold text-muted-text uppercase tracking-wider">
              {status === 'cancelled' ? t('doneWouldHaveSent', lang) : t('doneTransaction', lang)}
            </div>
            <div className="flex items-center justify-between mt-2">
              <div>
                <div className="text-[14px] font-semibold text-text-primary">{payee.name}</div>
                <div className="text-[12px] text-muted-text font-mono">
                  TnG · {payee.account}
                </div>
              </div>
              <div className="text-[20px] font-extrabold text-text-primary">
                {formatRM(amount)}
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-white border-t border-border-gray px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <button onClick={() => navigate('/home')} className="btn-primary">
          {t('backToWallet', lang)}
        </button>
        {status !== 'success' && (
          <button onClick={() => navigate('/transfer')} className="btn-ghost">
            {t('startNewTransfer', lang)}
          </button>
        )}
      </div>
    </div>
  );
}
