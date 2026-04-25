"""
SafeSend Backend — Alibaba EAS Client + Deterministic Fallback

Calls Alibaba EAS Isolation Forest model for ML fraud scoring.
Falls back to rule-based score if EAS is unreachable.
"""

import json
import requests
from .config import get_eas_endpoint, get_eas_api_key, EAS_TIMEOUT_MS

def call_eas(features: dict) -> dict:
    """
    Call Alibaba EAS for fraud scoring.
    
    Args:
        features: dict with amount_ratio, payee_account_age_days,
                  is_new_payee, hour_of_day, device_match, prior_txns_to_payee
    
    Returns:
        dict with fraud_score (0-100), is_anomaly (bool), model_version
    """
    endpoint = get_eas_endpoint()
    api_key = get_eas_api_key()

    if not endpoint:
        print("[eas] No endpoint configured, using fallback")
        return _fallback_score(features)

    payload = {"instances": [features]}

    try:
        resp = requests.post(
            endpoint,
            json=payload,
            headers={"Authorization": api_key} if api_key else {},
            timeout=EAS_TIMEOUT_MS / 1000,
        )
        resp.raise_for_status()
        data = resp.json()
        prediction = data.get("predictions", [{}])[0]
        return {
            "fraud_score": prediction.get("fraud_score", _fallback_score(features)["fraud_score"]),
            "is_anomaly": prediction.get("is_anomaly", False),
            "model_version": prediction.get("model_version", "fallback"),
        }
    except Exception as e:
        print(f"[eas] Error calling EAS: {e}")
        return _fallback_score(features)


def _fallback_score(features: dict) -> dict:
    """
    Deterministic fallback score (PRD Section 4 — Person C):
    if amount_ratio > 3 and is_new_payee → score 85, else score 20
    """
    amount_ratio = features.get("amount_ratio", 0)
    is_new = features.get("is_new_payee", 0)

    if amount_ratio > 3 and is_new:
        score = 85
    elif amount_ratio > 3:
        score = 55
    elif is_new:
        score = 45
    else:
        score = 20

    return {
        "fraud_score": score,
        "is_anomaly": score > 50,
        "model_version": "fallback-deterministic",
    }
