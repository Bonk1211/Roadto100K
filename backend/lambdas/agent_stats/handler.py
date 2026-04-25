"""
Lambda: agent-stats

GET /api/agent-stats?window_minutes=60
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.verification import load_agent_stats


def handler(event, context):
    query = event.get("queryStringParameters") or {}
    try:
        window = int(query.get("window_minutes", "60"))
        return _ok(load_agent_stats(window))
    except Exception as e:  # noqa: BLE001
        print(f"[agent-stats] error: {e}")
        return {"statusCode": 500, "headers": _cors(), "body": json.dumps({"error": str(e)})}


def _ok(payload):
    return {"statusCode": 200, "headers": _cors(), "body": json.dumps(payload, default=str)}


def _cors():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }
