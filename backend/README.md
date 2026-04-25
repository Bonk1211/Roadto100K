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
| **AWS RDS** | PostgreSQL instance — alert state store |
| **Kinesis** | `safesend-events` stream — event log |
| **Bedrock** | `anthropic.claude-3-haiku` — bilingual scam explanations |
| **SNS** | `safesend-user-alerts` — SMS on block action |
| **SSM** | Parameter store for EAS endpoint + API keys |

## Folder Structure

```text
backend/
├── lambdas/
│   ├── screen_transaction/    # Rule engine + EAS + Bedrock orchestrator
│   ├── analyse_message/       # Layer 1 NLP scam phrase detector
│   ├── agent_action/          # Block / Warn / Clear action handler
│   ├── get_alerts/            # Paginated PostgreSQL query
│   ├── get_stats/             # Aggregation function
│   └── get_network_graph/     # Graph data from OSS
├── shared/                    # Shared utilities across lambdas
│   ├── db.py                  # PostgreSQL helpers
│   ├── kinesis.py             # Kinesis event publisher
│   ├── bedrock.py             # Bedrock LLM client
│   ├── sns.py                 # SNS SMS sender
│   ├── eas_client.py          # Alibaba EAS client + fallback
│   ├── config.py              # SSM param loading + env config
│   └── models.py              # Shared data models
├── template.yaml              # AWS SAM template (IaC)
├── requirements.txt           # Shared Python dependencies
├── samconfig.toml              # SAM deployment config
└── README.md
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

| Variable | Source | Description |
|----------|--------|-------------|
| `RDSHOST` | env | RDS Endpoint |
| `RDSPORT` | env | RDS Port (default 5432) |
| `RDSDBNAME` | env | Database name |
| `RDSUSER` | env | Username |
| `RDSPASSWORD` | env | Password |
| `KINESIS_STREAM` | hardcoded | `safesend-events` |
| `SNS_TOPIC_ARN` | env | SNS topic for user SMS |
| `BEDROCK_MODEL_ID` | env | `anthropic.claude-3-haiku-20240307-v1:0` |
| `BEDROCK_REGION` | SSM | `us-east-1` |
| `EAS_ENDPOINT` | SSM | Alibaba EAS scoring endpoint |
| `EAS_API_KEY` | SSM | Alibaba EAS auth key |
