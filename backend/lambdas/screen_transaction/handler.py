"""
Lambda: screen-transaction

Rule engine + orchestrator. The core of SafeSend Layer 2.

Flow:
1. Parse transaction request
2. Evaluate 7 risk signals → rule_score (0-100)
3. Call Alibaba EAS for ML score (0-100) 
4. Compute final_score = 0.4 * rule_score + 0.6 * ml_score
5. Determine action: proceed / soft_warn / hard_intercept
6. If hard_intercept → call Bedrock for bilingual explanation
7. Write alert to PostgreSQL (if score > 40)
8. Publish event to Kinesis
9. Return response per PRD Section 7.2
"""

import json
import time
import sys
import os

# Add shared to path for Lambda packaging
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.config import RISK_THRESHOLD_LOW, RISK_THRESHOLD_HIGH, RULE_WEIGHT, ML_WEIGHT
from shared.models import generate_request_id, generate_txn_id, now_iso
from shared.db import put_alert
from shared.kinesis import put_transaction_event
from shared.bedrock import invoke_bedrock
from shared.eas_client import call_eas
from shared.verification import publish_verify_message


# ---------------------------------------------------------------------------
# Risk signal definitions (PRD Section 5 — 7 signals)
# ---------------------------------------------------------------------------
def evaluate_signals(txn: dict) -> list[dict]:
    """Evaluate all 7 risk signals and return list with triggered status."""
    amount = txn.get("amount", 0)
    user_avg = txn.get("user_avg_30d", 1)
    amount_ratio = amount / user_avg if user_avg > 0 else amount
    hour = _parse_hour(txn.get("timestamp", ""))
    payee_age = txn.get("payee_account_age_days", 9999)
    is_new = txn.get("is_new_payee", False)
    device_match = txn.get("device_match", True)
    prior_txns = txn.get("prior_txns_to_payee", 0)
    payee_flagged = txn.get("payee_flagged", False)

    signals = [
        {
            "signal": "new_account",
            "label_en": f"Payee account is only {payee_age} days old",
            "label_bm": f"Akaun penerima hanya {payee_age} hari",
            "weight": 20,
            "triggered": payee_age < 14,
        },
        {
            "signal": "new_payee",
            "label_en": "You have never sent money here before",
            "label_bm": "Anda tidak pernah hantar wang ke sini sebelum ini",
            "weight": 15,
            "triggered": bool(is_new) or prior_txns == 0,
        },
        {
            "signal": "amount_spike",
            "label_en": f"Amount is {amount_ratio:.0f}× your monthly average",
            "label_bm": f"Jumlah adalah {amount_ratio:.0f}× purata bulanan anda",
            "weight": 20,
            "triggered": amount_ratio > 3.0,
        },
        {
            "signal": "late_night",
            "label_en": f"Transaction at {hour}:00",
            "label_bm": f"Transaksi pada pukul {hour}:00",
            "weight": 10,
            "triggered": hour >= 22 or hour < 6,
        },
        {
            "signal": "device_mismatch",
            "label_en": "Different device from usual",
            "label_bm": "Peranti berbeza dari biasa",
            "weight": 15,
            "triggered": not device_match,
        },
        {
            "signal": "payee_flagged",
            "label_en": "Payee linked to flagged accounts",
            "label_bm": "Penerima dikaitkan dengan akaun yang ditandakan",
            "weight": 30,
            "triggered": bool(payee_flagged),
        },
        {
            "signal": "round_amount",
            "label_en": "Large round-number transfer",
            "label_bm": "Pemindahan nombor bulat yang besar",
            "weight": 5,
            "triggered": amount > 5000 and amount % 1000 == 0,
        },
    ]
    return signals


def compute_rule_score(signals: list[dict]) -> int:
    """Sum weights of triggered signals, capped at 100."""
    total = sum(s["weight"] for s in signals if s["triggered"])
    return min(total, 100)


def determine_action(final_score: int) -> str:
    """Map final score to action per PRD thresholds."""
    if final_score < RISK_THRESHOLD_LOW:
        return "proceed"
    elif final_score <= RISK_THRESHOLD_HIGH:
        return "soft_warn"
    else:
        return "hard_intercept"


def infer_scam_type(signals: list[dict]) -> str:
    """Infer most likely scam type from triggered signals."""
    triggered = {s["signal"] for s in signals if s["triggered"]}
    if "new_account" in triggered and "late_night" in triggered and "amount_spike" in triggered:
        return "macau_scam"
    if "payee_flagged" in triggered and "late_night" not in triggered:
        return "mule_account"
    if "device_mismatch" in triggered and "late_night" in triggered:
        return "account_takeover"
    if "amount_spike" in triggered and "new_payee" in triggered:
        return "investment_scam"
    return "macau_scam"


