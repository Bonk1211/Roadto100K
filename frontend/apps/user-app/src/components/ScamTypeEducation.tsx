import { useState } from 'react';
import type { ScamType, UIlang } from 'shared';

interface Props {
  scamType: ScamType;
  lang: UIlang;
}

interface Entry {
  emoji: string;
  title: { en: string; bm: string };
  what: { en: string; bm: string };
  redFlags: { en: string[]; bm: string[] };
}

const LIBRARY: Record<ScamType, Entry> = {
  macau_scam: {
    emoji: '☎️',
    title: { en: 'What is a Macau scam?', bm: 'Apakah penipuan Macau?' },
    what: {
      en: 'Scammers pretend to be police, court officers, or LHDN. They say you owe money or are under investigation, then push you to transfer "to clear your name".',
      bm: 'Penipu menyamar sebagai polis, pegawai mahkamah atau LHDN. Mereka kata anda berhutang atau disiasat, kemudian desak anda hantar wang "untuk bersihkan nama".',
    },
    redFlags: {
      en: [
        'Caller threatens arrest within hours',
        'Asked to transfer to a personal e-wallet',
        'Told to keep it secret from family',
      ],
      bm: [
        'Pemanggil ugut tangkap dalam beberapa jam',
        'Disuruh hantar ke e-dompet peribadi',
        'Disuruh rahsia daripada keluarga',
      ],
    },
  },
  investment_scam: {
    emoji: '📈',
    title: { en: 'What is an investment scam?', bm: 'Apakah penipuan pelaburan?' },
    what: {
      en: 'Promises of guaranteed high returns, often via WhatsApp groups or Telegram. Real licensed investments never guarantee returns or use personal e-wallets.',
      bm: 'Janji pulangan tinggi yang dijamin, biasanya melalui kumpulan WhatsApp atau Telegram. Pelaburan berlesen tidak pernah jamin pulangan atau guna e-dompet peribadi.',
    },
    redFlags: {
      en: [
        '"Guaranteed" returns over 10% per month',
        'Pressure to invest more before you can withdraw',
        'Receiver is a personal account, not a company',
      ],
      bm: [
        'Pulangan "dijamin" lebih 10% sebulan',
        'Didesak melabur lagi sebelum boleh keluarkan',
        'Penerima adalah akaun peribadi, bukan syarikat',
      ],
    },
  },
  love_scam: {
    emoji: '💔',
    title: { en: 'What is a love scam?', bm: 'Apakah penipuan cinta?' },
    what: {
      en: 'An online "partner" you have never met asks for money — for medical bills, travel, or to unlock a parcel stuck at customs. The story keeps escalating.',
      bm: 'Pasangan dalam talian yang anda tidak pernah jumpa minta wang — untuk bil perubatan, perjalanan, atau melepaskan bungkusan tersekat di kastam.',
    },
    redFlags: {
      en: [
        'Never met in person despite long chats',
        'Refuses video calls',
        'Story always needs more money to "fix"',
      ],
      bm: [
        'Tidak pernah jumpa walaupun lama berbual',
        'Enggan panggilan video',
        'Cerita sentiasa perlu wang lagi untuk "selesai"',
      ],
    },
  },
  account_takeover: {
    emoji: '🔓',
    title: { en: 'What is account takeover?', bm: 'Apakah akaun dirampas?' },
    what: {
      en: 'Someone may be using your account from a device or location we have not seen before. They might have your password, OTP, or SIM-swapped your phone number.',
      bm: 'Seseorang mungkin guna akaun anda dari peranti atau lokasi yang kami tidak pernah lihat. Mungkin mereka ada kata laluan, OTP, atau telah SIM-swap nombor anda.',
    },
    redFlags: {
      en: [
        'Login from a new device or unfamiliar city',
        'Transfer happens at unusual hours',
        'You did not request an OTP',
      ],
      bm: [
        'Log masuk dari peranti baru atau bandar asing',
        'Pemindahan berlaku pada waktu pelik',
        'Anda tidak minta OTP',
      ],
    },
  },
  mule_account: {
    emoji: '🐴',
    title: { en: 'What is a mule account?', bm: 'Apakah akaun mule?' },
    what: {
      en: 'The receiving account looks new and is linked to other accounts already flagged for fraud. Scammers route stolen money through these "mule" wallets to hide the trail.',
      bm: 'Akaun penerima kelihatan baru dan dikaitkan dengan akaun lain yang ditandakan untuk penipuan. Penipu salurkan wang curi melalui dompet "mule" ini untuk menyorok jejak.',
    },
    redFlags: {
      en: [
        'Receiver account is days or weeks old',
        'Linked to other flagged accounts',
        'Quick in, quick out — no real spending',
      ],
      bm: [
        'Akaun penerima berusia beberapa hari atau minggu',
        'Dikaitkan dengan akaun lain yang ditandakan',
        'Cepat masuk, cepat keluar — tiada perbelanjaan sebenar',
      ],
    },
  },
  false_positive: {
    emoji: '🤔',
    title: { en: 'Could be a false alarm', bm: 'Mungkin amaran palsu' },
    what: {
      en: 'A few signals were unusual but the picture is mixed. Take a moment to confirm with the recipient before deciding.',
      bm: 'Beberapa petunjuk luar biasa tetapi gambaran tidak jelas. Luangkan masa untuk sahkan dengan penerima sebelum membuat keputusan.',
    },
    redFlags: {
      en: ['Verify by calling, not texting', 'Unusual hour or amount only'],
      bm: ['Sahkan dengan menelefon, bukan menaip', 'Waktu atau jumlah yang luar biasa sahaja'],
    },
  },
};

export default function ScamTypeEducation({ scamType, lang }: Props) {
  const [open, setOpen] = useState(false);
  const entry = LIBRARY[scamType] ?? LIBRARY.false_positive;

  return (
    <div className="rounded-xl bg-white border border-border-gray overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 active:bg-app-gray"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 text-left">
          <span className="text-[22px]" aria-hidden>
            {entry.emoji}
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-text">
              {lang === 'en' ? 'Learn more' : 'Belajar lagi'}
            </p>
            <p className="text-[14px] font-bold text-text-primary leading-tight">
              {lang === 'en' ? entry.title.en : entry.title.bm}
            </p>
          </div>
        </div>
        <span
          className="text-tng-blue text-[14px] font-bold transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[13.5px] text-text-primary leading-relaxed">
            {lang === 'en' ? entry.what.en : entry.what.bm}
          </p>

          <div className="rounded-md bg-fraud-warning-bg border border-fraud-warning-border p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-risk-red mb-1.5">
              {lang === 'en' ? 'Red flags' : 'Tanda amaran'}
            </p>
            <ul className="space-y-1">
              {(lang === 'en' ? entry.redFlags.en : entry.redFlags.bm).map((flag) => (
                <li key={flag} className="flex items-start gap-2 text-[12.5px] text-text-primary">
                  <span className="text-risk-red leading-none mt-0.5">▸</span>
                  <span className="leading-snug">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
