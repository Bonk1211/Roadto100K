"""
Seed script — Pre-populates SafeSendAlerts DynamoDB table with demo alerts.
Run before the demo to ensure the agent dashboard is never empty.

Usage:
  python scripts/seed_demo_data.py
"""

import boto3
import time
import os
from datetime import datetime, timezone, timedelta

AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")
TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "SafeSendAlerts")
TTL_DAYS = 7


def seed():
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    table = dynamodb.Table(TABLE_NAME)

    now = datetime.now(timezone.utc)
    expires = int((now + timedelta(days=TTL_DAYS)).timestamp())

    alerts = [
        {
            "txn_id": "TXN-DEMO-001",
            "user_id": "USR-00123",
            "user_display": "User ***123",
            "payee_id": "60123456789",
            "payee_name": "Ahmad Rahman",
            "amount": 8000.00,
            "currency": "MYR",
            "final_score": 87,
            "rule_score": 80,
            "ml_score": 91,
            "scam_type": "macau_scam",
            "status": "open",
            "action": "hard_intercept",
            "triggered_signal_count": 5,
            "triggered_signals": [
                {"signal": "new_account", "label_en": "Payee account is only 6 days old", "label_bm": "Akaun penerima hanya 6 hari", "weight": 20, "triggered": True},
                {"signal": "new_payee", "label_en": "You have never sent money here before", "label_bm": "Anda tidak pernah hantar wang ke sini", "weight": 15, "triggered": True},
                {"signal": "amount_spike", "label_en": "Amount is 17× your monthly average", "label_bm": "Jumlah adalah 17× purata bulanan anda", "weight": 20, "triggered": True},
                {"signal": "late_night", "label_en": "Transaction at 2:15 AM", "label_bm": "Transaksi pada pukul 2:15 pagi", "weight": 10, "triggered": True},
                {"signal": "payee_flagged", "label_en": "Payee linked to 4 flagged accounts", "label_bm": "Penerima dikaitkan dengan 4 akaun ditandakan", "weight": 30, "triggered": True},
            ],
            "bedrock_explanation": {
                "explanation_en": "This account was created just 6 days ago and you have never sent money here before. This transfer matches a known Macau scam pattern.",
                "explanation_bm": "Akaun ini baru dicipta 6 hari lepas dan anda tidak pernah hantar wang ke sini sebelum ini. Pemindahan ini sepadan dengan corak penipuan Macau.",
                "scam_type": "macau_scam",
                "confidence": "high",
            },
            "created_at": (now - timedelta(minutes=2)).isoformat() + "Z",
            "updated_at": (now - timedelta(minutes=2)).isoformat() + "Z",
            "expires_at": expires,
        },
        {
            "txn_id": "TXN-DEMO-002",
            "user_id": "USR-00456",
            "user_display": "User ***456",
            "payee_id": "60198765432",
            "payee_name": "Investment Pro Trading",
            "amount": 5000.00,
            "currency": "MYR",
            "final_score": 78,
            "rule_score": 70,
            "ml_score": 83,
            "scam_type": "investment_scam",
            "status": "open",
            "action": "hard_intercept",
            "triggered_signal_count": 4,
            "triggered_signals": [
                {"signal": "new_account", "label_en": "Payee account is only 11 days old", "label_bm": "Akaun penerima hanya 11 hari", "weight": 20, "triggered": True},
                {"signal": "new_payee", "label_en": "First transfer to this payee", "label_bm": "Pemindahan pertama ke penerima ini", "weight": 15, "triggered": True},
                {"signal": "amount_spike", "label_en": "Amount is 12× your average", "label_bm": "Jumlah adalah 12× purata anda", "weight": 20, "triggered": True},
                {"signal": "round_amount", "label_en": "Large round-number transfer", "label_bm": "Pemindahan nombor bulat besar", "weight": 5, "triggered": True},
            ],
            "bedrock_explanation": {
                "explanation_en": "The payee promises guaranteed returns and the account is brand new.",
                "explanation_bm": "Penerima menjanjikan pulangan terjamin dan akaun ini baru didaftarkan.",
                "scam_type": "investment_scam",
                "confidence": "high",
            },
            "created_at": (now - timedelta(minutes=15)).isoformat() + "Z",
            "updated_at": (now - timedelta(minutes=15)).isoformat() + "Z",
            "expires_at": expires,
        },
        {
            "txn_id": "TXN-DEMO-003",
            "user_id": "USR-00789",
            "user_display": "User ***789",
            "payee_id": "60155443322",
            "payee_name": "LHDN Pengesahan",
            "amount": 3200.00,
            "currency": "MYR",
            "final_score": 65,
            "rule_score": 60,
            "ml_score": 68,
            "scam_type": "mule_account",
            "status": "open",
            "action": "soft_warn",
            "triggered_signal_count": 3,
            "triggered_signals": [
                {"signal": "new_account", "label_en": "Payee account is only 3 days old", "label_bm": "Akaun penerima hanya 3 hari", "weight": 20, "triggered": True},
                {"signal": "new_payee", "label_en": "First transfer to this payee", "label_bm": "Pemindahan pertama", "weight": 15, "triggered": True},
                {"signal": "amount_spike", "label_en": "Amount is 4× your average", "label_bm": "Jumlah adalah 4× purata anda", "weight": 20, "triggered": True},
            ],
            "bedrock_explanation": {
                "explanation_en": "The payee impersonates LHDN and the account was created 3 days ago.",
                "explanation_bm": "Penerima menyamar sebagai LHDN dan akaun baru 3 hari.",
                "scam_type": "mule_account",
                "confidence": "high",
            },
            "created_at": (now - timedelta(minutes=45)).isoformat() + "Z",
            "updated_at": (now - timedelta(minutes=45)).isoformat() + "Z",
            "expires_at": expires,
        },
    ]

    for alert in alerts:
        from decimal import Decimal
        # Convert floats to Decimal for DynamoDB
        item = _convert_floats(alert)
        table.put_item(Item=item)
        print(f"  ✓ Seeded {alert['txn_id']} — {alert['scam_type']} (score {alert['final_score']})")

    print(f"\n✅ Seeded {len(alerts)} demo alerts to {TABLE_NAME}")


def _convert_floats(obj):
    from decimal import Decimal
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats(i) for i in obj]
    return obj


if __name__ == "__main__":
    seed()
