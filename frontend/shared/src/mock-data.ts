import type {
  Alert,
  ContainmentAccount,
  NetworkGraph,
  Payee,
  RiskSignal,
  Transaction,
  User,
} from './types.js';

export const mockUsers: User[] = [
  {
    id: 'u_001',
    name: 'Encik Lim',
    phone: '+60123456789',
    user_avg_30d: 850,
    device_id: 'device_lim_iphone',
  },
  {
    id: 'u_002',
    name: 'Puan Aminah',
    phone: '+60198765432',
    user_avg_30d: 420,
    device_id: 'device_aminah_xiaomi',
  },
];

export const currentUser: User = mockUsers[0];

export const mockPayees: Payee[] = [
  {
    id: 'p_safe_01',
    name: 'Mak Cik Siti',
    account: '7088123456',
    phone: '+60121110000',
    account_age_days: 1240,
    flagged_in_scam_graph: false,
  },
  {
    id: 'p_safe_02',
    name: 'Restoran Nasi Kandar',
    account: '5520009988',
    account_age_days: 980,
    flagged_in_scam_graph: false,
  },
  {
    id: 'p_scam_01',
    name: 'Ahmad Rahman',
    account: '7099887766',
    phone: '+60177779999',
    account_age_days: 6,
    flagged_in_scam_graph: true,
  },
  {
    id: 'p_scam_02',
    name: 'Investment Pro Trading',
    account: '7011223344',
    account_age_days: 11,
    flagged_in_scam_graph: true,
  },
  {
    id: 'p_scam_03',
    name: 'LHDN Pengesahan',
    account: '7055443322',
    account_age_days: 3,
    flagged_in_scam_graph: true,
  },
];

/** Featured demo payee — used by user-app pre-fill. PRD section 8 Act 2. */
export const demoPayee: Payee = mockPayees[2];
export const demoAmount = 8000;

const isoNow = (offsetMin = 0): string =>
  new Date(Date.now() + offsetMin * 60_000).toISOString();

export const mockTransactions: Transaction[] = [
  // Macau scam — featured demo transaction
  {
    txn_id: 't_001',
    user_id: 'u_001',
    payee_id: 'p_scam_01',
    payee_name: 'Ahmad Rahman',
    payee_account: '7099887766',
    amount: 8000,
    timestamp: isoNow(-2),
    hour_of_day: 23,
    device_match: false,
    prior_txns_to_payee: 0,
    is_new_payee: true,
    payee_account_age_days: 6,
    user_avg_30d: 850,
    amount_ratio: 9.41,
  },
  // Investment scam
  {
    txn_id: 't_002',
    user_id: 'u_002',
    payee_id: 'p_scam_02',
    payee_name: 'Investment Pro Trading',
    payee_account: '7011223344',
    amount: 5000,
    timestamp: isoNow(-15),
    hour_of_day: 22,
    device_match: true,
    prior_txns_to_payee: 0,
    is_new_payee: true,
    payee_account_age_days: 11,
    user_avg_30d: 420,
    amount_ratio: 11.9,
  },
  // Mule account
  {
    txn_id: 't_003',
    user_id: 'u_001',
    payee_id: 'p_scam_03',
    payee_name: 'LHDN Pengesahan',
    payee_account: '7055443322',
    amount: 3200,
    timestamp: isoNow(-45),
    hour_of_day: 1,
    device_match: false,
    prior_txns_to_payee: 0,
    is_new_payee: true,
    payee_account_age_days: 3,
    user_avg_30d: 850,
    amount_ratio: 3.76,
  },
  // Borderline — should yield medium band
  {
    txn_id: 't_004',
    user_id: 'u_002',
    payee_id: 'p_safe_02',
    payee_name: 'Restoran Nasi Kandar',
    payee_account: '5520009988',
    amount: 1100,
    timestamp: isoNow(-90),
    hour_of_day: 13,
    device_match: true,
    prior_txns_to_payee: 0,
    is_new_payee: true,
    payee_account_age_days: 980,
    user_avg_30d: 420,
    amount_ratio: 2.62,
  },
  // Safe transactions
  {
    txn_id: 't_005',
    user_id: 'u_001',
    payee_id: 'p_safe_01',
    payee_name: 'Mak Cik Siti',
    payee_account: '7088123456',
    amount: 250,
    timestamp: isoNow(-200),
    hour_of_day: 11,
    device_match: true,
    prior_txns_to_payee: 14,
    is_new_payee: false,
    payee_account_age_days: 1240,
    user_avg_30d: 850,
    amount_ratio: 0.29,
  },
  {
    txn_id: 't_006',
    user_id: 'u_001',
    payee_id: 'p_safe_02',
    payee_name: 'Restoran Nasi Kandar',
    payee_account: '5520009988',
    amount: 38,
    timestamp: isoNow(-340),
    hour_of_day: 12,
    device_match: true,
    prior_txns_to_payee: 22,
    is_new_payee: false,
    payee_account_age_days: 980,
    user_avg_30d: 850,
    amount_ratio: 0.04,
  },
  // Account takeover style — late night, device mismatch, large
  {
    txn_id: 't_007',
    user_id: 'u_002',
    payee_id: 'p_scam_01',
    payee_name: 'Ahmad Rahman',
    payee_account: '7099887766',
    amount: 4500,
    timestamp: isoNow(-12),
    hour_of_day: 3,
    device_match: false,
    prior_txns_to_payee: 0,
    is_new_payee: true,
    payee_account_age_days: 6,
    user_avg_30d: 420,
    amount_ratio: 10.71,
  },
  // Another safe
  {
    txn_id: 't_008',
    user_id: 'u_002',
    payee_id: 'p_safe_01',
    payee_name: 'Mak Cik Siti',
    payee_account: '7088123456',
    amount: 80,
    timestamp: isoNow(-500),
    hour_of_day: 15,
    device_match: true,
    prior_txns_to_payee: 9,
    is_new_payee: false,
    payee_account_age_days: 1240,
    user_avg_30d: 420,
    amount_ratio: 0.19,
  },
];

