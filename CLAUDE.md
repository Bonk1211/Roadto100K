# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SafeSend — multi-layer scam-prevention demo for Touch 'n Go FinHack hackathon (April 2026). PRD: `docs/SafeSend_PRD_v1.md`. Design system: `docs/DESIGN.md`.

All AWS (Lambda, Bedrock, Kinesis, DynamoDB, SNS) and Alibaba (PAI, EAS, OSS, DataWorks) services from the PRD are **mocked** behind a single Express server (`services/mock-api`). The demo runs entirely on `localhost`. Do not attempt to wire real cloud calls — the mocks are the contract.

## Commands

```bash
make dev          # start mock-api + 3 React apps via concurrently
make stop         # kill anything on ports 4000/5173/5174/5175
make restart      # stop + dev
make status       # which ports are bound
make api          # mock-api only          (also: npm run dev:api)
make user         # user-app only          (also: npm run dev:user)
make plugin       # plugin only            (also: npm run dev:plugin)
make agent        # agent-dashboard only   (also: npm run dev:agent)
make typecheck    # tsc --noEmit across all workspaces
make build        # vite build all apps + tsc shared
```

`npm run dev` is identical to `make dev`. `make` targets are the convenience layer over npm workspace scripts.

Per-app type check: `npm run typecheck -w apps/user-app` (or any other workspace).

No test runner is configured. No linter is configured.

## Architecture

Monorepo via npm workspaces (NOT pnpm). Workspaces: `shared`, `services/*`, `apps/*`. The `shared` workspace is consumed via plain TS source — there is no build step; consumers just import from `"shared"`.

### Ports (hardcoded — do not change without updating all four)

| Port | Service |
|------|---------|
| 4000 | mock-api (Express) |
| 5173 | user-app (Vite) |
| 5174 | plugin (Vite) |
| 5175 | agent-dashboard (Vite) |

### Data flow

```
user-app /confirm → POST /api/score-transaction → mock-api
  rule-engine (7 signals) → eas-mock (anomaly score) → bedrock-mock (bilingual explanation + scam_type)
  → response
  → user-app routes to /intercept (band==="high") or /done

plugin → POST /api/scan-message → scam-message-detector (keyword/regex) → response

agent-dashboard polls every 5s:
  GET /api/alerts, /api/stats
  GET /api/network-graph (Network screen)
  POST /api/alerts/:id/decision → decisions.ts (in-memory OSS-equivalent log)
```

The mock-api response shape for `/api/score-transaction` is **flat** (`explanation_en`, `explanation_bm`, `scam_type`, `confidence` at top level). `apps/user-app/src/lib/api.ts` adapts it into the nested `shared.ScoreResponse` shape used by the screens. If you change either side, change both.

### shared/ is the single source of truth

- `design-tokens.ts` — every hex code, radius, shadow, font scale from `docs/DESIGN.md`. **Do not declare hex codes in app code.** Extend the Tailwind preset (`tailwind.preset.js`) instead.
- `types.ts` — `Transaction`, `Alert`, `RiskSignal`, `ScamType`, `ScoreResponse`, `BedrockExplanation`, `AgentDecision`.
- `mock-data.ts` — seed users, payees (including `p_scam_01` Ahmad Rahman = the demo Macau-scam case), `seedAlerts` (pre-baked dashboard alerts with chosen `scam_type` for narrative variety), `sampleScamMessages`, network-graph nodes/edges.

Any cross-app contract change starts here.

### Demo invariants (do not break these)

- **Ahmad Rahman / RM 8000 / 23:00 / device_match=false / age 6d** → score 98, band `high`, `scam_type === "macau_scam"`. Drives Act 2 of the pitch.
- **LHDN-style POST** (RM 3200 / 14:00 / age 3d / device_match=true) → `scam_type === "mule_account"`. Keeps dashboard variety.
- Classifier order in `services/mock-api/src/bedrock-mock.ts`: `macau_scam` → `mule_account` → `account_takeover` → `investment_scam` → `false_positive`. Reordering will shift seeded narratives.
- Risk signal weights in `services/mock-api/src/rule-engine.ts` are tuned so all 7 trigger the high band (>70). Changing weights re-tunes both the user-app interception threshold AND the dashboard sort order.

### Design rules (from `docs/DESIGN.md`)

- Primary CTA = TNG Blue `#005BAC`, white text, radius 16, height 52 mobile / 48 desktop.
- FINHACK Highlight CTA = Electric Yellow `#FFE600` bg + Royal Blue `#0055D4` text + shadow `0 4px 0 #0055D4`. Yellow ONLY on Royal Blue text — never on white.
- Wallet card = linear-gradient `#005BAC`→`#003F7D`, radius 24, white text.
- Fraud warning card = bg `#FEF2F2`, border `1px #FCA5A5`, radius 20, red shield icon.
- Risk score badge: green `#16A34A` (<40), yellow `#FFE600` bg + `#0055D4` text (40–70), red `#DC2626` (>70).
- Inter font everywhere. Mobile container `max-w-md`. Desktop dashboard is two-column with sidebar (`#071B33` bg).

## File ownership boundaries (multi-agent work)

When spawning agent teams to work on this repo:
- `apps/user-app/` + `apps/plugin/` are one ownership domain (frontend user-facing).
- `services/mock-api/` + `apps/agent-dashboard/` are another (backend + analyst tool).
- `shared/`, `tailwind.preset.js`, root `package.json`, `Makefile` belong to the lead/orchestrator.

Cross-domain changes (e.g. API contract shape) must touch `shared/types.ts` first, then both consumers.

## When in doubt

Re-read `docs/SafeSend_PRD_v1.md` (sections 4 = features, 5 = user flows, 6 = tech stack with services-mocked mapping, 8 = demo script) and `docs/DESIGN.md` (sections 2 = palette, 4 = components, 6 = elevation). Those two docs are the spec.
