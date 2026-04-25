import io
import json
import pickle
import boto3
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sklearn.ensemble import IsolationForest
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BUCKET    = "safesend-ml"
MODEL_KEY = "models/lambda/model.pkl"
CSV_KEY   = "data/raw/safesend_mock_data.csv"
LABELS_KEY = "data/labelled/labels.json"

FEATURES = [
    "amount_ratio", "payee_account_age_days", "is_new_payee", "hour_of_day",
    "device_match", "prior_txns_to_payee", "sender_account_age_days",
    "unique_inbound_senders_6h", "avg_inbound_gap_minutes",
    "inbound_outbound_ratio", "merchant_spend_7d",
]

_cache = {}
_mule_cases = {}  # in-memory mule case store keyed by account_id

app = FastAPI(title="SafeSend Fraud Scorer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _s3():
    return boto3.client("s3", region_name="ap-southeast-1")


def load_model():
    if not _cache:
        obj = _s3().get_object(Bucket=BUCKET, Key=MODEL_KEY)
        artifacts = pickle.loads(obj["Body"].read())
        _cache["model"]    = artifacts["model"]
        _cache["scaler"]   = artifacts["scaler"]
        _cache["features"] = artifacts["features"]
        _cache["loaded_at"] = datetime.now(timezone.utc).isoformat()
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


@app.get("/model-info")
def model_info():
    try:
        s3 = _s3()
        head = s3.head_object(Bucket=BUCKET, Key=MODEL_KEY)
        last_modified = head["LastModified"].isoformat()
        size_kb = round(head["ContentLength"] / 1024, 1)
        cached = load_model()
        return {
            "model_version": last_modified,
            "last_trained": last_modified,
            "size_kb": size_kb,
            "features": cached["features"],
            "scaler": cached["scaler"],
            "bucket": BUCKET,
            "key": MODEL_KEY,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@app.post("/retrain")
def retrain():
    try:
        s3 = _s3()

        # Load base CSV
        obj = s3.get_object(Bucket=BUCKET, Key=CSV_KEY)
        df = pd.read_csv(io.BytesIO(obj["Body"].read()))
        print(f"Base data: {len(df)} rows")

        # Merge agent labels if available
        try:
            obj = s3.get_object(Bucket=BUCKET, Key=LABELS_KEY)
            labels = json.loads(obj["Body"].read().decode())
            if labels:
                label_df = pd.DataFrame(labels)
                df = pd.concat([df, label_df], ignore_index=True)
                print(f"Added {len(label_df)} agent labels. Total: {len(df)} rows")
        except Exception:
            print("No agent labels yet — training on base data only")

        # Train
        X = df[FEATURES].fillna(0)
        X["amount_ratio"] = X["amount_ratio"].clip(upper=20)
        model = IsolationForest(n_estimators=200, contamination=0.10, random_state=42)
        model.fit(X)
        raw_scores = model.decision_function(X)
        scaler = {"min": float(raw_scores.min()), "max": float(raw_scores.max())}

        # Save to S3
        artifact = {"model": model, "scaler": scaler, "features": FEATURES}
        buf = io.BytesIO()
        pickle.dump(artifact, buf, protocol=4)
        buf.seek(0)
        s3.put_object(Bucket=BUCKET, Key=MODEL_KEY, Body=buf.getvalue())
        print("New model.pkl uploaded to S3")

        # Reload cache
        _cache.clear()
        load_model()

        trained_at = datetime.now(timezone.utc).isoformat()
        return {
            "status": "ok",
            "rows_trained": len(df),
            "scaler": scaler,
            "trained_at": trained_at,
            "model_key": MODEL_KEY,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class MuleAlert(BaseModel):
    account_id: str
    mule_score: float
    stage: int
    status: str
    withdrawal_status: str
    signals_fired: list = []


@app.post("/mule-alert")
def mule_alert(alert: MuleAlert):
    """Receive mule detection result from Alibaba ECS or AWS Lambda."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        record = {
            **alert.dict(),
            "detected_at": now,
            "source": "alibaba-ecs" if alert.stage >= 1 else "aws-lambda",
        }

        # Store in memory
        _mule_cases[alert.account_id] = record

        # Persist to S3 for dashboard and retrain pipeline
        try:
            all_cases = list(_mule_cases.values())
            _s3().put_object(
                Bucket=BUCKET,
                Key="data/mule-cases/latest.json",
                Body=json.dumps(all_cases),
                ContentType="application/json",
            )
        except Exception as e:
            print(f"[mule-alert] S3 write failed (non-blocking): {e}")

        print(f"[mule-alert] account={alert.account_id} stage={alert.stage} score={alert.mule_score}")
        return {"status": "ok", "account_id": alert.account_id, "stage": alert.stage}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/mule-cases")
def mule_cases():
    """Return all detected mule cases — polled by agent dashboard."""
    try:
        cases = list(_mule_cases.values())
        # Also try loading from S3 if in-memory is empty (after restart)
        if not cases:
            try:
                obj = _s3().get_object(Bucket=BUCKET, Key="data/mule-cases/latest.json")
                cases = json.loads(obj["Body"].read())
                for c in cases:
                    _mule_cases[c["account_id"]] = c
            except Exception:
                pass
        return {"mule_cases": cases, "total": len(cases)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    load_model()
    uvicorn.run(app, host="0.0.0.0", port=80)
