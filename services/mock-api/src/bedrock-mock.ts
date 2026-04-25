import type { BedrockExplanation, ConfidenceLevel, RiskSignal, ScamType } from 'shared';
import type { ScoreInput } from './rule-engine.js';

interface CannedExplanation {
  explanation_en: string;
  explanation_bm: string;
  scam_type: ScamType;
  confidence: ConfidenceLevel;
}

const CANNED: Record<ScamType, CannedExplanation> = {
  macau_scam: {
    explanation_en:
      'This transfer matches a Macau scam pattern: a freshly created payee, a large amount versus your usual spending, and contact during off-hours. Pause and verify before sending.',
    explanation_bm:
      'Pemindahan ini sepadan dengan corak penipuan Macau: penerima yang baru didaftarkan, jumlah jauh lebih besar daripada perbelanjaan biasa anda, dan dilakukan di luar waktu biasa. Berhenti seketika dan sahkan sebelum hantar.',
    scam_type: 'macau_scam',
    confidence: 'high',
  },
  investment_scam: {
    explanation_en:
      'The payee promises guaranteed returns and the account is brand new. Real licensed investments never use personal e-wallet accounts or guarantee profits.',
    explanation_bm:
      'Penerima menjanjikan pulangan terjamin dan akaun ini baru sahaja didaftarkan. Pelaburan yang sah tidak pernah menggunakan akaun e-dompet peribadi atau menjamin keuntungan.',
    scam_type: 'investment_scam',
    confidence: 'high',
  },
  mule_account: {
    explanation_en:
      'This payee is linked to other accounts already flagged as scam mules and the account itself was opened only days ago. Sending money here likely funds a scam ring.',
    explanation_bm:
      'Penerima ini berkait dengan akaun lain yang telah dikesan sebagai akaun mule penipu, dan akaun ini sendiri baru sahaja dibuka beberapa hari lepas. Memindahkan wang di sini berkemungkinan besar membiayai sindiket penipuan.',
    scam_type: 'mule_account',
    confidence: 'high',
  },
  account_takeover: {
    explanation_en:
      'This payment was started from an unfamiliar device late at night and is going to a payee already in our scam network. This pattern usually means the account has been taken over.',
    explanation_bm:
      'Pembayaran ini dimulakan daripada peranti yang tidak dikenali pada waktu lewat malam dan dihantar kepada penerima yang sudah ada dalam rangkaian penipu kami. Corak ini biasanya bermaksud akaun telah dirampas.',
    scam_type: 'account_takeover',
    confidence: 'high',
  },
  love_scam: {
    explanation_en:
      'The payee is brand new and the amount is unusually large for you. Love scammers often build trust online before asking for emergency money transfers.',
    explanation_bm:
      'Penerima ini baru dan jumlahnya luar biasa besar bagi anda. Penipu cinta selalu membina kepercayaan dalam talian sebelum meminta pemindahan wang kecemasan.',
    scam_type: 'love_scam',
    confidence: 'medium',
  },
  false_positive: {
    explanation_en:
      'A few signals were unusual, but the payee account is well-established and the pattern fits ordinary spending. Likely not a scam.',
    explanation_bm:
      'Beberapa petunjuk kelihatan luar biasa, tetapi akaun penerima sudah lama wujud dan corak ini sepadan dengan perbelanjaan biasa. Berkemungkinan bukan penipuan.',
    scam_type: 'false_positive',
    confidence: 'low',
  },
};

/**
 * Pretend to call Bedrock. Picks a canned bilingual explanation keyed by the
 * dominant scam type that the rule engine surfaced.
 */
export function explainScam(
  input: ScoreInput,
  signals: RiskSignal[],
  score: number,
): BedrockExplanation {
  const scamType = inferScamType(input, signals, score);
  return { ...CANNED[scamType] };
}

function inferScamType(
  input: ScoreInput,
  signals: RiskSignal[],
  score: number,
): ScamType {
  const triggered = new Set(signals.filter((s) => s.triggered).map((s) => s.id));

  if (score < 30) return 'false_positive';

  // 1. Macau scam — Ahmad signature: brand-new account + late night + amount spike (all three).
  if (
    triggered.has('new_account') &&
    triggered.has('late_night') &&
    triggered.has('amount_spike')
  ) {
    return 'macau_scam';
  }

  // 2. Mule account — LHDN signature: scam graph hit, NOT late night.
  if (triggered.has('scam_graph') && !triggered.has('late_night')) {
    return 'mule_account';
  }

  // 3. Account takeover — unfamiliar device + payee already known to user.
  if (!input.device_match && input.prior_txns_to_payee > 0) {
    return 'account_takeover';
  }

  // 4. Investment scam — large amount + first transfer to new payee, business hours.
  if (
    triggered.has('large_amount') &&
    triggered.has('first_transfer') &&
    !triggered.has('late_night')
  ) {
    return 'investment_scam';
  }

  // Catch-all for anything still flagged
  return 'macau_scam';
}
