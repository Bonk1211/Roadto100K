interface ScamProtectionCardProps {
  title: string;
  message: string;
}

export default function ScamProtectionCard({
  title,
  message,
}: ScamProtectionCardProps) {
  return (
    <section className="rounded-[24px] border border-[#F9A8A8] bg-[#FFF5F5] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-risk-red">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-bold text-[#991B1B]">{title}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-risk-red">{message}</p>
        </div>
      </div>
    </section>
  );
}
