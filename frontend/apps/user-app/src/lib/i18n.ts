import { useEffect, useState } from 'react';
import { getStoredLanguage, setStoredLanguage, type UIlang } from 'shared';

type Bilingual = { en: string; bm: string };

export const STRINGS = {
  // Home
  welcomeBack: { en: 'Welcome back', bm: 'Selamat kembali' },
  safeSendOn: { en: 'SafeSend is on', bm: 'SafeSend aktif' },
  safeSendOnSub: {
    en: 'Real-time scam protection on every transfer.',
    bm: 'Perlindungan penipuan masa nyata pada setiap pemindahan.',
  },
  recentActivity: { en: 'Recent activity', bm: 'Aktiviti terkini' },
  seeAll: { en: 'See all', bm: 'Lihat semua' },
  transferLabel: { en: 'Transfer', bm: 'Pemindahan' },

  // WalletCard
  tngWallet: { en: 'TnG Wallet', bm: 'Dompet TnG' },
  availableBalance: { en: 'Available Balance', bm: 'Baki tersedia' },
  reload: { en: '+ Reload', bm: '+ Tambah nilai' },
  viewHistory: { en: 'View History', bm: 'Lihat sejarah' },

  // QuickActionGrid
  qaScan: { en: 'Scan', bm: 'Imbas' },
  qaPay: { en: 'Pay', bm: 'Bayar' },
  qaTransfer: { en: 'Transfer', bm: 'Pindah' },
  qaReload: { en: 'Reload', bm: 'Tambah nilai' },
  qaDuitNow: { en: 'DuitNow', bm: 'DuitNow' },
  qaToll: { en: 'Toll', bm: 'Tol' },
  qaParking: { en: 'Parking', bm: 'Letak kereta' },
  qaRewards: { en: 'Rewards', bm: 'Ganjaran' },

  // BottomTabBar
  tabHome: { en: 'Home', bm: 'Utama' },
  tabPay: { en: 'Pay', bm: 'Bayar' },
  tabRewards: { en: 'Rewards', bm: 'Ganjaran' },
  tabFinance: { en: 'Finance', bm: 'Kewangan' },
  tabProfile: { en: 'Profile', bm: 'Profil' },

  // Transfer
  transferTitle: { en: 'Transfer', bm: 'Pemindahan' },
  step1: { en: 'Step 1 of 3 — enter amount', bm: 'Langkah 1 / 3 — masuk jumlah' },
  step2: { en: 'Step 2 of 3 — choose payee', bm: 'Langkah 2 / 3 — pilih penerima' },
  step3: { en: 'Step 3 of 3 — review & confirm', bm: 'Langkah 3 / 3 — semak & sahkan' },
  amountMyr: { en: 'Amount (MYR)', bm: 'Jumlah (MYR)' },
  noteLabel: { en: 'Note', bm: 'Catatan' },
  notePlaceholder: {
    en: 'What is this transfer for?',
    bm: 'Pemindahan ini untuk apa?',
  },
  noteHelper: {
    en: 'SafeSend will use the next step to check who you are sending to before final confirmation.',
    bm: 'SafeSend akan periksa penerima dalam langkah seterusnya sebelum sahkan akhir.',
  },
  continueToPayee: { en: 'Continue to payee', bm: 'Teruskan ke penerima' },

  // Payee
  recipientLabel: {
    en: 'Recipient phone or account',
    bm: 'Telefon atau akaun penerima',
  },
  recipientPlaceholder: {
    en: '60123456789 or account number',
    bm: '60123456789 atau nombor akaun',
  },
  payeeLookup: { en: 'Payee lookup', bm: 'Carian penerima' },
  accountAge: { en: 'Account age', bm: 'Usia akaun' },
  days: { en: 'days', bm: 'hari' },
  payeeCheckNote: {
    en: 'SafeSend will check this payee against scam patterns when you confirm the transfer.',
    bm: 'SafeSend akan periksa penerima ini terhadap corak penipuan apabila anda sahkan pemindahan.',
  },
  reviewTransfer: { en: 'Review transfer', bm: 'Semak pemindahan' },

  // Done badges/copy
  doneBadgeSuccess: { en: 'Transfer complete', bm: 'Pemindahan selesai' },
  doneBadgeCancelled: { en: 'Transfer cancelled', bm: 'Pemindahan dibatalkan' },
  doneBadgeReported: { en: 'Reported to SafeSend', bm: 'Dilaporkan ke SafeSend' },
  doneBadgeOverridden: { en: 'Transfer sent', bm: 'Pemindahan dihantar' },
  doneTitleSuccess: { en: 'Money sent successfully', bm: 'Wang berjaya dihantar' },
  doneTitleCancelled: { en: 'Your money is safe', bm: 'Wang anda selamat' },
  doneTitleReported: { en: 'Thank you for reporting', bm: 'Terima kasih kerana melaporkan' },
  doneTitleOverridden: {
    en: 'You proceeded against our warning',
    bm: 'Anda teruskan walaupun amaran kami',
  },
  doneTitleSoftProceed: {
    en: 'You proceeded after a warning',
    bm: 'Anda teruskan selepas amaran',
  },
  doneTitleSoftCancelled: {
    en: 'You stopped after a warning',
    bm: 'Anda berhenti selepas amaran',
  },
  doneBodySuccess: {
    en: 'The recipient will receive funds in seconds via DuitNow.',
    bm: 'Penerima akan terima wang dalam beberapa saat melalui DuitNow.',
  },
  doneBodyCancelled: {
    en: 'No funds left your wallet. Good call — when in doubt, always pause.',
    bm: 'Tiada wang keluar dari dompet anda. Tindakan baik — bila ragu, sentiasa berhenti dahulu.',
  },
  doneBodyReported: {
    en: 'Our fraud team has been notified and the recipient account will be reviewed.',
    bm: 'Pasukan penipuan kami telah dimaklumkan dan akaun penerima akan disemak.',
  },
  doneBodyOverridden: {
    en: 'If anything feels wrong later, contact TnG support immediately.',
    bm: 'Jika ada yang tidak kena kemudian, hubungi sokongan TnG dengan segera.',
  },
  doneBodySoftProceed: {
    en: 'SafeSend recorded your choice. If anything feels off, contact TnG support immediately.',
    bm: 'SafeSend rekodkan pilihan anda. Jika ada yang tidak kena, hubungi sokongan TnG.',
  },
  doneBodySoftCancelled: {
    en: 'No money left your wallet, and SafeSend recorded the cancelled transfer for review.',
    bm: 'Tiada wang keluar dari dompet, dan SafeSend rekodkan pemindahan dibatalkan untuk semakan.',
  },
  doneTransaction: { en: 'Transaction', bm: 'Transaksi' },
  doneWouldHaveSent: { en: 'Would have sent', bm: 'Akan dihantar' },
  backToWallet: { en: 'Back to wallet', bm: 'Kembali ke dompet' },
  startNewTransfer: { en: 'Start a new transfer', bm: 'Mula pemindahan baru' },

  // Confirm screen common
  confirmTransfer: { en: 'Confirm transfer', bm: 'Sahkan pemindahan' },
} satisfies Record<string, Bilingual>;

export type StringKey = keyof typeof STRINGS;

export function useLang(): [UIlang, (l: UIlang) => void] {
  const [lang, setLang] = useState<UIlang>(() => getStoredLanguage());

  useEffect(() => {
    setStoredLanguage(lang);
    // Broadcast change so sibling hooks in same tab stay in sync.
    window.dispatchEvent(new CustomEvent('safesend-lang-change', { detail: lang }));
  }, [lang]);

  useEffect(() => {
    function onChange(e: Event) {
      const next = (e as CustomEvent<UIlang>).detail;
      setLang((prev) => (prev !== next ? next : prev));
    }
    window.addEventListener('safesend-lang-change', onChange);
    return () => window.removeEventListener('safesend-lang-change', onChange);
  }, []);

  return [lang, setLang];
}

export function t(key: StringKey, lang: UIlang): string {
  const entry = STRINGS[key];
  return lang === 'en' ? entry.en : entry.bm;
}
