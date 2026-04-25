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

## Deploy User App To Alibaba OSS

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-user-app-oss.yml` that builds `frontend/apps/user-app` and syncs the generated `dist/` folder to Alibaba OSS.

### 1. Add GitHub secrets

In your GitHub repository, go to `Settings -> Secrets and variables -> Actions` and create:

- `ALIBABA_OSS_ACCESS_KEY_ID`
- `ALIBABA_OSS_ACCESS_KEY_SECRET`
- `USER_APP_API_KEY` (optional, only if your API Gateway requires `x-api-key`)

Use a RAM user with the minimum bucket permissions needed for deploys:

- `oss:ListObjects`
- `oss:PutObject`
- `oss:DeleteObject`

### 2. Add GitHub variables

Create these repository variables:

- `ALIBABA_OSS_BUCKET`: your OSS bucket name, for example `my-user-app-bucket`
- `ALIBABA_OSS_REGION`: your OSS region ID, for example `ap-southeast-1`
- `ALIBABA_OSS_ENDPOINT`: optional custom endpoint or CNAME endpoint
- `ALIBABA_OSS_PREFIX`: optional folder inside the bucket, for example `user-app`
- `USER_APP_API_URL`: optional API base URL injected at build time

If `ALIBABA_OSS_PREFIX` is blank, the app deploys to the bucket root.

### 3. Trigger the workflow

The workflow runs when you push changes to `main` that touch the `user-app`, shared frontend code, or the workflow file itself. You can also run it manually from the GitHub Actions tab using `workflow_dispatch`.

### 4. OSS static website settings

Because `user-app` uses React Router with browser history routes like `/home` and `/transfer`, configure the OSS bucket's static website hosting so refreshes do not fail:

- index document: `index.html`
- error document: `index.html`

If your bucket is in a Chinese mainland region and was created after March 20, 2025, Alibaba Cloud requires a custom domain (CNAME) for data API operations. If that applies to your bucket, set `ALIBABA_OSS_ENDPOINT` to that custom domain endpoint in GitHub Actions.
