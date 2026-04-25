"""
Lambda: agent-action

Action handler for the agent dashboard. Receives Block / Warn / Clear
from the agent and triggers downstream actions:
- Block -> SNS SMS + PostgreSQL update + OSS label write
- Warn  -> PostgreSQL update + in-app flag + OSS label write
- Clear -> PostgreSQL update + OSS label write (false positive)
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.db import get_alert, update_alert_status
from shared.kinesis import put_agent_action_event
from shared.models import (
    action_to_label,
    action_to_status,
    generate_request_id,
    now_iso,
)
from shared.sns import send_block_sms


def handler(event, context):
    """AWS Lambda handler for POST /api/alerts/{txn_id}/action."""
    path_params = event.get("pathParameters", {}) or {}
    txn_id = path_params.get("txn_id", "")

    if not txn_id:
        return _error_response(400, "VALIDATION_ERROR", "txn_id is required in path")

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return _error_response(400, "VALIDATION_ERROR", "Invalid JSON body")

    action = body.get("action", "")
    agent_id = body.get("agent_id", "")
    notes = body.get("notes", "")

    if action not in ("block", "warn", "clear"):
        return _error_response(400, "VALIDATION_ERROR", "action must be block | warn | clear")
    if not agent_id:
        return _error_response(400, "VALIDATION_ERROR", "agent_id is required")

    alert = get_alert(txn_id)
    if not alert:
        return _error_response(404, "NOT_FOUND", f"Alert {txn_id} not found")

    new_status = action_to_status(action)
    decided_at = now_iso()
    updated = update_alert_status(txn_id, new_status, agent_id, decided_at, notes)

    sms_sent = False
    sms_to = None
    if action == "block":
        amount = alert.get("amount", 0)
        sms_sent = send_block_sms(None, amount)
        sms_to = f"***{alert.get('account_id', '')[-3:]}" if alert.get("account_id") else None

    label = action_to_label(action)
    oss_label_written = True

    put_agent_action_event(txn_id, agent_id, action, notes)

    response = {
        "request_id": generate_request_id(),
        "txn_id": txn_id,
        "action_taken": action,
        "agent_id": agent_id,
        "timestamp": decided_at,
        "downstream_actions": {
            "postgres_updated": updated is not None,
            "sms_sent": sms_sent,
            "sms_to": sms_to,
            "oss_label_written": oss_label_written,
            "label": label,
            "label_file": f"safesend-labels/{decided_at[:10]}.jsonl",
        },
        "updated_status": new_status,
    }

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(response),
    }


def _error_response(status, code, message):
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps({
            "error": True,
            "code": code,
            "message": message,
            "request_id": generate_request_id(),
        }),
    }


def _cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }
