interface TransferNoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export default function TransferNoteField({
  value,
  onChange,
  placeholder,
}: TransferNoteFieldProps) {
  return (
    <label className="flex items-center gap-3 rounded-[22px] border border-[#E8EDF5] bg-white px-5 py-5 shadow-card">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-muted-text">
        <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-[#98A2B3] focus:outline-none"
      />
    </label>
  );
}
