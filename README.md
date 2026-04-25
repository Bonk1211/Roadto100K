# SafeSend

Multi-layer scam prevention system for **Touch 'n Go FinHack hackathon**.

SafeSend intercepts scams at two points — at the moment of transfer (TnG in-app warning), and at the agent-review network level (fraud console).

## Repo Structure

```text
safesend/
├── frontend/                  # All user-facing React apps + mock API
│   ├── apps/
│   │   ├── user-app/          # React: TnG transfer flow + SafeSend interception (port 5173)
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

## Local Frontend

```bash
cd frontend
npm install
npm run dev              # boots mock-api + 2 React apps concurrently
```

| App              | URL                       |
| ---------------- | ------------------------- |
| User app (TnG)   | http://localhost:5173     |
| Agent dashboard  | http://localhost:5175     |
| Mock API         | http://localhost:4000     |

## Postgres-Backed Agent Dashboard

```bash
cd backend
pip install -r requirements.txt
python test_pg_connection.py
python local_pg_api.py
```

The local Postgres API runs on:

```text
http://localhost:4100
```

The agent dashboard reads `frontend/apps/agent-dashboard/.env.local`:

```env
VITE_API_URL=http://localhost:4100
```

## Database

```bash
cd backend
python init_full_schema.py      # recreates ERD tables and seeds built-in demo rows
python seed_erd_mock_data.py    # resets to exactly 5 rows per ERD table
python test_pg_connection.py
```

PostgreSQL RDS is the source of truth for alert state, transactions, mule cases,
network links, containment records, explanations, actions, and model labels.

## Backend Deployment

```bash
cd backend
pip install -r requirements.txt
sam build
sam deploy --guided
sam deploy
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────┐                ┌────────────────┐             │
│  │ user-app │                │ agent-dashboard│             │
│  └─────┬────┘                └───────┬────────┘             │
│        │                             │                        │
└────────┼─────────────────────────────┼────────────────────────┘
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

| Service | Purpose |
|---------|---------|
| API Gateway | REST endpoints under `/api/*` |
| Lambda | One Python handler per endpoint |
| PostgreSQL RDS | ERD data store |
| Kinesis | Event log stream |
| Bedrock | Bilingual scam explanations |
| SNS | SMS on block action |
| SSM | EAS endpoint + API keys |
