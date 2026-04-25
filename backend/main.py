import boto3, pickle, numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BUCKET = "safesend-ml"
MODEL_KEY = "models/lambda/model.pkl"
_cache = {}

app = FastAPI(title="SafeSend Fraud Scorer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_model():
    if not _cache:
        s3 = boto3.client("s3", region_name="ap-southeast-1")
        obj = s3.get_object(Bucket=BUCKET, Key=MODEL_KEY)
        artifacts = pickle.loads(obj["Body"].read())
        _cache["model"]    = artifacts["model"]
        _cache["scaler"]   = artifacts["scaler"]
        _cache["features"] = artifacts["features"]
        print(f"Model loaded. Features: {_cache['features']}")
    return _cache

class Features(BaseModel):
    amount_ratio: float = 0.0
    payee_account_age_days: float = 0.0
    is_new_payee: float = 0.0
    hour_of_day: float = 0.0
    device_match: float = 0.0
    prior_txns_to_payee: float = 0.0
    sender_account_age_days: float = 0.0
    unique_inbound_senders_6h: float = 0.0
    avg_inbound_gap_minutes: float = 0.0
    inbound_outbound_ratio: float = 0.0
    merchant_spend_7d: float = 0.0

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/score")
def score(features: Features):
    try:
        artifacts  = load_model()
        model      = artifacts["model"]
        scaler     = artifacts["scaler"]
        feat_names = artifacts["features"]
        feat_dict  = features.dict()
        X   = np.array([[float(feat_dict.get(f, 0.0)) for f in feat_names]])
        raw = model.decision_function(X)[0]
        s   = (1.0 - (raw - scaler["min"]) / (scaler["max"] - scaler["min"])) * 100.0
        s   = float(np.clip(s, 0.0, 100.0))
        if s >= 80:   label, action = "mule",   "block"
        elif s >= 60: label, action = "fraud",  "block"
        elif s >= 40: label, action = "normal", "warn"
        else:         label, action = "normal", "approve"
        return {"fraud_score": round(s, 2), "label": label, "action": action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    load_model()
    uvicorn.run(app, host="0.0.0.0", port=80)
