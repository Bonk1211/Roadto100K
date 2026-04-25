import type { ScanMessageResponse } from 'shared';

interface Props {
  result: ScanMessageResponse;
}

const RISK_LABEL: Record<ScanMessageResponse['risk'], { en: string; bm: string; tone: string }> = {
  high: { en: 'High risk — likely a scam', bm: 'Risiko tinggi — kemungkinan penipuan', tone: 'red' },
  medium: { en: 'Medium risk — be careful', bm: 'Risiko sederhana — berhati-hati', tone: 'orange' },
  low: { en: 'Low risk — looks normal', bm: 'Risiko rendah — kelihatan biasa', tone: 'green' },
};

const SCAM_TYPE_LABEL: Record<string, string> = {
  macau_scam: 'Macau scam',
  investment_scam: 'Investment scam',
  love_scam: 'Love scam',
  account_takeover: 'Account takeover',
  mule_account: 'Mule account',
  false_positive: 'Likely safe',
};

export default function WarningBanner({ result }: Props) {
  const meta = RISK_LABEL[result.risk];
  const isLow = result.risk === 'low';

  return (
    <div className="rounded-xl overflow-hidden shadow-elevated border-2"
      style={{
        background: isLow ? '#ECFDF5' : '#FEF2F2',
        borderColor: isLow ? '#BBF7D0' : '#FCA5A5',
      }}
    >
      {/* Header band */}
      <div
        className="px-4 py-3 flex items-start gap-3"
        style={{ background: isLow ? '#ECFDF5' : '#FEF2F2' }}
      >
        <div
          className={[
            'w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 shadow-card text-white',
            isLow ? 'bg-success-green' : 'bg-risk-red',
          ].join(' ')}
        >
          {isLow ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={[
                'text-[11px] font-extrabold uppercase tracking-wider',
                isLow ? 'text-success-green' : 'text-risk-red',
              ].join(' ')}
            >
              SafeSend Plugin · {meta.en.split(' — ')[0]}
            </span>
            {result.scam_type && (
              <span
                className={[
                  'px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider',
                  isLow ? 'bg-success-green text-white' : 'bg-risk-red text-white',
                ].join(' ')}
              >
                {SCAM_TYPE_LABEL[result.scam_type] ?? result.scam_type}
              </span>
            )}
          </div>
          <div className="text-[14px] font-bold text-text-primary mt-1">
            {meta.en}
          </div>
          <div className="text-[12px] text-muted-text mt-0.5">{meta.bm}</div>
        </div>
      </div>

      {/* Yellow attention strip — DESIGN Enhanced Attention Variant */}
      {!isLow && (
        <div className="bg-electric-yellow px-4 py-2.5 border-y-2 border-fraud-warning-border">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-royal-blue">
            Why we flagged this
          </div>
          <div className="text-[13px] font-semibold text-text-primary mt-0.5 leading-snug">
            {result.explanation_en}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="bg-white px-4 py-3 space-y-3">
        {!isLow && result.matched_phrases.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-muted-text uppercase tracking-wider">
              Matched phrases
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {result.matched_phrases.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded-pill bg-fraud-warning-bg text-risk-red text-[11px] font-bold border border-fraud-warning-border"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="rounded-md bg-app-gray p-2.5">
            <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-0.5">English</div>
            <div className="text-[13px] text-text-primary leading-relaxed">{result.explanation_en}</div>
          </div>
          <div className="rounded-md bg-app-gray p-2.5">
            <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-0.5">Bahasa Malaysia</div>
            <div className="text-[13px] text-text-primary leading-relaxed">{result.explanation_bm}</div>
          </div>
        </div>

        {!isLow && (
          <a
            href="https://www.bnm.gov.my/scam-alert"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-tng-blue hover:underline"
          >
            Learn about this scam
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
