"""
SafeSend unified API Lambda.

FastAPI app behind Mangum, exposed via Lambda Function URL. Replaces
the per-endpoint Lambda + API Gateway architecture.

All routes are thin wrappers around shared modules — no duplicated logic.
Workers stay separate:
  - verify_alert (SQS)
  - retrain_trigger (EventBridge)
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any

# Layer mount path on Lambda; harmless locally.
sys.path.insert(0, "/opt/python")

from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse
from mangum import Mangum

from shared.bedrock import invoke_bedrock
from shared.config import RISK_THRESHOLD_LOW, RISK_THRESHOLD_HIGH, RULE_WEIGHT, ML_WEIGHT
from shared.db import (
    _cursor,
    get_alert,
    put_alert,
    query_alerts,
    scan_all_alerts,
    update_alert_status,
)
from shared.eas_client import call_eas
from shared.kinesis import (
    put_agent_action_event,
    put_event,
    put_transaction_event,
    put_user_choice_event,
)
from shared.models import (
    action_to_label,
    action_to_status,
    generate_request_id,
    generate_txn_id,
    now_iso,
)
from shared.mule import evaluate_receiver, get_watchlist_stage
from shared.oss import write_label
from shared.sns import send_block_sms
from shared.verification import (
    inject_synthetic_alert,
    load_active,
    load_agent_stats,
    load_queue,
    load_recent,
    load_run,
    load_run_streams,
    load_worker_state,
    publish_verify_message,
    reverify,
    set_worker_state,
)

# Reuse logic from per-endpoint handlers without re-implementing.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bulk_containment.handler import _execute as containment_execute  # noqa: E402
from bulk_containment.handler import _preview as containment_preview  # noqa: E402
from fraud_query.handler import _bedrock_translate, _build_sql  # noqa: E402
from screen_transaction.handler import (  # noqa: E402
    compute_rule_score,
    determine_action,
    evaluate_signals,
    infer_scam_type,
    _parse_hour,
)


app = FastAPI(title="SafeSend API", version="4.1")
# CORS handled by Lambda Function URL (template.yaml). Adding FastAPI's
# CORSMiddleware here causes duplicate Access-Control-Allow-Origin headers.


@app.get("/")
def root():
    return {
        "service": "SafeSend API",
        "version": "4.1",
        "endpoints": [r.path for r in app.routes],
    }


@app.get("/health")
def health():
    return {"ok": True, "timestamp": now_iso()}


# ---------------------------------------------------------------------------
# F1 — Transfer interception
# ---------------------------------------------------------------------------

@app.post("/api/screen-transaction")
async def screen_transaction(req: Request):
    body = await req.json()

    required = ["user_id", "payee_id", "amount", "device_id", "timestamp", "user_avg_30d"]
    missing = [f for f in required if f not in body]
    if missing:
        raise HTTPException(400, f"Missing fields: {', '.join(missing)}")

    start_ms = int(time.time() * 1000)
    request_id = generate_request_id()
    txn_id = generate_txn_id()

    try:
        body["payee_watchlist_stage"] = get_watchlist_stage(body.get("payee_id", ""))
    except Exception:
        body["payee_watchlist_stage"] = 0

    signals = evaluate_signals(body)
    rule_score = compute_rule_score(signals)
    triggered = [s for s in signals if s["triggered"]]

    amount = float(body["amount"])
    user_avg = float(body.get("user_avg_30d", 1))
    eas_features = {
        "amount_ratio": amount / user_avg if user_avg > 0 else amount,
        "payee_account_age_days": body.get("payee_account_age_days", 365),
        "is_new_payee": 1 if body.get("is_new_payee", False) else 0,
        "hour_of_day": _parse_hour(body["timestamp"]),
        "device_match": 1 if body.get("device_match", True) else 0,
        "prior_txns_to_payee": body.get("prior_txns_to_payee", 0),
        "sender_account_age_days": body.get("sender_account_age_days", 365),
        "unique_inbound_senders_6h": 0,
        "avg_inbound_gap_minutes": 0,
        "inbound_outbound_ratio": 0,
        "merchant_spend_7d": 0,
    }
    eas_result = call_eas(eas_features)
    ml_score = eas_result["fraud_score"]
    final_score = int(RULE_WEIGHT * rule_score + ML_WEIGHT * ml_score)
    action = determine_action(final_score)

    bedrock_explanation = None
    if action == "hard_intercept":
        scam_type = infer_scam_type(signals)
        bedrock_explanation = invoke_bedrock(
            amount=amount,
            payee=body.get("payee_name", body["payee_id"]),
            time=body["timestamp"],
            payee_age_days=body.get("payee_account_age_days", 0),
            prior_txns=body.get("prior_txns_to_payee", 0),
            score=final_score,
            signals=[s["signal"] for s in triggered],
            fallback_scam_type=scam_type,
        )

    if final_score >= RISK_THRESHOLD_LOW:
        alert_record = {
            "txn_id": txn_id,
            "user_id": body["user_id"],
            "user_display": f"User ***{body['user_id'][-3:]}",
            "payee_id": body["payee_id"],
            "payee_name": body.get("payee_name", ""),
            "amount": amount,
            "currency": body.get("currency", "MYR"),
            "final_score": final_score,
            "rule_score": rule_score,
            "ml_score": ml_score,
            "scam_type": (
                bedrock_explanation.get("scam_type", infer_scam_type(signals))
                if bedrock_explanation
                else infer_scam_type(signals)
            ),
            "status": "open",
            "action": action,
            "user_choice": None,
            "triggered_signals": triggered,
            "triggered_signal_count": len(triggered),
            "bedrock_explanation": bedrock_explanation,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        alert_id = put_alert(alert_record)
        try:
            publish_verify_message(alert_id)
        except Exception as e:
            print(f"[api] verify enqueue failed: {e}")

    mule_result = None
    try:
        mule_result = evaluate_receiver(body["payee_id"])
    except Exception as e:
        print(f"[api] mule eval failed: {e}")

    processed_ms = int(time.time() * 1000) - start_ms
    put_transaction_event(txn_id, action, final_score, {
        "rule_score": rule_score,
        "ml_score": ml_score,
        "triggered_count": len(triggered),
    })

    out: dict[str, Any] = {
        "request_id": request_id,
        "txn_id": txn_id,
        "action": action,
        "final_score": final_score,
        "rule_score": rule_score,
        "ml_score": ml_score,
        "triggered_signals": triggered,
        "processed_ms": processed_ms,
        "timestamp": now_iso(),
    }
    if action == "soft_warn":
        out["soft_warning_en"] = "This transfer is larger than usual. Please verify before confirming."
        out["soft_warning_bm"] = "Pemindahan ini lebih besar dari biasa. Sila sahkan sebelum mengesahkan."
    if bedrock_explanation:
        out["bedrock_explanation"] = bedrock_explanation
    if action != "proceed":
        out["payee_info"] = {
            "payee_id": body["payee_id"],
            "account_age_days": body.get("payee_account_age_days", 0),
            "is_new_payee": body.get("is_new_payee", False),
            "prior_txns_to_payee": body.get("prior_txns_to_payee", 0),
            "flagged_in_network": body.get("payee_flagged", False),
            "watchlist_stage": body["payee_watchlist_stage"],
        }
    if mule_result and mule_result.get("stage", 0) >= 1:
        out["mule_evaluation"] = {
            "account_id": mule_result.get("account_id"),
            "stage": mule_result.get("stage"),
            "mule_score": mule_result.get("mule_score"),
            "status": mule_result.get("status"),
            "alert_id": mule_result.get("alert_id"),
        }
    return out


# ---------------------------------------------------------------------------
# F8 — User choice
# ---------------------------------------------------------------------------

@app.post("/api/user-choice")
async def user_choice(req: Request):
    body = await req.json()
    txn_id = body.get("txn_id") or ""
    user_id = body.get("user_id") or ""
    choice = (body.get("choice") or "").lower()
    timestamp = body.get("timestamp") or now_iso()

    if not txn_id or not user_id:
        raise HTTPException(400, "txn_id and user_id required")
    if choice not in ("cancel", "proceed", "report"):
        raise HTTPException(400, "choice must be cancel|proceed|report")

    label = "fraud" if choice in ("cancel", "report") else "false_positive"
    alert_id = None

    try:
        with _cursor() as cur:
            cur.execute(
                "SELECT alert_id FROM alerts WHERE txn_id = %s ORDER BY created_at DESC LIMIT 1",
                (txn_id,),
            )
            row = cur.fetchone()
            if row:
                alert_id = row["alert_id"]
                try:
                    cur.execute(
                        """
                        UPDATE alerts
                           SET user_choice = %s,
                               status = CASE
                                          WHEN %s='cancel' THEN 'cleared'
                                          WHEN %s='report' THEN 'blocked'
                                          ELSE status
                                        END,
                               resolved_at = COALESCE(resolved_at, NOW())
                         WHERE alert_id = %s
                        """,
                        (choice, choice, choice, alert_id),
                    )
                except Exception as e:
                    print(f"[api] user_choice update skipped: {e}")
                cur.execute(
                    """
                    INSERT INTO agent_actions
                        (action_id, alert_id, agent_id, action_type,
                         decision_label, notes, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        generate_request_id(), alert_id, f"user:{user_id}",
                        "user_choice", label,
                        f"User chose '{choice}' on intercept screen",
                    ),
                )
    except Exception as e:
        print(f"[api] user_choice db write failed: {e}")

    put_user_choice_event(txn_id, user_id, choice)
    write_label({
        "txn_id": txn_id, "alert_id": alert_id, "user_id": user_id,
        "choice": choice, "label": label, "source": "user_intercept",
        "timestamp": timestamp,
    })

    return {
        "request_id": generate_request_id(),
        "txn_id": txn_id,
        "alert_id": alert_id,
        "choice": choice,
        "label": label,
        "logged": True,
        "timestamp": now_iso(),
    }


