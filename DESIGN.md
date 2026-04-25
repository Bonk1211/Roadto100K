# Design System Inspired by TNG Digital eWallet

## 1. Visual Theme & Atmosphere

TNG Digital eWallet’s design language should feel **fast, local, trustworthy, and everyday-use friendly**. Unlike luxury fintech products that feel distant or premium-first, this system should communicate that the wallet is built for daily Malaysian money movement: QR payments, tolls, parking, transfers, reloads, rewards, and scam-safe transactions.

The visual identity is anchored around a **high-trust blue wallet surface**, supported by **white cards**, **soft gray app backgrounds**, and small accents of **green for success**, **red for risk**, and **yellow for alerts/rewards**. The product should feel secure without feeling intimidating.

The design should use rounded mobile-first surfaces, compact information hierarchy, familiar e-wallet patterns, and clear transaction states. Components should be optimized for fast scanning because users often interact with the app in high-pressure moments: paying at merchants, entering toll-related flows, topping up, confirming transfers, or reviewing scam warnings.

**Key Characteristics:**
- TNG Blue as the main brand and trust color
- White card-based interface over soft gray app background
- Rounded QR/payment cards for mobile-first usage
- Clear financial hierarchy: balance first, actions second, promotions third
- Strong status color system for success, pending, warning, and blocked transactions
- Friendly but serious fraud-warning surfaces
- Large primary CTAs designed for one-thumb mobile usage
- Local Malaysian context: DuitNow QR, tolls, reloads, merchants, rewards, and scam protection

---

## 2. Color Palette & Roles

This design system uses a **unified palette combining trust (fintech) and energy (innovation)**. The goal is to balance **security + clarity (TNG)** with **attention + speed (FINHACK)** into a single cohesive system.

### Primary Colors

- **TNG Blue** (`#005BAC`): Core brand color, primary actions, navigation
- **Royal Blue** (`#0055D4`): Depth, outlines, strong contrast elements, panels
- **Electric Yellow** (`#FFE600`): High-attention highlight, key CTAs, focus elements

### Background & Surfaces

- **Sky Blue** (`#E6F0FF`): Main background for a light, modern, digital feel
- **Pure White** (`#FFFFFF`): Cards, modals, clean content containers
- **App Gray** (`#F5F7FA`): Secondary background for layering
- **Dark Security Blue** (`#071B33`): Security-focused sections and high-trust modules

### Accent & Interaction

- **Sunset Orange** (`#FF8A00`): Motion, urgency, micro-interactions, highlights
- **Soft Blue Surface** (`#EAF3FF`): Informational cards, safe states
- **Border Gray** (`#E5E7EB`): Dividers and outlines
- **Muted Text Gray** (`#6B7280`): Secondary text

### Status Colors

- **Success Green** (`#16A34A`): Completed and safe actions
- **Warning Yellow** (`#FFE600`): Attention required, review actions
- **Risk Red** (`#DC2626`): Fraud, blocked, or dangerous actions
- **Pending Orange** (`#F97316`): Processing or temporary state

---

### Unified Color Logic

- **Blue = Trust & Structure** (core UI, navigation, wallet)
- **Yellow = Attention & Focus** (key CTAs, highlights, important info)
- **Orange = Motion & Urgency** (interactions, transitions, dynamic elements)
- **Red = Risk** (fraud, errors, blocking)
- **Green = Safety** (success, verified)

---

### Visual Application Strategy

- Use **Sky Blue** as the default background to keep the interface light
- Use **TNG Blue / Royal Blue** for structure, hierarchy, and trust
- Use **Electric Yellow sparingly** for maximum visual impact
- Always pair **Electric Yellow with Royal Blue** for readability
- Use **Sunset Orange for motion and energy**, not primary actions
- Keep financial and transaction UI grounded in blue/white for trust

---

### Execution Guidelines

#### Isometric Elements
- Frame: Royal Blue (`#0055D4`)
- Surfaces: Sky Blue (`#E6F0FF`)
- Highlights: Electric Yellow (`#FFE600`) or Sunset Orange (`#FF8A00`)

#### Typography Highlights
- Headlines can use **Electric Yellow with Royal Blue outline** for emphasis
- Important numbers or actions may use yellow accents

#### Motion & Speed Lines
- Colors: White (`#FFFFFF`) + Sunset Orange (`#FF8A00`)
- Purpose: Create sense of speed and innovation

#### Icons & Mascots
- Outline: Royal Blue
- Fill accents: Electric Yellow

---

## 3. Typography Rules
 Typography Rules

### Font Families
Use accessible system fonts unless an official brand font is provided.

- **Display / Hero**: `Inter`, `SF Pro Display`, `Segoe UI`, sans-serif
- **UI / Navigation**: `Inter`, `SF Pro Text`, `Segoe UI`, sans-serif
- **Body**: `Inter`, `Roboto`, `Arial`, sans-serif
- **Numbers / Amounts**: `Inter`, `SF Mono` optional for fixed financial alignment

### Hierarchy

| Role | Font | Size | Weight | Line Height | Notes |
|------|------|------|--------|-------------|-------|
| Wallet Balance | Inter | 40px | 700 | 1.05 | Main balance display |
| Hero Heading | Inter | 36px | 700 | 1.10 | Landing / campaign pages |
| Page Title | Inter | 28px | 700 | 1.15 | App screen heading |
| Section Heading | Inter | 22px | 700 | 1.20 | Feature sections |
| Card Title | Inter | 18px | 700 | 1.30 | Payment cards, wallet modules |
| Feature Title | Inter | 16px | 700 | 1.35 | Shortcut labels, security items |
| Body | Inter | 16px | 400 | 1.50 | Standard reading |
| Body Semibold | Inter | 16px | 600 | 1.40 | Important labels |
| Transaction Amount | Inter | 16–24px | 700 | 1.20 | Amounts in history/details |
| Button | Inter | 16px | 700 | 1.20 | Primary actions |
| Caption | Inter | 14px | 500 | 1.45 | Metadata, timestamps |
| Small Label | Inter | 12px | 600 | 1.30 | Tags, badges, helper labels |

### Typography Behavior
- Use bold amounts for financial confidence
- Avoid long all-caps labels except short badges like `SAFE`, `RISK`, `PENDING`
- Use sentence case for most UI copy
- Keep transaction explanations short and direct
- For fraud warnings, use plain language instead of technical ML terminology

---

## 4. Component Stylings

### Buttons

#### Primary Button (Standard Product)
- Background: `#005BAC`
- Text: `#FFFFFF`
- Radius: 16px
- Height: 52px mobile / 48px desktop
- Font: 16px, 700
- Hover: `#004B91`
- Pressed: `#003F7D`

#### Primary Button (FINHACK Highlight)
- Background: `#FFE600` (Electric Yellow)
- Text: `#0055D4` (Royal Blue)
- Radius: 16px
- Font: 16px, 700
- Shadow: `0 4px 0 #0055D4` (for depth)
- Usage: ONLY for hero CTAs, hackathon actions, or key conversion moments

**Design Rule:**
Electric Yellow buttons must always have strong contrast (blue text or outline). Never place yellow text on white.

#### Secondary Button
- Background: `#EAF3FF`
- Text: `#005BAC`
- Radius: 16px

#### Danger Button
- Background: `#DC2626`
- Text: `#FFFFFF`
- Radius: 16px

#### Ghost Button
- Background: transparent
- Text: `#005BAC`

---

### Wallet Balance Card
- Background: linear gradient from `#005BAC` to `#003F7D`
- Text: white
- Radius: 24px
- Padding: 24px

#### FINHACK Variant
- Add subtle Electric Yellow accent line or glow (`#FFE600`)
- Highlight balance or CTA with Yellow underline or badge

**Rule:** Electric Yellow should enhance focus, not dominate the card.

---

### Quick Action Grid
- 4-column mobile grid
- Icon container: 48px circle or rounded square
- Icon background: `#EAF3FF`
- Icon color: `#005BAC`
- Label: 12–13px, 600
- Common actions:
  - Scan
  - Pay
  - Transfer
  - Reload
  - DuitNow
  - Toll
  - Parking
  - Rewards

---

### Transaction List Item
- Background: `#FFFFFF`
- Border bottom: `1px solid #E5E7EB`
- Padding: 16px
- Left: merchant/avatar/status icon
- Center: merchant name + timestamp
- Right: amount + status

**Amount Rules:**
- Outgoing: `-RM 24.50`, text black or muted
- Incoming: `+RM 24.50`, success green
- Failed/blocked: risk red label

---

### Fraud Warning Card
- Background: `#FEF2F2`
- Border: `1px solid #FCA5A5`
- Icon: red shield
- Radius: 20px

#### Enhanced Attention Variant
- Add Electric Yellow (`#FFE600`) highlight strip or icon glow to increase visibility without replacing red

**Usage Logic:**
- Red = danger
- Yellow = attention

Together they create urgency without panic.

---

### Safe Transaction Notice
- Background: `#ECFDF5`
- Border: `1px solid #BBF7D0`
- Text: `#166534`
- Used for verified merchant, known recipient, or secure payment confirmation

---

### Cards & Containers
- Small cards: 12px radius
- Standard cards: 16px radius
- Wallet cards: 24px radius
- Promotional banners: 20px radius
- Bottom sheets: 28px top-left and top-right radius
- Borders: `1px solid #E5E7EB`
- Shadows: subtle, never heavy

---

## 5. Layout Principles

### Mobile-First Structure
Most TNG eWallet interactions happen on mobile, so screens should prioritize thumb reach and fast decisions.

Typical screen hierarchy:
1. Header / identity / notification
2. Wallet balance or key task
3. Quick actions
4. Main product cards
5. Promotions / rewards
6. Transaction history or help

### Spacing System
- Base: 4px
- Recommended scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px

### Border Radius Scale
- Small: 8px — tags, icons, compact elements
- Standard: 12px–16px — cards, inputs, buttons
- Large: 20px–24px — wallet cards, banners, payment modules
- Sheet: 28px — bottom sheets and confirmation drawers
- Full Pill: 999px — chips, status badges, mini buttons

### App Navigation
- Bottom tab navigation for core areas
- Primary tabs:
  - Home
  - Pay
  - Rewards
  - Finance
  - Profile

**Rule:** Payment and scan actions should always be reachable within one tap from the home screen.

---

## 6. Depth & Elevation

TNG eWallet should use a restrained elevation system. The UI should feel clean, not overly decorative.

### Elevation Levels
- **Level 0:** App background, no shadow
- **Level 1:** Standard cards, very soft shadow
- **Level 2:** Wallet card, active modules, payment confirmation
- **Level 3:** Bottom sheets and modal overlays
- **Level 4:** Fraud warning overlays and blocking confirmation

### Shadow Examples
- Card: `0 1px 3px rgba(15, 23, 42, 0.08)`
- Elevated: `0 8px 24px rgba(15, 23, 42, 0.12)`
- Modal: `0 16px 48px rgba(15, 23, 42, 0.18)`

---

## 7. Do's and Don'ts

### Do
- Use TNG Blue for primary trust, navigation, and payment actions
- Make financial amounts easy to scan
- Use white cards over a soft gray background
- Keep QR/pay/transfer actions highly visible
- Use green, yellow, orange, and red consistently for transaction states
- Make fraud warnings calm, clear, and action-oriented
- Use local payment language like RM, DuitNow QR, toll, reload, merchant, transfer
- Provide strong confirmation screens before money leaves the wallet