def _parse_hour(timestamp: str) -> int:
    """Extract hour from ISO timestamp string."""
    try:
        # Parse "2026-04-25T02:15:00Z" → 2
        t_idx = timestamp.index("T")
        hour_str = timestamp[t_idx + 1 : t_idx + 3]
        return int(hour_str)
    except (ValueError, IndexError):
        return 12  # default to noon


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------
def handler(event, context):
    """AWS Lambda handler for POST /api/screen-transaction."""
    start_ms = int(time.time() * 1000)

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return _error_response(400, "VALIDATION_ERROR", "Invalid JSON body")

    # Validate required fields
    required = ["user_id", "payee_id", "amount", "device_id", "timestamp", "user_avg_30d"]
    missing = [f for f in required if f not in body]
    if missing:
        return _error_response(400, "VALIDATION_ERROR", f"Missing fields: {', '.join(missing)}")

    request_id = generate_request_id()
    txn_id = generate_txn_id()

    # --- Step 1: Evaluate risk signals ---
    signals = evaluate_signals(body)
    rule_score = compute_rule_score(signals)
    triggered_signals = [s for s in signals if s["triggered"]]

    # --- Step 2: Call EAS for ML score ---
    amount = float(body["amount"])
    user_avg = float(body.get("user_avg_30d", 1))
    eas_features = {
        "amount_ratio": amount / user_avg if user_avg > 0 else amount,
        "payee_account_age_days": body.get("payee_account_age_days", 365),
        "is_new_payee": 1 if body.get("is_new_payee", False) else 0,
        "hour_of_day": _parse_hour(body["timestamp"]),
        "device_match": 1 if body.get("device_match", True) else 0,
        "prior_txns_to_payee": body.get("prior_txns_to_payee", 0),
    }
    eas_result = call_eas(eas_features)
    ml_score = eas_result["fraud_score"]

    # --- Step 3: Compute final score ---
    final_score = int(RULE_WEIGHT * rule_score + ML_WEIGHT * ml_score)
    action = determine_action(final_score)

    # --- Step 4: Bedrock explanation (only for hard_intercept) ---
    bedrock_explanation = None
    if action == "hard_intercept":
        scam_type = infer_scam_type(signals)
        signal_names = [s["signal"] for s in triggered_signals]
        bedrock_explanation = invoke_bedrock(
            amount=amount,
            payee=body.get("payee_name", body["payee_id"]),
            time=body["timestamp"],
            payee_age_days=body.get("payee_account_age_days", 0),
            prior_txns=body.get("prior_txns_to_payee", 0),
            score=final_score,
            signals=signal_names,
            fallback_scam_type=scam_type,
        )

    # --- Step 5: Write alert to PostgreSQL (if score >= 40) ---
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
            "scam_type": bedrock_explanation.get("scam_type", infer_scam_type(signals)) if bedrock_explanation else infer_scam_type(signals),
            "status": "open",
            "action": action,
            "user_choice": None,
            "triggered_signals": triggered_signals,
            "triggered_signal_count": len(triggered_signals),
            "bedrock_explanation": bedrock_explanation,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        alert_id = put_alert(alert_record)
        # Hand off to autonomous fraud-verify worker (SQS → verify_alert Lambda).
        # Failure here must not break screening: log + continue.
        try:
            publish_verify_message(alert_id)
        except Exception as e:  # noqa: BLE001
            print(f"[screen-transaction] verify enqueue failed for {alert_id}: {e}")

    # --- Step 6: Publish to Kinesis ---
    processed_ms = int(time.time() * 1000) - start_ms
    put_transaction_event(txn_id, action, final_score, {
        "rule_score": rule_score,
        "ml_score": ml_score,
        "triggered_count": len(triggered_signals),
    })

    # --- Build response ---
    response_body = {
        "request_id": request_id,
        "txn_id": txn_id,
        "action": action,
        "final_score": final_score,
        "rule_score": rule_score,
        "ml_score": ml_score,
        "triggered_signals": triggered_signals,
        "processed_ms": processed_ms,
        "timestamp": now_iso(),
    }

    if action == "soft_warn":
        response_body["soft_warning_en"] = "This transfer is larger than usual. Please verify before confirming."
        response_body["soft_warning_bm"] = "Pemindahan ini lebih besar dari biasa. Sila sahkan sebelum mengesahkan."

    if bedrock_explanation:
        response_body["bedrock_explanation"] = bedrock_explanation

    if action != "proceed":
        response_body["payee_info"] = {
            "payee_id": body["payee_id"],
            "account_age_days": body.get("payee_account_age_days", 0),
            "is_new_payee": body.get("is_new_payee", False),
            "prior_txns_to_payee": body.get("prior_txns_to_payee", 0),
            "flagged_in_network": body.get("payee_flagged", False),
        }

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(response_body),
    }


def _error_response(status: int, code: str, message: str) -> dict:
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps({
            "error": True,
            "code": code,
            "message": message,
            "request_id": generate_request_id(),
        }),
    }


def _cors_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }
