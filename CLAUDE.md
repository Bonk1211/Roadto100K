# CLAUDE.md

Guide Claude Code in this repo.

## Project

SafeSend = multi-layer scam-prevention demo for Touch 'n Go FinHack.

Active DB: PostgreSQL RDS. Backend DB work use `backend/shared/db.py`, `backend/init_full_schema.py`, `backend/seed_erd_mock_data.py`, `backend/local_pg_api.py`.

## Commands

```bash
cd frontend
npm run dev
npm run typecheck --workspaces --if-present
npm run build --workspaces --if-present
```

```bash
cd backend
python test_pg_connection.py
python seed_erd_mock_data.py
python local_pg_api.py
```

## Ports

| Port | Service |
|------|---------|
| 4000 | mock-api |
| 4100 | local Postgres API |
| 5173 | user-app |
| 5174 | plugin |
| 5175 | agent-dashboard |

## Data Flow

Agent dashboard call HTTP API, not DB direct.

Postgres-backed local dev:

```text
agent-dashboard -> http://localhost:4100 -> backend/local_pg_api.py -> PostgreSQL RDS
```

Fully offline demo:

```text
agent-dashboard -> http://localhost:4000 -> frontend/services/mock-api -> in-memory mock data
```

## Shared Contracts

Frontend API/type contract changes start in `frontend/shared/src/types.ts`, flow to frontend consumers + backend API responses.

## Demo Invariants

- Agent dashboard show Stage 3 mule alert.
- Network graph show linked accounts + RM exposure.
- One-click containment work against local Postgres API or mock API.