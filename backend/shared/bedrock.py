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
        content = result.get("content", [{}])[0].get("text", "").strip()
        content = _extract_json(content)
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


# ===========================================================================
# Type 2 — Agent alert explanation (F2 mule flag)
#
# Audience: fraud analyst.
# Output: structured paragraph naming which signals fired with their values,
# pattern name, confidence, recommended action.
# ===========================================================================

AGENT_RECOMMENDED_ACTIONS = ("block", "warn", "monitor", "clear")

AGENT_CANNED: dict[str, dict[str, Any]] = {
    "macau_scam": {
        "signals_summary": (
            "User initiated a high-value transfer to a brand-new payee account "
            "(<14 days old) at an unusual hour. Amount is multiple times the "
            "user's 30-day average, matching the Macau-scam pressure pattern."
        ),
        "pattern_name": "macau_scam",
        "confidence": "high",
        "recommended_action": "block",
        "analyst_notes": (
            "Verify by calling the user on a known number. Macau scams escalate "
            "quickly and victim is typically being coached on a live call."
        ),
    },
    "mule_account": {
        "signals_summary": (
            "Receiver account is days old, linked to other already-flagged "
            "accounts in the scam graph, and is acting purely as a pass-through "
            "(in/out within 24h). Classic mule funnel."
        ),
        "pattern_name": "mule_account",
        "confidence": "high",
        "recommended_action": "block",
        "analyst_notes": (
            "Trigger F3 bulk containment if 2+ linked mules in cluster. Suspend "
            "withdrawals on receiver and immediate downstream accounts."
        ),
    },
    "investment_scam": {
        "signals_summary": (
            "Repeated transfers from the user to a payee promising guaranteed "
            "returns; payee account is under 30 days old and not registered with SC."
        ),
        "pattern_name": "investment_scam",
        "confidence": "high",
        "recommended_action": "warn",
        "analyst_notes": "Cross-check payee against SC investor alert list before block.",
    },
    "account_takeover": {
        "signals_summary": (
            "Login from a previously-unseen device followed by an immediate "
            "high-value transfer at an unusual hour. Possible SIM-swap or "
            "credential compromise."
        ),
        "pattern_name": "account_takeover",
        "confidence": "medium",
        "recommended_action": "warn",
        "analyst_notes": (
            "Force re-authentication. Contact telco for SIM-swap check before final block."
        ),
    },
    "false_positive": {
        "signals_summary": (
            "A few signals were unusual (amount, hour) but the payee has prior "
            "successful transfers and a long account history. Low risk."
        ),
        "pattern_name": "false_positive",
        "confidence": "low",
        "recommended_action": "clear",
        "analyst_notes": "Use this case as a 0-label training example.",
    },
}


def build_agent_prompt(
    txn_id: str,
    user_id: str,
    payee: str,
    amount: float,
    triggered_signals: list[dict],
    rule_score: int,
    ml_score: int,
    final_score: int,
) -> str:
    """Type 2 prompt — for fraud analyst, structured paragraph + recommendation."""
    signal_lines = "\n".join(
        f"- {s.get('signal', '?')} (+{s.get('weight', '?')}): {s.get('label_en', '')}"
        for s in (triggered_signals or [])
    ) or "- (no signals listed)"

    return f"""You are writing an explanation for a Touch 'n Go fraud analyst.
The analyst will read this in their alert console and decide block / warn / clear.

Alert details:
- Transaction ID: {txn_id}
- User: {user_id}
- Payee: {payee}
- Amount: RM {amount}
- Rule engine score: {rule_score}/100
- ML (EAS) score: {ml_score}/100
- Composite final score: {final_score}/100

Signals triggered:
{signal_lines}

Instructions:
1. Write `signals_summary`: 2–4 sentences. TECHNICAL tone. Reference the actual
   signal names and values. Do NOT use baby-talk — analyst is a domain expert.
2. Classify `pattern_name` (one of: macau_scam, investment_scam, love_scam,
   mule_account, account_takeover, false_positive).
3. Give `confidence` (high / medium / low).
4. Give `recommended_action` (block / warn / monitor / clear).
5. Write `analyst_notes`: 1–2 sentences with concrete next steps the analyst
   should take (call user, contact telco, trigger bulk containment, etc.).

Respond ONLY in valid JSON. No preamble, no markdown.
Format:
{{
  "signals_summary": "...",
  "pattern_name": "...",
  "confidence": "...",
  "recommended_action": "...",
  "analyst_notes": "..."
}}"""


def invoke_agent_explanation(
    txn_id: str,
    user_id: str,
    payee: str,
    amount: float,
    triggered_signals: list[dict],
    rule_score: int,
    ml_score: int,
    final_score: int,
    fallback_scam_type: str = "macau_scam",
) -> dict[str, Any]:
    """
    Call Bedrock for an agent-facing alert explanation (Type 2).

    Returns dict with: signals_summary, pattern_name, confidence,
    recommended_action, analyst_notes. Falls back to canned response on error.
    """
    prompt = build_agent_prompt(
        txn_id, user_id, payee, amount,
        triggered_signals, rule_score, ml_score, final_score,
    )

    try:
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 700,
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
        text = result.get("content", [{}])[0].get("text", "").strip()
        text = _extract_json(text)
        parsed = json.loads(text)

        required = (
            "signals_summary",
            "pattern_name",
            "confidence",
            "recommended_action",
            "analyst_notes",
        )
        if all(k in parsed for k in required):
            # Defensive: clamp recommended_action to allowed values.
            if parsed["recommended_action"] not in AGENT_RECOMMENDED_ACTIONS:
                parsed["recommended_action"] = "warn"
            return parsed

        print(f"[bedrock-agent] Missing fields, falling back")
        return AGENT_CANNED.get(fallback_scam_type, AGENT_CANNED["macau_scam"])

    except Exception as e:  # noqa: BLE001
        print(f"[bedrock-agent] Error: {e}")
        return AGENT_CANNED.get(fallback_scam_type, AGENT_CANNED["macau_scam"])


