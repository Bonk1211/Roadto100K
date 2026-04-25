interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskScoreBadge({ score, size = 'md' }: Props) {
  const palette = paletteFor(score);
  const dim =
    size === 'lg'
      ? 'h-14 w-14 text-[20px]'
      : size === 'sm'
        ? 'h-9 w-9 text-[12px]'
        : 'h-11 w-11 text-[15px]';

  return (
    <div
      className={`inline-flex items-center justify-center rounded-pill font-bold leading-none ${dim}`}
      style={{ backgroundColor: palette.bg, color: palette.fg, border: `2px solid ${palette.ring}` }}
      aria-label={`Risk score ${score}`}
      title={`Risk score: ${score} / 100`}
    >
      {score}
    </div>
  );
}

export function bandLabel(score: number): { text: string; color: string } {
  if (score >= 71) return { text: 'High risk', color: '#DC2626' };
  if (score >= 40) return { text: 'Medium risk', color: '#0055D4' };
  return { text: 'Low risk', color: '#16A34A' };
}

function paletteFor(score: number): { bg: string; fg: string; ring: string } {
  if (score >= 71) return { bg: '#DC2626', fg: '#FFFFFF', ring: '#7F1D1D' };
  if (score >= 40) return { bg: '#FFE600', fg: '#0055D4', ring: '#0055D4' };
  return { bg: '#16A34A', fg: '#FFFFFF', ring: '#166534' };
}
