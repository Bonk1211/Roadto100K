# SafeSend 🛡️

**Real-time scam prevention for wallet transfers and fraud operations.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-org/your-repo/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-informational)](https://github.com/your-org/your-repo/releases)

SafeSend is a real-time fraud intelligence and early containment system built for Touch 'n Go's e-wallet ecosystem. It closes the gap between fraud detection and actual damage by acting while funds are still inside the platform, not after they have already moved through mule accounts.

## Live Apps 📱

- Agent Dashboard: [https://main.d2fcqqeuq0z5lb.amplifyapp.com/](https://main.d2fcqqeuq0z5lb.amplifyapp.com/)
- User App: [https://safe-send.top](https://safe-send.top)

## Overview

SafeSend is designed around one operational insight: fraud response is often too late.

Instead of only scoring suspicious behavior, the system helps prevent damage in real time through two core capabilities:

- Sender-side transfer interception using a multi-signal risk engine and ML scoring
- Mule account early eviction using inbound transaction monitoring and stage-based escalation

This gives users a chance to stop risky transfers before completion, while also giving fraud teams the tools to investigate suspicious receiving accounts and contain linked networks quickly.

## Features

- Real-time transfer interception with a 3-way risk branch
- Mule Account Early Eviction with stage-based escalation
- Bulk network containment for linked suspicious accounts
- AI explainability powered by Bedrock for users, analysts, and compliance
- Agent dashboard with alert queue, investigation panel, and network graph
- Natural language fraud queries for proactive analyst investigation
- Feedback loop with retraining visibility and analyst-labeled outcomes

## Problem Statement

Fraud detection often fails not because the models are weak, but because action happens too late. In many scam cases, fraud is only confirmed after multiple transfers have already cleared and the money has left the platform.

SafeSend addresses that operational gap between detection and damage. It is especially relevant in Malaysia, where scam patterns such as Macau scams, fake LHDN notices, investment scams, and love scams continue to rely on mule account infrastructure. The goal is not just to warn one victim, but to collapse the scam network faster and reduce downstream losses across the ecosystem.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, AWS Lambda, EC2 |
| Data | PostgreSQL, Amazon RDS, DynamoDB, Kinesis |
| AI and ML | Amazon Bedrock, Amazon Nova Lite, SageMaker |
| Identity and Verification | Beyond Presence |
| Cloud and Infrastructure | AWS, Alibaba Cloud, API Gateway, SNS, SSM |

## Architecture

SafeSend follows a real-time, event-driven architecture built around screening, escalation, and containment.

- Real-time screening: transfers are evaluated immediately using rule-based signals and ML scoring
- Mule detection: receiving accounts are monitored continuously for suspicious inbound behavior
- Event-driven response: warnings, alerts, suspensions, and containment actions are triggered from transaction events
- Continuous improvement: analyst actions and labeled cases feed retraining and improve future model performance

## Repository Layout

```text
.
|-- frontend/
|   |-- apps/
|   |   |-- user-app/          # Transfer flow and SafeSend interception demo
|   |   `-- agent-dashboard/   # Fraud operations dashboard
|   `-- shared/                # Shared types, tokens, mock data
|-- backend/
|   |-- lambdas/               # Screening, agent actions, stats, network graph
|   |-- shared/                # Shared backend utilities
|   `-- scripts/               # Demo and setup scripts
`-- docs/                      # Product, architecture, and demo notes
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Python 3.12+
- PostgreSQL access for the dashboard-backed API

### 1. Install frontend dependencies

```bash
cd frontend
npm install
```

### 2. Start the frontend apps

```bash
npm run dev
```

This starts the local frontend workspace, including:

| Service | URL |
| --- | --- |
| User app | `http://localhost:5173` |
| Agent dashboard | `http://localhost:5175` |

### 3. Install backend dependencies

```bash
cd ../backend
pip install -r requirements.txt
```

### 4. Verify database connectivity

```bash
python test_pg_connection.py
```

### 5. Start the local dashboard API

```bash
python local_pg_api.py
```

The local API runs at:

```text
http://localhost:4100
```

If needed, set the dashboard API URL in `frontend/apps/agent-dashboard/.env.local`:

```env
VITE_API_URL=http://localhost:4100
```

### 6. Seed local demo data

```bash
python init_full_schema.py
python seed_erd_mock_data.py
```

## Usage

### User app

Live URL: [https://safe-send.top](https://safe-send.top)

1. Open `http://localhost:5173`
2. Start a transfer to a payee
3. Confirm the transfer to trigger SafeSend screening
4. Review the soft warning or hard intercept result

### Agent dashboard

Live URL: [https://main.d2fcqqeuq0z5lb.amplifyapp.com/](https://main.d2fcqqeuq0z5lb.amplifyapp.com/)

1. Open `http://localhost:5175`
2. Review `Agent Ops` for queue activity and live cases
3. Open `Network` to inspect linked entities and fraud clusters
4. Open `Model Health` to review retraining signals and coverage

### Example workflow

```text
User initiates transfer
-> SafeSend screens transaction
-> Suspicious payment is warned or blocked
-> Analyst reviews linked mule activity in dashboard
-> Network exposure is investigated and contained
```

## How It Works

### 1. Sender-side interception

When a user initiates a transfer, SafeSend evaluates the payment using a multi-signal risk engine and ML scoring. Based on the final score, the system either:

- Approves the transfer silently
- Shows a soft warning and lets the user reconsider
- Triggers a hard interception screen with a bilingual AI explanation and options to cancel, proceed, or report scam

### 2. Mule account early eviction

SafeSend also monitors inbound transaction behavior on receiving accounts. Instead of waiting for a mule account to withdraw funds, the system flags suspicious accounts in stages, escalates them for analyst review, and can automatically evict high-risk mule accounts before withdrawals happen.

### 3. Analyst investigation and containment

The agent dashboard gives fraud teams a queue of suspicious cases, a focused investigation view, and a network graph for linked account analysis. From there, analysts can review exposure quickly and contain suspicious clusters through a single operational workflow.

## Deployment

Deploy the backend with AWS SAM:

```bash
cd backend
sam build
sam deploy --guided
```

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Open a pull request with context, screenshots, and testing notes where relevant

For larger changes, open an issue first so the scope and approach can be aligned before implementation.

## Documentation

- `docs/SafeSend_PRD_v3.md`
- `docs/PersonD_Demo_Runbook.md`
- `docs/ERD.md`
- `docs/DESIGN.md`
