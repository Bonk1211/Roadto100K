# SafeSend Backend — AWS Lambda Functions (Python 3.12)

## Architecture

All backend logic runs as **AWS Lambda functions** behind **Amazon API Gateway (HTTP API)**.

```
API Gateway (HTTP API) → /api/*
├── POST /api/screen-transaction  → screen_transaction/
├── POST /api/analyse-message     → analyse_message/
├── POST /api/alerts/{txn_id}/action → agent_action/
├── GET  /api/alerts              → get_alerts/
├── GET  /api/stats               → get_stats/
├── GET  /api/network-graph       → get_network_graph/
└── POST /api/user-choice         → screen_transaction/ (secondary handler)
```

## Services Used

| Service | Purpose |
|---------|---------|
| **DynamoDB** | `SafeSendAlerts` table — alert state store |
| **Kinesis** | `safesend-events` stream — event log |
| **Bedrock** | `anthropic.claude-3-haiku` — bilingual scam explanations |
| **SNS** | `safesend-user-alerts` — SMS on block action |
| **SSM** | Parameter store for EAS endpoint + API keys |

## Folder Structure

```
backend/
├── lambdas/
│   ├── screen_transaction/    # Rule engine + EAS + Bedrock orchestrator
│   ├── analyse_message/       # Layer 1 NLP scam phrase detector
│   ├── agent_action/          # Block / Warn / Clear action handler
│   ├── get_alerts/            # Paginated DynamoDB query
│   ├── get_stats/             # Aggregation function
│   └── get_network_graph/     # Graph data from OSS
├── shared/                    # Shared utilities across lambdas
│   ├── db.py                  # DynamoDB helpers
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
# Install dependencies
pip install -r requirements.txt

# Run with SAM local (requires Docker)
sam local start-api --port 4000

# Or use the mock-api in /frontend/services/mock-api for offline dev
```

## Deployment

```bash
sam build
sam deploy --guided   # first time
sam deploy            # subsequent
```

## Environment Variables (Lambda)

| Variable | Source | Description |
|----------|--------|-------------|
| `DYNAMODB_TABLE` | hardcoded | `SafeSendAlerts` |
| `KINESIS_STREAM` | hardcoded | `safesend-events` |
| `SNS_TOPIC_ARN` | env | SNS topic for user SMS |
| `BEDROCK_MODEL_ID` | env | `anthropic.claude-3-haiku-20240307-v1:0` |
| `BEDROCK_REGION` | SSM | `us-east-1` |
| `EAS_ENDPOINT` | SSM | Alibaba EAS scoring endpoint |
| `EAS_API_KEY` | SSM | Alibaba EAS auth key |
