"""
Lambda: analyse-message

Layer 1 NLP rule engine. Scans pasted message text for scam phrases
using regex + keyword matching against a scam phrase dictionary.
Returns risk classification, matched patterns, and bilingual warnings.
"""

import json
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.models import generate_request_id, now_iso

# ---------------------------------------------------------------------------
# Scam phrase dictionary (PRD Section 5 — Layer 1)
# ---------------------------------------------------------------------------
PATTERNS = [
    # Government impersonation
    {"pattern": "lhdn", "category": "government_impersonation", "weight": 3},
    {"pattern": "pdrm", "category": "government_impersonation", "weight": 3},
    {"pattern": "sprm", "category": "government_impersonation", "weight": 3},
    {"pattern": "bnm", "category": "government_impersonation", "weight": 3},
    {"pattern": "polis", "category": "government_impersonation", "weight": 2},
    # Bank impersonation
    {"pattern": "maybank", "category": "bank_impersonation", "weight": 2},
    {"pattern": "cimb", "category": "bank_impersonation", "weight": 2},
    {"pattern": "rhb", "category": "bank_impersonation", "weight": 2},
    # Urgency phrases
    {"pattern": "akaun anda dibekukan", "category": "urgency", "weight": 4},
    {"pattern": "dibekukan", "category": "urgency", "weight": 3},
    {"pattern": "segera", "category": "urgency", "weight": 2},
    {"pattern": "dalam masa 24 jam", "category": "urgency", "weight": 3},
    {"pattern": "hadiah", "category": "urgency", "weight": 2},
    {"pattern": "tahniah", "category": "urgency", "weight": 2},
    {"pattern": "menang", "category": "urgency", "weight": 2},
    # Transfer instructions
    {"pattern": "pindahkan wang ke akaun selamat", "category": "transfer_instruction", "weight": 5},
    {"pattern": "pindahkan wang", "category": "transfer_instruction", "weight": 4},
    {"pattern": "pindahkan", "category": "transfer_instruction", "weight": 2},
    {"pattern": "akaun selamat", "category": "transfer_instruction", "weight": 3},
    {"pattern": "akaun sementara", "category": "transfer_instruction", "weight": 3},
    # Account takeover
    {"pattern": "otp", "category": "account_takeover", "weight": 3},
    {"pattern": "kata laluan", "category": "account_takeover", "weight": 3},
    # Investment scam
    {"pattern": "guaranteed return", "category": "investment_fraud", "weight": 4},
    {"pattern": "pulangan terjamin", "category": "investment_fraud", "weight": 4},
    {"pattern": "pelaburan", "category": "investment_fraud", "weight": 2},
    {"pattern": "limited slot", "category": "investment_fraud", "weight": 3},
    # Monetary patterns
    {"pattern": "cukai tertunggak", "category": "monetary_amount", "weight": 3},
]

# Regex for monetary amounts: RM followed by digits
MONEY_REGEX = re.compile(r"RM\s?[\d,]+(?:\.\d{2})?", re.IGNORECASE)

# Bilingual warning templates by dominant category
WARNINGS = {
    "government_impersonation": {
        "en": "This message impersonates a government agency. Genuine agencies never collect money via e-wallet or ask you to transfer to a 'safe account'.",
        "bm": "Mesej ini menyamar sebagai agensi kerajaan. Agensi sebenar tidak pernah mengutip wang melalui e-dompet atau meminta anda memindah ke 'akaun selamat'.",
    },
    "bank_impersonation": {
        "en": "This message appears to impersonate a bank. Real banks never ask you to transfer money via messaging apps.",
        "bm": "Mesej ini kelihatan menyamar sebagai bank. Bank sebenar tidak pernah meminta anda memindahkan wang melalui aplikasi pesanan.",
    },
    "urgency": {
        "en": "This message uses urgency tactics commonly found in scams. Do not rush into any financial decision.",
        "bm": "Mesej ini menggunakan taktik desakan yang biasa digunakan dalam penipuan. Jangan tergesa-gesa membuat keputusan kewangan.",
    },
    "transfer_instruction": {
        "en": "This message contains language commonly used in Macau scams. Do not transfer any money until you call the official agency directly.",
        "bm": "Mesej ini mengandungi bahasa yang biasa digunakan dalam penipuan Macau. Jangan pindahkan wang sehingga anda menghubungi agensi rasmi secara terus.",
    },
    "account_takeover": {
        "en": "This message asks for your OTP or password. Never share these — they let scammers take over your account.",
        "bm": "Mesej ini meminta OTP atau kata laluan anda. Jangan kongsi — ia membolehkan penipu mengambil alih akaun anda.",
    },
    "investment_fraud": {
        "en": "This message promises guaranteed investment returns. Real licensed investments never guarantee profits.",
        "bm": "Mesej ini menjanjikan pulangan pelaburan terjamin. Pelaburan sah tidak pernah menjamin keuntungan.",
    },
    "monetary_amount": {
        "en": "This message contains language commonly used in scams. Do not transfer money until you verify in person.",
        "bm": "Mesej ini mengandungi bahasa yang sering digunakan dalam penipuan. Jangan pindahkan wang sehingga anda mengesahkannya secara peribadi.",
    },
}

SCAM_TYPE_MAP = {
    "government_impersonation": "macau_scam",
    "bank_impersonation": "macau_scam",
    "urgency": "macau_scam",
    "transfer_instruction": "macau_scam",
    "account_takeover": "account_takeover",
    "investment_fraud": "investment_scam",
    "monetary_amount": "macau_scam",
}


def analyse_message(text: str, language_hint: str = "auto") -> dict:
    """Scan message text for scam indicators."""
    if not text or not text.strip():
        return {
            "is_scam": False,
            "risk_level": "low",
            "confidence": 0.0,
            "matched_patterns": [],
            "warning_en": "No suspicious content detected.",
            "warning_bm": "Tiada kandungan mencurigakan dikesan.",
            "scam_type_hint": None,
            "education_url": "https://bnmlink.bnm.gov.my/scam-check",
        }

    lower = text.lower()
    matched = []
    total_weight = 0

    for p in PATTERNS:
        if p["pattern"] in lower:
            matched.append({"pattern": p["pattern"], "category": p["category"]})
            total_weight += p["weight"]

    # Check for monetary amounts
    money_matches = MONEY_REGEX.findall(text)
    for m in money_matches:
        matched.append({"pattern": m, "category": "monetary_amount"})
        total_weight += 2

    # Determine risk level
    if total_weight >= 8:
        risk_level = "high"
        confidence = min(0.95, 0.6 + total_weight * 0.03)
    elif total_weight >= 4:
        risk_level = "medium"
        confidence = min(0.7, 0.3 + total_weight * 0.05)
    else:
        risk_level = "low"
        confidence = max(0.1, total_weight * 0.1)

    is_scam = risk_level in ("high", "medium")

    # Find dominant category
    cat_weights: dict[str, int] = {}
    for p in PATTERNS:
        if p["pattern"] in lower:
            cat_weights[p["category"]] = cat_weights.get(p["category"], 0) + p["weight"]

    dominant_cat = max(cat_weights, key=cat_weights.get) if cat_weights else "urgency"
    warning = WARNINGS.get(dominant_cat, WARNINGS["urgency"])
    scam_type = SCAM_TYPE_MAP.get(dominant_cat, "macau_scam")

    return {
        "is_scam": is_scam,
        "risk_level": risk_level,
        "confidence": round(confidence, 2),
        "matched_patterns": matched,
        "warning_en": warning["en"],
        "warning_bm": warning["bm"],
        "scam_type_hint": scam_type if is_scam else None,
        "education_url": "https://bnmlink.bnm.gov.my/scam-check",
    }


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------
def handler(event, context):
    """AWS Lambda handler for POST /api/analyse-message."""
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return _error_response(400, "VALIDATION_ERROR", "Invalid JSON body")

    message_text = body.get("message_text", "")
    if not message_text:
        return _error_response(400, "VALIDATION_ERROR", "message_text is required")

    if len(message_text) > 2000:
        return _error_response(400, "VALIDATION_ERROR", "message_text max 2000 chars")

    language_hint = body.get("language_hint", "auto")
    result = analyse_message(message_text, language_hint)

    response = {
        "request_id": generate_request_id(),
        **result,
        "processed_at": now_iso(),
    }

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(response),
    }


def _error_response(status, code, message):
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps({
            "error": True, "code": code, "message": message,
            "request_id": generate_request_id(),
        }),
    }


def _cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }
