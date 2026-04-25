import type { AnalyseMessageResponse, UIlang } from 'shared';

interface Props {
  result: AnalyseMessageResponse;
  lang: UIlang;
}

const RISK_LABEL: Record<
  AnalyseMessageResponse['risk_level'],
  { en: string; bm: string }
> = {
  high: { en: 'High risk - likely a scam', bm: 'Risiko tinggi - kemungkinan penipuan' },
  medium: { en: 'Medium risk - be careful', bm: 'Risiko sederhana - berhati-hati' },
  low: { en: 'No suspicious content detected', bm: 'Tiada kandungan mencurigakan dikesan' },
};

const SCAM_TYPE_LABEL: Record<string, string> = {
  macau_scam: 'Macau scam',
  investment_scam: 'Investment scam',
  love_scam: 'Love scam',
  account_takeover: 'Account takeover',
  mule_account: 'Mule account',
  false_positive: 'Likely safe',
};

export default function WarningBanner({ result, lang }: Props) {
  const isScam = result.is_scam;
  const meta = RISK_LABEL[result.risk_level];

  return (
    <div
      className="rounded-xl overflow-hidden shadow-elevated border-2"
      style={{
        background: isScam ? '#FEF2F2' : '#ECFDF5',
        borderColor: isScam ? '#FCA5A5' : '#BBF7D0',
      }}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div
          className={[
            'w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 shadow-card text-white',
            isScam ? 'bg-risk-red' : 'bg-success-green',
          ].join(' ')}
        >
          {isScam ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={[
                'text-[11px] font-extrabold uppercase tracking-wider',
                isScam ? 'text-risk-red' : 'text-success-green',
              ].join(' ')}
            >
              SafeSend Plugin
            </span>
            {result.scam_type_hint && (
              <span
                className={[
                  'px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider',
                  isScam ? 'bg-risk-red text-white' : 'bg-success-green text-white',
                ].join(' ')}
              >
                {SCAM_TYPE_LABEL[result.scam_type_hint] ?? result.scam_type_hint}
              </span>
            )}
          </div>
          <div className="text-[14px] font-bold text-text-primary mt-1">
            {lang === 'en' ? meta.en : meta.bm}
          </div>
          <div className="text-[12px] text-muted-text mt-0.5">
            {lang === 'en'
              ? `Confidence ${(result.confidence * 100).toFixed(0)}%`
              : `Keyakinan ${(result.confidence * 100).toFixed(0)}%`}
          </div>
        </div>
      </div>

      {isScam && (
        <div className="bg-electric-yellow px-4 py-2.5 border-y-2 border-fraud-warning-border">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-royal-blue">
            {lang === 'en' ? 'Warning' : 'Amaran'}
          </div>
          <div className="text-[13px] font-semibold text-text-primary mt-0.5 leading-snug">
            {lang === 'en' ? result.warning_en : result.warning_bm}
          </div>
        </div>
      )}

      <div className="bg-white px-4 py-3 space-y-3">
        {result.matched_patterns.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-muted-text uppercase tracking-wider">
              {lang === 'en' ? 'Matched patterns' : 'Corak yang dipadankan'}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {result.matched_patterns.map((pattern) => (
                <span
                  key={`${pattern.pattern}-${pattern.category}`}
                  className={[
                    'px-2 py-0.5 rounded-pill text-[11px] font-bold border',
                    isScam
                      ? 'bg-fraud-warning-bg text-risk-red border-fraud-warning-border'
                      : 'bg-success-green/10 text-success-green border-success-green/30',
                  ].join(' ')}
                >
                  {pattern.pattern}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="rounded-md bg-app-gray p-2.5">
            <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-0.5">
              English
            </div>
            <div className="text-[13px] text-text-primary leading-relaxed">
              {result.warning_en}
            </div>
          </div>
          <div className="rounded-md bg-app-gray p-2.5">
            <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-0.5">
              Bahasa Malaysia
            </div>
            <div className="text-[13px] text-text-primary leading-relaxed">
              {result.warning_bm}
            </div>
          </div>
        </div>

        <a
          href={result.education_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-tng-blue hover:underline"
        >
          {lang === 'en' ? 'Learn about this scam' : 'Ketahui lebih lanjut tentang penipuan ini'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  );
}
