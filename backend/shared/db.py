"""
SafeSend Backend — DynamoDB Helpers

CRUD operations on the `SafeSendAlerts` table.
Table schema:
  PK: txn_id (string)
  GSI1: status-risk_score-index (status + risk_score DESC)
  TTL: expires_at (epoch seconds)
"""

import time
import boto3
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
from typing import Any, Optional

from .config import AWS_REGION, DYNAMODB_TABLE, ALERT_TTL_SECONDS


# Cache the DynamoDB resource across invocations (Lambda container reuse)
_table = None


def _get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
        _table = dynamodb.Table(DYNAMODB_TABLE)
    return _table


def _to_decimal(obj: Any) -> Any:
    """Convert floats to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_decimal(i) for i in obj]
    return obj


def _from_decimal(obj: Any) -> Any:
    """Convert Decimals back to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: _from_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_from_decimal(i) for i in obj]
    return obj


def put_alert(alert: dict) -> None:
    """Write an alert record to DynamoDB with TTL."""
    item = _to_decimal(alert)
    item["expires_at"] = int(time.time()) + ALERT_TTL_SECONDS
    _get_table().put_item(Item=item)


def get_alert(txn_id: str) -> Optional[dict]:
    """Fetch a single alert by txn_id."""
    resp = _get_table().get_item(Key={"txn_id": txn_id})
    item = resp.get("Item")
    return _from_decimal(item) if item else None


def update_alert_status(
    txn_id: str,
    status: str,
    agent_id: str,
    decided_at: str,
    notes: str = "",
) -> Optional[dict]:
    """Update alert status after agent action."""
    try:
        resp = _get_table().update_item(
            Key={"txn_id": txn_id},
            UpdateExpression=(
                "SET #s = :status, agent_id = :agent_id, "
                "decided_at = :decided_at, agent_notes = :notes"
            ),
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":status": status,
                ":agent_id": agent_id,
                ":decided_at": decided_at,
                ":notes": notes,
            },
            ReturnValues="ALL_NEW",
        )
        return _from_decimal(resp.get("Attributes"))
    except Exception as e:
        print(f"[db] update_alert_status error: {e}")
        return None


def query_alerts(
    status: str = "open",
    limit: int = 20,
    cursor: Optional[str] = None,
    sort_by: str = "risk_score",
) -> dict:
    """
    Query alerts from DynamoDB GSI.
    Returns: { alerts: [...], has_more: bool, next_cursor: str|None, total: int }
    """
    table = _get_table()

    if status == "all":
        # Scan all items (hackathon scope — small table)
        scan_kwargs = {"Limit": limit}
        if cursor:
            scan_kwargs["ExclusiveStartKey"] = {"txn_id": cursor}
        resp = table.scan(**scan_kwargs)
    else:
        # Query on GSI by status
        scan_kwargs = {
            "IndexName": "status-risk_score-index",
            "KeyConditionExpression": Key("status").eq(status),
            "ScanIndexForward": False,  # DESC by risk_score
            "Limit": limit,
        }
        if cursor:
            scan_kwargs["ExclusiveStartKey"] = {"txn_id": cursor, "status": status}
        resp = table.query(**scan_kwargs)

    items = [_from_decimal(i) for i in resp.get("Items", [])]
    last_key = resp.get("LastEvaluatedKey")

    return {
        "alerts": items,
        "has_more": last_key is not None,
        "next_cursor": last_key.get("txn_id") if last_key else None,
        "total": resp.get("Count", len(items)),
    }


def scan_all_alerts() -> list[dict]:
    """Scan entire table (for stats aggregation — hackathon scope)."""
    table = _get_table()
    items = []
    scan_kwargs: dict = {}

    while True:
        resp = table.scan(**scan_kwargs)
        items.extend(resp.get("Items", []))
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    return [_from_decimal(i) for i in items]
