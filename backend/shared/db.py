"""
SafeSend Backend — PostgreSQL Database Helpers

CRUD operations mapped to the real RDS schema:

  alerts              (alert_id PK, account_id, txn_id, mule_case_id,
                       alert_type, risk_score, stage, status, priority,
                       created_at, resolved_at)

  transactions        (txn_id PK, sender_account_id, receiver_account_id,
                       amount, timestamp, status, channel,
                       is_first_transfer, device_match, created_at)

  accounts            (account_id PK, user_id, account_type, account_age_days,
                       status, device_fingerprint, ip_address, card_bin,
                       created_at, updated_at)

  risk_scores         (risk_score_id PK, txn_id, account_id, score_type,
                       rule_score, ml_score, composite_score, risk_level,
                       created_at)

  risk_signals        (signal_id PK, risk_score_id, signal_name,
                       signal_value, points, fired)

  bedrock_explanations (explanation_id PK, alert_id, explanation_type,
                        explanation_en, explanation_bm, scam_type,
                        confidence, recommended_action, incident_summary,
                        created_at)

  agent_actions       (action_id PK, alert_id, agent_id, action_type,
                       decision_label, notes, created_at)
"""

import uuid
import json
import decimal
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone
from typing import Any, Optional

from .config import RDS_HOST, RDS_PORT, RDS_DBNAME, RDS_USER, RDS_PASSWORD


# ---------------------------------------------------------------------------
# Connection (cached across Lambda invocations via container reuse)
# ---------------------------------------------------------------------------
_conn = None


def _get_conn():
    global _conn
    try:
        if _conn is None or _conn.closed:
            _conn = psycopg2.connect(
                host=RDS_HOST,
                port=RDS_PORT,
                dbname=RDS_DBNAME,
                user=RDS_USER,
                password=RDS_PASSWORD,
                connect_timeout=5,
                sslmode="require",
            )
            _conn.autocommit = True
    except Exception as e:
        print(f"[db] Connection error: {e}")
        raise
    return _conn


