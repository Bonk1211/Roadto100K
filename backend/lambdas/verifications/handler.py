"""
Lambda: verifications (read-side router)

Routes:
  GET /api/verifications/recent
  GET /api/verifications/active
  GET /api/verifications/queue
  GET /api/verifications/{run_id}
  GET /api/verifications/{run_id}/streams
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.verification import (
    load_recent,
    load_active,
    load_run,
    load_run_streams,
    load_queue,
)


def handler(event, context):
    raw_path = event.get("rawPath") or event.get("path") or ""
    path_params = event.get("pathParameters") or {}
    query = event.get("queryStringParameters") or {}

    try:
        if raw_path.endswith("/recent"):
            limit = int(query.get("limit", "50"))
            return _ok({"runs": load_recent(limit)})

        if raw_path.endswith("/active"):
            return _ok({"runs": load_active()})

        if raw_path.endswith("/queue"):
            return _ok(load_queue())

        run_id = path_params.get("run_id") or path_params.get("proxy")
        if run_id:
            if raw_path.endswith("/streams"):
                return _ok({"streams": load_run_streams(run_id)})
            run = load_run(run_id)
            if not run:
                return _err("Run not found", 404)
            return _ok(run)

        return _err("Not found", 404)
    except Exception as e:  # noqa: BLE001
        print(f"[verifications] error: {e}")
        return _err(str(e), 500)


def _ok(payload):
    return {
        "statusCode": 200,
        "headers": _cors(),
        "body": json.dumps(payload, default=str),
    }


def _err(msg, code):
    return {"statusCode": code, "headers": _cors(), "body": json.dumps({"error": msg})}


def _cors():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }
