import os
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

EC2_URL = os.environ.get("EC2_URL", "http://13.212.182.108")

app = FastAPI(title="SafeSend Mule Detector")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SIGNALS = [
    ("unique_inbound_senders_6h", lambda v: v >= 3,  30),
    ("avg_inbound_gap_minutes",   lambda v: v < 20,  25),
    ("inbound_outbound_ratio",    lambda v: v > 80,  25),
    ("account_age_days",          lambda v: v < 30,  15),
    ("merchant_spend_7d",         lambda v: v == 0,  20),
]


class MuleFeatures(BaseModel):
    account_id: str
    unique_inbound_senders_6h: float = 0.0
    avg_inbound_gap_minutes: float = 999.0
    inbound_outbound_ratio: float = 0.0
    account_age_days: float = 365.0
    merchant_spend_7d: float = 0.0


@app.get("/health")
def health():
    return {"status": "ok", "service": "mule-detector"}


@app.post("/mule-score")
def mule_score(features: MuleFeatures):
    fired, score = [], 0
    for field, condition, weight in SIGNALS:
        val = getattr(features, field, 0)
        if condition(val):
            score += weight
            fired.append({"signal": field, "value": val, "weight": weight})
    score = min(score, 100)

    if score >= 80:   stage, status, withdrawal = 3, "auto_eviction", "blocked"
    elif score >= 60: stage, status, withdrawal = 2, "agent_alert",   "soft_blocked"
    elif score >= 40: stage, status, withdrawal = 1, "watchlist",     "active"
    else:             stage, status, withdrawal = 0, "clear",         "active"

    result = {
        "account_id": features.account_id,
        "mule_score": score,
        "stage": stage,
        "status": status,
        "withdrawal_status": withdrawal,
        "signals_fired": fired,
    }

    # Push result to AWS EC2 so it gets written to S3 + dashboard
    if stage >= 1:
        try:
            requests.post(f"{EC2_URL}/mule-alert", json=result, timeout=5)
        except Exception as e:
            print(f"[mule-detector] EC2 notify failed (non-blocking): {e}")

    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
