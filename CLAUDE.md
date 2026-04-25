# CLAUDE.md

Guide Claude Code in this repo.

## Project

SafeSend = multi-layer scam-prevention demo for Touch 'n Go FinHack.

Backend = AWS Lambda + API Gateway (SAM stack `safesend-backend`, region `ap-southeast-1`). DB = PostgreSQL RDS. Backend DB work use `backend/shared/db.py`, `backend/init_full_schema.py`, `backend/seed_erd_mock_data.py`.

Mock-api removed — frontend calls deployed API Gateway directly.

## Commands

```bash
cd frontend
npm run dev
npm run typecheck --workspaces --if-present
npm run build --workspaces --if-present
```

```bash
# Backend (from repo root)
make backend-build
make backend-deploy RDS_PWD=...
make backend-logs
make api-url
```

## Ports

| Port | Service |
|------|---------|
| 5173 | user-app |
| 5174 | plugin |
| 5175 | agent-dashboard |

## Data Flow

```text
agent-dashboard / user-app
  -> https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/prod
  -> Lambda (safesend-backend)
  -> PostgreSQL RDS / Bedrock / Kinesis
```

`VITE_API_URL` overrides the default API Gateway URL per app.

## Shared Contracts

Frontend API/type contract changes start in `frontend/shared/src/types.ts`, flow to frontend consumers + Lambda response shapes. Adapter layer in `apps/agent-dashboard/src/lib/api.ts` (`adaptGraphNode`/`adaptGraphEdge`) maps raw Lambda payloads to frontend types when fields drift.

## Demo Invariants

- Agent dashboard show Stage 3 mule alert.
- Network graph show linked accounts + RM exposure.
- One-click containment work against deployed API Gateway.
