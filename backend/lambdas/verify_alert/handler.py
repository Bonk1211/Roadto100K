"""
Lambda: verify-alert (SQS consumer)

Triggered per SQS message. Body: {"alert_id": "..."}.
Runs 5 parallel streaming agents + arbiter, writes verdicts to RDS.
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.verification import verify_alert


def handler(event, context):
    # Pre-warm ping (EventBridge rate(4 minutes)) — keep Lambda hot to dodge
    # ~600ms cold start during demo.
    if isinstance(event, dict) and event.get("warmup"):
        return {"warm": True}

    records = event.get("Records") or []
    failures = []
    for rec in records:
        try:
            body = json.loads(rec.get("body") or "{}")
            alert_id = body.get("alert_id")
            if not alert_id:
                print(f"[verify-alert] missing alert_id in body: {rec.get('body')!r}")
                continue
            verify_alert(alert_id)
        except Exception as e:  # noqa: BLE001
            print(f"[verify-alert] failed message {rec.get('messageId')}: {e}")
            failures.append({"itemIdentifier": rec.get("messageId")})
    # SQS partial-batch-failure response shape
    return {"batchItemFailures": failures}
