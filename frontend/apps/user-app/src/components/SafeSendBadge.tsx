interface Props {
  size?: 'sm' | 'md';
}

export default function SafeSendBadge({ size = 'md' }: Props) {
  const px = size === 'sm' ? 14 : 18;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-royal-blue/90 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase text-white">
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none">
        <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" fill="#FFE600" stroke="#FFE600" strokeWidth="1"/>
        <path d="m9 12 2 2 4-4" stroke="#0055D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      SafeSend active
    </span>
  );
}
