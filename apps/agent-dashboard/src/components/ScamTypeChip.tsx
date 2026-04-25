import type { ScamType } from 'shared';

interface Props {
  scamType: ScamType;
}

const COPY: Record<ScamType, string> = {
  macau_scam: 'Macau scam',
  investment_scam: 'Investment scam',
  mule_account: 'Mule account',
  account_takeover: 'Account takeover',
  love_scam: 'Love scam',
  false_positive: 'Likely safe',
};

const COLOR: Record<ScamType, { bg: string; fg: string }> = {
  macau_scam: { bg: '#FEF2F2', fg: '#DC2626' },
  investment_scam: { bg: '#FEF3C7', fg: '#92400E' },
  mule_account: { bg: '#EAF3FF', fg: '#0055D4' },
  account_takeover: { bg: '#FEF2F2', fg: '#DC2626' },
  love_scam: { bg: '#FCE7F3', fg: '#9D174D' },
  false_positive: { bg: '#ECFDF5', fg: '#166534' },
};

export function ScamTypeChip({ scamType }: Props) {
  const c = COLOR[scamType];
  return (
    <span
      className="inline-flex items-center rounded-pill px-3 py-1 text-small-label font-semibold"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {COPY[scamType]}
    </span>
  );
}