export const muleContainmentAccounts: ContainmentAccount[] = [
  {
    account_id: 'p_scam_01',
    display_name: 'Ahmad Rahman',
    risk_score: 94,
    connection_type: 'direct_transaction',
    degree: 1,
    rm_exposure: 12500,
    selected: true,
  },
  {
    account_id: 'p_scam_04',
    display_name: 'Wong Trading',
    risk_score: 87,
    connection_type: 'shared_device',
    degree: 1,
    rm_exposure: 31000,
    selected: true,
  },
  {
    account_id: 'p_scam_05',
    display_name: 'Bantuan Kerajaan',
    risk_score: 82,
    connection_type: 'shared_ip',
    degree: 1,
    rm_exposure: 26400,
    selected: true,
  },
  {
    account_id: 'p_scam_02',
    display_name: 'Investment Pro Trading',
    risk_score: 76,
    connection_type: 'overlapping_timing',
    degree: 2,
    rm_exposure: 50000,
    selected: true,
  },
  {
    account_id: 'p_watch_01',
    display_name: 'Silverline Services',
    risk_score: 61,
    connection_type: 'same_card_bin',
    degree: 2,
    rm_exposure: 22100,
    selected: true,
  },
];

const senderSignals: RiskSignal[] = [
  { id: 'new_account', label: 'Payee account age < 14 days', triggered: true, weight: 25, detail: 'Account opened less than two weeks ago.' },
  { id: 'first_transfer', label: 'First-ever transfer to this payee', triggered: true, weight: 20, detail: 'Sender has no transfer history with this payee.' },
  { id: 'amount_spike', label: 'Amount > 3x user average', triggered: true, weight: 20, detail: 'Transfer is far above the sender 30-day average.' },
  { id: 'watchlist', label: 'Payee already on mule watchlist', triggered: true, weight: 30, detail: 'Payee inherited watchlist risk from Stage 1 mule detection.' },
];

const muleSignals: RiskSignal[] = [
  { id: 'unique_senders', label: 'Received from 3+ unique senders in 6 hours', triggered: true, weight: 30, detail: '4 unrelated senders sent money within the last 3 hours.' },
  { id: 'inbound_gap', label: 'Average inbound gap < 20 minutes', triggered: true, weight: 25, detail: 'Average gap is 14 minutes between inbound transfers.' },
  { id: 'pass_through', label: 'Inbound-to-outbound ratio > 80%', triggered: true, weight: 25, detail: 'Funds are being staged for pass-through movement.' },
  { id: 'young_account', label: 'Account age < 30 days', triggered: true, weight: 15, detail: 'Account opened 3 days ago.' },
  { id: 'no_merchant_spend', label: 'No merchant spend, only peer transfers', triggered: true, weight: 20, detail: 'No normal wallet usage in the last 7 days.' },
];

/** Pre-seeded alerts (for agent dashboard at first load). */
export const seedAlerts: Alert[] = [
  {
    id: 'a_mule_stage3',
    txn: mockTransactions[2],
    score: 96,
    band: 'high',
    alert_type: 'mule_eviction',
    mule_stage: 3,
    rm_at_risk: 142000,
    mule_profile: {
      account_id: 'p_scam_03',
      stage: 3,
      unique_inbound_senders_6h: 4,
      avg_inbound_gap_minutes: 14,
      inbound_outbound_ratio: 92,
      merchant_spend_7d: 0,
      withdrawal_status: 'blocked',
      escrow_amount: 142000,
    },
    containment_accounts: muleContainmentAccounts,
    signals: muleSignals,
    explanation: {
      explanation_en:
        'Stage 3 mule eviction triggered: this young account received funds from 4 unrelated senders in 3 hours, has no merchant spend, and shows a pass-through withdrawal pattern. Withdrawal is blocked, inbound funds are held in escrow, and linked accounts should be contained now.',
      explanation_bm:
        'Pengusiran mule Tahap 3 dicetuskan: akaun baharu ini menerima dana daripada 4 penghantar tidak berkaitan dalam 3 jam, tiada perbelanjaan merchant, dan menunjukkan corak pindahan keluar. Pengeluaran disekat, dana masuk ditahan dalam escrow, dan akaun berkait perlu dikawal sekarang.',
      scam_type: 'mule_account',
      confidence: 'high',
    },
    status: 'open',
    created_at: isoNow(-4),
  },
  {
    id: 'a_mule_stage2',
    txn: mockTransactions[1],
    score: 72,
    band: 'high',
    alert_type: 'mule_eviction',
    mule_stage: 2,
    rm_at_risk: 50000,
    mule_profile: {
      account_id: 'p_scam_02',
      stage: 2,
      unique_inbound_senders_6h: 3,
      avg_inbound_gap_minutes: 18,
      inbound_outbound_ratio: 84,
      merchant_spend_7d: 0,
      withdrawal_status: 'soft_blocked',
      escrow_amount: 50000,
    },
    signals: muleSignals.map((signal) => ({
      ...signal,
      triggered: signal.id !== 'young_account' || true,
    })),
    explanation: {
      explanation_en:
        'Stage 2 mule alert: the account crossed the inbound velocity threshold and withdrawal capability is soft-blocked pending analyst review.',
      explanation_bm:
        'Amaran mule Tahap 2: akaun ini melepasi ambang kelajuan dana masuk dan fungsi pengeluaran disekat sementara menunggu semakan analis.',
      scam_type: 'mule_account',
      confidence: 'high',
    },
    status: 'open',
    created_at: isoNow(-18),
  },
  {
    id: 'a_002',
    txn: mockTransactions[1],
    score: 88,
    band: 'high',
    alert_type: 'sender_interception',
    rm_at_risk: mockTransactions[1].amount,
    signals: senderSignals,
    explanation: {
      explanation_en:
        'This transfer pattern matches a known investment scam: a brand-new payee promising guaranteed returns, large amount versus your usual spending.',
      explanation_bm:
        'Corak transaksi ini sepadan dengan penipuan pelaburan: penerima baharu yang menjanjikan pulangan terjamin dan jumlahnya jauh lebih besar daripada perbelanjaan biasa anda.',
      scam_type: 'investment_scam',
      confidence: 'high',
    },
    status: 'open',
    created_at: isoNow(-15),
  },
  {
    id: 'a_003',
    txn: mockTransactions[2],
    score: 81,
    band: 'high',
    alert_type: 'mule_eviction',
    mule_stage: 1,
    rm_at_risk: 3200,
    signals: muleSignals.slice(0, 2),
    explanation: {
      explanation_en:
        'The payee impersonates LHDN and the account was created 3 days ago. Government agencies never request transfers to personal e-wallet accounts.',
      explanation_bm:
        'Penerima menyamar sebagai LHDN dan akaun ini hanya didaftarkan 3 hari lepas. Agensi kerajaan tidak pernah meminta pemindahan ke akaun e-dompet peribadi.',
      scam_type: 'mule_account',
      confidence: 'high',
    },
    status: 'open',
    created_at: isoNow(-45),
  },
  {
    id: 'a_004',
    txn: mockTransactions[3],
    score: 52,
    band: 'medium',
    alert_type: 'sender_interception',
    rm_at_risk: mockTransactions[3].amount,
    signals: senderSignals.map((signal) => ({
      ...signal,
      triggered: signal.id === 'first_transfer',
    })),
    explanation: {
      explanation_en:
        'Amount is over 2x the user average and this is the first transfer to this payee. Otherwise the payee is well-established.',
      explanation_bm:
        'Jumlah melebihi 2 kali purata pengguna dan ini adalah pemindahan pertama kepada penerima ini. Walau bagaimanapun, akaun penerima sudah lama wujud.',
      scam_type: 'false_positive',
      confidence: 'medium',
    },
    status: 'open',
    created_at: isoNow(-90),
  },
  {
    id: 'a_007',
    txn: mockTransactions[6],
    score: 94,
    band: 'high',
    alert_type: 'sender_interception',
    rm_at_risk: mockTransactions[6].amount,
    signals: senderSignals,
    explanation: {
      explanation_en:
        'Late-night transfer from an unfamiliar device to a payee already in our scam network. Strong indicators of account takeover or mule routing.',
      explanation_bm:
        'Pemindahan lewat malam daripada peranti yang tidak dikenali ke akaun yang sudah ada dalam rangkaian penipu kami. Petunjuk kuat akaun dirampas atau saluran akaun mule.',
      scam_type: 'account_takeover',
      confidence: 'high',
    },
    status: 'open',
    created_at: isoNow(-12),
  },
];

