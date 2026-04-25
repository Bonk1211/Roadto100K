#!/usr/bin/env python3
"""
Standalone migration: adds verification_runs, agent_findings, and
alerts.verification_status used by the autonomous fraud-verify worker.

Idempotent: safe to run multiple times. Uses DATABASE_URL from backend/.env
to match local_pg_api.py.

Run:  python init_verification_schema.py
"""

import os
import sys

import psycopg2
from dotenv import load_dotenv


def main() -> int:
    load_dotenv(".env")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set in backend/.env", file=sys.stderr)
        return 1

    sql = """
    CREATE TABLE IF NOT EXISTS verification_runs (
        run_id            VARCHAR(64) PRIMARY KEY,
        alert_id          VARCHAR(255) NOT NULL REFERENCES alerts(alert_id) ON DELETE CASCADE,
        status            VARCHAR(50)  NOT NULL DEFAULT 'queued',
        started_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at      TIMESTAMP,
        final_verdict     VARCHAR(50),
        consensus_score   INT,
        agreement_pct     INT,
        total_latency_ms  INT,
        arbiter_reasoning TEXT,
        mode              VARCHAR(20)  NOT NULL DEFAULT 'mock'
    );

    CREATE TABLE IF NOT EXISTS agent_findings (
        finding_id   BIGSERIAL PRIMARY KEY,
        run_id       VARCHAR(64) NOT NULL REFERENCES verification_runs(run_id) ON DELETE CASCADE,
        agent_name   VARCHAR(50) NOT NULL,
        agent_label  VARCHAR(100),
        verdict      VARCHAR(50) NOT NULL,
        confidence   INT NOT NULL,
        evidence     JSONB NOT NULL DEFAULT '[]'::jsonb,
        reasoning    TEXT NOT NULL,
        latency_ms   INT NOT NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_findings_run     ON agent_findings(run_id);
    CREATE INDEX IF NOT EXISTS idx_findings_created ON agent_findings(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_alert       ON verification_runs(alert_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status      ON verification_runs(status, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_started     ON verification_runs(started_at DESC);

    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50);
    CREATE INDEX IF NOT EXISTS idx_alerts_verify_status ON alerts(verification_status);

    CREATE TABLE IF NOT EXISTS agent_streams (
        run_id        VARCHAR(64) NOT NULL REFERENCES verification_runs(run_id) ON DELETE CASCADE,
        agent_name    VARCHAR(50) NOT NULL,
        partial_text  TEXT        NOT NULL DEFAULT '',
        status        VARCHAR(20) NOT NULL DEFAULT 'streaming',
        started_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (run_id, agent_name)
    );
    CREATE INDEX IF NOT EXISTS idx_streams_run ON agent_streams(run_id);

    CREATE TABLE IF NOT EXISTS worker_settings (
        key        VARCHAR(50) PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(100)
    );

    INSERT INTO worker_settings (key, value)
    VALUES ('paused', 'false')
    ON CONFLICT (key) DO NOTHING;
    """

    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()

    print("Verification schema ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