### Don't
- Don’t overload the app with too many competing colors
- Don’t use red unless there is actual risk, failure, or danger
- Don’t hide payment actions behind deep menus
- Don’t make fraud warnings sound technical or vague
- Don’t use heavy shadows or glassmorphism for core financial screens
- Don’t place promotions above urgent wallet or security actions
- Don’t show sensitive balance information without a masking option

---

## 8. Responsive Behavior

Although the product is mobile-first, web and tablet layouts should scale cleanly for support portals, merchant dashboards, and campaign pages.

### Breakpoints
- 360px: Small mobile
- 400px: Standard mobile
- 576px: Large mobile
- 768px: Tablet
- 1024px: Small desktop / merchant dashboard
- 1280px: Desktop
- 1440px: Wide desktop

### Mobile Rules
- Use single-column layouts
- Keep CTAs sticky at the bottom for confirmation flows
- Use bottom sheets instead of centered modals
- Keep primary action height at least 48px

### Desktop Rules
- Use two-column layouts for dashboards
- Keep wallet/payment modules in card grids
- Use side navigation for merchant/admin tools
- Use wider tables for transaction history and settlements

---

## 9. Agent Prompt Guide

### Quick Color Reference
- Brand: TNG Blue (`#005BAC`)
- Deep brand: `#003F7D`
- Background: `#F5F7FA`
- Card: `#FFFFFF`
- Text: `#111827`
- Muted text: `#6B7280`
- Success: `#16A34A`
- Warning: `#FACC15`
- Risk: `#DC2626`
- Pending: `#F97316`

### Example Component Prompts
- “Create a TNG eWallet home screen with a blue gradient wallet balance card, white rounded action cards, and a 4-column quick action grid for Scan, Pay, Transfer, and Reload.”
- “Design a payment confirmation screen with RM amount hierarchy, merchant verification badge, primary blue Pay button, and a sticky bottom CTA.”
- “Create a fraud warning bottom sheet using red risk styling, plain-language scam explanation, Cancel Transfer as the primary action, and Continue Anyway as a secondary action.”
- “Build a transaction history list with white cards, merchant icons, RM amounts, green incoming states, red failed states, and muted timestamps.”
- “Create a Security Centre page using dark blue surface, shield iconography, scam education cards, and a prominent Report Scam CTA.”

---

## 10. Signature Product Patterns

### Pattern 1: One-Tap Payment Home
The home screen should make the next payment action obvious. The user should immediately see balance, scan/pay, reload, and transfer.

### Pattern 2: Trust Before Transfer
Before sending money, the UI should show:
- Recipient name
- Recipient account / phone identifier
- Known or new recipient status
- Risk level
- Final amount
- Confirmation CTA

### Pattern 3: Scam Interruption Layer
For suspicious transfers, introduce friction intentionally:
- Full-width warning
- Short reason
- Recommended action
- Optional cooldown
- Report button

### Pattern 4: Local Everyday Utility
Design should support more than payments:
- Toll
- Parking
- Reloads
- Insurance
- Investments
- Remittance
- Rewards
- Merchant QR

---

## 11. Accessibility

- Minimum text contrast: WCAG AA
- Buttons minimum height: 48px
- Tap targets: minimum 44px
- Do not rely on color alone for status
- Pair status colors with icons and labels
- Provide clear error messages for payment failures
- Support balance masking for privacy in public places

---

## 12. Design Personality

TNG Digital eWallet should feel:
- **Trustworthy**, because users store and move money
- **Fast**, because payments happen in queues and real-world moments
- **Local**, because the product serves Malaysian daily life
- **Protective**, because scam prevention is part of financial trust
- **Practical**, because utility matters more than visual decoration

The final design should not feel like a generic fintech template. It should feel like a Malaysian super-wallet: blue, rounded, direct, secure, and built for everyday money movement.

