/**
 * Shared Tailwind preset for SafeSend monorepo.
 * Mirrors shared/src/design-tokens.ts — DESIGN.md sections 2, 3, 5, 6.
 * Every Tailwind config in this repo MUST extend this preset.
 *
 * Agent dashboard restyled with Airtable design language:
 * navy text on white canvas, Airtable Blue (#1b61c9) primary,
 * 12px radius CTAs, multi-layer blue-tinted shadow.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary — remapped to Airtable palette
        'tng-blue': '#254fad',
        'royal-blue': '#1b61c9',
        'electric-yellow': '#1b61c9',

        // Airtable specific
        'airtable-blue': '#1b61c9',
        'airtable-blue-deep': '#254fad',
        'airtable-navy': '#181d26',
        'airtable-border': '#e0e2e6',
        'airtable-surface': '#f8fafc',
        'airtable-soft-surface': '#eef4fc',
        'airtable-text-weak': 'rgba(4,14,32,0.69)',

        // Backgrounds & surfaces
        'sky-blue': '#eef4fc',
        'app-gray': '#f8fafc',
        'dark-security-blue': '#181d26',

        // Accents & interaction
        'sunset-orange': '#FF8A00',
        'soft-blue-surface': '#eef4fc',
        'border-gray': '#e0e2e6',
        'muted-text': 'rgba(4,14,32,0.69)',
        'text-primary': '#181d26',

        // Status — kept semantic
        'success-green': '#16A34A',
        'warning-yellow': '#F59E0B',
        'risk-red': '#DC2626',
        'pending-orange': '#F97316',

        // Derived
        'primary-hover': '#254fad',
        'primary-pressed': '#1a3f8a',
        'wallet-grad-from': '#254fad',
        'wallet-grad-to': '#1a3f8a',
        'fraud-warning-bg': '#FEF2F2',
        'fraud-warning-border': '#FCA5A5',
        'safe-notice-bg': '#ECFDF5',
        'safe-notice-border': '#BBF7D0',
        'safe-notice-text': '#166534',

        // Semantic aliases
        brand: {
          DEFAULT: '#1b61c9',
          deep: '#254fad',
          royal: '#1b61c9',
        },
      },
      fontFamily: {
        sans: ['Haas', 'Inter', '-apple-system', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Haas Groot Disp"', 'Haas', 'Inter', 'sans-serif'],
        ui: ['Haas', 'Inter', 'SF Pro Text', 'Segoe UI', 'sans-serif'],
        body: ['Haas', 'Inter', 'Roboto', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Airtable hierarchy + retained legacy keys
        'wallet-balance': ['40px', { lineHeight: '1.05', fontWeight: '700' }],
        hero: ['48px', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '0px' }],
        'page-title': ['32px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.1px' }],
        'section-heading': ['24px', { lineHeight: '1.25', fontWeight: '600', letterSpacing: '0.12px' }],
        'card-title': ['18px', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.12px' }],
        'feature-title': ['16px', { lineHeight: '1.35', fontWeight: '600', letterSpacing: '0.1px' }],
        'txn-amount': ['20px', { lineHeight: '1.2', fontWeight: '700' }],
        caption: ['14px', { lineHeight: '1.45', fontWeight: '400', letterSpacing: '0.18px' }],
        'small-label': ['12px', { lineHeight: '1.3', fontWeight: '500', letterSpacing: '0.18px' }],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        sheet: '28px',
        pill: '999px',
      },
      boxShadow: {
        // Airtable multi-layer blue-tinted shadow
        card: 'rgba(0,0,0,0.32) 0px 0px 1px, rgba(0,0,0,0.08) 0px 0px 2px, rgba(45,127,249,0.18) 0px 1px 3px',
        elevated: 'rgba(15,48,106,0.05) 0px 0px 20px, rgba(45,127,249,0.18) 0px 4px 12px',
        modal: 'rgba(15,48,106,0.08) 0px 16px 48px, rgba(45,127,249,0.22) 0px 8px 24px',
        airtable: 'rgba(0,0,0,0.32) 0px 0px 1px, rgba(0,0,0,0.08) 0px 0px 2px, rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset',
        'airtable-soft': 'rgba(15,48,106,0.05) 0px 0px 20px',
        'yellow-depth': '0 4px 0 #254fad',
      },
      spacing: {
        4.5: '18px',
      },
    },
  },
};
