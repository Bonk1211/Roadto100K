import { useEffect, useState } from 'react';
import {
  getStoredLanguage,
  setStoredLanguage,
  type BedrockExplanation,
  type UIlang,
} from 'shared';
import { LanguageToggle } from './LanguageToggle.js';

interface Props {
  explanation: BedrockExplanation;
  heading?: string;
  subtitle?: string;
}

export function ExplanationCard({
  explanation,
  heading = 'AI explanation (Bedrock)',
  subtitle,
}: Props) {
  const [lang, setLang] = useState<UIlang>(getStoredLanguage());

  useEffect(() => {
    setStoredLanguage(lang);
  }, [lang]);

  return (
    <section
      className="rounded-lg p-5"
      style={{
        backgroundColor: '#EAF3FF',
        border: '1px solid #C7DCFB',
      }}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-card-title text-text-primary">{heading}</h3>
          {subtitle && <p className="mt-4 text-caption text-muted-text">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle value={lang} onChange={setLang} />
          <span
            className="rounded-pill px-3 py-1 text-small-label font-semibold uppercase tracking-wide"
            style={{ backgroundColor: '#0055D4', color: '#FFE600' }}
          >
            {explanation.confidence}
          </span>
        </div>
      </header>

      <div className="text-text-primary">
        <Block
          lang={lang === 'en' ? 'EN' : 'BM'}
          body={lang === 'en' ? explanation.explanation_en : explanation.explanation_bm}
        />
      </div>

      <p className="mt-4 text-caption text-muted-text">
        {explanation.scam_type.replace('_', ' ')}
      </p>
    </section>
  );
}

function Block({ lang, body }: { lang: 'EN' | 'BM'; body: string }) {
  return (
    <div className="flex gap-3">
      <span
        className="mt-[2px] inline-flex h-6 shrink-0 items-center rounded-pill px-2 text-small-label font-semibold"
        style={{ backgroundColor: '#0055D4', color: '#FFFFFF' }}
      >
        {lang}
      </span>
      <p className="text-base leading-relaxed">{body}</p>
    </div>
  );
}