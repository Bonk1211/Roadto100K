import MessageBubble from './MessageBubble';

interface Props {
  scammerName: string;
  contextMessages?: { text: string; direction: 'in' | 'out'; time: string }[];
  pendingMessage: string | null;
  matchedPhrases?: string[];
}

const DEFAULT_CONTEXT: Props['contextMessages'] = [
  { direction: 'in', time: '10:14 AM', text: 'Selamat pagi, ini Pegawai Aziz dari LHDN.' },
  { direction: 'in', time: '10:14 AM', text: 'Kami ada isu cukai dengan akaun anda.' },
  { direction: 'out', time: '10:15 AM', text: 'Eh, betul ke?' },
  { direction: 'in', time: '10:15 AM', text: 'Ya, sangat penting. Saya akan hantar arahan.' },
];

export default function ChatMockup({
  scammerName,
  contextMessages = DEFAULT_CONTEXT,
  pendingMessage,
  matchedPhrases,
}: Props) {
  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-border-gray shadow-elevated bg-white">
      {/* WhatsApp-style header */}
      <div className="bg-wa-header text-white px-3 py-2.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/20 grid place-items-center text-[14px] font-bold flex-shrink-0">
          {scammerName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold truncate">{scammerName}</div>
          <div className="text-[11px] opacity-80">online</div>
        </div>
        <button aria-label="Call" className="opacity-90">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Conversation */}
      <div
        className="flex-1 overflow-y-auto py-3 space-y-2"
        style={{
          backgroundColor: '#ECE5DD',
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='2' cy='2' r='1' fill='%23d3c8b8' opacity='0.5'/></svg>\")",
        }}
      >
        {contextMessages?.map((m, i) => (
          <MessageBubble key={i} {...m} />
        ))}
        {pendingMessage && (
          <div className="pt-1">
            <MessageBubble
              direction="in"
              time="10:16 AM"
              text={pendingMessage}
              highlight={matchedPhrases}
            />
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="bg-wa-chat-bg border-t border-border-gray p-2 flex items-center gap-2">
        <div className="flex-1 bg-white rounded-pill h-10 px-4 grid place-items-start content-center text-[13px] text-muted-text">
          Type a message
        </div>
        <button className="w-10 h-10 rounded-full bg-wa-green grid place-items-center text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 12 21 3l-4 18-4-7-7-2Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
