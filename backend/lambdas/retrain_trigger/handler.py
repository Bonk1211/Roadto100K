"""
Lambda: retrain-trigger

Triggered by EventBridge on rate(1 day).
POSTs to the EC2 FastAPI /retrain endpoint to kick off model retraining.
"""

import json
import os
import requests

EC2_SCORER_URL = os.environ.get("EC2_SCORER_URL", "http://13.212.182.108")


def handler(event, context):
    retrain_url = f"{EC2_SCORER_URL.rstrip('/')}/retrain"
    print(f"[retrain-trigger] Calling {retrain_url}")
    try:
        resp = requests.post(retrain_url, timeout=300)
        resp.raise_for_status()
        result = resp.json()
        print(f"[retrain-trigger] Success: {result}")
        return {
            "statusCode": 200,
            "body": json.dumps(result),
        }
    except Exception as e:
        print(f"[retrain-trigger] Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
