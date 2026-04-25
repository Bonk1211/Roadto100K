# SafeSend

Multi-layer scam prevention demo for **Touch 'n Go FinHack hackathon** (April 2026).

SafeSend intercepts scams at three points — in messaging (WhatsApp plugin), at the moment of transfer (TnG in-app warning), and at the agent-review network level (fraud console). All AWS + Alibaba services are mocked behind a single Express API so the demo runs entirely on `localhost`.

## Repo layout

```
safesend/
├── apps/
│   ├── user-app/          # React: TnG transfer flow + SafeSend interception (port 5173)
│   ├── plugin/            # React: WhatsApp scam-message plugin demo  (port 5174)
│   └── agent-dashboard/   # React: fraud-analyst console + D3 graph    (port 5175)
├── services/
│   └── mock-api/          # Express: rule engine + EAS + Bedrock mocks (port 4000)
├── shared/                # design tokens, TS types, mock data
├── tailwind.preset.js     # shared Tailwind preset (consumed by every app)
└── docs/                  # PRD + DESIGN system
```

## Prerequisites

- Node 18+ and npm 9+
- npm workspaces (already set up — no pnpm/yarn needed)

## Install + run

```bash
npm install              # installs all workspaces
npm run dev              # boots mock-api + 3 React apps concurrently
```

Then open:

| App              | URL                       |
| ---------------- | ------------------------- |
| User app (TnG)   | http://localhost:5173     |
| WhatsApp plugin  | http://localhost:5174     |
| Agent dashboard  | http://localhost:5175     |
| Mock API         | http://localhost:4000     |

## Demo script (5 minutes)

Mirrors `docs/SafeSend_PRD_v1.md` section 8. Run `npm run dev` first and have all four URLs open in tabs.

**Opening (30 sec).** *"Every 7 minutes, a Malaysian loses money to a scam. It doesn't start in their TnG app. It starts in WhatsApp."*

**Act 1 — messaging layer (1 min).** Open the **plugin** at http://localhost:5174. Click the **LHDN account freeze** sample message. The plugin POSTs `/api/scan-message`; the warning banner appears with matched phrases (`lhdn`, `pindahkan`, `akaun selamat`, `segera`) and a bilingual explanation. Layer 1 caught the scam before the user ever opened TnG.

**Act 2 — transfer interception (1.5 min).** Switch to the **user-app** at http://localhost:5173. Uncle persona opens TnG anyway. Tap **Transfer**, payee is pre-filled to **Ahmad Rahman** (account 7099887766, 6 days old), amount **RM 8,000**. Tap **Confirm**. The SafeSend interception screen replaces the normal confirmation — score 98/100, Macau-scam pattern, bilingual explanation, 7 risk signals listed. Toggle BM/EN. Tap **Cancel transfer**. Savings intact.

**Act 3 — agent dashboard (1 min).** Switch to the **agent dashboard** at http://localhost:5175. The new high-risk alert (`a_1001`, score 98) is at the top of the queue. Click it — Bedrock explanation, full risk-signal breakdown, transaction details. Click **Network** in the sidebar — the payee shares a device fingerprint with 3 other flagged accounts (this is a mule cluster, not an isolated case). Back to alert detail, click **Block**. The decision endpoint fires, SMS log records, status flips to `blocked`, stats bar updates (`open_alerts` -1, `blocked_today` +1, `rm_at_risk` -8000).

**Act 4 — feedback loop (30 sec).** *"Every decision the agent makes teaches the model. Tomorrow it's smarter."* Mention `services/mock-api/src/decisions.ts` — every block/warn/clear is logged exactly the way the production OSS label store would record them, ready for the nightly Alibaba PAI retraining run.

**Close (30 sec).** *"SafeSend is the first system that fights scams at every layer — in your messages, at the moment of transfer, and at the network level. With 24 million TnG users, this is RM 1.2 billion worth of protection."*

### API smoke check (optional)

```bash
curl -s http://localhost:4000/health
curl -s http://localhost:4000/api/alerts | jq 'length'
curl -s http://localhost:4000/api/stats
curl -s -X POST http://localhost:4000/api/scan-message \
  -H 'Content-Type: application/json' \
  -d '{"text":"Akaun LHDN anda akan dibekukan. Sila pindahkan ke akaun selamat."}'
```

## Design

All colors, typography, radii, and shadows come from `docs/DESIGN.md`. The single source of truth is `shared/src/design-tokens.ts` and `tailwind.preset.js` — extend the preset, do not redeclare hex codes in app code.

## Per-app dev commands

```bash
npm run dev:api      # just mock-api
npm run dev:user     # just user-app
npm run dev:plugin   # just plugin
npm run dev:agent    # just agent-dashboard
```
