"""
Lambda: mule-detector (F2)

POST /api/mule-detect

Two modes:
  1. Direct features supplied in body (test/dev path):
       {"account_id": "...", "unique_inbound_senders_6h": 4, ...}
  2. account_id only — aggregates features from PostgreSQL transactions table:
       {"account_id": "..."}

Always:
  - Scores 5 mule signals → Stage 0/1/2/3
  - Stage >=1 → upsert mule_cases row (silent watchlist)
  - Stage >=2 → write alerts row (alert_type=mule_eviction) + Bedrock Type 2 explanation
  - Stage 3 → suspends the account immediately + holds inbound transfers in escrow
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.mule import (
    aggregate_receiver_features,
    score_features,
    upsert_mule_case,
    insert_mule_alert,
    evaluate_receiver,
)
from shared.models import generate_request_id, now_iso


def handler(event, context):
    try:
        body = event.get("body") or "{}"
        data = json.loads(body) if isinstance(body, str) else body
    except json.JSONDecodeError:
        return _resp(400, {"error": "invalid JSON body"})

    account_id = data.get("account_id")
    if not account_id:
        return _resp(400, {"error": "account_id required"})

    # If caller passed feature fields directly, use them. Otherwise aggregate from DB.
    feature_keys = (
        "account_age_days", "unique_inbound_senders_6h",
        "avg_inbound_gap_minutes", "inbound_outbound_ratio", "merchant_spend_7d",
    )
    has_features = any(k in data for k in feature_keys)

    try:
        if has_features:
            features = {"account_id": account_id, **{k: data.get(k, 0) for k in feature_keys}}
            scoring = score_features(features)
            mule_case_id = None
            alert_id = None
            if scoring["stage"] >= 1:
                mule_case_id = upsert_mule_case(features, scoring)
                if scoring["stage"] >= 2 and mule_case_id:
                    alert_id = insert_mule_alert(account_id, mule_case_id, scoring, features)
            result = {
                **scoring,
                "account_id": account_id,
                "features": features,
                "mule_case_id": mule_case_id,
                "alert_id": alert_id,
            }
        else:
            result = evaluate_receiver(account_id)
    except Exception as e:  # noqa: BLE001
        print(f"[mule-detector] error: {e}")
        return _resp(500, {"error": str(e)})

    return _resp(200, {
        "request_id": generate_request_id(),
        "timestamp": now_iso(),
        **result,
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
