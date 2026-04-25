/**
 * SafeSend design tokens — sourced from docs/DESIGN.md sections 2, 3, 5, 6.
 * These hex codes are LAW. Do not edit without re-reading the design doc.
 */

export const colors = {
  // Primary
  tngBlue: "#005BAC",
  royalBlue: "#0055D4",
  electricYellow: "#FFE600",

  // Background & Surfaces
  skyBlue: "#E6F0FF",
  white: "#FFFFFF",
  appGray: "#F5F7FA",
  darkSecurityBlue: "#071B33",

  // Accent & Interaction
  sunsetOrange: "#FF8A00",
  softBlueSurface: "#EAF3FF",
  borderGray: "#E5E7EB",
  mutedTextGray: "#6B7280",

  // Status
  successGreen: "#16A34A",
  warningYellow: "#FFE600",
  riskRed: "#DC2626",
  pendingOrange: "#F97316",

  // Derived (from DESIGN component specs)
  primaryHover: "#004B91",
  primaryPressed: "#003F7D",
  walletGradientFrom: "#005BAC",
  walletGradientTo: "#003F7D",
  fraudWarningBg: "#FEF2F2",
  fraudWarningBorder: "#FCA5A5",
  safeNoticeBg: "#ECFDF5",
  safeNoticeBorder: "#BBF7D0",
  safeNoticeText: "#166534",
  textPrimary: "#111827",
} as const;

export type ColorToken = keyof typeof colors;

/** Spacing scale — base 4px, per DESIGN section 5. */
export const spacing = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
} as const;

/** Border radius scale — DESIGN section 5. */
export const radius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  sheet: "28px",
  pill: "999px",
} as const;

/** Typography scale — DESIGN section 3. */
export const typography = {
  fontFamily: {
    display: ['Inter', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
    ui: ['Inter', 'SF Pro Text', 'Segoe UI', 'sans-serif'],
    body: ['Inter', 'Roboto', 'Arial', 'sans-serif'],
    mono: ['Inter', 'SF Mono', 'monospace'],
  },
  scale: {
    walletBalance: { size: '40px', weight: 700, lineHeight: 1.05 },
    hero: { size: '36px', weight: 700, lineHeight: 1.1 },
    pageTitle: { size: '28px', weight: 700, lineHeight: 1.15 },
    sectionHeading: { size: '22px', weight: 700, lineHeight: 1.2 },
    cardTitle: { size: '18px', weight: 700, lineHeight: 1.3 },
    featureTitle: { size: '16px', weight: 700, lineHeight: 1.35 },
    body: { size: '16px', weight: 400, lineHeight: 1.5 },
    bodySemibold: { size: '16px', weight: 600, lineHeight: 1.4 },
    txnAmount: { size: '20px', weight: 700, lineHeight: 1.2 },
    button: { size: '16px', weight: 700, lineHeight: 1.2 },
    caption: { size: '14px', weight: 500, lineHeight: 1.45 },
    smallLabel: { size: '12px', weight: 600, lineHeight: 1.3 },
  },
} as const;

/** Shadow tokens — DESIGN section 6. */
export const shadows = {
  card: '0 1px 3px rgba(15, 23, 42, 0.08)',
  elevated: '0 8px 24px rgba(15, 23, 42, 0.12)',
  modal: '0 16px 48px rgba(15, 23, 42, 0.18)',
  yellowDepth: '0 4px 0 #0055D4',
} as const;

/** Risk score thresholds — PRD Flow B. */
export const riskThresholds = {
  low: 40,
  medium: 70,
} as const;
