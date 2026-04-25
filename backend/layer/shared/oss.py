"""
SafeSend Backend — Alibaba OSS compliance label writer.

Mirrors S3 label records to Alibaba OSS for Malaysian data sovereignty
audit trail. Best-effort: missing creds → log + return False, never
blocks the calling Lambda.

Env vars (set via SSM Parameter Store /safesend/oss-* at deploy):
  OSS_ACCESS_KEY_ID
  OSS_ACCESS_KEY_SECRET
  OSS_ENDPOINT          e.g. oss-ap-southeast-3.aliyuncs.com
  OSS_BUCKET            e.g. safesend-labels-my
"""

import json
import os
from datetime import datetime, timezone
from typing import Any

_oss_bucket = None


def _get_bucket():
    global _oss_bucket
    if _oss_bucket is not None:
        return _oss_bucket

    ak = os.environ.get("OSS_ACCESS_KEY_ID", "")
    sk = os.environ.get("OSS_ACCESS_KEY_SECRET", "")
    endpoint = os.environ.get("OSS_ENDPOINT", "")
    bucket_name = os.environ.get("OSS_BUCKET", "")

    if not (ak and sk and endpoint and bucket_name):
        return None

    try:
        import oss2  # type: ignore

        auth = oss2.Auth(ak, sk)
        _oss_bucket = oss2.Bucket(auth, endpoint, bucket_name)
        return _oss_bucket
    except Exception as e:
        print(f"[oss] init failed: {e}")
        return None


def write_label(record: dict[str, Any]) -> bool:
    """
    Append a JSONL label record to today's OSS object.

    Object key: safesend-labels/YYYY-MM-DD.jsonl
    Returns True on success, False otherwise (never raises).
    """
    bucket = _get_bucket()
    if bucket is None:
        print("[oss] credentials missing — skipping (compliance mirror disabled)")
        return False

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"safesend-labels/{today}.jsonl"
    line = json.dumps(record, default=str) + "\n"

    try:
        try:
            existing = bucket.get_object(key).read().decode("utf-8")
        except Exception:
            existing = ""
        bucket.put_object(key, existing + line)
        return True
    except Exception as e:
        print(f"[oss] write_label error: {e}")
        return False


def write_incident_report(report: dict[str, Any], incident_id: str) -> bool:
    """Write a single Bedrock-generated compliance incident report to OSS."""
    bucket = _get_bucket()
    if bucket is None:
        return False

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"safesend-incidents/{today}/{incident_id}.json"
    try:
        bucket.put_object(key, json.dumps(report, default=str, indent=2))
        return True
    except Exception as e:
        print(f"[oss] write_incident_report error: {e}")
        return False
