import type { AnalyseMessageResponse, MatchedPattern, ScamType } from 'shared';

interface Pattern {
  phrase: string;
  weight: number;
  category: ScamType | 'generic';
  responseCategory: MatchedPattern['category'];
}

const PATTERNS: Pattern[] = [
  {
    phrase: 'akaun anda dibekukan',
    weight: 3,
    category: 'mule_account',
    responseCategory: 'urgency',
  },
  {
    phrase: 'akaun dibekukan',
    weight: 3,
    category: 'mule_account',
    responseCategory: 'urgency',
  },
  {
    phrase: 'lhdn',
    weight: 3,
    category: 'mule_account',
    responseCategory: 'government_impersonation',
  },
  {
    phrase: 'pdrm',
    weight: 3,
    category: 'mule_account',
    responseCategory: 'government_impersonation',
  },
  {
    phrase: 'polis',
    weight: 2,
    category: 'mule_account',
    responseCategory: 'government_impersonation',
  },
  {
    phrase: 'pindahkan',
    weight: 2,
    category: 'macau_scam',
    responseCategory: 'transfer_instruction',
  },
  {
    phrase: 'akaun selamat',
    weight: 3,
    category: 'macau_scam',
    responseCategory: 'transfer_instruction',
  },
  {
    phrase: 'pindahkan wang ke akaun selamat',
    weight: 4,
    category: 'macau_scam',
    responseCategory: 'transfer_instruction',
  },
  {
    phrase: 'otp',
    weight: 3,
    category: 'account_takeover',
    responseCategory: 'otp_request',
  },
  {
    phrase: 'kata laluan',
    weight: 2,
    category: 'account_takeover',
    responseCategory: 'otp_request',
  },
  {
    phrase: 'hadiah',
    weight: 2,
    category: 'mule_account',
    responseCategory: 'generic',
  },
  {
    phrase: 'tahniah',
    weight: 1,
    category: 'mule_account',
    responseCategory: 'generic',
  },
  {
    phrase: 'menang',
    weight: 1,
    category: 'mule_account',
    responseCategory: 'generic',
  },
  {
    phrase: 'segera',
    weight: 1,
    category: 'generic',
    responseCategory: 'urgency',
  },
  {
    phrase: 'investment',
    weight: 2,
    category: 'investment_scam',
    responseCategory: 'investment_pitch',
  },
  {
    phrase: 'pelaburan',
    weight: 2,
    category: 'investment_scam',
    responseCategory: 'investment_pitch',
  },
  {
    phrase: 'guaranteed return',
    weight: 4,
    category: 'investment_scam',
    responseCategory: 'investment_pitch',
  },
  {
    phrase: 'pulangan terjamin',
    weight: 4,
    category: 'investment_scam',
    responseCategory: 'investment_pitch',
  },
  {
    phrase: 'limited slot',
    weight: 2,
    category: 'investment_scam',
    responseCategory: 'investment_pitch',
  },
  {
    phrase: 'tng loyalty',
    weight: 2,
    category: 'mule_account',
    responseCategory: 'government_impersonation',
  },
  {
    phrase: 'cukai tertunggak',
    weight: 3,
    category: 'mule_account',
    responseCategory: 'government_impersonation',
  },
];

const EXPLANATIONS: Record<ScamType | 'generic', { en: string; bm: string }> = {
  macau_scam: {
    en: 'This message uses classic Macau-scam language - false urgency about your account and a request to move money to a "safe" account. Do not transfer.',
    bm: 'Mesej ini menggunakan bahasa penipuan Macau klasik - desakan palsu tentang akaun anda dan arahan memindah wang ke akaun "selamat". Jangan pindahkan wang.',
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
    en: 'This message asks for your OTP or password. Never share these - they let scammers take over your account.',
    bm: 'Mesej ini meminta OTP atau kata laluan anda. Jangan kongsi - ia membolehkan penipu mengambil alih akaun anda.',
  },
  love_scam: {
    en: 'Be cautious - this message has hallmarks of a love-scam request for emergency money. Verify the person in real life first.',
    bm: 'Berhati-hati - mesej ini mempunyai ciri penipuan cinta yang meminta wang kecemasan. Sahkan orang itu secara nyata dahulu.',
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

export function scanMessage(text: string): AnalyseMessageResponse {
  if (!text || !text.trim()) {
    return {
      request_id: crypto.randomUUID(),
      is_scam: false,
      risk_level: 'low',
      confidence: 0,
      matched_patterns: [],
      warning_en: 'Empty message - nothing to analyse.',
      warning_bm: 'Mesej kosong - tiada apa untuk dianalisis.',
      scam_type_hint: null,
      education_url: 'https://bnmlink.bnm.gov.my/scam-check',
      processed_at: new Date().toISOString(),
    };
  }

  const lower = text.toLowerCase();
  const matched: Pattern[] = [];
  for (const pattern of PATTERNS) {
    if (lower.includes(pattern.phrase)) matched.push(pattern);
  }

  const totalWeight = matched.reduce((sum, pattern) => sum + pattern.weight, 0);
  let risk: 'low' | 'medium' | 'high' = 'low';
  if (totalWeight >= 6) risk = 'high';
  else if (totalWeight >= 3) risk = 'medium';

  const categoryWeights = new Map<ScamType, number>();
  for (const pattern of matched) {
    if (pattern.category === 'generic') continue;
    categoryWeights.set(
      pattern.category,
      (categoryWeights.get(pattern.category) ?? 0) + pattern.weight,
    );
  }

  let scamType: ScamType | null = null;
  let bestWeight = 0;
  for (const [category, weight] of categoryWeights) {
    if (weight > bestWeight) {
      bestWeight = weight;
      scamType = category;
    }
  }

  const copy = scamType
    ? EXPLANATIONS[scamType]
    : risk === 'low'
      ? EXPLANATIONS.false_positive
      : EXPLANATIONS.generic;

  const matchedPatterns = dedupePatterns(
    matched.map((pattern) => ({
      pattern: pattern.phrase,
      category: pattern.responseCategory,
    })),
  );

  const moneyMatch = text.match(/(rm\s?[\d,.]+|[\d,.]+\s?ringgit)/i);
  if (moneyMatch) {
    matchedPatterns.push({
      pattern: moneyMatch[0],
      category: 'monetary_amount',
    });
  }

  return {
    request_id: crypto.randomUUID(),
    is_scam: risk !== 'low',
    risk_level: risk,
    confidence: Math.min(0.98, Math.max(0.1, totalWeight / 10)),
    matched_patterns: dedupePatterns(matchedPatterns),
    warning_en: copy.en,
    warning_bm: copy.bm,
    scam_type_hint: scamType,
    education_url: 'https://bnmlink.bnm.gov.my/scam-check',
    processed_at: new Date().toISOString(),
  };
}

function dedupePatterns(patterns: MatchedPattern[]): MatchedPattern[] {
  const seen = new Set<string>();
  return patterns.filter((pattern) => {
    const key = `${pattern.pattern}|${pattern.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