# ===========================================================================
# Type 3 — Incident report (F3 bulk containment)
#
# Audience: TnG compliance team.
# Output: structured incident summary — accounts, RM exposure, pattern,
# actions taken, timestamp chain. Pre-formatted for compliance sign-off.
# ===========================================================================

INCIDENT_CANNED_FALLBACK: dict[str, Any] = {
    "incident_summary": (
        "Coordinated mule cluster detected. SafeSend identified multiple "
        "newly-opened accounts sharing device fingerprints and a common "
        "downstream withdrawal pattern. Bulk containment executed."
    ),
    "pattern_description": (
        "All flagged accounts were created within the last 7 days, share at "
        "least one device fingerprint with another flagged account, and "
        "received funds from victim users without any subsequent merchant "
        "spend (in/out within 12 hours). This is consistent with a mule "
        "funnel used to launder Macau-scam victim funds."
    ),
    "pattern_name": "mule_account",
    "confidence": "high",
    "actions_taken": [
        "Suspended affected receiver accounts",
        "Held outbound withdrawals pending compliance review",
        "Notified affected senders via SNS",
        "Logged training-set entries to S3 (label=fraud)",
    ],
    "compliance_recommendation": (
        "Sign off on permanent account closure for all listed accounts. "
        "Forward case file to NSRC within 24 hours."
    ),
}


def build_incident_prompt(
    incident_id: str,
    pattern_hint: str,
    accounts: list[dict],
    rm_exposure: float,
    detection_signals: list[str],
    timeline: list[dict],
) -> str:
    """Type 3 prompt — for compliance team, pre-formatted incident report."""
    accounts_block = "\n".join(
        f"- {a.get('account_id', '?')} (role: {a.get('role', '?')}, "
        f"age: {a.get('age_days', '?')}d, last_balance: RM {a.get('balance', 0)})"
        for a in (accounts or [])
    ) or "- (none listed)"

    timeline_block = "\n".join(
        f"- {t.get('timestamp', '?')}: {t.get('event', '?')}"
        for t in (timeline or [])
    ) or "- (no timeline events)"

    signals_str = ", ".join(detection_signals) if detection_signals else "(none)"

    return f"""You are drafting an incident report for the Touch 'n Go compliance team.
A senior compliance officer will read, edit if needed, and sign off.

Incident metadata:
- Incident ID: {incident_id}
- Suspected pattern: {pattern_hint}
- Total RM exposure: RM {rm_exposure}
- Detection signals: {signals_str}

Accounts involved:
{accounts_block}

Timeline of events:
{timeline_block}

Instructions:
1. Write `incident_summary`: 2 sentences. Plain English. Top of report.
2. Write `pattern_description`: ONE paragraph (4–6 sentences) explaining
   the scam pattern in compliance-grade language, citing the signals and the
   relationship between accounts.
3. Classify `pattern_name` (one of: macau_scam, investment_scam, love_scam,
   mule_account, account_takeover, false_positive).
4. Give `confidence` (high / medium / low).
5. List `actions_taken`: 3–5 short imperative bullets describing what
   SafeSend already did automatically.
6. Write `compliance_recommendation`: 1–2 sentences on what compliance
   should do next (sign-off, NSRC report, account closure, etc.).

Respond ONLY in valid JSON. No preamble, no markdown.
Format:
{{
  "incident_summary": "...",
  "pattern_description": "...",
  "pattern_name": "...",
  "confidence": "...",
  "actions_taken": ["...", "..."],
  "compliance_recommendation": "..."
}}"""


def invoke_incident_report(
    incident_id: str,
    pattern_hint: str,
    accounts: list[dict],
    rm_exposure: float,
    detection_signals: list[str],
    timeline: list[dict],
) -> dict[str, Any]:
    """
    Call Bedrock for a compliance incident report (Type 3).

    Returns dict with: incident_summary, pattern_description, pattern_name,
    confidence, actions_taken, compliance_recommendation. Falls back to a
    canned report on error.
    """
    prompt = build_incident_prompt(
        incident_id, pattern_hint, accounts, rm_exposure,
        detection_signals, timeline,
    )

    try:
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 900,
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
        text = result.get("content", [{}])[0].get("text", "").strip()
        text = _extract_json(text)
        parsed = json.loads(text)

        required = (
            "incident_summary",
            "pattern_description",
            "pattern_name",
            "confidence",
            "actions_taken",
            "compliance_recommendation",
        )
        if all(k in parsed for k in required) and isinstance(parsed["actions_taken"], list):
            return parsed

        print(f"[bedrock-incident] Missing fields, falling back")
        return INCIDENT_CANNED_FALLBACK

    except Exception as e:  # noqa: BLE001
        print(f"[bedrock-incident] Error: {e}")
        return INCIDENT_CANNED_FALLBACK


# ---------------------------------------------------------------------------
# JSON extraction helper — Bedrock occasionally wraps in ```json fences or
# adds prose. Pull the first balanced {...} block.
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> str:
    import re

    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return fence.group(1)
    brace = re.search(r"\{.*\}", text, re.DOTALL)
    return brace.group(0) if brace else text
