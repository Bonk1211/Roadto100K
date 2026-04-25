"""
Lambda: fraud-query (F6)

Natural-language fraud query. Bedrock translates English/BM into a
whitelisted JSON filter spec; handler builds parameterised SQL against
the alerts/transactions/accounts join and returns matching alerts.
"""

import json
import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import boto3  # type: ignore
from shared.config import BEDROCK_MODEL_ID, get_bedrock_region
from shared.db import _cursor, _row_to_dict
from shared.models import generate_request_id


# Whitelist: NL field name -> SQL column reference. Only these are queryable.
FIELD_MAP: dict[str, str] = {
    "risk_score": "a.risk_score",
    "status": "a.status",
    "alert_type": "a.alert_type",
    "scam_type": "a.alert_type",
    "stage": "a.stage",
    "priority": "a.priority",
    "created_at": "a.created_at",
    "amount": "t.amount",
    "txn_timestamp": "t.timestamp",
    "is_first_transfer": "t.is_first_transfer",
    "device_match": "t.device_match",
    "channel": "t.channel",
    "sender_account_id": "t.sender_account_id",
    "receiver_account_id": "t.receiver_account_id",
    "account_age_days": "acct.account_age_days",
    "device_fingerprint": "acct.device_fingerprint",
    "ip_address": "acct.ip_address",
}

ALLOWED_OPS = {"=", "!=", ">", ">=", "<", "<=", "ILIKE", "IN"}
ALLOWED_SORT = {"risk_score", "created_at", "amount"}

PROMPT_SCHEMA = """You translate a fraud analyst's natural-language question into a strict JSON filter spec for SafeSend's PostgreSQL alerts database.

Allowed fields (use these exact names):
  risk_score (int 0-100), status (open|blocked|warned|cleared), alert_type (text),
  scam_type (text alias of alert_type), stage (text), priority (low|medium|high),
  created_at (ISO timestamp), amount (numeric), txn_timestamp (ISO timestamp),
  is_first_transfer (bool), device_match (bool), channel (text),
  sender_account_id (text), receiver_account_id (text),
  account_age_days (int), device_fingerprint (text), ip_address (text).

Allowed ops: "=", "!=", ">", ">=", "<", "<=", "ILIKE", "IN".
ILIKE values may use % wildcards. IN values must be a JSON array.

Return ONLY a JSON object with this shape, no commentary:
{{
  "filters": [{{"field": "<name>", "op": "<op>", "value": <value>}}, ...],
  "sort_by": "risk_score" | "created_at" | "amount",
  "limit": <1-100>,
  "summary": "<one-sentence English description of the query>"
}}

If a request mentions a relative time like "last 7 days" or "today", convert
to an ISO date using TODAY = {today}.

Question: {question}
"""


def handler(event, context):
    start = time.time()
    body_raw = event.get("body") or "{}"
    try:
        body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
    except json.JSONDecodeError:
        return _resp(400, {"error": "invalid JSON body"})

    question = str(body.get("query") or body.get("question") or "").strip()
    if not question:
        return _resp(400, {"error": "query field required"})

    try:
        spec = _bedrock_translate(question)
    except Exception as exc:  # noqa: BLE001
        print(f"[fraud_query] bedrock error: {exc}")
        return _resp(502, {"error": "bedrock translation failed", "detail": str(exc)})

    try:
        sql, params = _build_sql(spec)
    except ValueError as exc:
        return _resp(400, {"error": str(exc), "spec": spec})

    try:
        with _cursor() as cur:
            cur.execute(sql, params)
            rows = [_row_to_dict(r) for r in cur.fetchall()]
    except Exception as exc:  # noqa: BLE001
        print(f"[fraud_query] db error: {exc} — sql={sql} params={params}")
        return _resp(500, {"error": "database query failed", "detail": str(exc)})

    return _resp(
        200,
        {
            "request_id": generate_request_id(),
            "question": question,
            "summary": spec.get("summary", ""),
            "spec": spec,
            "alerts": rows,
            "count": len(rows),
            "elapsed_ms": int((time.time() - start) * 1000),
        },
    )


def _bedrock_translate(question: str) -> dict:
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prompt = PROMPT_SCHEMA.format(today=today, question=question)

    client = boto3.client("bedrock-runtime", region_name=get_bedrock_region())
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 512,
            "temperature": 0,
            "messages": [{"role": "user", "content": prompt}],
        }
    )
    resp = client.invoke_model(
        modelId=BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )
    payload = json.loads(resp["body"].read())
    text = payload.get("content", [{}])[0].get("text", "").strip()
    print(f"[fraud_query] bedrock raw text: {text[:600]!r}")

    # Extract first {...} block — Bedrock may add prose or ```json fences.
    import re

    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        if brace:
            text = brace.group(0)
    return json.loads(text)


def _build_sql(spec: dict) -> tuple[str, list[Any]]:
    filters = spec.get("filters") or []
    sort_by = spec.get("sort_by", "risk_score")
    limit = int(spec.get("limit") or 20)
    limit = max(1, min(limit, 100))

    if sort_by not in ALLOWED_SORT:
        sort_by = "risk_score"

    where_parts: list[str] = []
    params: list[Any] = []

    for flt in filters:
        field = str(flt.get("field", ""))
        op = str(flt.get("op", "")).upper() if flt.get("op", "").upper() in {"ILIKE", "IN"} else str(flt.get("op", ""))
        value = flt.get("value")

        col = FIELD_MAP.get(field)
        if not col:
            raise ValueError(f"field '{field}' not allowed")
        if op not in ALLOWED_OPS:
            raise ValueError(f"op '{op}' not allowed")

        if op == "IN":
            if not isinstance(value, list) or not value:
                raise ValueError("IN requires non-empty list value")
            placeholders = ",".join(["%s"] * len(value))
            where_parts.append(f"{col} IN ({placeholders})")
            params.extend(value)
        else:
            where_parts.append(f"{col} {op} %s")
            params.append(value)

    sort_col_map = {
        "risk_score": "a.risk_score",
        "created_at": "a.created_at",
        "amount": "t.amount",
    }
    order_col = sort_col_map[sort_by]

    where_sql = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""

    sql = f"""
        SELECT
            a.alert_id, a.txn_id, a.alert_type, a.risk_score, a.status,
            a.stage, a.priority, a.created_at, a.resolved_at,
            t.amount, t.sender_account_id, t.receiver_account_id, t.timestamp AS txn_timestamp,
            t.is_first_transfer, t.device_match,
            acct.account_age_days
        FROM alerts a
        LEFT JOIN transactions t ON t.txn_id = a.txn_id
        LEFT JOIN accounts acct ON acct.account_id = a.account_id
        {where_sql}
        ORDER BY {order_col} DESC NULLS LAST
        LIMIT %s
    """
    params.append(limit)
    return sql, params


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
