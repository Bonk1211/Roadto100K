# SafeSend Backend - AWS Lambda Functions (Python 3.12)

## Architecture

Backend logic runs as AWS Lambda functions behind Amazon API Gateway. Alert state
and fraud investigation data are stored in PostgreSQL RDS using the ERD schema in
`docs/ERD.md`.

```text
API Gateway (HTTP API) -> /api/*
|-- POST /api/screen-transaction       -> screen_transaction/
|-- POST /api/analyse-message          -> analyse_message/
|-- POST /api/alerts/{txn_id}/action   -> agent_action/
|-- GET  /api/alerts                   -> get_alerts/
|-- GET  /api/stats                    -> get_stats/
|-- GET  /api/network-graph            -> get_network_graph/
`-- POST /api/user-choice              -> screen_transaction/
```

## Services Used

| Service | Purpose |
|---------|---------|
| PostgreSQL RDS | ERD tables for accounts, transactions, alerts, mule cases, containment, and labels |
| Kinesis | `safesend-events` stream for event logging |
| Bedrock | `anthropic.claude-3-haiku` bilingual scam explanations |
| SNS | `safesend-user-alerts` SMS on block action |
| SSM | Parameter store for EAS endpoint and API keys |

## Folder Structure

```text
backend/
|-- lambdas/
|   |-- screen_transaction/    # Rule engine + EAS + Bedrock orchestrator
|   |-- analyse_message/       # Layer 1 NLP scam phrase detector
|   |-- agent_action/          # Block / Warn / Clear action handler
|   |-- get_alerts/            # PostgreSQL alert query
|   |-- get_stats/             # PostgreSQL aggregation
|   `-- get_network_graph/     # Graph data endpoint
|-- shared/
|   |-- db.py                  # PostgreSQL helpers
|   |-- kinesis.py             # Kinesis event publisher
|   |-- bedrock.py             # Bedrock LLM client
|   |-- sns.py                 # SNS SMS sender
|   |-- eas_client.py          # Alibaba EAS client + fallback
|   |-- config.py              # SSM param loading + env config
|   `-- models.py              # Shared data models
|-- init_full_schema.py        # Recreates ERD PostgreSQL schema
|-- seed_erd_mock_data.py      # Seeds 5 rows per ERD table
|-- local_pg_api.py            # Local Postgres-backed API for frontend dev
|-- template.yaml              # AWS SAM template
`-- requirements.txt
```

## Local Development

```bash
pip install -r requirements.txt
python test_pg_connection.py
python local_pg_api.py
```

The local Postgres API runs on `http://localhost:4100`.

## Deployment

```bash
sam build
sam deploy --guided
sam deploy
```

Pass `DatabaseUrl` during deployment or configure it in the Lambda environment.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL RDS connection string |
| `KINESIS_STREAM` | Event stream name, default `safesend-events` |
| `SNS_TOPIC_ARN` | SNS topic for user SMS |
| `BEDROCK_MODEL_ID` | Bedrock model id |
| `BEDROCK_REGION` | Bedrock runtime region |
| `EAS_ENDPOINT` | Alibaba EAS scoring endpoint |
| `EAS_API_KEY` | Alibaba EAS API key |
