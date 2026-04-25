/**
 * Shared Tailwind preset for SafeSend monorepo.
 * Mirrors shared/src/design-tokens.ts — DESIGN.md sections 2, 3, 5, 6.
 * Every Tailwind config in this repo MUST extend this preset.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary
        'tng-blue': '#005BAC',
        'royal-blue': '#0055D4',
        'electric-yellow': '#FFE600',

        // Backgrounds & surfaces
        'sky-blue': '#E6F0FF',
        'app-gray': '#F5F7FA',
        'dark-security-blue': '#071B33',

        // Accents & interaction
        'sunset-orange': '#FF8A00',
        'soft-blue-surface': '#EAF3FF',
        'border-gray': '#E5E7EB',
        'muted-text': '#6B7280',
        'text-primary': '#111827',

        // Status
        'success-green': '#16A34A',
        'warning-yellow': '#FFE600',
        'risk-red': '#DC2626',
        'pending-orange': '#F97316',

        // Derived
        'primary-hover': '#004B91',
        'primary-pressed': '#003F7D',
        'wallet-grad-from': '#005BAC',
        'wallet-grad-to': '#003F7D',
        'fraud-warning-bg': '#FEF2F2',
        'fraud-warning-border': '#FCA5A5',
        'safe-notice-bg': '#ECFDF5',
        'safe-notice-border': '#BBF7D0',
        'safe-notice-text': '#166534',

        // Semantic aliases
        brand: {
          DEFAULT: '#005BAC',
          deep: '#003F7D',
          royal: '#0055D4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
        ui: ['Inter', 'SF Pro Text', 'Segoe UI', 'sans-serif'],
        body: ['Inter', 'Roboto', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // DESIGN section 3 hierarchy
        'wallet-balance': ['40px', { lineHeight: '1.05', fontWeight: '700' }],
        hero: ['36px', { lineHeight: '1.1', fontWeight: '700' }],
        'page-title': ['28px', { lineHeight: '1.15', fontWeight: '700' }],
        'section-heading': ['22px', { lineHeight: '1.2', fontWeight: '700' }],
        'card-title': ['18px', { lineHeight: '1.3', fontWeight: '700' }],
        'feature-title': ['16px', { lineHeight: '1.35', fontWeight: '700' }],
        'txn-amount': ['20px', { lineHeight: '1.2', fontWeight: '700' }],
        caption: ['14px', { lineHeight: '1.45', fontWeight: '500' }],
        'small-label': ['12px', { lineHeight: '1.3', fontWeight: '600' }],
      },
      borderRadius: {
        // DESIGN section 5
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        sheet: '28px',
        pill: '999px',
      },
      boxShadow: {
        // DESIGN section 6
        card: '0 1px 3px rgba(15, 23, 42, 0.08)',
        elevated: '0 8px 24px rgba(15, 23, 42, 0.12)',
        modal: '0 16px 48px rgba(15, 23, 42, 0.18)',
        'yellow-depth': '0 4px 0 #0055D4',
      },
      spacing: {
        4.5: '18px',
      },
    },
  },
};
