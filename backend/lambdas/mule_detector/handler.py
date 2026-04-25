"""
Lambda: mule-detector

Fires on every inbound transfer. Evaluates 5 mule signals,
assigns Stage 1/2/3, then POSTs result to EC2 /mule-alert.

Called by screen_transaction after scoring the sender side.
"""

import json
import os
import urllib.request

EC2_URL = os.environ.get("EC2_URL", "http://13.212.182.108")

SIGNALS = [
    ("unique_inbound_senders_6h", lambda v: v >= 3,  30),
    ("avg_inbound_gap_minutes",   lambda v: v < 20,  25),
    ("inbound_outbound_ratio",    lambda v: v > 80,  25),
    ("account_age_days",          lambda v: v < 30,  15),
    ("merchant_spend_7d",         lambda v: v == 0,  20),
]


def score_mule(features: dict) -> dict:
    fired, score = [], 0
    for field, condition, weight in SIGNALS:
        val = float(features.get(field, 0))
        if condition(val):
            score += weight
            fired.append({"signal": field, "value": val, "weight": weight})
    score = min(score, 100)

    if score >= 80:   stage, status, withdrawal = 3, "auto_eviction", "blocked"
    elif score >= 60: stage, status, withdrawal = 2, "agent_alert",   "soft_blocked"
    elif score >= 40: stage, status, withdrawal = 1, "watchlist",     "active"
    else:             stage, status, withdrawal = 0, "clear",         "active"

    return {
        "account_id": features.get("account_id", "unknown"),
        "mule_score": score,
        "stage": stage,
        "status": status,
        "withdrawal_status": withdrawal,
        "signals_fired": fired,
    }


def handler(event, context):
    try:
        body = json.loads(event.get("body", "{}")) if isinstance(event.get("body"), str) else event
        result = score_mule(body)

        # Only notify EC2 if a mule stage was detected
        if result["stage"] >= 1:
            try:
                data = json.dumps(result).encode()
                req = urllib.request.Request(
                    f"{EC2_URL}/mule-alert",
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                urllib.request.urlopen(req, timeout=5)
                print(f"[mule-detector] Notified EC2: account={result['account_id']} stage={result['stage']}")
            except Exception as e:
                print(f"[mule-detector] EC2 notify failed (non-blocking): {e}")

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(result),
        }
    except Exception as e:
        print(f"[mule-detector] Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