def _cursor():
    return _get_conn().cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def _now() -> str:
    """Clean UTC timestamp compatible with Postgres timestamp without time zone."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _clean_ts(ts_str: str) -> str:
    """Normalise any ISO timestamp string to Postgres-compatible format."""
    if not ts_str:
        return _now()
    # Remove trailing Z, strip timezone offset (+00:00 or +0000)
    ts = str(ts_str).rstrip("Z")
    for suffix in ("+00:00", "+0000"):
        if ts.endswith(suffix):
            ts = ts[: -len(suffix)]
            break
    # Replace T with space
    ts = ts.replace("T", " ")
    # Keep only up to seconds
    return ts[:19]


def _new_id() -> str:
    return str(uuid.uuid4())


def _row_to_dict(row) -> Optional[dict]:
    if row is None:
        return None
    d = dict(row)
    for key, val in d.items():
        if isinstance(val, datetime):
            d[key] = val.isoformat()
        elif isinstance(val, decimal.Decimal):
            d[key] = float(val)
    return d


def _rows_to_list(rows) -> list[dict]:
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# alerts table
# ---------------------------------------------------------------------------

def put_alert(alert: dict) -> str:
    """
    Write a screening result as a new alert row.

    Insertion order (FK chain):
      1. accounts   (upsert sender + receiver)
      2. transactions (upsert txn)
      3. alerts       (insert)
      4. risk_scores  (insert)
      5. risk_signals (insert per signal)
      6. bedrock_explanations (insert if present)

    Returns the new alert_id.
    """
    alert_id  = _new_id()
    txn_id    = alert.get("txn_id", _new_id())
    user_id   = alert.get("user_id", "unknown")
    payee_id  = alert.get("payee_id", "unknown")   # receiver account
    amount    = alert.get("amount", 0)
    action    = alert.get("action", "proceed")
    final_score = alert.get("final_score", 0)

    # Risk classification
    if action == "hard_intercept":
        risk_level = "high"; priority = "high"; stage = "review"
    elif action == "soft_warn":
        risk_level = "medium"; priority = "medium"; stage = "monitoring"
    else:
        risk_level = "low"; priority = "low"; stage = "closed"

    alert_type = alert.get("scam_type", "unknown")

    try:
        with _cursor() as cur:
            # ── 1. Upsert sender account ─────────────────────────────────
            cur.execute(
                """
                INSERT INTO accounts (account_id, user_id, account_type, status, created_at, updated_at)
                VALUES (%s, %s, 'ewallet', 'active', %s, %s)
                ON CONFLICT (account_id) DO NOTHING
                """,
                (user_id, user_id, _now(), _now()),
            )

            # ── 2. Upsert receiver (payee) account ───────────────────────
            payee_age = alert.get("payee_account_age_days", 365)
            cur.execute(
                """
                INSERT INTO accounts
                    (account_id, user_id, account_type, account_age_days, status, created_at, updated_at)
                VALUES (%s, %s, 'ewallet', %s, 'active', %s, %s)
                ON CONFLICT (account_id) DO NOTHING
                """,
                (payee_id, payee_id, payee_age, _now(), _now()),
            )

            # ── 3. Upsert transaction ─────────────────────────────────────
            is_first = alert.get("is_new_payee", True)
            device_match = True  # default; override from alert if available
            cur.execute(
                """
                INSERT INTO transactions
                    (txn_id, sender_account_id, receiver_account_id, amount,
                     timestamp, status, channel, is_first_transfer, device_match, created_at)
                VALUES (%s, %s, %s, %s, %s, 'intercepted', 'ewallet', %s, %s, %s)
                ON CONFLICT (txn_id) DO NOTHING
                """,
                (
                    txn_id, user_id, payee_id, amount,
                    _clean_ts(alert.get("created_at", _now())),
                    is_first, device_match, _now(),
                ),
            )

            # ── 4. Insert alert ───────────────────────────────────────────
            cur.execute(
                """
                INSERT INTO alerts
                    (alert_id, account_id, txn_id, alert_type,
                     risk_score, stage, status, priority, created_at,
                     processed_ms, user_display)
                VALUES (%s, %s, %s, %s, %s, %s, 'open', %s, %s, %s, %s)
                ON CONFLICT (alert_id) DO NOTHING
                """,
                (
                    alert_id, payee_id, txn_id, alert_type,
                    final_score, stage, priority, _now(),
                    alert.get("processed_ms"),
                    alert.get("user_display"),
                ),
            )

            # ── 5. Insert risk_scores ─────────────────────────────────────
            risk_score_id = _new_id()
            cur.execute(
                """
                INSERT INTO risk_scores
                    (risk_score_id, txn_id, account_id, score_type,
                     rule_score, ml_score, composite_score, risk_level, created_at)
                VALUES (%s, %s, %s, 'composite', %s, %s, %s, %s, %s)
                ON CONFLICT (risk_score_id) DO NOTHING
                """,
                (
                    risk_score_id, txn_id, payee_id,
                    alert.get("rule_score", 0),
                    alert.get("ml_score", 0),
                    final_score, risk_level, _now(),
                ),
            )

            # ── 6. Insert risk_signals ────────────────────────────────────
            for sig in (alert.get("triggered_signals") or []):
                cur.execute(
                    """
                    INSERT INTO risk_signals
                        (signal_id, risk_score_id, signal_name, signal_value, points, fired)
                    VALUES (%s, %s, %s, %s, %s, true)
                    ON CONFLICT (signal_id) DO NOTHING
                    """,
                    (
                        _new_id(), risk_score_id,
                        sig.get("signal", "unknown"),
                        sig.get("label_en", ""),
                        sig.get("weight", 0),
                    ),
                )

            # ── 7. Insert bedrock_explanation ─────────────────────────────
            bex = alert.get("bedrock_explanation")
            if bex:
                conf_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
                confidence_num = conf_map.get(str(bex.get("confidence", "low")).lower(), 0.5)
                cur.execute(
                    """
                    INSERT INTO bedrock_explanations
                        (explanation_id, alert_id, explanation_type,
                         explanation_en, explanation_bm,
                         scam_type, confidence, recommended_action, created_at)
                    VALUES (%s, %s, 'scam_explanation', %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (explanation_id) DO NOTHING
                    """,
                    (
                        _new_id(), alert_id,
                        bex.get("explanation_en", ""),
                        bex.get("explanation_bm", ""),
                        bex.get("scam_type", alert_type),
                        confidence_num,
                        "block" if action == "hard_intercept" else "warn",
                        _now(),
                    ),
                )

    except Exception as e:
        print(f"[db] put_alert error: {e}")
        raise

    return alert_id



def get_alert(txn_id: str) -> Optional[dict]:
    """
    Fetch a single alert by txn_id, joined with bedrock_explanation and agent action.
    Returns a flattened dict compatible with the old interface.
    """
    sql = """
        SELECT
            a.*,
            rs.rule_score, rs.ml_score, rs.composite_score AS final_score,
            rs.risk_level, rs.risk_score_id,
            be.explanation_en, be.explanation_bm,
            be.scam_type, be.confidence, be.recommended_action,
            aa.action_type AS agent_action, aa.agent_id, aa.notes AS agent_notes,
            aa.created_at AS decided_at
        FROM alerts a
        LEFT JOIN risk_scores rs  ON rs.txn_id   = a.txn_id
        LEFT JOIN bedrock_explanations be ON be.alert_id = a.alert_id
        LEFT JOIN agent_actions aa ON aa.alert_id = a.alert_id
        WHERE a.txn_id = %s
        ORDER BY rs.created_at DESC, be.created_at DESC, aa.created_at DESC
        LIMIT 1
    """
    try:
        with _cursor() as cur:
            cur.execute(sql, (txn_id,))
            row = cur.fetchone()
            if not row:
                return None
            d = _row_to_dict(row)
            # Attach signals
            if d.get("risk_score_id"):
                cur.execute(
                    "SELECT * FROM risk_signals WHERE risk_score_id = %s AND fired = true",
                    (d["risk_score_id"],),
                )
                d["triggered_signals"] = _rows_to_list(cur.fetchall())
            return d
    except Exception as e:
        print(f"[db] get_alert error: {e}")
        return None


def update_alert_status(
    alert_or_txn_id: str,
    status: str,
    agent_id: str,
    decided_at: str,
    notes: str = "",
) -> Optional[dict]:
    """
    Update alert status and write an agent_actions record.
    Returns updated alert dict.
    """
    # Map status to action_type
    action_type_map = {
        "blocked": "block",
        "warned":  "warn",
        "cleared": "clear",
    }
    action_type = action_type_map.get(status, status)

    try:
        with _cursor() as cur:
            # Update alerts.status and resolved_at
            cur.execute(
                """
                UPDATE alerts
                SET status = %s, resolved_at = %s
                WHERE txn_id = %s
                RETURNING alert_id
                """,
                (status, _clean_ts(decided_at), txn_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            alert_id = row["alert_id"]

            # Insert agent_actions record
            cur.execute(
                """
                INSERT INTO agent_actions
                    (action_id, alert_id, agent_id, action_type, decision_label,
                     notes, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    _new_id(), alert_id, agent_id, action_type,
                    status, notes, _clean_ts(decided_at),
                ),
            )

        return get_alert(txn_id)
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
    """
    Paginate alerts joined with risk scores.
    Returns: { alerts, has_more, next_cursor, total }
    """
    order_col = "a.risk_score" if sort_by == "risk_score" else "a.created_at"

    try:
        with _cursor() as cur:
            if status == "all":
                cur.execute("SELECT COUNT(*) FROM alerts")
                count_row = cur.fetchone()
                total = count_row["count"]
                base_sql = f"SELECT a.*, rs.rule_score, rs.ml_score, rs.composite_score AS final_score FROM alerts a LEFT JOIN risk_scores rs ON rs.txn_id = a.txn_id"
                if cursor:
                    cur.execute(f"{base_sql} WHERE a.alert_id > %s ORDER BY {order_col} DESC LIMIT %s",
                                (cursor, limit + 1))
                else:
                    cur.execute(f"{base_sql} ORDER BY {order_col} DESC LIMIT %s", (limit + 1,))
            else:
                cur.execute("SELECT COUNT(*) FROM alerts WHERE status = %s", (status,))
                count_row = cur.fetchone()
                total = count_row["count"]
                base_sql = f"SELECT a.*, rs.rule_score, rs.ml_score, rs.composite_score AS final_score FROM alerts a LEFT JOIN risk_scores rs ON rs.txn_id = a.txn_id WHERE a.status = %s"
                if cursor:
                    cur.execute(f"{base_sql} AND a.alert_id > %s ORDER BY {order_col} DESC LIMIT %s",
                                (status, cursor, limit + 1))
                else:
                    cur.execute(f"{base_sql} ORDER BY {order_col} DESC LIMIT %s",
                                (status, limit + 1))

            rows = cur.fetchall()
    except Exception as e:
        print(f"[db] query_alerts error: {e}")
        return {"alerts": [], "has_more": False, "next_cursor": None, "total": 0}

    has_more = len(rows) > limit
    rows = rows[:limit]
    alerts = [_row_to_dict(r) for r in rows]
    next_cursor = alerts[-1]["alert_id"] if has_more and alerts else None

    return {
        "alerts": alerts,
        "has_more": has_more,
        "next_cursor": next_cursor,
        "total": total,
    }


def scan_all_alerts() -> list[dict]:
    """
    Fetch all alerts joined with risk scores (for stats aggregation).
    Includes amount from transactions table.
    """
    sql = """
        SELECT
            a.*,
            rs.rule_score, rs.ml_score, rs.composite_score AS final_score,
            t.amount, t.sender_account_id AS user_id,
            aa.created_at AS decided_at
        FROM alerts a
        LEFT JOIN risk_scores  rs ON rs.txn_id   = a.txn_id
        LEFT JOIN transactions  t ON t.txn_id    = a.txn_id
        LEFT JOIN agent_actions aa ON aa.alert_id = a.alert_id
        ORDER BY a.created_at DESC
    """
    try:
        with _cursor() as cur:
            cur.execute(sql)
            return [_row_to_dict(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"[db] scan_all_alerts error: {e}")
        return []
