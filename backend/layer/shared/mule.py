"""
SafeSend Backend — Mule detection (F2)

Pure-Python scoring + PostgreSQL aggregation + write helpers.
Used by:
  - mule_detector Lambda (direct API call)
  - screen_transaction Lambda (inline, every inbound transfer)
"""

from __future__ import annotations

import os
import json
from datetime import datetime, timezone
from typing import Any

from .db import _cursor, _new_id, _now
from .bedrock import invoke_mule_alert

# ---------------------------------------------------------------------------
# Stage thresholds (PRD §5 F2)
# ---------------------------------------------------------------------------

STAGE_1_THRESHOLD = 40
STAGE_2_THRESHOLD = 60
STAGE_3_THRESHOLD = 80

SIGNALS: list[tuple[str, callable, int]] = [
    ("unique_inbound_senders_6h", lambda v: v >= 3, 30),
    ("avg_inbound_gap_minutes",   lambda v: 0 < v < 20, 25),
    ("inbound_outbound_ratio",    lambda v: v > 80, 25),
    ("account_age_days",          lambda v: 0 < v < 30, 15),
    ("merchant_spend_7d",         lambda v: v == 0, 20),
]


def score_features(features: dict) -> dict:
    """Score 5 mule signals against feature dict. Returns score + stage + fired list."""
    fired: list[dict] = []
    score = 0
    for field, predicate, weight in SIGNALS:
        try:
            v = float(features.get(field, 0) or 0)
        except (TypeError, ValueError):
            v = 0.0
        if predicate(v):
            score += weight
            fired.append({"signal": field, "value": v, "weight": weight})
    score = min(score, 100)

    if score >= STAGE_3_THRESHOLD:
        stage, status, withdrawal = 3, "auto_eviction", "blocked"
    elif score >= STAGE_2_THRESHOLD:
        stage, status, withdrawal = 2, "agent_alert", "soft_blocked"
    elif score >= STAGE_1_THRESHOLD:
        stage, status, withdrawal = 1, "watchlist", "active"
    else:
        stage, status, withdrawal = 0, "clear", "active"

    return {
        "mule_score": score,
        "stage": stage,
        "status": status,
        "withdrawal_status": withdrawal,
        "signals_fired": fired,
    }


# ---------------------------------------------------------------------------
# Receiver-side feature aggregation (queries transactions + accounts)
# ---------------------------------------------------------------------------

def aggregate_receiver_features(account_id: str) -> dict:
    """Compute the 5 mule features for a given receiver account from PostgreSQL."""
    with _cursor() as cur:
        cur.execute(
            "SELECT account_age_days FROM accounts WHERE account_id = %s",
            (account_id,),
        )
        acc = cur.fetchone()
        account_age_days = int((acc or {}).get("account_age_days") or 9999)

        # inbound transfers in last 6h
        cur.execute(
            """
            SELECT COUNT(DISTINCT sender_account_id) AS unique_senders,
                   COUNT(*) AS total_inbound,
                   MIN(timestamp) AS first_ts,
                   MAX(timestamp) AS last_ts,
                   COALESCE(SUM(amount), 0) AS inbound_total
              FROM transactions
             WHERE receiver_account_id = %s
               AND timestamp >= NOW() - INTERVAL '6 hours'
            """,
            (account_id,),
        )
        row = cur.fetchone() or {}
        unique_senders = int(row.get("unique_senders") or 0)
        total_inbound = int(row.get("total_inbound") or 0)
        first_ts = row.get("first_ts")
        last_ts = row.get("last_ts")
        inbound_total = float(row.get("inbound_total") or 0)

        # avg gap (minutes) between inbound transfers
        if total_inbound > 1 and first_ts and last_ts:
            span_sec = (last_ts - first_ts).total_seconds()
            avg_gap_minutes = (span_sec / max(total_inbound - 1, 1)) / 60.0
        else:
            avg_gap_minutes = 0.0

        # outbound in last 6h
        cur.execute(
            """
            SELECT COALESCE(SUM(amount), 0) AS outbound_total
              FROM transactions
             WHERE sender_account_id = %s
               AND timestamp >= NOW() - INTERVAL '6 hours'
            """,
            (account_id,),
        )
        outbound_total = float((cur.fetchone() or {}).get("outbound_total") or 0)
        if inbound_total > 0:
            inbound_outbound_ratio = round(100.0 * (inbound_total - outbound_total) / inbound_total, 2)
            inbound_outbound_ratio = max(0.0, min(inbound_outbound_ratio, 100.0))
        else:
            inbound_outbound_ratio = 0.0

        # merchant spend in last 7d (transactions where channel = 'merchant')
        cur.execute(
            """
            SELECT COALESCE(SUM(amount), 0) AS merchant_spend
              FROM transactions
             WHERE sender_account_id = %s
               AND channel IN ('merchant', 'pos', 'qr_pay')
               AND timestamp >= NOW() - INTERVAL '7 days'
            """,
            (account_id,),
        )
        merchant_spend = float((cur.fetchone() or {}).get("merchant_spend") or 0)

    return {
        "account_id": account_id,
        "account_age_days": account_age_days,
        "unique_inbound_senders_6h": unique_senders,
        "avg_inbound_gap_minutes": avg_gap_minutes,
        "inbound_outbound_ratio": inbound_outbound_ratio,
        "merchant_spend_7d": merchant_spend,
    }


