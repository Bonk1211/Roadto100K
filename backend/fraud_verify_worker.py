#!/usr/bin/env python3
"""
SafeSend Autonomous Fraud Verification Worker.

Long-running async worker. Polls alerts every VERIFY_POLL_SEC seconds,
picks unverified open alerts, runs five specialised agents in parallel
(transaction, behaviour, network, policy, victim), an arbiter merges,
and the final decision is written back to alerts/agent_actions so the
existing dashboard stays consistent.

Two modes:

    VERIFY_MOCK=1 (default)  -> deterministic mock findings shaped by alert
                                 features, with realistic per-agent latency.
                                 Zero AWS dependency. Ideal for demo.

    VERIFY_MOCK=0            -> calls Bedrock Claude for each agent in
                                 parallel via asyncio.gather. Requires AWS
                                 creds + Bedrock model access.

Run:
    python init_verification_schema.py     # one-time
    python fraud_verify_worker.py          # leave running
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import re
import signal
import sys
import time
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv


load_dotenv(".env")

POLL_SEC = float(os.environ.get("VERIFY_POLL_SEC", "2"))
BATCH = int(os.environ.get("VERIFY_BATCH", "3"))
MOCK_MODE = os.environ.get("VERIFY_MOCK", "1") != "0"
BEDROCK_MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"
)
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "ap-southeast-1")

AGENTS: list[str] = ["txn", "behavior", "network", "policy", "victim"]
AGENT_LABELS: dict[str, str] = {
    "txn": "Transaction Analyst",
    "behavior": "Behaviour Analyst",
    "network": "Network Analyst",
    "policy": "Compliance Officer",
    "victim": "Victim Profiler",
}

VERDICTS = ("block", "warn", "clear", "inconclusive")

# Rules fast-path: skip Bedrock entirely for obviously high or obviously low risk.
RULES_HIGH_SCORE = float(os.environ.get("RULES_HIGH_SCORE", "85"))
RULES_LOW_SCORE = float(os.environ.get("RULES_LOW_SCORE", "25"))
ENABLE_RULES_FAST_PATH = os.environ.get("RULES_FAST_PATH", "1") != "0"

# UX trickle: spread finding inserts across this many seconds so the dashboard
# sees streaming arrivals even when the LLM returned them in one shot.
TRICKLE_SECONDS = float(os.environ.get("TRICKLE_SECONDS", "1.6"))


# ---------------------------------------------------------------------------
# DB helpers (DATABASE_URL, same pattern as local_pg_api.py)
# ---------------------------------------------------------------------------

def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL missing in backend/.env")
    return url


@contextmanager
def db_cursor():
    conn = psycopg2.connect(_database_url())
    conn.autocommit = True
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
    finally:
        conn.close()


def _new_run_id() -> str:
    return f"run_{uuid.uuid4().hex[:16]}"


def is_paused() -> bool:
    """Read pause flag from worker_settings. Default false on any DB error."""
    try:
        with db_cursor() as cur:
            cur.execute("SELECT value FROM worker_settings WHERE key = 'paused'")
            row = cur.fetchone()
        if not row:
            return False
        return str(row["value"]).lower() == "true"
    except Exception as e:  # noqa: BLE001
        print(f"[worker] is_paused read failed: {e}", flush=True)
        return False


# ---------------------------------------------------------------------------
# Alert fetch / state transitions
# ---------------------------------------------------------------------------

ALERT_CONTEXT_SQL = """
SELECT
    a.alert_id,
    a.account_id,
    a.txn_id,
    a.alert_type,
    a.risk_score,
    a.stage,
    a.priority,
    a.status,
    a.created_at,
    t.amount,
    t.sender_account_id,
    t.receiver_account_id,
    t.timestamp           AS txn_timestamp,
    t.is_first_transfer,
    t.device_match,
    t.channel,
    sender.account_age_days   AS sender_age_days,
    sender.status             AS sender_status,
    receiver.account_age_days AS receiver_age_days,
    receiver.status           AS receiver_status,
    receiver.device_fingerprint AS receiver_device,
    mc.stage                    AS mule_stage,
    mc.unique_inbound_senders_6h,
    mc.avg_inbound_gap_minutes,
    mc.inbound_outbound_ratio,
    be.scam_type
FROM alerts a
LEFT JOIN transactions t        ON t.txn_id = a.txn_id
LEFT JOIN accounts sender       ON sender.account_id = t.sender_account_id
LEFT JOIN accounts receiver     ON receiver.account_id = a.account_id
LEFT JOIN mule_cases mc         ON mc.mule_case_id = a.mule_case_id
LEFT JOIN bedrock_explanations be ON be.alert_id = a.alert_id
WHERE a.alert_id = %s
LIMIT 1;
"""


def claim_unverified_alerts(limit: int) -> list[dict]:
    """Atomically pick unverified alerts and mark them queued."""
    sql = """
        WITH picked AS (
            SELECT alert_id FROM alerts
            WHERE verification_status IS NULL
              AND status = 'open'
            ORDER BY risk_score DESC NULLS LAST, created_at ASC
            LIMIT %s
            FOR UPDATE SKIP LOCKED
        )
        UPDATE alerts a
           SET verification_status = 'queued'
          FROM picked
         WHERE a.alert_id = picked.alert_id
        RETURNING a.alert_id;
    """
    with db_cursor() as cur:
        cur.execute(sql, (limit,))
        rows = cur.fetchall()
    return [{"alert_id": r["alert_id"]} for r in rows]


def load_alert_context(alert_id: str) -> dict | None:
    with db_cursor() as cur:
        cur.execute(ALERT_CONTEXT_SQL, (alert_id,))
        row = cur.fetchone()
    if not row:
        return None
    return dict(row)


def insert_run(run_id: str, alert_id: str, mode: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO verification_runs (run_id, alert_id, status, mode)
            VALUES (%s, %s, 'running', %s)
            """,
            (run_id, alert_id, mode),
        )
        cur.execute(
            "UPDATE alerts SET verification_status = 'running' WHERE alert_id = %s",
            (alert_id,),
        )


def init_stream(run_id: str, agent_name: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO agent_streams (run_id, agent_name, partial_text, status)
            VALUES (%s, %s, '', 'streaming')
            ON CONFLICT (run_id, agent_name)
            DO UPDATE SET partial_text = '', status = 'streaming',
                          started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            """,
            (run_id, agent_name),
        )


def append_stream(run_id: str, agent_name: str, full_text: str) -> None:
    """Replace partial_text with the latest accumulated buffer."""
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE agent_streams
               SET partial_text = %s,
                   updated_at = CURRENT_TIMESTAMP
             WHERE run_id = %s AND agent_name = %s
            """,
            (full_text, run_id, agent_name),
        )


def complete_stream(run_id: str, agent_name: str, status: str = "done") -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE agent_streams
               SET status = %s, updated_at = CURRENT_TIMESTAMP
             WHERE run_id = %s AND agent_name = %s
            """,
            (status, run_id, agent_name),
        )


def insert_finding(run_id: str, finding: dict) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO agent_findings
                (run_id, agent_name, agent_label, verdict, confidence,
                 evidence, reasoning, latency_ms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                run_id,
                finding["agent_name"],
                AGENT_LABELS.get(finding["agent_name"], finding["agent_name"]),
                finding["verdict"],
                int(finding["confidence"]),
                psycopg2.extras.Json(finding.get("evidence", [])),
                finding["reasoning"],
                int(finding["latency_ms"]),
            ),
        )


def finalise_run(
    run_id: str,
    alert_id: str,
    decision: dict,
    total_ms: int,
    agreement_pct: int,
) -> None:
    """Write final verdict, update alert + agent_actions to keep existing dashboard consistent."""
    final_verdict = decision["final_verdict"]
    consensus = int(decision.get("consensus_score", 0))
    reasoning = decision.get("reasoning", "")

    db_status = "cleared" if final_verdict == "clear" else "resolved"
    decision_label = "false_positive" if final_verdict == "clear" else "fraud"
    notes = f"[auto_verifier] {reasoning}"
    action_id = f"action_auto_{run_id}"

    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE verification_runs
               SET status = 'decided',
                   final_verdict = %s,
                   consensus_score = %s,
                   agreement_pct = %s,
                   total_latency_ms = %s,
                   completed_at = CURRENT_TIMESTAMP,
                   arbiter_reasoning = %s
             WHERE run_id = %s
            """,
            (final_verdict, consensus, agreement_pct, total_ms, reasoning, run_id),
        )
        cur.execute(
            """
            UPDATE alerts
               SET status = %s,
                   resolved_at = CURRENT_TIMESTAMP,
                   verification_status = 'decided'
             WHERE alert_id = %s
            """,
            (db_status, alert_id),
        )
        cur.execute(
            """
            INSERT INTO agent_actions
                (action_id, alert_id, agent_id, action_type,
                 decision_label, notes, created_at)
            VALUES (%s, %s, 'auto_verifier', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (action_id) DO NOTHING
            """,
            (action_id, alert_id, final_verdict, decision_label, notes[:1000]),
        )


def mark_run_failed(run_id: str, alert_id: str, err: str) -> None:
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE verification_runs
                   SET status = 'failed',
                       completed_at = CURRENT_TIMESTAMP,
                       arbiter_reasoning = %s
                 WHERE run_id = %s
                """,
                (f"failed: {err[:500]}", run_id),
            )
            cur.execute(
                "UPDATE alerts SET verification_status = NULL WHERE alert_id = %s",
                (alert_id,),
            )
    except Exception as e:
        print(f"[worker] mark_run_failed db error: {e}")


# ---------------------------------------------------------------------------
# Mock agent reasoning — deterministic based on alert features
# ---------------------------------------------------------------------------

def _band(score: float) -> str:
    if score >= 80:
        return "high"
    if score >= 60:
        return "elevated"
    if score >= 40:
        return "medium"
    return "low"


def _rng_for(alert_id: str, agent: str) -> random.Random:
    return random.Random(f"{alert_id}:{agent}")


def _mock_finding(agent: str, ctx: dict) -> dict:
    rng = _rng_for(ctx["alert_id"], agent)
    score = float(ctx.get("risk_score") or 0)
    band = _band(score)
    amount = float(ctx.get("amount") or 0)
    age_recv = int(ctx.get("receiver_age_days") or 0)
    age_send = int(ctx.get("sender_age_days") or 0)
    is_first = bool(ctx.get("is_first_transfer"))
    device_match = bool(ctx.get("device_match")) if ctx.get("device_match") is not None else True
    mule_stage = str(ctx.get("mule_stage") or "")
    alert_type = str(ctx.get("alert_type") or "")

    base_conf = {"high": 92, "elevated": 80, "medium": 65, "low": 70}[band]
    conf = max(50, min(98, base_conf + rng.randint(-7, 7)))

    if band == "high":
        verdict = "block"
    elif band == "elevated":
        verdict = "block" if rng.random() < 0.7 else "warn"
    elif band == "medium":
        verdict = rng.choice(["warn", "warn", "clear"])
    else:
        verdict = "clear"

    if agent == "txn":
        evidence = [
            {"signal": "amount", "value": f"RM {amount:,.2f}"},
            {"signal": "first_transfer_to_payee", "value": is_first},
            {"signal": "channel", "value": ctx.get("channel") or "unknown"},
        ]
        if amount >= 5000 and is_first and band in ("high", "elevated"):
            verdict = "block"
            conf = max(conf, 90)
            reason = (
                f"First-time transfer of RM{amount:,.0f} on channel "
                f"{ctx.get('channel') or 'unknown'}. Amount + new payee "
                f"matches scam exfiltration pattern."
            )
        else:
            reason = (
                f"Transaction profile {band} risk: amount RM{amount:,.0f}, "
                f"first_transfer={is_first}. Aligns with composite score "
                f"{score:.0f}."
            )

    elif agent == "behavior":
        evidence = [
            {"signal": "device_match", "value": device_match},
            {"signal": "receiver_account_age_days", "value": age_recv},
            {"signal": "sender_account_age_days", "value": age_send},
        ]
        if not device_match and band in ("high", "elevated"):
            verdict = "block"
            conf = max(conf, 88)
            reason = (
                "Device fingerprint mismatch on a high-risk transfer "
                "indicates session compromise or remote takeover."
            )
        elif age_recv <= 14:
            verdict = "block" if band in ("high", "elevated") else "warn"
            reason = (
                f"Receiver account only {age_recv} days old. New accounts "
                f"are heavily over-represented in scam exfiltration."
            )
        else:
            reason = (
                f"Behavioural footprint {band}: device_match={device_match}, "
                f"receiver age {age_recv}d. No takeover signature."
            )

    elif agent == "network":
        evidence = [
            {"signal": "mule_stage", "value": mule_stage or "none"},
            {
                "signal": "inbound_senders_6h",
                "value": ctx.get("unique_inbound_senders_6h") or 0,
            },
            {
                "signal": "io_ratio",
                "value": float(ctx.get("inbound_outbound_ratio") or 0),
            },
        ]
        if mule_stage in ("stage_3", "stage_2"):
            verdict = "block"
            conf = max(conf, 93)
            reason = (
                f"Receiver sits in {mule_stage} mule cluster. "
                f"{ctx.get('unique_inbound_senders_6h') or 0} unique inbound "
                f"senders in 6h confirms layering."
            )
        elif alert_type == "bulk_containment":
            verdict = "warn"
            reason = "Linked to second-degree containment cluster; not a mule head."
        else:
            reason = (
                f"Graph footprint {band}: no active mule cluster, ratio "
                f"{ctx.get('inbound_outbound_ratio') or 0}."
            )

    elif agent == "policy":
        evidence = [
            {"signal": "amount_threshold_RM5000", "value": amount >= 5000},
            {"signal": "alert_type", "value": alert_type or "unknown"},
            {"signal": "stage", "value": ctx.get("stage") or "unknown"},
        ]
        if amount >= 5000 and band in ("high", "elevated"):
            verdict = "block"
            conf = max(conf, 85)
            reason = (
                "BNM PSA Sec 70 + AMLA flag: high-value first-time transfer "
                "to a high-risk receiver requires interception."
            )
        elif band == "low":
            verdict = "clear"
            conf = max(conf, 75)
            reason = "All policy thresholds clear; no AMLA/PSA action required."
        else:
            reason = "Soft-warn threshold under TnG fraud SOP §4.2."

    else:  # victim
        evidence = [
            {"signal": "sender_account_age_days", "value": age_send},
            {"signal": "first_transfer_to_payee", "value": is_first},
            {"signal": "sender_status", "value": ctx.get("sender_status") or "unknown"},
        ]
        if is_first and age_send >= 365 and band in ("high", "elevated"):
            verdict = "block"
            conf = max(conf, 86)
            reason = (
                "Long-tenured sender making a first transfer to a high-risk "
                "payee — strong victim signature for Macau/love scam."
            )
        elif band == "low":
            verdict = "clear"
            reason = "Sender profile consistent with normal everyday spend."
        else:
            reason = (
                f"Sender age {age_send}d, first_transfer={is_first}. "
                f"Possible coercion in progress — recommend warn."
            )

    return {
        "agent_name": agent,
        "verdict": verdict,
        "confidence": conf,
        "evidence": evidence,
        "reasoning": reason,
    }


def _rules_classify(ctx: dict) -> list[dict] | None:
    """
    Fast-path classifier. Returns 5 synthesised findings if the case is
    obviously high or obviously low risk, otherwise None (defer to Bedrock).
    """
    if not ENABLE_RULES_FAST_PATH:
        return None

    score = float(ctx.get("risk_score") or 0)
    mule_stage = str(ctx.get("mule_stage") or "")
    age_recv = int(ctx.get("receiver_age_days") or 0)
    is_first = bool(ctx.get("is_first_transfer"))
    device_match = bool(ctx.get("device_match")) if ctx.get("device_match") is not None else True
    amount = float(ctx.get("amount") or 0)

    obvious_high = (
        score >= RULES_HIGH_SCORE
        and (mule_stage in ("stage_3", "stage_2") or age_recv <= 7)
    )
    obvious_low = score <= RULES_LOW_SCORE and device_match and not is_first and amount < 500

    if not (obvious_high or obvious_low):
        return None

    findings: list[dict] = []
    for agent in AGENTS:
        f = _mock_finding(agent, ctx)
        # Pin verdict so rules path is decisive (no per-agent dissent here).
        if obvious_high:
            f["verdict"] = "block"
            f["confidence"] = max(f["confidence"], 92)
            f["reasoning"] = (
                f"[rules] Score {score:.0f}, receiver age {age_recv}d, mule {mule_stage or 'n/a'}. "
                + f["reasoning"][:140]
            )
        else:
            f["verdict"] = "clear"
            f["confidence"] = max(f["confidence"], 75)
            f["reasoning"] = (
                f"[rules] Score {score:.0f}, device match, repeat payee, low amount. "
                + f["reasoning"][:140]
            )
        findings.append(f)
    return findings


def _arbitrate(findings: list[dict]) -> tuple[dict, int]:
    """Majority verdict weighted by confidence; returns (decision, agreement_pct)."""
    weights: dict[str, float] = {"block": 0.0, "warn": 0.0, "clear": 0.0, "inconclusive": 0.0}
    counts: dict[str, int] = {"block": 0, "warn": 0, "clear": 0, "inconclusive": 0}
    for f in findings:
        v = f["verdict"]
        weights[v] = weights.get(v, 0) + float(f["confidence"])
        counts[v] = counts.get(v, 0) + 1

    final = max(("block", "warn", "clear"), key=lambda k: weights.get(k, 0))
    if weights["block"] == weights["warn"] == weights["clear"] == 0:
        final = "warn"

    total = sum(counts.values()) or 1
    agreement = round(100 * counts[final] / total)
    consensus = int(round(weights[final] / max(counts[final], 1))) if counts[final] else 0
    reasoning = (
        f"{counts[final]}/{total} agents converged on {final.upper()} "
        f"with average confidence {consensus}%. "
        f"Block={counts['block']} Warn={counts['warn']} Clear={counts['clear']}."
    )
    return (
        {
            "final_verdict": final,
            "consensus_score": consensus,
            "reasoning": reasoning,
        },
        agreement,
    )


# ---------------------------------------------------------------------------
# Bedrock real-mode agents (only used if VERIFY_MOCK=0)
# ---------------------------------------------------------------------------

_BEDROCK_PROMPTS = {
    "txn": (
        "You are a transaction analyst at Touch 'n Go's fraud desk. "
        "Score the transaction profile for scam exfiltration risk."
    ),
    "behavior": (
        "You are a behavioural analyst. Look at device fingerprint, "
        "account age and login signals for takeover indicators."
    ),
    "network": (
        "You are a graph analyst. Decide whether the receiver participates "
        "in a mule layering cluster."
    ),
    "policy": (
        "You are a Malaysian compliance officer. Apply BNM PSA, AMLA and "
        "TnG fraud SOP thresholds to recommend an action."
    ),
    "victim": (
        "You are a victim profiler. Assess whether the sender is being "
        "coerced (Macau / love / investment scam victim signature)."
    ),
}

_BEDROCK_OUTPUT = (
    'Return ONLY JSON: {"verdict":"block|warn|clear|inconclusive",'
    '"confidence":0-100,"evidence":[{"signal":"...","value":"..."}],'
    '"reasoning":"<two short sentences>"}'
)


def _extract_json(text: str) -> str:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return fence.group(1)
    brace = re.search(r"\{.*\}", text, re.DOTALL)
    return brace.group(0) if brace else text


_bedrock_client = None


def _get_bedrock_client():
    """Cached client with adaptive retry so throttling is handled automatically."""
    global _bedrock_client
    if _bedrock_client is None:
        import boto3  # lazy import
        from botocore.config import Config

        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=BEDROCK_REGION,
            config=Config(
                retries={"max_attempts": 8, "mode": "adaptive"},
                connect_timeout=8,
                read_timeout=30,
            ),
        )
    return _bedrock_client


async def _bedrock_finding(agent: str, ctx: dict) -> dict:
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 400,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"{_BEDROCK_PROMPTS[agent]}\n\n"
                        f"Alert context:\n{json.dumps(_safe_ctx(ctx), default=str)}\n\n"
                        f"{_BEDROCK_OUTPUT}"
                    ),
                }
            ],
        }
    )

    def _invoke():
        client = _get_bedrock_client()
        resp = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        payload = json.loads(resp["body"].read())
        return payload.get("content", [{}])[0].get("text", "")

    loop = asyncio.get_event_loop()
    text = await loop.run_in_executor(None, _invoke)
    parsed = json.loads(_extract_json(text))
    parsed["agent_name"] = agent
    parsed["verdict"] = str(parsed.get("verdict", "inconclusive")).lower()
    if parsed["verdict"] not in VERDICTS:
        parsed["verdict"] = "inconclusive"
    parsed["confidence"] = int(parsed.get("confidence", 50))
    parsed.setdefault("evidence", [])
    parsed.setdefault("reasoning", "(no reasoning)")
    return parsed


# Debounce DB writes during streaming so we don't hammer Postgres on every token.
STREAM_DB_FLUSH_SEC = float(os.environ.get("STREAM_DB_FLUSH_SEC", "0.18"))


async def _bedrock_finding_streamed(agent: str, ctx: dict, run_id: str) -> dict:
    """Per-agent Bedrock streaming call. Tokens flushed to agent_streams as they arrive."""
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 400,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"{_BEDROCK_PROMPTS[agent]}\n\n"
                        f"Alert context:\n{json.dumps(_safe_ctx(ctx), default=str)}\n\n"
                        f"{_BEDROCK_OUTPUT}"
                    ),
                }
            ],
        }
    )

    init_stream(run_id, agent)
    loop = asyncio.get_event_loop()
    buffer: list[str] = []
    last_flush = time.time()

    def _open_stream():
        client = _get_bedrock_client()
        return client.invoke_model_with_response_stream(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )

    def _flush_blocking(text: str):
        try:
            append_stream(run_id, agent, text)
        except Exception as e:  # noqa: BLE001
            print(f"[worker] stream flush ({agent}) error: {e}", flush=True)

    try:
        resp = await loop.run_in_executor(None, _open_stream)
        stream = resp["body"]

        # Iterator is blocking; pump it on the executor a chunk at a time.
        def _next_event(it):
            try:
                return next(it)
            except StopIteration:
                return None

        it = iter(stream)
        while True:
            event = await loop.run_in_executor(None, _next_event, it)
            if event is None:
                break
            chunk = event.get("chunk")
            if not chunk:
                continue
            data = json.loads(chunk["bytes"])
            etype = data.get("type")
            if etype == "content_block_delta":
                delta = data.get("delta") or {}
                text_delta = delta.get("text") or ""
                if text_delta:
                    buffer.append(text_delta)
                    now = time.time()
                    if now - last_flush >= STREAM_DB_FLUSH_SEC:
                        last_flush = now
                        await loop.run_in_executor(None, _flush_blocking, "".join(buffer))
            elif etype == "message_stop":
                break
        # Final flush + parse
        full_text = "".join(buffer)
        await loop.run_in_executor(None, _flush_blocking, full_text)
        complete_stream(run_id, agent, "done")

        parsed = json.loads(_extract_json(full_text)) if full_text.strip() else {}
    except Exception as e:  # noqa: BLE001
        complete_stream(run_id, agent, "error")
        print(f"[worker] stream ({agent}) failed: {e}", flush=True)
        parsed = {}

    parsed.setdefault("verdict", "inconclusive")
    parsed["agent_name"] = agent
    parsed["verdict"] = str(parsed.get("verdict", "inconclusive")).lower()
    if parsed["verdict"] not in VERDICTS:
        parsed["verdict"] = "inconclusive"
    parsed["confidence"] = int(parsed.get("confidence", 50))
    parsed.setdefault("evidence", [])
    parsed.setdefault("reasoning", "(no reasoning)")
    return parsed


async def _mock_finding_streamed(agent: str, ctx: dict, run_id: str) -> dict:
    """Mock equivalent: emit `reasoning` as fake tokens to agent_streams."""
    init_stream(run_id, agent)
    final = _mock_finding(agent, ctx)
    text = str(final.get("reasoning") or "")
    # Chunk into ~6-char tokens to mimic streaming cadence
    loop = asyncio.get_event_loop()
    buf: list[str] = []
    chunk_size = 6
    pieces = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)] or [""]
    last_flush = time.time()
    for piece in pieces:
        buf.append(piece)
        await asyncio.sleep(0.05 + random.uniform(0, 0.05))
        now = time.time()
        if now - last_flush >= STREAM_DB_FLUSH_SEC:
            last_flush = now
            await loop.run_in_executor(None, append_stream, run_id, agent, "".join(buf))
    await loop.run_in_executor(None, append_stream, run_id, agent, text)
    complete_stream(run_id, agent, "done")
    return final


_BEDROCK_TEAM_PROMPT = """You ARE the SafeSend autonomous fraud-review team. Five specialists review the alert IN PARALLEL and each emit one short verdict.

Specialists:
1. txn       (Transaction Analyst): amount, velocity, channel.
2. behavior  (Behaviour Analyst): device match, account age, takeover signals.
3. network   (Network Analyst): mule cluster, hops, inbound/outbound ratio.
4. policy    (Compliance Officer): BNM PSA, AMLA, TnG fraud SOP thresholds.
5. victim    (Victim Profiler): sender profile, coercion / Macau / love / investment scam shape.

Each specialist returns:
  verdict in {"block","warn","clear","inconclusive"}
  confidence integer 0-100
  evidence: 2-3 short {"signal","value"} entries
  reasoning: ONE short sentence

Distinct angles, no two should give identical reasoning. Real specialists disagree sometimes — that is fine.

Return ONLY a JSON object exactly like:
{
  "agents": [
    {"name":"txn","verdict":"...","confidence":0,"evidence":[{"signal":"...","value":"..."}],"reasoning":"..."},
    {"name":"behavior", ...},
    {"name":"network", ...},
    {"name":"policy", ...},
    {"name":"victim", ...}
  ]
}
"""


async def _bedrock_team_findings(ctx: dict) -> list[dict]:
    """One Bedrock invocation -> 5 agent findings. Big speedup vs serial calls."""
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 900,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"{_BEDROCK_TEAM_PROMPT}\n"
                        f"Alert context:\n{json.dumps(_safe_ctx(ctx), default=str)}"
                    ),
                }
            ],
        }
    )

    def _invoke():
        client = _get_bedrock_client()
        resp = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        payload = json.loads(resp["body"].read())
        return payload.get("content", [{}])[0].get("text", "")

    loop = asyncio.get_event_loop()
    text = await loop.run_in_executor(None, _invoke)
    parsed = json.loads(_extract_json(text))
    raw_agents = parsed.get("agents") or []

    by_name = {str(a.get("name", "")).lower(): a for a in raw_agents}
    out: list[dict] = []
    for agent in AGENTS:
        a = by_name.get(agent) or {}
        verdict = str(a.get("verdict", "inconclusive")).lower()
        if verdict not in VERDICTS:
            verdict = "inconclusive"
        out.append(
            {
                "agent_name": agent,
                "verdict": verdict,
                "confidence": int(a.get("confidence", 50)),
                "evidence": a.get("evidence") or [],
                "reasoning": str(a.get("reasoning") or "(no reasoning)"),
            }
        )
    return out


def _safe_ctx(ctx: dict) -> dict:
    """Trim context to JSON-serialisable fields for Bedrock."""
    keys = (
        "alert_id alert_type risk_score stage priority status "
        "amount sender_account_id receiver_account_id is_first_transfer "
        "device_match channel sender_age_days receiver_age_days "
        "mule_stage unique_inbound_senders_6h inbound_outbound_ratio "
        "scam_type"
    ).split()
    out = {}
    for k in keys:
        v = ctx.get(k)
        if v is None:
            continue
        if isinstance(v, (datetime,)):
            v = v.isoformat()
        out[k] = v
    return out


# ---------------------------------------------------------------------------
# Per-alert verification flow
# ---------------------------------------------------------------------------

async def run_one(agent: str, ctx: dict) -> dict:
    t0 = time.time()
    if MOCK_MODE:
        # Realistic per-agent latency so the dashboard sees streaming arrivals.
        await asyncio.sleep(random.uniform(0.4, 1.1))
        finding = _mock_finding(agent, ctx)
    else:
        finding = await _bedrock_finding(agent, ctx)
    finding["latency_ms"] = int((time.time() - t0) * 1000)
    return finding


async def verify_alert(alert_id: str) -> None:
    ctx = load_alert_context(alert_id)
    if not ctx:
        print(f"[worker] alert {alert_id} disappeared; skipping")
        with db_cursor() as cur:
            cur.execute(
                "UPDATE alerts SET verification_status = NULL WHERE alert_id = %s",
                (alert_id,),
            )
        return

    run_id = _new_run_id()
    started = time.time()

    # 1) Rules fast-path (no LLM, ~10ms)
    rules_findings = _rules_classify(ctx)
    if rules_findings is not None:
        mode = "rules"
        insert_run(run_id, alert_id, mode)
        print(
            f"[worker] run {run_id} alert={alert_id} mode={mode} score={ctx.get('risk_score')}",
            flush=True,
        )
        findings = await _stream_findings(run_id, rules_findings, started)
    else:
        mode = "mock" if MOCK_MODE else "bedrock"
        insert_run(run_id, alert_id, mode)
        print(
            f"[worker] run {run_id} alert={alert_id} mode={mode} score={ctx.get('risk_score')}",
            flush=True,
        )

        # 2) Per-agent streaming: 5 calls in parallel, tokens written to
        #    agent_streams as they arrive. Each agent finalises independently.
        async def _stream_one(agent: str) -> dict:
            t0 = time.time()
            try:
                if MOCK_MODE:
                    f = await _mock_finding_streamed(agent, ctx, run_id)
                else:
                    f = await _bedrock_finding_streamed(agent, ctx, run_id)
            except Exception as e:  # noqa: BLE001
                print(f"[worker] agent {agent} failed: {e}", flush=True)
                f = {
                    "agent_name": agent,
                    "verdict": "inconclusive",
                    "confidence": 0,
                    "evidence": [{"signal": "error", "value": str(e)[:200]}],
                    "reasoning": f"Agent {agent} failed: {e}",
                }
            f["latency_ms"] = int((time.time() - t0) * 1000)
            try:
                insert_finding(run_id, f)
            except Exception as e:  # noqa: BLE001
                print(f"[worker] insert_finding ({agent}) failed: {e}", flush=True)
            return f

        findings = await asyncio.gather(*[_stream_one(a) for a in AGENTS])

    # Tiny pause so the arbiter feels like a separate step.
    await asyncio.sleep(random.uniform(0.2, 0.4))

    decision, agreement = _arbitrate(findings)
    total_ms = int((time.time() - started) * 1000)

    try:
        finalise_run(run_id, alert_id, decision, total_ms, agreement)
        print(
            f"[worker] run {run_id} -> {decision['final_verdict']} "
            f"({agreement}% agree, {total_ms}ms, mode={mode})",
            flush=True,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[worker] finalise_run failed: {e}", flush=True)
        mark_run_failed(run_id, alert_id, str(e))


async def _mock_team_findings(ctx: dict) -> list[dict]:
    """Mock equivalent of single-shot team call: returns 5 findings instantly."""
    return [_mock_finding(a, ctx) for a in AGENTS]


async def _stream_findings(run_id: str, findings_data: list[dict], started: float) -> list[dict]:
    """Insert findings one-by-one with a small gap so the dashboard sees streaming arrivals."""
    n = max(1, len(findings_data))
    gap = max(0.05, TRICKLE_SECONDS / n)
    out: list[dict] = []
    for f in findings_data:
        f.setdefault("latency_ms", int((time.time() - started) * 1000))
        try:
            insert_finding(run_id, f)
        except Exception as e:  # noqa: BLE001
            print(f"[worker] insert_finding failed: {e}", flush=True)
        out.append(f)
        await asyncio.sleep(gap)
    return out


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

_running = True


def _stop(*_args: Any) -> None:
    global _running
    _running = False
    print("[worker] shutdown requested")


async def _release_claim(alert_id: str) -> None:
    """Reset a claimed alert back to unverified so it can be re-picked later."""
    try:
        with db_cursor() as cur:
            cur.execute(
                "UPDATE alerts SET verification_status = NULL WHERE alert_id = %s "
                "AND verification_status IN ('queued','running')",
                (alert_id,),
            )
    except Exception as e:  # noqa: BLE001
        print(f"[worker] release_claim error: {e}", flush=True)


async def main_loop() -> None:
    sem = asyncio.Semaphore(BATCH)
    inflight: set[asyncio.Task] = set()
    last_paused_state = False

    while _running:
        paused_now = is_paused()
        if paused_now != last_paused_state:
            print(
                f"[worker] state change: {'PAUSED' if paused_now else 'RESUMED'}",
                flush=True,
            )
            last_paused_state = paused_now
            # On pause: cancel every queued/in-flight task so the dashboard
            # sees an immediate stop rather than a long drain.
            if paused_now and inflight:
                count = len(inflight)
                print(f"[worker] cancelling {count} in-flight task(s)", flush=True)
                for t in list(inflight):
                    t.cancel()
                results = await asyncio.gather(*inflight, return_exceptions=True)
                inflight.clear()
                cancelled = sum(1 for r in results if isinstance(r, asyncio.CancelledError))
                print(f"[worker] cancelled {cancelled}/{count}", flush=True)

        if paused_now:
            await asyncio.sleep(POLL_SEC)
            continue

        try:
            picked = claim_unverified_alerts(BATCH)
        except Exception as e:  # noqa: BLE001
            print(f"[worker] claim error: {e}", flush=True)
            picked = []

        for entry in picked:
            alert_id = entry["alert_id"]

            async def _run(aid: str = alert_id) -> None:
                try:
                    async with sem:
                        await verify_alert(aid)
                except asyncio.CancelledError:
                    # Pause cancelled us mid-flight — release the claim so the
                    # alert returns to the queue when the worker resumes.
                    await _release_claim(aid)
                    raise

            t = asyncio.create_task(_run())
            inflight.add(t)
            t.add_done_callback(inflight.discard)

        await asyncio.sleep(POLL_SEC)

    if inflight:
        print(f"[worker] draining {len(inflight)} in-flight runs", flush=True)
        await asyncio.gather(*inflight, return_exceptions=True)


def main() -> int:
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    print(
        f"[worker] starting (mode={'mock' if MOCK_MODE else 'bedrock'} "
        f"poll={POLL_SEC}s batch={BATCH})"
    )
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        pass
    print("[worker] exit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
