"""
SafeSend Backend — EC2 ML Scorer Client + Deterministic Fallback

Calls EC2 FastAPI Isolation Forest scorer for ML fraud scoring.
Falls back to rule-based score if EC2 is unreachable.
"""

import requests
from .config import EC2_SCORER_URL, EAS_TIMEOUT_MS


def call_eas(features: dict) -> dict:
    """
    Call EC2 FastAPI scorer for fraud scoring.

    Args:
        features: dict with all 11 model features

    Returns:
        dict with fraud_score (0-100), is_anomaly (bool), model_version
    """
    if not EC2_SCORER_URL:
        print("[scorer] No EC2_SCORER_URL configured, using fallback")
        return _fallback_score(features)

    try:
        resp = requests.post(
            EC2_SCORER_URL,
            json=features,
            timeout=EAS_TIMEOUT_MS / 1000,
        )
        resp.raise_for_status()
        data = resp.json()
        score = data.get("fraud_score", _fallback_score(features)["fraud_score"])
        return {
            "fraud_score": score,
            "is_anomaly": score >= 60,
            "model_version": data.get("model_version", "ec2-isolation-forest"),
        }
    except Exception as e:
        print(f"[scorer] Error calling EC2 scorer: {e}")
        return _fallback_score(features)


def _fallback_score(features: dict) -> dict:
    """Deterministic fallback — fires if EC2 is unreachable."""
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
