"""SafeSend Backend - PostgreSQL database helpers.

PostgreSQL is the only alert state store. Set DATABASE_URL:
postgresql://user:password@host:port/database
"""

import json
import os
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json

from .config import ALERT_TTL_SECONDS


_pg_conn = None


def _get_pg_conn():
    """Get or create PostgreSQL connection from DATABASE_URL env var."""
    global _pg_conn

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError(
            "DATABASE_URL not set. Set it to: "
            "postgresql://user:password@host:port/database"
        )

    if _pg_conn is None or _pg_conn.closed:
        _pg_conn = psycopg2.connect(database_url)

    return _pg_conn


def _row_to_dict(cursor, row) -> dict:
    cols = [desc[0] for desc in cursor.description]
    return dict(zip(cols, row))


def _json_safe(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def _risk_band(score: float) -> str:
    if score < 40:
        return "low"
    if score < 71:
        return "medium"
    return "high"


def _stage_from_score(score: float) -> str:
    if score >= 80:
        return "stage_3"
    if score >= 60:
        return "stage_2"
    return "stage_1"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_account(cursor, account_id: str, user_id: str = "", account_age_days: int = 0) -> None:
    cursor.execute(
        """
        INSERT INTO accounts
        (account_id, user_id, account_type, account_age_days, status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (account_id) DO NOTHING
        """,
        (account_id, user_id or account_id, "personal", account_age_days, "active"),
    )


def pg_init_tables():
    """Create the simple legacy alerts table if needed.

    Prefer backend/init_full_schema.py for the ERD schema.
    """
    conn = _get_pg_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id VARCHAR(255) PRIMARY KEY,
                account_id VARCHAR(255),
                txn_id VARCHAR(255),
                alert_type VARCHAR(50),
                risk_score NUMERIC(5, 2),
                stage VARCHAR(50),
                status VARCHAR(50) DEFAULT 'open',
                priority VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
            CREATE INDEX IF NOT EXISTS idx_alerts_risk_score ON alerts(risk_score DESC);
            """
        )
        conn.commit()
        print("[db] PostgreSQL schema initialized")
    except Exception as e:
        print(f"[db] pg_init_tables error: {e}")
        conn.rollback()
    finally:
        cursor.close()


def put_alert(alert: dict) -> None:
    """Write an alert and related transaction/risk records to PostgreSQL."""
    conn = _get_pg_conn()
    cursor = conn.cursor()

    try:
        txn_id = alert.get("txn_id")
        user_id = alert.get("user_id", "unknown_user")
        payee_id = alert.get("payee_id", "unknown_payee")
        amount = alert.get("amount", 0)
        score = float(alert.get("final_score", alert.get("risk_score", 0)))
        now = _now_utc()

        sender_account_id = f"acct_{user_id}"
        receiver_account_id = str(payee_id)
        _ensure_account(cursor, sender_account_id, user_id)
        _ensure_account(
            cursor,
            receiver_account_id,
            alert.get("payee_name") or receiver_account_id,
            int(alert.get("payee_account_age_days", 0) or 0),
        )

        cursor.execute(
            """
            INSERT INTO transactions
            (txn_id, sender_account_id, receiver_account_id, amount, timestamp, status, channel, is_first_transfer, device_match, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (txn_id) DO NOTHING
            """,
            (
                txn_id,
                sender_account_id,
                receiver_account_id,
                amount,
                now,
                "warned" if alert.get("action") == "soft_warn" else "blocked",
                "wallet_transfer",
                True,
                True,
            ),
        )

        risk_score_id = f"risk_{txn_id}"
        cursor.execute(
            """
            INSERT INTO risk_scores
            (risk_score_id, txn_id, account_id, score_type, rule_score, ml_score, composite_score, risk_level, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (risk_score_id) DO NOTHING
            """,
            (
                risk_score_id,
                txn_id,
                receiver_account_id,
                "sender_fraud",
                alert.get("rule_score"),
                alert.get("ml_score"),
                score,
                _risk_band(score),
            ),
        )

        for index, signal in enumerate(alert.get("triggered_signals", []), start=1):
            cursor.execute(
                """
                INSERT INTO risk_signals
                (signal_id, risk_score_id, signal_name, signal_value, points, fired)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (signal_id) DO NOTHING
                """,
                (
                    f"signal_{txn_id}_{index}",
                    risk_score_id,
                    signal.get("signal", signal.get("label_en", "signal")),
                    signal.get("label_en", ""),
                    signal.get("weight", 0),
                    bool(signal.get("triggered", True)),
                ),
            )

        alert_id = alert.get("alert_id") or txn_id
        cursor.execute(
            """
            INSERT INTO alerts
            (alert_id, account_id, txn_id, alert_type, risk_score, stage, status, priority, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (alert_id) DO NOTHING
            """,
            (
                alert_id,
                receiver_account_id,
                txn_id,
                "sender_interception",
                score,
                _stage_from_score(score),
                alert.get("status", "open"),
                "critical" if score >= 90 else "high" if score >= 70 else "medium",
            ),
        )

        explanation = alert.get("bedrock_explanation") or {}
        if explanation:
            cursor.execute(
                """
                INSERT INTO bedrock_explanations
                (explanation_id, alert_id, explanation_type, explanation_en, explanation_bm, scam_type, confidence, recommended_action, incident_summary, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (explanation_id) DO NOTHING
                """,
                (
                    f"explain_{alert_id}",
                    alert_id,
                    "user_warning",
                    explanation.get("explanation_en", ""),
                    explanation.get("explanation_bm", ""),
                    explanation.get("scam_type", alert.get("scam_type", "mule_account")),
                    0.9 if explanation.get("confidence") == "high" else 0.6,
                    "warn",
                    "",
                ),
            )

        conn.commit()
    except Exception as e:
        print(f"[db] put_alert error: {e}")
        conn.rollback()
    finally:
        cursor.close()


def get_alert(alert_or_txn_id: str) -> Optional[dict]:
    """Fetch a single alert by alert_id or txn_id."""
    conn = _get_pg_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT *
            FROM alerts
            WHERE alert_id = %s OR txn_id = %s
            LIMIT 1
            """,
            (alert_or_txn_id, alert_or_txn_id),
        )
        row = cursor.fetchone()
        return _json_safe(_row_to_dict(cursor, row)) if row else None
    except Exception as e:
        print(f"[db] get_alert error: {e}")
        return None
    finally:
        cursor.close()


def update_alert_status(
    alert_or_txn_id: str,
    status: str,
    agent_id: str,
    decided_at: str,
    notes: str = "",
) -> Optional[dict]:
    """Update alert status after agent action."""
    conn = _get_pg_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE alerts
            SET status = %s, resolved_at = CURRENT_TIMESTAMP
            WHERE alert_id = %s OR txn_id = %s
            RETURNING *
            """,
            (status, alert_or_txn_id, alert_or_txn_id),
        )
        row = cursor.fetchone()
        if row:
            alert = _row_to_dict(cursor, row)
            cursor.execute(
                """
                INSERT INTO agent_actions
                (action_id, alert_id, agent_id, action_type, decision_label, notes, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                """,
                (
                    f"action_{alert['alert_id']}_{int(time.time())}",
                    alert["alert_id"],
                    agent_id,
                    status,
                    "false_positive" if status == "cleared" else "fraud",
                    notes,
                ),
            )
            conn.commit()
            return _json_safe(alert)

        conn.rollback()
        return None
    except Exception as e:
        print(f"[db] update_alert_status error: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()


def query_alerts(
    status: str = "open",
    limit: int = 20,
    cursor: Optional[str] = None,
    sort_by: str = "risk_score",
) -> dict:
    """Query alerts from PostgreSQL."""
    conn = _get_pg_conn()
    db_cursor = conn.cursor()

    try:
        where_sql = ""
        params: list = []
        if status != "all":
            where_sql = "WHERE status = %s"
            params.append(status)

        order_col = "created_at" if sort_by == "created_at" else "risk_score"
        params.append(limit)
        db_cursor.execute(
            f"""
            SELECT *
            FROM alerts
            {where_sql}
            ORDER BY {order_col} DESC
            LIMIT %s
            """,
            params,
        )
        rows = [_json_safe(_row_to_dict(db_cursor, row)) for row in db_cursor.fetchall()]
        return {
            "alerts": rows,
            "has_more": False,
            "next_cursor": None,
            "total": len(rows),
        }
    except Exception as e:
        print(f"[db] query_alerts error: {e}")
        return {"alerts": [], "has_more": False, "next_cursor": None, "total": 0}
    finally:
        db_cursor.close()


def scan_all_alerts() -> list[dict]:
    """Return every alert joined with transaction amount when available."""
    conn = _get_pg_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT a.*, COALESCE(t.amount, 0) AS amount
            FROM alerts a
            LEFT JOIN transactions t ON t.txn_id = a.txn_id
            ORDER BY a.created_at DESC
            """
        )
        return [_json_safe(_row_to_dict(cursor, row)) for row in cursor.fetchall()]
    except Exception as e:
        print(f"[db] scan_all_alerts error: {e}")
        return []
    finally:
        cursor.close()


def pg_put_alert(alert: dict) -> None:
    """Compatibility wrapper."""
    put_alert(alert)


def pg_get_alert(txn_id: str) -> Optional[dict]:
    """Compatibility wrapper."""
    return get_alert(txn_id)


def pg_update_alert_status(
    txn_id: str,
    status: str,
    agent_id: str,
    decided_at: str,
    notes: str = "",
) -> Optional[dict]:
    """Compatibility wrapper."""
    return update_alert_status(txn_id, status, agent_id, decided_at, notes)


def pg_query_alerts(status: str = "open", limit: int = 20) -> list[dict]:
    """Compatibility wrapper."""
    return query_alerts(status=status, limit=limit)["alerts"]