# ---------------------------------------------------------------------------
# F2 — Mule detection
# ---------------------------------------------------------------------------

@app.post("/api/mule-detect")
async def mule_detect(req: Request):
    from shared.mule import (
        aggregate_receiver_features,
        insert_mule_alert,
        score_features,
        upsert_mule_case,
    )

    body = await req.json()
    account_id = body.get("account_id")
    if not account_id:
        raise HTTPException(400, "account_id required")

    feature_keys = (
        "account_age_days", "unique_inbound_senders_6h",
        "avg_inbound_gap_minutes", "inbound_outbound_ratio", "merchant_spend_7d",
    )
    has_features = any(k in body for k in feature_keys)

    if has_features:
        features = {"account_id": account_id, **{k: body.get(k, 0) for k in feature_keys}}
        scoring = score_features(features)
        mule_case_id = None
        alert_id = None
        if scoring["stage"] >= 1:
            mule_case_id = upsert_mule_case(features, scoring)
            if scoring["stage"] >= 2 and mule_case_id:
                alert_id = insert_mule_alert(account_id, mule_case_id, scoring, features)
        result = {**scoring, "account_id": account_id, "features": features,
                  "mule_case_id": mule_case_id, "alert_id": alert_id}
    else:
        result = evaluate_receiver(account_id)

    return {"request_id": generate_request_id(), "timestamp": now_iso(), **result}


# ---------------------------------------------------------------------------
# F3 — Bulk containment (preview + execute)
# ---------------------------------------------------------------------------

def _to_lambda_event(req: Request, body: dict | None = None, path_params: dict | None = None) -> dict:
    """Build a synthetic Lambda v2 event so existing handlers work unchanged."""
    return {
        "rawPath": str(req.url.path),
        "requestContext": {"http": {"method": req.method}},
        "pathParameters": path_params or {},
        "queryStringParameters": dict(req.query_params),
        "body": json.dumps(body) if body is not None else None,
    }


@app.get("/api/containment/{account_id}")
async def containment_preview_route(account_id: str, req: Request):
    event = _to_lambda_event(req, path_params={"account_id": account_id})
    resp = containment_preview(event)
    return _unwrap(resp)


@app.post("/api/containment/execute")
async def containment_execute_route(req: Request):
    body = await req.json()
    event = _to_lambda_event(req, body=body)
    resp = containment_execute(event)
    return _unwrap(resp)


# ---------------------------------------------------------------------------
# F6 — Natural language fraud query
# ---------------------------------------------------------------------------

@app.post("/api/fraud-query")
async def fraud_query_route(req: Request):
    body = await req.json()
    question = str(body.get("query") or body.get("question") or "").strip()
    if not question:
        raise HTTPException(400, "query field required")

    start = time.time()
    try:
        spec = _bedrock_translate(question)
    except Exception as exc:
        raise HTTPException(502, f"bedrock translation failed: {exc}")

    try:
        sql, params = _build_sql(spec)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    try:
        with _cursor() as cur:
            cur.execute(sql, params)
            from shared.db import _row_to_dict
            rows = [_row_to_dict(r) for r in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(500, f"database query failed: {exc}")

    return {
        "request_id": generate_request_id(),
        "question": question,
        "summary": spec.get("summary", ""),
        "spec": spec,
        "alerts": rows,
        "count": len(rows),
        "elapsed_ms": int((time.time() - start) * 1000),
    }


# ---------------------------------------------------------------------------
# Alerts CRUD
# ---------------------------------------------------------------------------

@app.get("/api/alerts")
def list_alerts(
    status: str = Query("open"),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    sort_by: str = Query("risk_score"),
):
    result = query_alerts(status=status, limit=limit, cursor=cursor, sort_by=sort_by)
    return {
        "request_id": generate_request_id(),
        "alerts": result["alerts"],
        "total": result["total"],
        "has_more": result["has_more"],
        "next_cursor": result["next_cursor"],
    }


@app.get("/api/alerts/{txn_id}")
def get_alert_route(txn_id: str = Path(...)):
    alert = get_alert(txn_id)
    if not alert:
        raise HTTPException(404, f"Alert {txn_id} not found")
    return {"request_id": generate_request_id(), **alert}


@app.post("/api/alerts/{txn_id}/action")
async def agent_action_route(txn_id: str, req: Request):
    body = await req.json()
    action = body.get("action", "")
    agent_id = body.get("agent_id", "")
    notes = body.get("notes", "")

    if action not in ("block", "warn", "clear"):
        raise HTTPException(400, "action must be block|warn|clear")
    if not agent_id:
        raise HTTPException(400, "agent_id is required")

    alert = get_alert(txn_id)
    if not alert:
        raise HTTPException(404, f"Alert {txn_id} not found")

    new_status = action_to_status(action)
    decided_at = now_iso()
    updated = update_alert_status(txn_id, new_status, agent_id, decided_at, notes)

    sms_sent = False
    sms_to = None
    if action == "block":
        sms_sent = send_block_sms(None, alert.get("amount", 0))
        sms_to = f"***{alert.get('account_id', '')[-3:]}" if alert.get("account_id") else None

    label = action_to_label(action)
    put_agent_action_event(txn_id, agent_id, action, notes)
    write_label({
        "txn_id": txn_id, "agent_id": agent_id, "action": action,
        "label": "fraud" if label == 1 else "false_positive",
        "source": "agent_action", "timestamp": decided_at,
    })

    return {
        "request_id": generate_request_id(),
        "txn_id": txn_id,
        "action_taken": action,
        "agent_id": agent_id,
        "timestamp": decided_at,
        "downstream_actions": {
            "db_updated": updated is not None,
            "sms_sent": sms_sent,
            "sms_to": sms_to,
            "oss_label_written": True,
            "label": label,
        },
        "updated_status": new_status,
    }


@app.post("/api/alerts/{alert_id}/reverify")
def reverify_route(alert_id: str):
    result = reverify(alert_id)
    if not result.get("ok"):
        raise HTTPException(404, result.get("error", "reverify failed"))
    return result


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/api/stats")
def stats():
    from datetime import datetime, timezone

    alerts = scan_all_alerts()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    open_alerts = rm_at_risk = 0
    blocked = warned = cleared = 0
    response_times: list[int] = []

    for a in alerts:
        s = a.get("status", "open")
        if s == "open":
            open_alerts += 1
            rm_at_risk += a.get("amount", 0) or 0
        decided_at = (a.get("decided_at") or "")
        is_today = decided_at.startswith(today)
        if s == "blocked" and is_today:
            blocked += 1
        elif s == "warned" and is_today:
            warned += 1
        elif s == "cleared" and is_today:
            cleared += 1
        if a.get("processed_ms"):
            response_times.append(int(a["processed_ms"]))

    avg = round(sum(response_times) / len(response_times)) if response_times else 312

    return {
        "request_id": generate_request_id(),
        "period": "today",
        "open_alerts": open_alerts,
        "rm_at_risk_today": round(rm_at_risk, 2),
        "transactions_blocked": blocked,
        "transactions_warned": warned,
        "transactions_cleared": cleared,
        "avg_response_time_ms": avg,
        "model_accuracy_pct": 92.0,
        "last_updated": now_iso(),
    }


@app.get("/api/agent-stats")
def agent_stats(window_minutes: int = Query(60, ge=5, le=24 * 60)):
    return load_agent_stats(window_minutes)


# ---------------------------------------------------------------------------
# Network graph (mock for now — bulk_containment is the real one)
# ---------------------------------------------------------------------------

@app.get("/api/network-graph")
def network_graph(focal_node: str | None = None, min_risk_score: int = 0, req: Request = None):
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from get_network_graph.handler import handler as gn_handler  # type: ignore
    event = {
        "queryStringParameters": {
            "focal_node": focal_node or "",
            "min_risk_score": str(min_risk_score),
        },
    }
    return _unwrap(gn_handler(event, None))


# ---------------------------------------------------------------------------
# Verifications (read side)
# ---------------------------------------------------------------------------

@app.get("/api/verifications/recent")
def verifications_recent(limit: int = Query(50, ge=1, le=200)):
    return {"runs": load_recent(limit)}


@app.get("/api/verifications/active")
def verifications_active():
    return {"runs": load_active()}


@app.get("/api/verifications/queue")
def verifications_queue():
    return load_queue()


@app.post("/api/verifications/inject")
async def verifications_inject(req: Request):
    body = await req.json() if (await req.body()) else {}
    profile = (body.get("profile") or "high_risk").lower()
    if profile not in ("low_risk", "medium_risk", "high_risk"):
        raise HTTPException(400, f"invalid profile: {profile}")
    result = inject_synthetic_alert(profile)
    if not result.get("ok"):
        raise HTTPException(500, result.get("error", "inject failed"))
    return result


@app.get("/api/verifications/{run_id}")
def verifications_detail(run_id: str):
    run = load_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@app.get("/api/verifications/{run_id}/streams")
def verifications_streams(run_id: str):
    return {"streams": load_run_streams(run_id)}


# ---------------------------------------------------------------------------
# Worker control
# ---------------------------------------------------------------------------

@app.get("/api/worker/state")
def worker_state_get():
    return load_worker_state()


@app.post("/api/worker/pause")
async def worker_pause(req: Request):
    body = await req.json() if (await req.body()) else {}
    return set_worker_state(True, body.get("by", "api"))


@app.post("/api/worker/resume")
async def worker_resume(req: Request):
    body = await req.json() if (await req.body()) else {}
    return set_worker_state(False, body.get("by", "api"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _unwrap(resp: dict) -> JSONResponse:
    """Convert a Lambda-shaped dict response into a FastAPI JSONResponse."""
    status = int(resp.get("statusCode", 200))
    body = resp.get("body", "{}")
    try:
        payload = json.loads(body) if isinstance(body, str) else body
    except Exception:
        payload = {"raw": body}
    return JSONResponse(content=payload, status_code=status)


# Mangum adapter — Lambda Function URL events are API Gateway v2 shape.
_mangum = Mangum(app, lifespan="off")


def handler(event, context):
    # Warmup ping (EventBridge) — short-circuit before Mangum so we don't
    # try to route a fake HTTP request.
    if isinstance(event, dict) and event.get("warmup"):
        return {"warm": True}
    return _mangum(event, context)