# ---------------------------------------------------------------------------
# DB writers
# ---------------------------------------------------------------------------

def upsert_mule_case(features: dict, scoring: dict) -> str | None:
    """Insert or update mule_cases row; return mule_case_id (None if Stage 0)."""
    if scoring["stage"] < 1:
        return None

    account_id = features["account_id"]
    with _cursor() as cur:
        # Ensure FK target exists. mule_cases.account_id REFERENCES accounts(account_id).
        cur.execute(
            """
            INSERT INTO accounts
                (account_id, user_id, account_type, account_age_days,
                 status, created_at, updated_at)
            VALUES (%s, %s, 'ewallet', %s, 'monitoring', %s, %s)
            ON CONFLICT (account_id) DO NOTHING
            """,
            (
                account_id, account_id,
                int(features.get("account_age_days") or 0),
                _now(), _now(),
            ),
        )

        cur.execute(
            "SELECT mule_case_id FROM mule_cases WHERE account_id = %s ORDER BY created_at DESC LIMIT 1",
            (account_id,),
        )
        existing = cur.fetchone()

        stage_label = f"stage_{scoring['stage']}"
        status_map = {1: "monitoring", 2: "agent_alert", 3: "evicted"}
        case_status = status_map[scoring["stage"]]

        if existing:
            mule_case_id = existing["mule_case_id"]
            cur.execute(
                """
                UPDATE mule_cases
                   SET mule_score = %s,
                       stage = %s,
                       unique_inbound_senders_6h = %s,
                       avg_inbound_gap_minutes = %s,
                       inbound_outbound_ratio = %s,
                       merchant_spend_7d = %s,
                       status = %s,
                       updated_at = %s
                 WHERE mule_case_id = %s
                """,
                (
                    scoring["mule_score"], stage_label,
                    features["unique_inbound_senders_6h"],
                    features["avg_inbound_gap_minutes"],
                    features["inbound_outbound_ratio"],
                    features["merchant_spend_7d"],
                    case_status, _now(), mule_case_id,
                ),
            )
        else:
            mule_case_id = _new_id()
            cur.execute(
                """
                INSERT INTO mule_cases
                    (mule_case_id, account_id, mule_score, stage,
                     unique_inbound_senders_6h, avg_inbound_gap_minutes,
                     inbound_outbound_ratio, merchant_spend_7d,
                     status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    mule_case_id, account_id,
                    scoring["mule_score"], stage_label,
                    features["unique_inbound_senders_6h"],
                    features["avg_inbound_gap_minutes"],
                    features["inbound_outbound_ratio"],
                    features["merchant_spend_7d"],
                    case_status, _now(), _now(),
                ),
            )

        # Stage 3 → suspend account immediately
        if scoring["stage"] >= 3:
            cur.execute(
                "UPDATE accounts SET status='suspended', updated_at=%s WHERE account_id=%s",
                (_now(), account_id),
            )
        elif scoring["stage"] == 2:
            cur.execute(
                "UPDATE accounts SET status='monitoring', updated_at=%s WHERE account_id=%s",
                (_now(), account_id),
            )

    return mule_case_id


def insert_mule_alert(account_id: str, mule_case_id: str, scoring: dict, features: dict) -> str:
    """Insert alerts row for Stage 2/3 mule eviction. Returns alert_id."""
    alert_id = _new_id()
    priority = "critical" if scoring["stage"] >= 3 else "high"
    stage_label = f"stage_{scoring['stage']}"
    status = "open"

    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO alerts
                (alert_id, account_id, mule_case_id, alert_type,
                 risk_score, stage, status, priority, created_at)
            VALUES (%s, %s, %s, 'mule_eviction', %s, %s, %s, %s, %s)
            """,
            (alert_id, account_id, mule_case_id, scoring["mule_score"],
             stage_label, status, priority, _now()),
        )

        # Bedrock Type 2 — agent mule alert
        try:
            explanation = invoke_mule_alert(
                account_id=account_id,
                stage=scoring["stage"],
                score=int(scoring["mule_score"]),
                account_age_days=int(features.get("account_age_days") or 0),
                unique_senders=int(features.get("unique_inbound_senders_6h") or 0),
                avg_gap_minutes=float(features.get("avg_inbound_gap_minutes") or 0),
                inbound_outbound_ratio=float(features.get("inbound_outbound_ratio") or 0),
                merchant_spend=float(features.get("merchant_spend_7d") or 0),
            )
            cur.execute(
                """
                INSERT INTO bedrock_explanations
                    (explanation_id, alert_id, explanation_type,
                     explanation_en, explanation_bm, scam_type,
                     confidence, recommended_action, incident_summary, created_at)
                VALUES (%s, %s, 'mule_alert', %s, %s, 'mule_account', %s, %s, %s, %s)
                """,
                (
                    _new_id(), alert_id,
                    explanation.get("explanation_en", ""),
                    "",
                    {"high": 0.9, "medium": 0.6, "low": 0.3}.get(
                        str(explanation.get("confidence", "high")).lower(), 0.7
                    ),
                    explanation.get("recommended_action", "block"),
                    json.dumps({
                        "pattern_name": explanation.get("pattern_name"),
                        "signals_fired": explanation.get("signals_fired"),
                    }, default=str),
                    _now(),
                ),
            )
        except Exception as e:
            print(f"[mule] bedrock type-2 failed (non-blocking): {e}")

    return alert_id


