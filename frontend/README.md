# SafeSend Frontend

## Architecture

The frontend is a **monorepo** with npm workspaces containing three React (Vite) apps. Backend is **AWS Lambda + API Gateway** (SAM stack `safesend-backend`).

```
frontend/
├── apps/
│   ├── user-app/          # TnG Transfer Flow + SafeSend Warning Screen
│   ├── plugin/            # Layer 1 Scam Message Detector Demo
│   └── agent-dashboard/   # Agent Dashboard (internal analyst tool)
├── shared/                # Shared types, design tokens, mock data
├── package.json           # Workspace root
├── tailwind.preset.js     # Shared Tailwind config
└── Makefile               # Dev commands
```

## Quick Start

```bash
cd frontend
npm install
npm run dev          # Starts user-app + agent-dashboard concurrently
```

## Ports

| Port | Service |
|------|---------|
| 5173 | user-app (Vite) |
| 5174 | plugin (Vite) |
| 5175 | agent-dashboard (Vite) |

## Backend Endpoint

Apps call the deployed API Gateway by default. Override per-app via `.env`:

```bash
# AWS API Gateway:
VITE_API_URL="https://yognv4d3gl.execute-api.ap-southeast-1.amazonaws.com/prod"

# Optional when API Gateway is protected by an API key:
VITE_API_KEY="your-api-key"
```

Deploy backend with `make backend-deploy` from repo root.

## Tech Stack

- **React 18** + **Vite 5** + **TypeScript**
- **Tailwind CSS 3.4** (Airtable design system on agent-dashboard, TnG blue on user-app)
- **D3.js v7** (network graph)
- **Recharts 2.x** (charts)
- **Axios** (HTTP client)
- **React Router v6** (routing)
- **vite-plugin-pwa** (installable user-app shell)

## User App PWA

The `user-app` is configured as the first installable PWA in this repo.

Local checks:

```bash
cd frontend
npm run dev:user
```

Then open `http://localhost:5173` and confirm:
- the manifest is visible in the browser application tools
- the service worker registers without console errors
- the app is installable in a supported browser

Production-style validation:

```bash
cd frontend
npm run build -w apps/user-app
npm run preview -w apps/user-app
```

Offline behavior in v1:
- static shell assets are cached after the first successful load
- API requests are not cached
- transfer screening and other backend-backed flows still require network access
