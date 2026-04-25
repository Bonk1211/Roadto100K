"""
Lambda: user-choice (F1 user-side logging)

POST /api/user-choice

Captures the end-user's reaction to a soft warning or hard interception:
  cancel | proceed | report

Writes:
  alerts.user_choice               (added column, see migration in init schema)
  agent_actions row                (audit)
  Kinesis event                    (label store)
  Alibaba OSS jsonl line           (compliance mirror, best-effort)
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.db import _cursor, _new_id, _now
from shared.kinesis import put_user_choice_event
from shared.models import generate_request_id, now_iso
from shared.oss import write_label


VALID_CHOICES = {"cancel", "proceed", "report"}


def handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "invalid JSON body"})

    txn_id = body.get("txn_id") or ""
    user_id = body.get("user_id") or ""
    choice = (body.get("choice") or "").lower()
    timestamp = body.get("timestamp") or now_iso()

    if not txn_id or not user_id:
        return _resp(400, {"error": "txn_id and user_id required"})
    if choice not in VALID_CHOICES:
        return _resp(400, {"error": f"choice must be one of {sorted(VALID_CHOICES)}"})

    label = "fraud" if choice in ("cancel", "report") else "false_positive"
    alert_id = None

    try:
        with _cursor() as cur:
            cur.execute(
                "SELECT alert_id FROM alerts WHERE txn_id = %s ORDER BY created_at DESC LIMIT 1",
                (txn_id,),
            )
            row = cur.fetchone()
            if row:
                alert_id = row["alert_id"]
                # Best-effort column update — the alerts table may not have user_choice
                # if the schema migration hasn't run. Catch + continue.
                try:
                    cur.execute(
                        """
                        UPDATE alerts
                           SET user_choice = %s,
                               status = CASE
                                          WHEN %s = 'cancel' THEN 'cleared'
                                          WHEN %s = 'report' THEN 'blocked'
                                          ELSE status
                                        END,
                               resolved_at = COALESCE(resolved_at, %s)
                         WHERE alert_id = %s
                        """,
                        (choice, choice, choice, _now(), alert_id),
                    )
                except Exception as e:  # noqa: BLE001
                    print(f"[user-choice] alerts.user_choice update skipped: {e}")
                    cur.execute(
                        """
                        UPDATE alerts
                           SET status = CASE
                                          WHEN %s = 'cancel' THEN 'cleared'
                                          WHEN %s = 'report' THEN 'blocked'
                                          ELSE status
                                        END,
                               resolved_at = COALESCE(resolved_at, %s)
                         WHERE alert_id = %s
                        """,
                        (choice, choice, _now(), alert_id),
                    )

                # Audit row
                cur.execute(
                    """
                    INSERT INTO agent_actions
                        (action_id, alert_id, agent_id, action_type,
                         decision_label, notes, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        _new_id(), alert_id, f"user:{user_id}",
                        "user_choice", label,
                        f"User chose '{choice}' on intercept screen", _now(),
                    ),
                )
    except Exception as e:  # noqa: BLE001
        print(f"[user-choice] db write failed (non-blocking): {e}")

    # Best-effort downstream emits
    put_user_choice_event(txn_id, user_id, choice)
    write_label({
        "txn_id": txn_id,
        "alert_id": alert_id,
        "user_id": user_id,
        "choice": choice,
        "label": label,
        "source": "user_intercept",
        "timestamp": timestamp,
    })

    return _resp(200, {
        "request_id": generate_request_id(),
        "txn_id": txn_id,
        "alert_id": alert_id,
        "choice": choice,
        "label": label,
        "logged": True,
        "timestamp": now_iso(),
    })


def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,x-api-key",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }
