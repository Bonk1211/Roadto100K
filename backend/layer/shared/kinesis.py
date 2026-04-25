"""
SafeSend Backend — Kinesis Event Publisher

Publishes transaction events and user choices to the `safesend-events`
Kinesis Data Stream for append-only event logging.
"""

import json
import boto3
from typing import Any

from .config import AWS_REGION, KINESIS_STREAM
from .models import now_iso

# Cache client across invocations
_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client("kinesis", region_name=AWS_REGION)
    return _client


def put_event(
    event_type: str,
    txn_id: str,
    payload: dict[str, Any],
    partition_key: str | None = None,
) -> bool:
    """
    Publish an event to the Kinesis stream.

    Args:
        event_type: e.g. "transaction_screened", "user_choice", "agent_action"
        txn_id: Transaction ID used as default partition key
        payload: Event data dict
        partition_key: Optional override for partition key

    Returns:
        True if published successfully, False on error
    """
    record = {
        "event_type": event_type,
        "txn_id": txn_id,
        "timestamp": now_iso(),
        "data": payload,
    }

    try:
        _get_client().put_record(
            StreamName=KINESIS_STREAM,
            Data=json.dumps(record, default=str).encode("utf-8"),
            PartitionKey=partition_key or txn_id,
        )
        print(f"[kinesis] Published {event_type} for {txn_id}")
        return True
    except Exception as e:
        print(f"[kinesis] Error publishing {event_type}: {e}")
        return False


def put_transaction_event(txn_id: str, action: str, score: int, details: dict) -> bool:
    """Convenience: publish a transaction screening event."""
    return put_event(
        event_type="transaction_screened",
        txn_id=txn_id,
        payload={"action": action, "final_score": score, **details},
    )


def put_user_choice_event(txn_id: str, user_id: str, choice: str) -> bool:
    """Convenience: publish a user choice event."""
    return put_event(
        event_type="user_choice",
        txn_id=txn_id,
        payload={"user_id": user_id, "choice": choice},
    )


def put_agent_action_event(
    txn_id: str, agent_id: str, action: str, notes: str = ""
) -> bool:
    """Convenience: publish an agent action event."""
    return put_event(
        event_type="agent_action",
        txn_id=txn_id,
        payload={"agent_id": agent_id, "action": action, "notes": notes},
    )
