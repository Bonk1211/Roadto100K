interface Props {
  text: string;
  time: string;
  direction: 'in' | 'out';
  highlight?: string[];
}

export default function MessageBubble({ text, time, direction, highlight }: Props) {
  const isIn = direction === 'in';

  const parts = highlight && highlight.length > 0 ? splitHighlights(text, highlight) : [{ text, hit: false }];

  return (
    <div className={`flex ${isIn ? 'justify-start' : 'justify-end'} px-3`}>
      <div
        className={[
          'max-w-[78%] rounded-[14px] px-3 py-2 text-[14px] leading-snug shadow-card',
          isIn
            ? 'bg-wa-bubble-in text-text-primary rounded-tl-[4px]'
            : 'bg-wa-bubble-out text-text-primary rounded-tr-[4px]',
        ].join(' ')}
      >
        <div className="whitespace-pre-wrap break-words">
          {parts.map((p, i) =>
            p.hit ? (
              <span
                key={i}
                className="bg-electric-yellow/80 text-text-primary rounded-sm px-0.5 font-semibold"
              >
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </div>
        <div className="text-[10px] text-muted-text text-right mt-0.5">{time}</div>
      </div>
    </div>
  );
}

function splitHighlights(
  text: string,
  phrases: string[]
): { text: string; hit: boolean }[] {
  const cleanPhrases = phrases.filter(Boolean).sort((a, b) => b.length - a.length);
  if (cleanPhrases.length === 0) return [{ text, hit: false }];
  const escaped = cleanPhrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const out: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}