export const mockNetworkGraph: NetworkGraph = {
  nodes: [
    { id: 'p_scam_01', type: 'account', label: 'Ahmad Rahman', flagged: true, metadata: { account: '7099887766', age_days: 6, risk_score: 94, rm_exposure: 12500, connection: 'Direct transaction' } },
    { id: 'p_scam_02', type: 'account', label: 'Investment Pro', flagged: true, metadata: { account: '7011223344', age_days: 11, risk_score: 76, rm_exposure: 50000, connection: 'Overlapping timing' } },
    { id: 'p_scam_03', type: 'account', label: 'LHDN Pengesahan', flagged: true, metadata: { account: '7055443322', age_days: 3, risk_score: 96, rm_exposure: 142000, stage: 3 } },
    { id: 'p_scam_04', type: 'account', label: 'Wong Trading', flagged: true, metadata: { account: '7077665544', age_days: 9, risk_score: 87, rm_exposure: 31000, connection: 'Shared device' } },
    { id: 'p_scam_05', type: 'account', label: 'Bantuan Kerajaan', flagged: true, metadata: { account: '7022334455', age_days: 4, risk_score: 82, rm_exposure: 26400, connection: 'Shared IP' } },
    { id: 'p_watch_01', type: 'account', label: 'Silverline Services', flagged: true, metadata: { account: '7066554433', age_days: 18, risk_score: 61, rm_exposure: 22100, connection: 'Same card BIN' } },
    { id: 'p_safe_01', type: 'account', label: 'Mak Cik Siti', flagged: false, metadata: { account: '7088123456', age_days: 1240 } },
    { id: 'p_safe_02', type: 'account', label: 'Restoran Nasi Kandar', flagged: false, metadata: { account: '5520009988', age_days: 980 } },
    { id: 'd_mule_01', type: 'device', label: 'Device A4F2', flagged: true, metadata: { fingerprint: 'A4F2-91XX' } },
    { id: 'd_mule_02', type: 'device', label: 'Device 7C81', flagged: true, metadata: { fingerprint: '7C81-44YY' } },
    { id: 'u_001', type: 'account', label: 'Encik Lim (victim)', flagged: false, metadata: { account: 'u_001' } },
    { id: 'u_002', type: 'account', label: 'Puan Aminah (victim)', flagged: false, metadata: { account: 'u_002' } },
  ],
  edges: [
    { source: 'p_scam_01', target: 'd_mule_01', type: 'shared_device' },
    { source: 'p_scam_03', target: 'd_mule_01', type: 'shared_device' },
    { source: 'p_scam_04', target: 'd_mule_01', type: 'shared_device' },
    { source: 'p_scam_02', target: 'd_mule_02', type: 'shared_device' },
    { source: 'p_scam_05', target: 'd_mule_02', type: 'shared_device' },
    { source: 'p_scam_03', target: 'p_scam_05', type: 'shared_ip' },
    { source: 'p_scam_03', target: 'p_scam_02', type: 'overlapping_timing' },
    { source: 'p_scam_03', target: 'p_watch_01', type: 'same_card_bin' },
    { source: 'u_001', target: 'p_scam_01', type: 'transaction', weight: 8000 },
    { source: 'u_001', target: 'p_scam_03', type: 'transaction', weight: 3200 },
    { source: 'u_002', target: 'p_scam_02', type: 'transaction', weight: 5000 },
    { source: 'u_002', target: 'p_scam_01', type: 'transaction', weight: 4500 },
    { source: 'u_001', target: 'p_safe_01', type: 'transaction', weight: 250 },
  ],
};

/** Pre-canned scam messages used by the plugin demo. PRD section 8 Act 1. */
export const sampleScamMessages = [
  {
    id: 'msg_lhdn',
    label: 'LHDN account freeze',
    body:
      'Akaun LHDN anda akan dibekukan kerana cukai tertunggak. Sila pindahkan RM8,000 ke akaun selamat 7055443322 dengan segera atau hubungi pegawai.',
  },
  {
    id: 'msg_prize',
    label: 'Prize / hadiah scam',
    body:
      'Tahniah! Anda menang hadiah RM50,000 dari TnG Loyalty. Berikan OTP yang dihantar untuk tuntut hadiah anda segera sebelum tamat tempoh.',
  },
  {
    id: 'msg_invest',
    label: 'Investment scam',
    body:
      'Guaranteed 30% return monthly. Transfer your investment to our trading account today, limited slots only. Pindahkan wang anda sekarang!',
  },
];