# ---------------------------------------------------------------------------
# Watchlist inheritance helper (used by F1 screen_transaction)
# ---------------------------------------------------------------------------

def get_watchlist_stage(account_id: str) -> int:
    """Return current mule_cases stage (0-3) for an account, or 0 if not flagged."""
    if not account_id:
        return 0
    try:
        with _cursor() as cur:
            cur.execute(
                """
                SELECT stage FROM mule_cases
                 WHERE account_id = %s
                 ORDER BY updated_at DESC LIMIT 1
                """,
                (account_id,),
            )
            row = cur.fetchone()
        if not row:
            return 0
        stage_str = str(row.get("stage") or "")
        if "stage_3" in stage_str:
            return 3
        if "stage_2" in stage_str:
            return 2
        if "stage_1" in stage_str:
            return 1
    except Exception as e:
        print(f"[mule] watchlist lookup error: {e}")
    return 0


# ---------------------------------------------------------------------------
# Top-level entry — used by screen_transaction inline + mule_detector Lambda
# ---------------------------------------------------------------------------

def evaluate_receiver(account_id: str) -> dict:
    """Aggregate features from DB, score, write mule_case + alert. Returns full result."""
    features = aggregate_receiver_features(account_id)
    scoring = score_features(features)
    mule_case_id = None
    alert_id = None
    if scoring["stage"] >= 1:
        mule_case_id = upsert_mule_case(features, scoring)
        if scoring["stage"] >= 2 and mule_case_id:
            alert_id = insert_mule_alert(account_id, mule_case_id, scoring, features)
    return {
        **scoring,
        "account_id": account_id,
        "features": features,
        "mule_case_id": mule_case_id,
        "alert_id": alert_id,
    }
