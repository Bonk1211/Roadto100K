"""
Lambda: inject-alert

POST /api/verifications/inject  body: {"profile":"low_risk|medium_risk|high_risk"}

Creates synthetic alert + transaction in RDS, publishes SQS message
so the verify-alert worker picks it up.
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.verification import inject_synthetic_alert


def handler(event, context):
    body = _parse_body(event)
    profile = (body.get("profile") or "high_risk").lower()
    if profile not in ("low_risk", "medium_risk", "high_risk"):
        return _err(f"invalid profile: {profile}", 400)
    try:
        result = inject_synthetic_alert(profile)
        if not result.get("ok"):
            return _err(result.get("error", "inject failed"), 500)
        return _ok(result)
    except Exception as e:  # noqa: BLE001
        print(f"[inject-alert] error: {e}")
        return _err(str(e), 500)


def _parse_body(event):
    raw = event.get("body")
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


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
