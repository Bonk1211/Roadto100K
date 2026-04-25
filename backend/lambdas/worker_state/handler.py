"""
Lambda: worker-state

GET  /api/worker/state    -> current pause flag
POST /api/worker/pause    -> pause
POST /api/worker/resume   -> resume

Note: SQS-driven worker doesn't auto-poll; pause flag is informational
for the dashboard. Local dev worker honours it.
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.verification import load_worker_state, set_worker_state


def handler(event, context):
    raw_path = event.get("rawPath") or event.get("path") or ""
    method = (event.get("requestContext", {}).get("http", {}) or {}).get("method") or event.get("httpMethod") or "GET"
    body = _parse_body(event)

    try:
        if method == "GET":
            return _ok(load_worker_state())
        if method == "POST" and raw_path.endswith("/pause"):
            return _ok(set_worker_state(True, body.get("by", "api")))
        if method == "POST" and raw_path.endswith("/resume"):
            return _ok(set_worker_state(False, body.get("by", "api")))
        return _err("Not found", 404)
    except Exception as e:  # noqa: BLE001
        print(f"[worker-state] error: {e}")
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
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }
