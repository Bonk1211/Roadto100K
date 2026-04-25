"""
SafeSend Backend — Configuration & SSM Parameter Loading

Loads environment variables for RDS PostgreSQL, Bedrock, Kinesis, SNS, and EAS.
"""

import os
import boto3
from functools import lru_cache

# ---------------------------------------------------------------------------
# AWS region
# ---------------------------------------------------------------------------
AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")

# ---------------------------------------------------------------------------
# RDS PostgreSQL config
# ---------------------------------------------------------------------------
RDS_HOST     = os.environ.get("RDSHOST", "")
RDS_PORT     = int(os.environ.get("RDSPORT", "5432"))
RDS_DBNAME   = os.environ.get("RDSDBNAME", "postgres")
RDS_USER     = os.environ.get("RDSUSER", "postgres")
RDS_PASSWORD = os.environ.get("RDSPASSWORD", "")

# ---------------------------------------------------------------------------
# Other AWS services
# ---------------------------------------------------------------------------
KINESIS_STREAM  = os.environ.get("KINESIS_STREAM", "safesend-events")
SNS_TOPIC_ARN   = os.environ.get("SNS_TOPIC_ARN", "")
BEDROCK_MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"
)
BEDROCK_REGION  = os.environ.get("BEDROCK_REGION", "ap-southeast-1")

# ---------------------------------------------------------------------------
# Alert TTL (7 days in seconds — stored as timestamptz in Postgres)
# ---------------------------------------------------------------------------
ALERT_TTL_SECONDS = 7 * 24 * 60 * 60

# ---------------------------------------------------------------------------
# Risk thresholds & score weights
# ---------------------------------------------------------------------------
RISK_THRESHOLD_LOW  = 40
RISK_THRESHOLD_HIGH = 70
RULE_WEIGHT         = 0.4
ML_WEIGHT           = 0.6

# EAS timeout (milliseconds)
EAS_TIMEOUT_MS = 800


# ---------------------------------------------------------------------------
# SSM Parameter Store loader (cached per cold start)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _ssm_client():
    return boto3.client("ssm", region_name=AWS_REGION)


@lru_cache(maxsize=10)
def get_ssm_param(name: str, decrypt: bool = True) -> str:
    """Fetch a parameter from SSM Parameter Store (cached for Lambda lifetime)."""
    try:
        resp = _ssm_client().get_parameter(Name=name, WithDecryption=decrypt)
        return resp["Parameter"]["Value"]
    except Exception as e:
        print(f"[config] SSM param {name} unavailable: {e}")
        return ""


def get_eas_endpoint() -> str:
    """Get Alibaba EAS scoring endpoint from SSM or env."""
    return os.environ.get("EAS_ENDPOINT") or get_ssm_param("/safesend/eas-endpoint")


def get_eas_api_key() -> str:
    """Get Alibaba EAS API key from SSM or env."""
    return os.environ.get("EAS_API_KEY") or get_ssm_param("/safesend/eas-api-key")


def get_bedrock_region() -> str:
    """Get Bedrock region from SSM or env (defaults to ap-southeast-1)."""
    return (
        os.environ.get("BEDROCK_REGION")
        or get_ssm_param("/safesend/bedrock-region")
        or "ap-southeast-1"
    )
