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


# ---------------------------------------------------------------------------
# Type 2 — Agent mule alert (PRD §10)
# ---------------------------------------------------------------------------

def invoke_mule_alert(
    account_id: str,
    stage: int,
    score: int,
    account_age_days: int,
    unique_senders: int,
    avg_gap_minutes: float,
    inbound_outbound_ratio: float,
    merchant_spend: float,
) -> dict[str, Any]:
    """Type 2: structured alert explanation for fraud analyst."""
    prompt = f"""You are a fraud analyst assistant for Touch 'n Go.
A mule account has been flagged at Stage {stage}.

Account profile:
- Account: {account_id}
- Account age: {account_age_days} days
- Unique inbound senders (6h): {unique_senders}
- Average time between inbound transfers: {avg_gap_minutes} minutes
- Inbound-to-outbound ratio: {inbound_outbound_ratio}%
- Merchant spend (7d): RM {merchant_spend}
- Mule risk score: {score}/100

Write a structured alert explanation for a fraud analyst.
Include: which signals fired, pattern name, confidence, recommended action.

Return ONLY valid JSON, no markdown, no preamble:
{{
  "explanation_en": "...",
  "pattern_name": "...",
  "signals_fired": ["..."],
  "confidence": "high | medium | low",
  "recommended_action": "block | warn | monitor"
}}"""

    fallback = {
        "explanation_en": (
            f"Account {account_id} matches mule pattern at Stage {stage}: "
            f"{unique_senders} unique senders in 6h, avg gap {avg_gap_minutes:.1f} min, "
            f"{inbound_outbound_ratio:.0f}% pass-through, age {account_age_days}d."
        ),
        "pattern_name": "layered_inbound_passthrough",
        "signals_fired": ["unique_inbound_senders_6h", "inbound_outbound_ratio"],
        "confidence": "high" if stage >= 3 else "medium",
        "recommended_action": "block" if stage >= 3 else "warn" if stage == 2 else "monitor",
    }

    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 400,
            "temperature": 0,
            "messages": [{"role": "user", "content": prompt}],
        })
        response = _get_client().invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        result = json.loads(response["body"].read())
        text = result.get("content", [{}])[0].get("text", "").strip()
        parsed = _extract_json(text)
        if all(k in parsed for k in ("explanation_en", "pattern_name")):
            return parsed
        return fallback
    except Exception as e:
        print(f"[bedrock] mule_alert error: {e}")
        return fallback


# ---------------------------------------------------------------------------
# Type 3 — Compliance incident report (PRD §10) for bulk containment
# ---------------------------------------------------------------------------

def invoke_incident_report(
    mule_account_id: str,
    linked_accounts: list[dict[str, Any]],
    total_rm_exposure: float,
    actions_taken: list[str],
    pattern_hint: str = "mule_layering",
) -> dict[str, Any]:
    """
    Type 3: compliance incident report for bulk containment action.

    Returns structured JSON ready for compliance filing.
    Falls back to deterministic template on Bedrock failure.
    """
    timestamp = _now_iso()
    accounts_summary = ", ".join(
        f"{a.get('account_id', '?')} (deg {a.get('degree', 0)}, "
        f"{a.get('connection_type', 'unknown')})"
        for a in linked_accounts[:10]
    )

    prompt = f"""You are generating a compliance incident report for Touch 'n Go's fraud team.

Incident summary:
- Confirmed mule account: {mule_account_id}
- Linked accounts contained: {len(linked_accounts)}
- Account list (sample): {accounts_summary}
- Total RM exposure: RM {total_rm_exposure:,.2f}
- Actions taken: {", ".join(actions_taken)}
- Pattern hint: {pattern_hint}
- Timestamp: {timestamp}

Generate a structured incident report suitable for compliance filing.
Professional tone. Include: pattern description, accounts involved,
actions taken, RM exposure, recommended follow-up.

Return ONLY valid JSON, no markdown, no preamble:
{{
  "incident_title": "...",
  "pattern_description": "...",
  "accounts_involved": [...],
  "total_rm_exposure": {total_rm_exposure:.2f},
  "actions_taken": [...],
  "recommended_followup": "...",
  "report_timestamp": "{timestamp}"
}}"""

    fallback = {
        "incident_title": f"Bulk containment — mule cluster centred on {mule_account_id}",
        "pattern_description": (
            f"Auto-evicted mule account {mule_account_id} flagged via Stage 3 inbound layering. "
            f"Graph traversal surfaced {len(linked_accounts)} linked accounts sharing device "
            f"fingerprint, IP range, registration cluster, or direct transaction edges. "
            f"Pattern: {pattern_hint}."
        ),
        "accounts_involved": [a.get("account_id") for a in linked_accounts],
        "total_rm_exposure": float(total_rm_exposure),
        "actions_taken": list(actions_taken),
        "recommended_followup": (
            "File BNM PSA incident report within 24h. Notify affected senders via SNS. "
            "Open second-degree review for any account not contained."
        ),
        "report_timestamp": timestamp,
    }

    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 700,
            "temperature": 0,
            "messages": [{"role": "user", "content": prompt}],
        })
        response = _get_client().invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        result = json.loads(response["body"].read())
        text = result.get("content", [{}])[0].get("text", "").strip()
        parsed = _extract_json(text)
        required = ("incident_title", "pattern_description", "accounts_involved")
        if all(k in parsed for k in required):
            parsed.setdefault("total_rm_exposure", float(total_rm_exposure))
            parsed.setdefault("actions_taken", list(actions_taken))
            parsed.setdefault("report_timestamp", timestamp)
            return parsed
        return fallback
    except Exception as e:
        print(f"[bedrock] incident_report error: {e}")
        return fallback


def _extract_json(text: str) -> dict[str, Any]:
    """Best-effort extract JSON object from Bedrock text response."""
    import re
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        if brace:
            text = brace.group(0)
    try:
        return json.loads(text)
    except Exception:
        return {}


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z"
