"""
SafeSend Backend — Amazon Bedrock Integration

Invokes Claude 3 Haiku for bilingual scam explanation generation.
Falls back to canned responses if Bedrock is unavailable or slow.
"""

import json
import boto3
from typing import Any

from .config import BEDROCK_MODEL_ID, get_bedrock_region

# Cache client across invocations
_client = None


def _get_client():
    global _client
    if _client is None:
        region = get_bedrock_region()
        _client = boto3.client("bedrock-runtime", region_name=region)
    return _client


# ---------------------------------------------------------------------------
# Canned fallback responses (PRD Section 10)
# ---------------------------------------------------------------------------
CANNED_RESPONSES: dict[str, dict[str, str]] = {
    "macau_scam": {
        "explanation_en": (
            "This account was created just days ago and you have never sent "
            "money here before. This matches a Macau scam where scammers "
            "pretend to be government officers to pressure you."
        ),
        "explanation_bm": (
            "Akaun ini baru dibuka beberapa hari lepas dan anda tidak pernah "
            "hantar wang ke sini. Ini sepadan dengan penipuan Macau di mana "
            "penipu berpura-pura menjadi pegawai kerajaan."
        ),
        "scam_type": "macau_scam",
        "confidence": "high",
    },
    "investment_scam": {
        "explanation_en": (
            "The payee promises guaranteed returns and the account is brand new. "
            "Real licensed investments never use personal e-wallet accounts."
        ),
        "explanation_bm": (
            "Penerima menjanjikan pulangan terjamin dan akaun ini baru sahaja "
            "didaftarkan. Pelaburan yang sah tidak pernah menggunakan akaun "
            "e-dompet peribadi."
        ),
        "scam_type": "investment_scam",
        "confidence": "high",
    },
    "mule_account": {
        "explanation_en": (
            "This payee is linked to other accounts already flagged as scam "
            "mules and the account was opened only days ago."
        ),
        "explanation_bm": (
            "Penerima ini berkait dengan akaun lain yang telah dikesan sebagai "
            "akaun mule penipu, dan akaun ini baru sahaja dibuka."
        ),
        "scam_type": "mule_account",
        "confidence": "high",
    },
    "account_takeover": {
        "explanation_en": (
            "This payment was started from an unfamiliar device late at night. "
            "This pattern usually means the account has been taken over."
        ),
        "explanation_bm": (
            "Pembayaran ini dimulakan daripada peranti yang tidak dikenali pada "
            "waktu lewat malam. Corak ini bermaksud akaun mungkin telah dirampas."
        ),
        "scam_type": "account_takeover",
        "confidence": "high",
    },
    "love_scam": {
        "explanation_en": (
            "The payee is brand new and the amount is unusually large. Love "
            "scammers often build trust online before asking for money."
        ),
        "explanation_bm": (
            "Penerima ini baru dan jumlahnya luar biasa besar. Penipu cinta "
            "selalu membina kepercayaan sebelum meminta wang."
        ),
        "scam_type": "love_scam",
        "confidence": "medium",
    },
    "false_positive": {
        "explanation_en": (
            "A few signals were unusual, but the payee account is well-established. "
            "Likely not a scam."
        ),
        "explanation_bm": (
            "Beberapa petunjuk luar biasa, tetapi akaun penerima sudah lama wujud. "
            "Berkemungkinan bukan penipuan."
        ),
        "scam_type": "false_positive",
        "confidence": "low",
    },
}


def build_prompt(
    amount: float,
    payee: str,
    time: str,
    payee_age_days: int,
    prior_txns: int,
    score: int,
    signals: list[str],
) -> str:
    """Build the structured Bedrock prompt per PRD Section 10."""
    signals_str = ", ".join(signals) if signals else "none"
    return f"""You are a fraud analyst for a Malaysian e-wallet called Touch 'n Go.
A transaction has been flagged by our anomaly detection system.

Transaction details:
- Amount: RM {amount}
- Payee: "{payee}"
- Time: {time}
- Payee account age: {payee_age_days} days
- Prior transactions to this payee: {prior_txns}
- ML fraud score: {score}/100

Risk signals triggered: {signals_str}

Instructions:
1. In 2 sentences, explain WHY this transaction looks suspicious to a non-technical user.
   Write in simple language an elderly Malaysian would understand.
   Provide both English and Bahasa Malaysia versions.
2. Classify the most likely scam type from:
   [macau_scam | investment_scam | love_scam | account_takeover | mule_account | false_positive]
3. Confidence level: high / medium / low

Respond ONLY in valid JSON. No preamble, no markdown.
Format:
{{
  "explanation_en": "...",
  "explanation_bm": "...",
  "scam_type": "...",
  "confidence": "..."
}}"""


def invoke_bedrock(
    amount: float,
    payee: str,
    time: str,
    payee_age_days: int,
    prior_txns: int,
    score: int,
    signals: list[str],
    fallback_scam_type: str = "macau_scam",
) -> dict[str, str]:
    """
    Call Bedrock Claude Haiku for a bilingual scam explanation.

    Returns dict with: explanation_en, explanation_bm, scam_type, confidence.
    Falls back to canned response on any error.
    """
    prompt = build_prompt(amount, payee, time, payee_age_days, prior_txns, score, signals)

    try:
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 512,
                "temperature": 0,
                "messages": [{"role": "user", "content": prompt}],
            }
        )

        response = _get_client().invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )

        result = json.loads(response["body"].read())
        content = result.get("content", [{}])[0].get("text", "")

        # Parse the JSON response from Claude
        parsed = json.loads(content)

        # Validate required fields
        required = ["explanation_en", "explanation_bm", "scam_type", "confidence"]
        if all(k in parsed for k in required):
            return parsed

        print(f"[bedrock] Missing fields in response, falling back")
        return CANNED_RESPONSES.get(
            fallback_scam_type, CANNED_RESPONSES["macau_scam"]
        )

    except Exception as e:
        print(f"[bedrock] Error invoking model: {e}")
        return CANNED_RESPONSES.get(
            fallback_scam_type, CANNED_RESPONSES["macau_scam"]
        )


def get_canned_response(scam_type: str) -> dict[str, str]:
    """Get a canned fallback response by scam type."""
    return CANNED_RESPONSES.get(scam_type, CANNED_RESPONSES["macau_scam"])
