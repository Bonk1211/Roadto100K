"""
Lambda: get-alerts

Paginated query on SafeSendAlerts table.
Sorted by risk_score DESC (default) or created_at.
Supports status filtering and cursor-based pagination.
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.models import generate_request_id
from shared.db import query_alerts, get_alert


def handler(event, context):
    """AWS Lambda handler for GET /api/alerts and GET /api/alerts/{txn_id}."""
    path_params = event.get("pathParameters", {}) or {}
    txn_id = path_params.get("txn_id")

    # Single alert detail
    if txn_id:
        return _get_single_alert(txn_id)

    # List alerts with pagination
    query = event.get("queryStringParameters", {}) or {}

    status = query.get("status", "open")
    limit = min(int(query.get("limit", "20")), 100)
    cursor = query.get("cursor")
    sort_by = query.get("sort_by", "risk_score")

    result = query_alerts(status=status, limit=limit, cursor=cursor, sort_by=sort_by)

    response = {
        "request_id": generate_request_id(),
        "alerts": result["alerts"],
        "total": result["total"],
        "has_more": result["has_more"],
        "next_cursor": result["next_cursor"],
    }

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(response, default=str),
    }


def _get_single_alert(txn_id: str):
    """Fetch full detail for a single alert."""
    alert = get_alert(txn_id)
    if not alert:
        return {
            "statusCode": 404,
            "headers": _cors_headers(),
            "body": json.dumps({
                "error": True,
                "code": "NOT_FOUND",
                "message": f"Alert {txn_id} not found",
                "request_id": generate_request_id(),
            }),
        }

    response = {
        "request_id": generate_request_id(),
        **alert,
    }

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(response, default=str),
    }


def _cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }
