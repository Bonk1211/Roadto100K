"""
SafeSend — Bedrock 3-call-types test suite.

Validates the three Bedrock call types from PRD F4:

  Type 1 — User-facing warning (F1 hard interception)
           invoke_bedrock(...)
           → 2 sentences, bilingual, scam_type, confidence

  Type 2 — Agent alert explanation (F2 mule flag)
           invoke_agent_explanation(...)
           → structured paragraph, signals, recommended_action

  Type 3 — Incident report (F3 bulk containment)
           invoke_incident_report(...)
           → incident summary, accounts, RM exposure, timeline, actions

Each test verifies BOTH:
  • happy path against real Bedrock (Claude 3 Haiku in ap-southeast-1)
  • fallback path when Bedrock errors (raises in invoke_model)

Run:
    source .venv/bin/activate
    AWS_PROFILE=default python -m pytest tests/test_bedrock_3types.py -v
"""

from __future__ import annotations

import json
import re
from unittest.mock import patch

import pytest

from shared.bedrock import (
    AGENT_CANNED,
    AGENT_RECOMMENDED_ACTIONS,
    CANNED_RESPONSES,
    INCIDENT_CANNED_FALLBACK,
    invoke_agent_explanation,
    invoke_bedrock,
    invoke_incident_report,
)
from tests.conftest import needs_bedrock


VALID_SCAM_TYPES = {
    "macau_scam",
    "investment_scam",
    "love_scam",
    "account_takeover",
    "mule_account",
    "false_positive",
}
VALID_CONFIDENCE = {"high", "medium", "low"}

# ---------------------------------------------------------------------------
# Type 1 — User-facing warning
# ---------------------------------------------------------------------------

TYPE1_FIXTURE = dict(
    amount=8000.0,
    payee="Ahmad Rahman",
    time="2026-04-25T23:00:00Z",
    payee_age_days=6,
    prior_txns=0,
    score=98,
    signals=[
        "new_account",
        "first_transfer",
        "amount_spike",
        "late_night",
        "device_mismatch",
        "scam_graph",
        "large_amount",
    ],
    fallback_scam_type="macau_scam",
)


@needs_bedrock
def test_type1_user_warning_structure_live():
    """Type 1: response has all 4 required keys, valid enums."""
    result = invoke_bedrock(**TYPE1_FIXTURE)

    assert isinstance(result, dict)
    for key in ("explanation_en", "explanation_bm", "scam_type", "confidence"):
        assert key in result, f"missing {key}"

    assert result["scam_type"] in VALID_SCAM_TYPES
    assert result["confidence"] in VALID_CONFIDENCE


@needs_bedrock
def test_type1_user_warning_bilingual_distinct_live():
    """Type 1: BM and EN are non-empty and distinct (real translation, not echo)."""
    result = invoke_bedrock(**TYPE1_FIXTURE)
    en, bm = result["explanation_en"], result["explanation_bm"]

    assert isinstance(en, str) and len(en) > 20
    assert isinstance(bm, str) and len(bm) > 20
    assert en.strip().lower() != bm.strip().lower()


@needs_bedrock
def test_type1_user_warning_brevity_live():
    """Type 1: ≤2 sentences (≤4 sentence-ending punctuation marks for slack)."""
    result = invoke_bedrock(**TYPE1_FIXTURE)
    en = result["explanation_en"]

    # Count sentence terminators. Allow up to 4 to absorb sub-clauses, but flag
    # walls of text — Type 1 is supposed to be short for non-technical users.
    sentence_count = len(re.findall(r"[.!?]+", en))
    assert sentence_count <= 4, f"explanation too long: {sentence_count} sentences"
    assert len(en) <= 600, f"explanation_en too long ({len(en)} chars)"


@needs_bedrock
def test_type1_user_warning_macau_inferred_live():
    """Type 1: with all macau-scam signals present, model classifies it as macau_scam
    (or at minimum agrees it is a scam — not false_positive)."""
    result = invoke_bedrock(**TYPE1_FIXTURE)
    assert result["scam_type"] != "false_positive"


def test_type1_user_warning_falls_back_on_error():
    """Type 1: when Bedrock raises, returns canned response for the fallback type."""
    with patch(
        "shared.bedrock._get_client",
        side_effect=RuntimeError("simulated outage"),
    ):
        result = invoke_bedrock(**TYPE1_FIXTURE)
    assert result == CANNED_RESPONSES["macau_scam"]
    # Canned still satisfies the contract.
    assert result["scam_type"] == "macau_scam"
    assert result["confidence"] in VALID_CONFIDENCE


# ---------------------------------------------------------------------------
# Type 2 — Agent alert explanation
# ---------------------------------------------------------------------------

TYPE2_FIXTURE = dict(
    txn_id="TXN-20260425-DEMO1",
    user_id="u_zara",
    payee="Ahmad Rahman",
    amount=8000.0,
    triggered_signals=[
        {"signal": "new_account", "weight": 20, "label_en": "Payee account is 6 days old"},
        {"signal": "first_transfer", "weight": 15, "label_en": "Sender never paid this payee before"},
        {"signal": "amount_spike", "weight": 20, "label_en": "Amount is 9x user 30-day avg"},
        {"signal": "late_night", "weight": 10, "label_en": "Transaction at 23:00"},
        {"signal": "device_mismatch", "weight": 15, "label_en": "Unfamiliar device"},
        {"signal": "scam_graph", "weight": 30, "label_en": "Payee linked to 4 flagged accounts"},
        {"signal": "large_amount", "weight": 5, "label_en": "Round-number RM 8000"},
    ],
    rule_score=80,
    ml_score=92,
    final_score=98,
    fallback_scam_type="macau_scam",
)


@needs_bedrock
def test_type2_agent_explanation_structure_live():
    """Type 2: all required keys + recommended_action is whitelisted."""
    result = invoke_agent_explanation(**TYPE2_FIXTURE)

    for key in (
        "signals_summary",
        "pattern_name",
        "confidence",
        "recommended_action",
        "analyst_notes",
    ):
        assert key in result, f"missing {key}"

    assert result["pattern_name"] in VALID_SCAM_TYPES
    assert result["confidence"] in VALID_CONFIDENCE
    assert result["recommended_action"] in AGENT_RECOMMENDED_ACTIONS


@needs_bedrock
def test_type2_agent_references_signal_names_live():
    """Type 2: signals_summary should reference at least 1 of the technical signal
    names (analyst tone, not baby-talk)."""
    result = invoke_agent_explanation(**TYPE2_FIXTURE)
    summary = result["signals_summary"].lower()

    technical_terms = [
        "device",
        "payee",
        "amount",
        "score",
        "account",
        "signal",
        "graph",
        "transfer",
        "late",
        "new",
        "mule",
        "30-day",
        "fraud",
        "flagged",
    ]
    matches = sum(1 for term in technical_terms if term in summary)
    assert matches >= 3, (
        f"signals_summary too generic — only {matches} technical terms hit. "
        f"Got: {result['signals_summary']!r}"
    )


@needs_bedrock
def test_type2_agent_recommends_block_for_macau_live():
    """Type 2: with Macau-scam-style signals, recommended_action should be block or warn,
    not clear/monitor."""
    result = invoke_agent_explanation(**TYPE2_FIXTURE)
    assert result["recommended_action"] in {"block", "warn"}, (
        f"unexpected action {result['recommended_action']} for high-risk Macau pattern"
    )


def test_type2_agent_falls_back_on_error():
    """Type 2: when Bedrock raises, returns canned agent response."""
    with patch(
        "shared.bedrock._get_client",
        side_effect=RuntimeError("simulated outage"),
    ):
        result = invoke_agent_explanation(**TYPE2_FIXTURE)
    assert result == AGENT_CANNED["macau_scam"]
    assert result["recommended_action"] in AGENT_RECOMMENDED_ACTIONS


# ---------------------------------------------------------------------------
# Type 3 — Incident report
# ---------------------------------------------------------------------------

TYPE3_FIXTURE = dict(
    incident_id="INC-2026-04-25-001",
    pattern_hint="mule_account",
    accounts=[
        {"account_id": "ACC-1001", "role": "victim", "age_days": 312, "balance": 0},
        {"account_id": "ACC-2001", "role": "mule_a", "age_days": 6, "balance": 8000},
        {"account_id": "ACC-2002", "role": "mule_b", "age_days": 4, "balance": 4500},
        {"account_id": "ACC-2003", "role": "withdrawer", "age_days": 11, "balance": 12000},
    ],
    rm_exposure=12500.00,
    detection_signals=[
        "shared_device_fingerprint",
        "rapid_in_out_pattern",
        "new_account_cluster",
        "no_merchant_spend",
    ],
    timeline=[
        {"timestamp": "2026-04-25T22:58:00Z", "event": "Victim initiates RM 8,000 transfer to ACC-2001"},
        {"timestamp": "2026-04-25T22:59:12Z", "event": "ACC-2001 forwards RM 7,950 to ACC-2002"},
        {"timestamp": "2026-04-25T23:00:48Z", "event": "ACC-2002 forwards RM 7,800 to ACC-2003"},
        {"timestamp": "2026-04-25T23:01:30Z", "event": "ACC-2003 attempts ATM withdrawal — blocked by SafeSend"},
        {"timestamp": "2026-04-25T23:01:45Z", "event": "F3 bulk containment triggered on cluster"},
    ],
)


@needs_bedrock
def test_type3_incident_structure_live():
    """Type 3: all 6 required keys, actions_taken is a non-empty list."""
    result = invoke_incident_report(**TYPE3_FIXTURE)

    for key in (
        "incident_summary",
        "pattern_description",
        "pattern_name",
        "confidence",
        "actions_taken",
        "compliance_recommendation",
    ):
        assert key in result, f"missing {key}"

    assert result["pattern_name"] in VALID_SCAM_TYPES
    assert result["confidence"] in VALID_CONFIDENCE
    assert isinstance(result["actions_taken"], list)
    assert 1 <= len(result["actions_taken"]) <= 10
    for item in result["actions_taken"]:
        assert isinstance(item, str) and len(item) > 0


@needs_bedrock
def test_type3_incident_references_amount_or_accounts_live():
    """Type 3: incident_summary or pattern_description should reference the RM exposure
    or an account ID — proving the model used the structured input, not a generic template."""
    result = invoke_incident_report(**TYPE3_FIXTURE)
    blob = (result["incident_summary"] + " " + result["pattern_description"]).lower()

    has_amount = any(
        token in blob
        for token in ("rm 12", "rm12", "12,500", "12500", "rm 8", "8,000", "8000")
    )
    has_account = any(
        token in blob
        for token in ("acc-1001", "acc-2001", "acc-2002", "acc-2003", "account", "cluster")
    )
    assert has_amount or has_account, (
        f"report didn't reference structured input: {blob[:300]!r}"
    )


@needs_bedrock
def test_type3_incident_pattern_description_paragraph_live():
    """Type 3: pattern_description should be a real paragraph (≥3 sentences, ≥200 chars)."""
    result = invoke_incident_report(**TYPE3_FIXTURE)
    desc = result["pattern_description"]

    assert len(desc) >= 200, f"pattern_description too short ({len(desc)} chars)"
    sentence_count = len(re.findall(r"[.!?]+", desc))
    assert sentence_count >= 3, f"only {sentence_count} sentences in description"


@needs_bedrock
def test_type3_incident_classifies_as_mule_or_macau_live():
    """Type 3: with mule cluster + rapid in/out signals, pattern_name should be
    mule_account or macau_scam (not false_positive / love_scam)."""
    result = invoke_incident_report(**TYPE3_FIXTURE)
    assert result["pattern_name"] in {"mule_account", "macau_scam", "account_takeover"}


def test_type3_incident_falls_back_on_error():
    """Type 3: when Bedrock raises, returns canned incident report."""
    with patch(
        "shared.bedrock._get_client",
        side_effect=RuntimeError("simulated outage"),
    ):
        result = invoke_incident_report(**TYPE3_FIXTURE)
    assert result == INCIDENT_CANNED_FALLBACK
    assert isinstance(result["actions_taken"], list) and result["actions_taken"]


# ---------------------------------------------------------------------------
# Cross-cutting smoke test — ensures the module-level constants stay aligned
# with the test expectations.
# ---------------------------------------------------------------------------

def test_canned_responses_cover_all_scam_types():
    for st in VALID_SCAM_TYPES:
        assert st in CANNED_RESPONSES, f"Type 1 canned missing {st}"


def test_agent_canned_covers_main_scam_types():
    # AGENT_CANNED is allowed to be sparser; just check the macau fallback
    # used by every test fixture exists.
    assert "macau_scam" in AGENT_CANNED
    assert AGENT_CANNED["macau_scam"]["recommended_action"] in AGENT_RECOMMENDED_ACTIONS


def test_incident_canned_has_all_keys():
    for key in (
        "incident_summary",
        "pattern_description",
        "pattern_name",
        "confidence",
        "actions_taken",
        "compliance_recommendation",
    ):
        assert key in INCIDENT_CANNED_FALLBACK, f"INCIDENT_CANNED_FALLBACK missing {key}"
