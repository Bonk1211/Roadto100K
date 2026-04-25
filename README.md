# SafeSend

Multi-layer scam prevention system for **Touch 'n Go FinHack hackathon**.

SafeSend intercepts scams at three points: in messaging, at the moment of transfer,
and at the fraud-analyst network containment layer.

## Repo Structure

```text
safesend/
|-- frontend/
|   |-- apps/
|   |   |-- user-app/          # TnG transfer flow + SafeSend interception
|   |   |-- plugin/            # Scam-message plugin demo
|   |   `-- agent-dashboard/   # Fraud analyst console + D3 graph
|   |-- services/mock-api/     # Offline mock server
|   `-- shared/                # TS types, design tokens, mock data
|
|-- backend/
|   |-- lambdas/               # AWS Lambda handlers
|   |-- shared/                # PostgreSQL, Kinesis, Bedrock, SNS, EAS helpers
|   |-- init_full_schema.py    # Recreate ERD PostgreSQL schema
|   |-- seed_erd_mock_data.py  # Seed 5 rows per ERD table
|   |-- local_pg_api.py        # Local Postgres-backed dashboard API
|   `-- template.yaml          # AWS SAM IaC template
|
`-- docs/
    |-- ERD.md
    `-- SafeSend_PRD_v3.md
```

## Local Frontend

```bash
cd frontend
npm install
npm run dev
```

| App | URL |
| --- | --- |
| User app | http://localhost:5173 |
| Plugin | http://localhost:5174 |
| Agent dashboard | http://localhost:5175 |
| Mock API | http://localhost:4000 |

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

Pass the `DatabaseUrl` SAM parameter or configure `DATABASE_URL` in Lambda.

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
