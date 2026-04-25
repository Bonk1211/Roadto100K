"""
Lambda: reverify-alert

POST /api/alerts/{alert_id}/reverify

Resets alert verification_status, re-publishes to verify queue.
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.verification import reverify


def handler(event, context):
    path_params = event.get("pathParameters") or {}
    alert_id = path_params.get("alert_id")
    if not alert_id:
        return _err("alert_id required", 400)
    try:
        result = reverify(alert_id)
        if not result.get("ok"):
            return _err(result.get("error", "reverify failed"), 404)
        return _ok(result)
    except Exception as e:  # noqa: BLE001
        print(f"[reverify-alert] error: {e}")
        return _err(str(e), 500)


def _ok(payload):
    return {"statusCode": 200, "headers": _cors(), "body": json.dumps(payload, default=str)}


def _err(msg, code):
    return {"statusCode": code, "headers": _cors(), "body": json.dumps({"error": msg})}


def _cors():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }
