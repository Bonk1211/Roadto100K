"""
Seed script — Pre-populates SafeSend RDS PostgreSQL tables with demo alerts.
Run before the demo to ensure the agent dashboard is never empty.

Usage:
  # From backend/ directory
  source .venv/bin/activate
  python scripts/seed_demo_data.py
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load env vars before importing shared modules
load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")

# Add shared to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone, timedelta
from shared.db import put_alert, _now
from shared.models import now_iso

def seed():
    print("Seeding RDS PostgreSQL with demo data...")
    
    now = datetime.now(timezone.utc)

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
            "processed_ms": 425,
            "triggered_signals": [
                {"signal": "new_account", "label_en": "Payee account is only 6 days old", "weight": 20},
                {"signal": "new_payee", "label_en": "You have never sent money here before", "weight": 15},
                {"signal": "amount_spike", "label_en": "Amount is 17× your monthly average", "weight": 20},
                {"signal": "late_night", "label_en": "Transaction at 2:15 AM", "weight": 10},
                {"signal": "payee_flagged", "label_en": "Payee linked to 4 flagged accounts", "weight": 30},
            ],
            "bedrock_explanation": {
                "explanation_en": "This account was created just 6 days ago and you have never sent money here before. This transfer matches a known Macau scam pattern.",
                "explanation_bm": "Akaun ini baru dicipta 6 hari lepas dan anda tidak pernah hantar wang ke sini sebelum ini. Pemindahan ini sepadan dengan corak penipuan Macau.",
                "scam_type": "macau_scam",
                "confidence": "high",
            },
            "created_at": (now - timedelta(minutes=2)).isoformat() + "Z",
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
            "processed_ms": 310,
            "triggered_signals": [
                {"signal": "new_account", "label_en": "Payee account is only 11 days old", "weight": 20},
                {"signal": "new_payee", "label_en": "First transfer to this payee", "weight": 15},
                {"signal": "amount_spike", "label_en": "Amount is 12× your average", "weight": 20},
                {"signal": "round_amount", "label_en": "Large round-number transfer", "weight": 5},
            ],
            "bedrock_explanation": {
                "explanation_en": "The payee promises guaranteed returns and the account is brand new.",
                "explanation_bm": "Penerima menjanjikan pulangan terjamin dan akaun ini baru didaftarkan.",
                "scam_type": "investment_scam",
                "confidence": "high",
            },
            "created_at": (now - timedelta(minutes=15)).isoformat() + "Z",
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
            "processed_ms": 285,
            "triggered_signals": [
                {"signal": "new_account", "label_en": "Payee account is only 3 days old", "weight": 20},
                {"signal": "new_payee", "label_en": "First transfer to this payee", "weight": 15},
                {"signal": "amount_spike", "label_en": "Amount is 4× your average", "weight": 20},
            ],
            "bedrock_explanation": {
                "explanation_en": "The payee impersonates LHDN and the account was created 3 days ago.",
                "explanation_bm": "Penerima menyamar sebagai LHDN dan akaun baru 3 hari.",
                "scam_type": "mule_account",
                "confidence": "high",
            },
            "created_at": (now - timedelta(minutes=45)).isoformat() + "Z",
        },
    ]

    for alert in alerts:
        try:
            alert_id = put_alert(alert)
            print(f"  ✓ Seeded {alert['txn_id']} — {alert['scam_type']} (score {alert['final_score']}) -> alert_id: {alert_id}")
        except Exception as e:
            print(f"  ✗ Failed to seed {alert['txn_id']}: {e}")

    print(f"\n✅ Finished seeding demo data to RDS PostgreSQL.")

if __name__ == "__main__":
    seed()
