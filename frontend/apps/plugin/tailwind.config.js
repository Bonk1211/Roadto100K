import preset from '../../tailwind.preset.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../shared/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // WhatsApp-ish palette for the chat mockup only.
        'wa-green': '#25D366',
        'wa-bubble-in': '#FFFFFF',
        'wa-bubble-out': '#DCF8C6',
        'wa-chat-bg': '#ECE5DD',
        'wa-header': '#075E54',
      },
    },
  },
};
