import type { ScamType, ScanMessageResponse } from 'shared';

interface Pattern {
  phrase: string;
  weight: number;
  category: ScamType | 'generic';
}

const PATTERNS: Pattern[] = [
  { phrase: 'akaun anda dibekukan', weight: 3, category: 'mule_account' },
  { phrase: 'akaun dibekukan', weight: 3, category: 'mule_account' },
  { phrase: 'lhdn', weight: 3, category: 'mule_account' },
  { phrase: 'pdrm', weight: 3, category: 'mule_account' },
  { phrase: 'polis', weight: 2, category: 'mule_account' },
  { phrase: 'pindahkan', weight: 2, category: 'macau_scam' },
  { phrase: 'akaun selamat', weight: 3, category: 'macau_scam' },
  { phrase: 'pindahkan wang ke akaun selamat', weight: 4, category: 'macau_scam' },
  { phrase: 'otp', weight: 3, category: 'account_takeover' },
  { phrase: 'kata laluan', weight: 2, category: 'account_takeover' },
  { phrase: 'hadiah', weight: 2, category: 'mule_account' },
  { phrase: 'tahniah', weight: 1, category: 'mule_account' },
  { phrase: 'menang', weight: 1, category: 'mule_account' },
  { phrase: 'segera', weight: 1, category: 'generic' },
  { phrase: 'investment', weight: 2, category: 'investment_scam' },
  { phrase: 'pelaburan', weight: 2, category: 'investment_scam' },
  { phrase: 'guaranteed return', weight: 4, category: 'investment_scam' },
  { phrase: 'pulangan terjamin', weight: 4, category: 'investment_scam' },
  { phrase: 'limited slot', weight: 2, category: 'investment_scam' },
  { phrase: 'tng loyalty', weight: 2, category: 'mule_account' },
  { phrase: 'cukai tertunggak', weight: 3, category: 'mule_account' },
];

const EXPLANATIONS: Record<ScamType | 'generic', { en: string; bm: string }> = {
  macau_scam: {
    en: 'This message uses classic Macau-scam language — false urgency about your account and a request to move money to a "safe" account. Do not transfer.',
    bm: 'Mesej ini menggunakan bahasa penipuan Macau klasik — desakan palsu tentang akaun anda dan arahan memindah wang ke akaun "selamat". Jangan pindahkan wang.',
  },
  investment_scam: {
    en: 'This message promises guaranteed investment returns. Real licensed investments never guarantee profits. Likely an investment scam.',
    bm: 'Mesej ini menjanjikan pulangan pelaburan terjamin. Pelaburan sah tidak pernah menjamin keuntungan. Berkemungkinan penipuan pelaburan.',
  },
  mule_account: {
    en: 'This message impersonates a government agency or claims you won a prize so you transfer money. Genuine agencies never collect via e-wallet.',
    bm: 'Mesej ini menyamar sebagai agensi kerajaan atau mendakwa anda memenangi hadiah supaya anda memindahkan wang. Agensi sebenar tidak pernah mengutip melalui e-dompet.',
  },
  account_takeover: {
    en: 'This message asks for your OTP or password. Never share these — they let scammers take over your account.',
    bm: 'Mesej ini meminta OTP atau kata laluan anda. Jangan kongsi — ia membolehkan penipu mengambil alih akaun anda.',
  },
  love_scam: {
    en: 'Be cautious — this message has hallmarks of a love-scam request for emergency money. Verify the person in real life first.',
    bm: 'Berhati-hati — mesej ini mempunyai ciri penipuan cinta yang meminta wang kecemasan. Sahkan orang itu secara nyata dahulu.',
  },
  false_positive: {
    en: 'No clear scam signals were detected.',
    bm: 'Tiada petunjuk penipuan yang jelas dikesan.',
  },
  generic: {
    en: 'This message contains language commonly used in scams. Do not transfer money until you verify in person.',
    bm: 'Mesej ini mengandungi bahasa yang sering digunakan dalam penipuan. Jangan pindahkan wang sehingga anda mengesahkannya secara peribadi.',
  },
};

export function scanMessage(text: string): ScanMessageResponse {
  if (!text || !text.trim()) {
    return {
      risk: 'low',
      matched_phrases: [],
      explanation_en: 'Empty message — nothing to analyse.',
      explanation_bm: 'Mesej kosong — tiada apa untuk dianalisis.',
      scam_type: null,
    };
  }

  const lower = text.toLowerCase();
  const matched: Pattern[] = [];
  for (const p of PATTERNS) {
    if (lower.includes(p.phrase)) matched.push(p);
  }

  const totalWeight = matched.reduce((sum, p) => sum + p.weight, 0);
  const matchedPhrases = dedupe(matched.map((m) => m.phrase));

  let risk: 'low' | 'medium' | 'high' = 'low';
  if (totalWeight >= 6) risk = 'high';
  else if (totalWeight >= 3) risk = 'medium';

  // Pick scam type by highest-weighted matched category (excluding generic).
  const categoryWeights = new Map<ScamType, number>();
  for (const m of matched) {
    if (m.category === 'generic') continue;
    categoryWeights.set(m.category, (categoryWeights.get(m.category) ?? 0) + m.weight);
  }
  let scamType: ScamType | null = null;
  let bestWeight = 0;
  for (const [cat, w] of categoryWeights) {
    if (w > bestWeight) {
      bestWeight = w;
      scamType = cat;
    }
  }

  const copy = scamType
    ? EXPLANATIONS[scamType]
    : risk === 'low'
      ? EXPLANATIONS.false_positive
      : EXPLANATIONS.generic;

  return {
    risk,
    matched_phrases: matchedPhrases,
    explanation_en: copy.en,
    explanation_bm: copy.bm,
    scam_type: scamType,
  };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
