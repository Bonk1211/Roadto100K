# SafeSend

Multi-layer scam prevention system for **Touch 'n Go FinHack hackathon** (April 2026).

SafeSend intercepts scams at three points — in messaging (WhatsApp plugin), at the moment of transfer (TnG in-app warning), and at the agent-review network level (fraud console).

## Repo Structure

```
safesend/
├── frontend/                  # All user-facing React apps + mock API
│   ├── apps/
│   │   ├── user-app/          # React: TnG transfer flow + SafeSend interception (port 5173)
│   │   ├── plugin/            # React: WhatsApp scam-message plugin demo  (port 5174)
│   │   └── agent-dashboard/   # React: fraud-analyst console + D3 graph    (port 5175)
│   ├── services/
│   │   └── mock-api/          # Express: rule engine + EAS + Bedrock mocks (port 4000)
│   ├── shared/                # Design tokens, TS types, mock data
│   ├── tailwind.preset.js     # Shared Tailwind preset
│   ├── package.json           # npm workspaces root
│   └── Makefile               # Dev commands
│
├── backend/                   # AWS Lambda functions (Python 3.12)
│   ├── lambdas/
│   │   ├── screen_transaction/  # Rule engine + EAS + Bedrock orchestrator
│   │   ├── analyse_message/     # Layer 1 NLP scam phrase detector
│   │   ├── agent_action/        # Block / Warn / Clear action handler
│   │   ├── get_alerts/          # Paginated DynamoDB query
│   │   ├── get_stats/           # Dashboard aggregation
│   │   └── get_network_graph/   # Scam network graph data
│   ├── shared/                  # Shared Python utilities (DB, Kinesis, Bedrock, SNS, EAS)
│   ├── scripts/
│   │   └── seed_demo_data.py    # Pre-seed DynamoDB with demo alerts
│   ├── template.yaml            # AWS SAM IaC template
│   ├── samconfig.toml           # SAM deployment config
│   └── requirements.txt         # Python dependencies
│
└── docs/                      # PRD + Design system specs
```

## Quick Start (Local Dev)

```bash
# Frontend (mock API + React apps)
cd frontend
npm install
npm run dev              # boots mock-api + 3 React apps concurrently
```

| App              | URL                       |
| ---------------- | ------------------------- |
| User app (TnG)   | http://localhost:5173     |
| WhatsApp plugin  | http://localhost:5174     |
| Agent dashboard  | http://localhost:5175     |
| Mock API         | http://localhost:4000     |

## Backend Deployment (AWS)

```bash
# Deploy Lambda functions + infrastructure
cd backend
pip install -r requirements.txt
sam build
sam deploy --guided       # first time
sam deploy                # subsequent deploys

# Seed demo data
python scripts/seed_demo_data.py
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐             │
│  │ user-app │  │  plugin  │  │ agent-dashboard│             │
│  └─────┬────┘  └─────┬────┘  └───────┬────────┘             │
│        │             │               │                        │
└────────┼─────────────┼───────────────┼────────────────────────┘
         │             │               │
    ┌────▼─────────────▼───────────────▼────┐
    │       Amazon API Gateway (HTTP API)    │
    └────┬─────────┬──────────┬─────────────┘
         │         │          │
    ┌────▼────┐ ┌──▼───┐ ┌───▼──────────┐
    │ screen- │ │ get- │ │ agent-action │ ... (6 Lambda functions)
    │  txn    │ │alerts│ │              │
    └────┬────┘ └──┬───┘ └───┬──────────┘
         │         │          │
    ┌────▼─────────▼──────────▼──────┐
    │         Amazon DynamoDB         │  ←── SafeSendAlerts table
    └─────────────────────────────────┘
         │              │
    ┌────▼────┐    ┌────▼────┐
    │ Kinesis │    │   SNS   │  ←── SMS on block
    │ Stream  │    │  Topic  │
    └─────────┘    └─────────┘
```

## AWS Services

| Service | Resource | Purpose |
|---------|----------|---------|
| **API Gateway** | HTTP API | REST endpoints under `/api/*` |
| **Lambda** (×6) | Python 3.12 | One function per endpoint |
| **DynamoDB** | `SafeSendAlerts` | Alert state store (GSI + TTL) |
| **Kinesis** | `safesend-events` | Event log stream (24h retention) |
| **Bedrock** | Claude 3 Haiku | Bilingual scam explanations |
| **SNS** | `safesend-user-alerts` | SMS on block action |
| **SSM** | Parameter Store | EAS endpoint + API keys |

## Design

All colors, typography, radii, and shadows come from `docs/DESIGN.md`. The single source of truth is `frontend/shared/src/design-tokens.ts` and `frontend/tailwind.preset.js`.
