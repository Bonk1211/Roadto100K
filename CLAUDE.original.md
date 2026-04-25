# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project

SafeSend is a multi-layer scam-prevention demo for Touch 'n Go FinHack.

The active database is PostgreSQL RDS. Backend database work should use
`backend/shared/db.py`, `backend/init_full_schema.py`, `backend/seed_erd_mock_data.py`,
and `backend/local_pg_api.py`.

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

The agent dashboard should call an HTTP API, not the database directly.

For Postgres-backed local development:

```text
agent-dashboard -> http://localhost:4100 -> backend/local_pg_api.py -> PostgreSQL RDS
```

For fully offline demos:

```text
agent-dashboard -> http://localhost:4000 -> frontend/services/mock-api -> in-memory mock data
```

## Shared Contracts

Frontend API/type contract changes start in `frontend/shared/src/types.ts`, then flow
into frontend consumers and backend API responses.

## Demo Invariants

- Keep the agent dashboard capable of showing a Stage 3 mule alert.
- Keep the network graph capable of showing linked accounts and RM exposure.
- Keep the one-click containment flow working against either local Postgres API or mock API.
