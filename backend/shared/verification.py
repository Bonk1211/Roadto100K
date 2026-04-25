"""
SafeSend autonomous fraud-verification module.

Consolidated for Lambda execution: SQS handler invokes verify_alert(alert_id),
HTTP API handlers call load_* / state helpers. Local dev scripts import the
same module so behaviour matches between local + cloud.

Tables (created by init_verification_schema.py):
  verification_runs   — one row per verification cycle
  agent_findings      — one row per agent verdict (final, after stream completes)
  agent_streams       — partial reasoning text written incrementally during stream
  worker_settings     — pause flag (legacy; SQS-driven workers ignore it)
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import re
import time
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any

import psycopg2
import psycopg2.extras

from .db import _get_conn

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BEDROCK_MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"
)
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "ap-southeast-1")

MOCK_MODE = os.environ.get("VERIFY_MOCK", "1") != "0"

RULES_HIGH_SCORE = float(os.environ.get("RULES_HIGH_SCORE", "85"))
RULES_LOW_SCORE = float(os.environ.get("RULES_LOW_SCORE", "25"))
ENABLE_RULES_FAST_PATH = os.environ.get("RULES_FAST_PATH", "1") != "0"

STREAM_DB_FLUSH_SEC = float(os.environ.get("STREAM_DB_FLUSH_SEC", "0.18"))
STALE_RUN_SECONDS = int(os.environ.get("STALE_RUN_SECONDS", "120"))

AGENTS: list[str] = ["txn", "behavior", "network", "policy", "victim"]
AGENT_LABELS: dict[str, str] = {
    "txn": "Transaction Analyst",
    "behavior": "Behaviour Analyst",
    "network": "Network Analyst",
    "policy": "Compliance Officer",
    "victim": "Victim Profiler",
}
VERDICTS = ("block", "warn", "clear", "inconclusive")

# ---------------------------------------------------------------------------
# DB helpers — reuse shared cached conn
# ---------------------------------------------------------------------------


@contextmanager
def db_cursor():
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
    finally:
        cur.close()


def _fetch_dicts(cur) -> list[dict]:
    return [dict(r) for r in cur.fetchall()]


def _new_run_id() -> str:
    return f"vrun_{uuid.uuid4().hex[:16]}"


# ---------------------------------------------------------------------------
# Alert claim / context
# ---------------------------------------------------------------------------

ALERT_CONTEXT_SQL = """
SELECT
    a.alert_id, a.account_id, a.txn_id, a.alert_type, a.risk_score,
    a.stage, a.priority, a.status, a.created_at,
    t.amount, t.sender_account_id, t.receiver_account_id,
    t.timestamp AS txn_timestamp,
    t.is_first_transfer, t.device_match, t.channel,
    sender.account_age_days   AS sender_age_days,
    sender.status             AS sender_status,
    receiver.account_age_days AS receiver_age_days,
    receiver.status           AS receiver_status,
    receiver.device_fingerprint AS receiver_device,
    mc.stage                  AS mule_stage,
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


def load_alert_context(alert_id: str) -> dict | None:
    with db_cursor() as cur:
        cur.execute(ALERT_CONTEXT_SQL, (alert_id,))
        row = cur.fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Run + finding inserts
# ---------------------------------------------------------------------------


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
                int(finding.get("latency_ms", 0)),
            ),
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
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE agent_streams
               SET partial_text = %s, updated_at = CURRENT_TIMESTAMP
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


def finalise_run(
    run_id: str,
    alert_id: str,
    decision: dict,
    total_ms: int,
    agreement_pct: int,
) -> None:
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
               SET status = 'decided', final_verdict = %s, consensus_score = %s,
                   agreement_pct = %s, total_latency_ms = %s,
                   completed_at = CURRENT_TIMESTAMP, arbiter_reasoning = %s
             WHERE run_id = %s
            """,
            (final_verdict, consensus, agreement_pct, total_ms, reasoning, run_id),
        )
        cur.execute(
            """
            UPDATE alerts
               SET status = %s, resolved_at = CURRENT_TIMESTAMP,
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
                   SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
                       arbiter_reasoning = %s
                 WHERE run_id = %s
                """,
                (f"failed: {err[:500]}", run_id),
            )
            cur.execute(
                "UPDATE alerts SET verification_status = NULL WHERE alert_id = %s",
                (alert_id,),
            )
    except Exception as e:  # noqa: BLE001
        print(f"[verification] mark_run_failed error: {e}")


def expire_stale_runs() -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE verification_runs
               SET status = 'failed',
                   completed_at = COALESCE(completed_at, NOW()),
                   arbiter_reasoning = COALESCE(arbiter_reasoning,
                       '[auto] expired — worker silent > %s s')
             WHERE status = 'running'
               AND started_at < NOW() - (%s || ' seconds')::INTERVAL
             RETURNING alert_id
            """,
            (STALE_RUN_SECONDS, STALE_RUN_SECONDS),
        )
        expired = [r["alert_id"] for r in cur.fetchall()]
        if expired:
            cur.execute(
                """
                UPDATE alerts SET verification_status = 'failed'
                 WHERE alert_id = ANY(%s)
                   AND verification_status IN ('running', 'queued')
                """,
                (expired,),
            )


# ---------------------------------------------------------------------------
# Mock agent reasoning — deterministic
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
                f"{ctx.get('channel') or 'unknown'}. Amount + new payee matches scam exfiltration."
            )
        else:
            reason = (
                f"Transaction profile {band} risk: amount RM{amount:,.0f}, first_transfer={is_first}."
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
            reason = "Device fingerprint mismatch on high-risk transfer indicates session compromise."
        elif age_recv <= 14:
            verdict = "block" if band in ("high", "elevated") else "warn"
            reason = f"Receiver account only {age_recv} days old. New accounts over-represented in scam."
        else:
            reason = f"Behavioural footprint {band}: device_match={device_match}, receiver age {age_recv}d."
    elif agent == "network":
        evidence = [
            {"signal": "mule_stage", "value": mule_stage or "none"},
            {"signal": "inbound_senders_6h", "value": ctx.get("unique_inbound_senders_6h") or 0},
            {"signal": "io_ratio", "value": float(ctx.get("inbound_outbound_ratio") or 0)},
        ]
        if mule_stage in ("stage_3", "stage_2"):
            verdict = "block"
            conf = max(conf, 93)
            reason = (
                f"Receiver sits in {mule_stage} mule cluster. "
                f"{ctx.get('unique_inbound_senders_6h') or 0} unique inbound senders in 6h confirms layering."
            )
        elif alert_type == "bulk_containment":
            verdict = "warn"
            reason = "Linked to second-degree containment cluster; not a mule head."
        else:
            reason = f"Graph footprint {band}: no active mule cluster, ratio {ctx.get('inbound_outbound_ratio') or 0}."
    elif agent == "policy":
        evidence = [
            {"signal": "amount_vs_bnm_threshold", "value": amount >= 1500},
            {"signal": "alert_type", "value": alert_type or "open_investigation"},
            {"signal": "scam_type", "value": ctx.get("scam_type") or "n/a"},
        ]
        if amount >= 1500 and band in ("high", "elevated"):
            verdict = "block"
            conf = max(conf, 90)
            reason = (
                f"Transfer of RM{amount:,.0f} crosses BNM PSA enhanced-due-diligence threshold "
                "and aligns with scam typology. SOP requires hold + customer callback."
            )
        elif alert_type in ("scam_outflow_burst", "containment_cascade"):
            verdict = "warn"
            reason = "AMLA Section 29 triggers customer notification; recommend warn + cool-off."
        else:
            reason = f"Within BNM low-friction band; risk score {score:.0f}, no SOP escalation."
    else:  # victim
        evidence = [
            {"signal": "sender_account_age_days", "value": age_send},
            {"signal": "scam_type_hint", "value": ctx.get("scam_type") or "unknown"},
            {"signal": "first_transfer_to_payee", "value": is_first},
        ]
        scam = (ctx.get("scam_type") or "").lower()
        if scam in ("macau_scam", "love_scam", "investment_scam"):
            verdict = "block" if band in ("high", "elevated") else "warn"
            conf = max(conf, 85)
            reason = (
                f"Sender profile matches {scam.replace('_', ' ')} victim signature. "
                "Pattern shows urgency, coercion, transfer to unknown payee."
            )
        elif age_send >= 365 and is_first and amount >= 2000:
            verdict = "warn"
            reason = (
                f"Long-tenured sender ({age_send}d) sending RM{amount:,.0f} to first-time payee "
                "is atypical — possible coercion."
            )
        else:
            reason = f"Sender behavioural baseline {band}; no clear victim signature."

    return {
        "agent_name": agent,
        "verdict": verdict,
        "confidence": conf,
        "evidence": evidence,
        "reasoning": reason,
    }


# ---------------------------------------------------------------------------
# Rules fast-path + arbiter
# ---------------------------------------------------------------------------


def rules_classify(ctx: dict) -> list[dict] | None:
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


def arbitrate(findings: list[dict]) -> tuple[dict, int]:
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
    return ({"final_verdict": final, "consensus_score": consensus, "reasoning": reasoning}, agreement)


# ---------------------------------------------------------------------------
# Bedrock streaming agents
# ---------------------------------------------------------------------------

_BEDROCK_PROMPTS = {
    "txn": "You are a transaction analyst at Touch 'n Go's fraud desk. Score the transaction profile for scam exfiltration risk.",
    "behavior": "You are a behavioural analyst. Look at device fingerprint, account age and login signals for takeover indicators.",
    "network": "You are a graph analyst. Decide whether the receiver participates in a mule layering cluster.",
    "policy": "You are a Malaysian compliance officer. Apply BNM PSA, AMLA and TnG fraud SOP thresholds to recommend an action.",
    "victim": "You are a victim profiler. Assess whether the sender is being coerced (Macau / love / investment scam victim signature).",
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


def _safe_ctx(ctx: dict) -> dict:
    """Minimal context fields the agents actually reason on. Trim = faster prompt."""
    keys = (
        "alert_type risk_score amount is_first_transfer device_match "
        "sender_age_days receiver_age_days mule_stage "
        "unique_inbound_senders_6h inbound_outbound_ratio scam_type"
    ).split()
    out = {}
    for k in keys:
        v = ctx.get(k)
        if v is None:
            continue
        if isinstance(v, datetime):
            v = v.isoformat()
        out[k] = v
    return out


_bedrock_client = None


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        import boto3
        from botocore.config import Config

        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=BEDROCK_REGION,
            config=Config(
                retries={"max_attempts": 8, "mode": "adaptive"},
                connect_timeout=8,
                read_timeout=60,
            ),
        )
    return _bedrock_client


async def _bedrock_finding_streamed(agent: str, ctx: dict, run_id: str) -> dict:
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 200,  # JSON verdict fits in <120 tokens — cap cuts latency
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
            print(f"[verify] flush ({agent}) error: {e}")

    try:
        resp = await loop.run_in_executor(None, _open_stream)
        stream = resp["body"]

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
        full_text = "".join(buffer)
        await loop.run_in_executor(None, _flush_blocking, full_text)
        complete_stream(run_id, agent, "done")
        parsed = json.loads(_extract_json(full_text)) if full_text.strip() else {}
    except Exception as e:  # noqa: BLE001
        complete_stream(run_id, agent, "error")
        err_str = str(e)[:300]
        print(f"[verify] stream ({agent}) failed: {err_str}")
        parsed = {
            "verdict": "inconclusive",
            "confidence": 0,
            "evidence": [{"signal": "bedrock_error", "value": err_str}],
            "reasoning": f"Bedrock stream failed for {agent}: {err_str}",
        }

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
    init_stream(run_id, agent)
    final = _mock_finding(agent, ctx)
    text = str(final.get("reasoning") or "")
    loop = asyncio.get_event_loop()
    buf: list[str] = []
    pieces = [text[i : i + 6] for i in range(0, len(text), 6)] or [""]
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


# ---------------------------------------------------------------------------
# Verification entry point — called by SQS handler
# ---------------------------------------------------------------------------


async def verify_alert_async(alert_id: str) -> None:
    ctx = load_alert_context(alert_id)
    if not ctx:
        print(f"[verify] alert {alert_id} disappeared; skipping")
        with db_cursor() as cur:
            cur.execute(
                "UPDATE alerts SET verification_status = NULL WHERE alert_id = %s",
                (alert_id,),
            )
        return

    run_id = _new_run_id()
    started = time.time()

    rules_findings = rules_classify(ctx)
    if rules_findings is not None:
        mode = "rules"
        insert_run(run_id, alert_id, mode)
        print(f"[verify] run {run_id} alert={alert_id} mode={mode}", flush=True)
        for f in rules_findings:
            f.setdefault("latency_ms", int((time.time() - started) * 1000))
            try:
                insert_finding(run_id, f)
            except Exception as e:  # noqa: BLE001
                print(f"[verify] insert_finding (rules) failed: {e}")
        findings = rules_findings
    else:
        mode = "mock" if MOCK_MODE else "bedrock"
        insert_run(run_id, alert_id, mode)
        print(f"[verify] run {run_id} alert={alert_id} mode={mode}", flush=True)

        # Cap concurrent Bedrock streams to avoid ThrottlingException.
        # 5 agents × multiple in-flight runs × default account quota
        # → easy to exceed. Semaphore stages calls 2-at-a-time per run.
        bedrock_sem = asyncio.Semaphore(int(os.environ.get("BEDROCK_STREAM_CONCURRENCY", "2")))

        async def _stream_one(agent: str) -> dict:
            t0 = time.time()
            try:
                if MOCK_MODE:
                    f = await _mock_finding_streamed(agent, ctx, run_id)
                else:
                    async with bedrock_sem:
                        f = await _bedrock_finding_streamed(agent, ctx, run_id)
            except Exception as e:  # noqa: BLE001
                print(f"[verify] agent {agent} failed: {e}")
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
                print(f"[verify] insert_finding ({agent}) failed: {e}")
            return f

        findings = await asyncio.gather(*[_stream_one(a) for a in AGENTS])

    decision, agreement = arbitrate(findings)
    total_ms = int((time.time() - started) * 1000)

    try:
        finalise_run(run_id, alert_id, decision, total_ms, agreement)
        print(
            f"[verify] run {run_id} -> {decision['final_verdict']} "
            f"({agreement}% agree, {total_ms}ms, mode={mode})",
            flush=True,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[verify] finalise_run failed: {e}")
        mark_run_failed(run_id, alert_id, str(e))


def verify_alert(alert_id: str) -> None:
    """Sync wrapper for Lambda handlers."""
    asyncio.run(verify_alert_async(alert_id))


# ---------------------------------------------------------------------------
# API loaders (used by HTTP API Lambdas + local_pg_api)
# ---------------------------------------------------------------------------


def _findings_for_runs(cur, run_ids):
    if not run_ids:
        return {}
    cur.execute(
        """
        SELECT run_id, agent_name, agent_label, verdict, confidence,
               evidence, reasoning, latency_ms, created_at
          FROM agent_findings
         WHERE run_id = ANY(%s)
         ORDER BY created_at ASC, finding_id ASC
        """,
        (list(run_ids),),
    )
    grouped: dict = {}
    for f in _fetch_dicts(cur):
        grouped.setdefault(f["run_id"], []).append(
            {
                "agent_name": f["agent_name"],
                "agent_label": f["agent_label"] or f["agent_name"],
                "verdict": f["verdict"],
                "confidence": int(f["confidence"]),
                "evidence": f["evidence"] or [],
                "reasoning": f["reasoning"],
                "latency_ms": int(f["latency_ms"] or 0),
                "created_at": f["created_at"],
            }
        )
    return grouped


def _streams_for_runs(cur, run_ids):
    if not run_ids:
        return {}
    cur.execute(
        """
        SELECT run_id, agent_name, partial_text, status, started_at, updated_at
          FROM agent_streams
         WHERE run_id = ANY(%s)
        """,
        (list(run_ids),),
    )
    grouped: dict = {}
    for s in _fetch_dicts(cur):
        grouped.setdefault(s["run_id"], []).append(
            {
                "agent_name": s["agent_name"],
                "partial_text": s["partial_text"] or "",
                "status": s["status"],
                "started_at": s["started_at"],
                "updated_at": s["updated_at"],
            }
        )
    return grouped


def _serialise_run(row, findings, streams=None, signals=None):
    return {
        "run_id": row["run_id"],
        "alert_id": row["alert_id"],
        "status": row["status"],
        "mode": row.get("mode"),
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
        "final_verdict": row["final_verdict"],
        "consensus_score": int(row["consensus_score"]) if row["consensus_score"] is not None else None,
        "agreement_pct": int(row["agreement_pct"]) if row["agreement_pct"] is not None else None,
        "total_latency_ms": int(row["total_latency_ms"]) if row["total_latency_ms"] is not None else None,
        "arbiter_reasoning": row["arbiter_reasoning"],
        "alert_type": row["alert_type"],
        "risk_score": float(row["risk_score"]) if row["risk_score"] is not None else 0.0,
        "amount": float(row["amount"]) if row["amount"] is not None else 0.0,
        "scam_type": row["scam_type"],
        "stage": row["stage"],
        "priority": row["priority"],
        "rule_score": float(row["rule_score"]) if row.get("rule_score") is not None else None,
        "ml_score": float(row["ml_score"]) if row.get("ml_score") is not None else None,
        "composite_score": float(row["composite_score"]) if row.get("composite_score") is not None else None,
        "triggered_signals": signals or [],
        "findings": findings,
        "streams": streams or [],
    }


def _signals_for_runs(cur, run_ids):
    """Bulk-fetch triggered risk_signals per run via alert.txn_id JOIN."""
    if not run_ids:
        return {}
    cur.execute(
        """
        SELECT vr.run_id,
               sig.signal_name,
               sig.signal_value,
               sig.points
          FROM verification_runs vr
          JOIN alerts a       ON a.alert_id = vr.alert_id
          JOIN risk_scores rs ON rs.txn_id  = a.txn_id
          JOIN risk_signals sig ON sig.risk_score_id = rs.risk_score_id
         WHERE vr.run_id = ANY(%s) AND sig.fired = true
        """,
        (list(run_ids),),
    )
    grouped: dict = {}
    for s in _fetch_dicts(cur):
        grouped.setdefault(s["run_id"], []).append({
            "signal": s["signal_name"],
            "label": s["signal_value"],
            "weight": int(s["points"]) if s["points"] is not None else 0,
        })
    return grouped


_RUN_BASE_SQL = """
SELECT vr.run_id, vr.alert_id, vr.status, vr.mode, vr.started_at, vr.completed_at,
       vr.final_verdict, vr.consensus_score, vr.agreement_pct, vr.total_latency_ms,
       vr.arbiter_reasoning,
       a.alert_type, a.risk_score, a.stage, a.priority,
       t.amount, be.scam_type,
       rs.rule_score, rs.ml_score, rs.composite_score, rs.risk_score_id
  FROM verification_runs vr
  JOIN alerts a ON a.alert_id = vr.alert_id
  LEFT JOIN transactions t ON t.txn_id = a.txn_id
  LEFT JOIN bedrock_explanations be ON be.alert_id = a.alert_id
  LEFT JOIN LATERAL (
    SELECT rule_score, ml_score, composite_score, risk_score_id
      FROM risk_scores
     WHERE risk_scores.txn_id = a.txn_id
     ORDER BY created_at DESC
     LIMIT 1
  ) rs ON TRUE
"""


def load_recent(limit: int = 50) -> list[dict]:
    limit = max(1, min(int(limit or 50), 200))
    with db_cursor() as cur:
        cur.execute(_RUN_BASE_SQL + " ORDER BY vr.started_at DESC LIMIT %s", (limit,))
        rows = _fetch_dicts(cur)
        run_ids = [r["run_id"] for r in rows]
        findings = _findings_for_runs(cur, run_ids)
        signals = _signals_for_runs(cur, run_ids)
    return [
        _serialise_run(r, findings.get(r["run_id"], []), None, signals.get(r["run_id"], []))
        for r in rows
    ]


def load_active() -> list[dict]:
    expire_stale_runs()
    with db_cursor() as cur:
        cur.execute(_RUN_BASE_SQL + " WHERE vr.status = 'running' ORDER BY vr.started_at ASC")
        rows = _fetch_dicts(cur)
        run_ids = [r["run_id"] for r in rows]
        findings = _findings_for_runs(cur, run_ids)
        streams = _streams_for_runs(cur, run_ids)
        signals = _signals_for_runs(cur, run_ids)
    return [
        _serialise_run(
            r, findings.get(r["run_id"], []), streams.get(r["run_id"], []), signals.get(r["run_id"], [])
        )
        for r in rows
    ]


def load_run(run_id: str) -> dict | None:
    with db_cursor() as cur:
        cur.execute(_RUN_BASE_SQL + " WHERE vr.run_id = %s", (run_id,))
        row = cur.fetchone()
        if not row:
            return None
        row = dict(row)
        findings = _findings_for_runs(cur, [run_id])
        streams = _streams_for_runs(cur, [run_id])
        signals = _signals_for_runs(cur, [run_id])
    return _serialise_run(
        row, findings.get(run_id, []), streams.get(run_id, []), signals.get(run_id, [])
    )


def load_run_streams(run_id: str) -> list[dict]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT agent_name, partial_text, status, started_at, updated_at
              FROM agent_streams WHERE run_id = %s
            """,
            (run_id,),
        )
        rows = _fetch_dicts(cur)
    return [
        {
            "agent_name": r["agent_name"],
            "partial_text": r["partial_text"] or "",
            "status": r["status"],
            "started_at": r["started_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def load_queue() -> dict:
    expire_stale_runs()
    with db_cursor() as cur:
        cur.execute(
            "SELECT verification_status, COUNT(*) AS n FROM alerts GROUP BY verification_status"
        )
        rows = _fetch_dicts(cur)
    queued = running = decided = unverified = 0
    for r in rows:
        n = int(r["n"])
        s = r["verification_status"]
        if s == "queued":
            queued = n
        elif s == "running":
            running = n
        elif s == "decided":
            decided = n
        elif s is None:
            unverified = n
    return {"unverified": unverified, "queued": queued, "running": running, "decided": decided}


def load_agent_stats(window_minutes: int = 60) -> dict:
    window_minutes = max(5, min(int(window_minutes or 60), 60 * 24))
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT agent_name,
                   COALESCE(MAX(agent_label), agent_name) AS agent_label,
                   COUNT(*) AS runs,
                   COALESCE(AVG(latency_ms), 0)::INT AS avg_latency_ms,
                   COALESCE(AVG(confidence), 0)::INT AS avg_confidence,
                   SUM(CASE WHEN verdict = 'block' THEN 1 ELSE 0 END) AS blocks,
                   SUM(CASE WHEN verdict = 'warn'  THEN 1 ELSE 0 END) AS warns,
                   SUM(CASE WHEN verdict = 'clear' THEN 1 ELSE 0 END) AS clears,
                   SUM(CASE WHEN verdict = 'inconclusive' THEN 1 ELSE 0 END) AS inconclusive
              FROM agent_findings
             WHERE created_at >= NOW() - (%s || ' minutes')::INTERVAL
             GROUP BY agent_name
            """,
            (window_minutes,),
        )
        per_agent = [
            {
                "agent_name": r["agent_name"],
                "agent_label": r["agent_label"] or r["agent_name"],
                "runs": int(r["runs"]),
                "avg_latency_ms": int(r["avg_latency_ms"]),
                "avg_confidence": int(r["avg_confidence"]),
                "blocks": int(r["blocks"]),
                "warns": int(r["warns"]),
                "clears": int(r["clears"]),
                "inconclusive": int(r["inconclusive"]),
            }
            for r in _fetch_dicts(cur)
        ]
        cur.execute(
            """
            SELECT COUNT(*) AS runs_decided,
                   COALESCE(AVG(total_latency_ms), 0)::INT AS avg_total_ms,
                   COALESCE(MIN(total_latency_ms), 0)::INT AS min_total_ms,
                   COALESCE(MAX(total_latency_ms), 0)::INT AS max_total_ms,
                   SUM(CASE WHEN final_verdict = 'block' THEN 1 ELSE 0 END) AS blocks,
                   SUM(CASE WHEN final_verdict = 'warn'  THEN 1 ELSE 0 END) AS warns,
                   SUM(CASE WHEN final_verdict = 'clear' THEN 1 ELSE 0 END) AS clears
              FROM verification_runs
             WHERE status = 'decided'
               AND completed_at >= NOW() - (%s || ' minutes')::INTERVAL
            """,
            (window_minutes,),
        )
        t = cur.fetchone() or {}
        totals = {
            "runs_decided": int(t.get("runs_decided") or 0),
            "avg_total_ms": int(t.get("avg_total_ms") or 0),
            "min_total_ms": int(t.get("min_total_ms") or 0),
            "max_total_ms": int(t.get("max_total_ms") or 0),
            "blocks": int(t.get("blocks") or 0),
            "warns": int(t.get("warns") or 0),
            "clears": int(t.get("clears") or 0),
        }
    return {"window_minutes": window_minutes, "per_agent": per_agent, "totals": totals}


_sqs_client = None


def _get_sqs_client():
    global _sqs_client
    if _sqs_client is None:
        import boto3

        _sqs_client = boto3.client("sqs", region_name=os.environ.get("AWS_REGION", "ap-southeast-1"))
    return _sqs_client


def publish_verify_message(alert_id: str) -> None:
    """Push alert_id onto VERIFY_QUEUE_URL so the worker Lambda picks it up."""
    queue_url = os.environ.get("VERIFY_QUEUE_URL")
    if not queue_url:
        print("[verify] VERIFY_QUEUE_URL unset — skipping SQS publish (local dev)")
        return
    client = _get_sqs_client()
    client.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps({"alert_id": alert_id}),
    )


def reverify(alert_id: str) -> dict:
    """Reset an alert + enqueue for verification."""
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE alerts
               SET verification_status = NULL, status = 'open', resolved_at = NULL
             WHERE alert_id = %s
            RETURNING alert_id
            """,
            (alert_id,),
        )
        row = cur.fetchone()
    if not row:
        return {"ok": False, "error": "alert not found"}
    publish_verify_message(alert_id)
    return {"ok": True, "alert_id": alert_id, "queued": True}


def inject_synthetic_alert(profile: str = "high_risk") -> dict:
    """Create synthetic alert + transaction; publish to verify queue."""
    now = datetime.now()
    suffix = int(now.timestamp() * 1000)
    txn_id = f"txn_test_{suffix}"
    alert_id = f"alert_test_{suffix}"

    if profile == "low_risk":
        risk_score, amount, age_days, is_first, device_match = 22, 120, 720, False, True
        alert_type, priority, stage = "sender_interception", "low", "stage_1"
    elif profile == "medium_risk":
        risk_score, amount, age_days, is_first, device_match = 58, 1800, 35, True, True
        alert_type, priority, stage = "sender_interception", "medium", "stage_1"
    else:
        risk_score, amount, age_days, is_first, device_match = 91, 8200, 4, True, False
        alert_type, priority, stage = "mule_eviction", "critical", "stage_2"

    receiver_id = f"acc_synth_{suffix}"

    with db_cursor() as cur:
        cur.execute(
            """
            SELECT account_id FROM accounts
             WHERE status = 'active'
               AND account_type IN ('personal','business','merchant','ewallet')
             ORDER BY account_id LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            return {"ok": False, "error": "no active account available"}
        sender_id = row["account_id"]

        cur.execute(
            """
            INSERT INTO accounts
                (account_id, user_id, account_type, account_age_days, status,
                 device_fingerprint, ip_address, card_bin, created_at, updated_at)
            VALUES (%s, %s, 'personal', %s, 'monitoring', %s, %s, %s, %s, %s)
            ON CONFLICT (account_id) DO NOTHING
            """,
            (receiver_id, f"u_synth_{suffix}", age_days, f"fp_synth_{suffix}",
             "203.0.113.99", "522222", now, now),
        )
        cur.execute(
            """
            INSERT INTO transactions
                (txn_id, sender_account_id, receiver_account_id, amount, timestamp,
                 status, channel, is_first_transfer, device_match)
            VALUES (%s, %s, %s, %s, %s, 'pending', 'app', %s, %s)
            ON CONFLICT (txn_id) DO NOTHING
            """,
            (txn_id, sender_id, receiver_id, amount, now, is_first, device_match),
        )
        cur.execute(
            """
            INSERT INTO alerts
                (alert_id, account_id, txn_id, alert_type, risk_score,
                 stage, status, priority, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'open', %s, %s)
            ON CONFLICT (alert_id) DO NOTHING
            """,
            (alert_id, receiver_id, txn_id, alert_type, risk_score, stage, priority, now),
        )

    publish_verify_message(alert_id)
    return {
        "ok": True,
        "alert_id": alert_id,
        "txn_id": txn_id,
        "risk_score": risk_score,
        "profile": profile,
    }


def load_worker_state() -> dict:
    with db_cursor() as cur:
        cur.execute("SELECT key, value, updated_at, updated_by FROM worker_settings WHERE key = 'paused'")
        row = cur.fetchone()
    if not row:
        return {"paused": False, "updated_at": None, "updated_by": None}
    return {
        "paused": str(row["value"]).lower() == "true",
        "updated_at": row["updated_at"],
        "updated_by": row["updated_by"],
    }


def set_worker_state(paused: bool, by: str = "api") -> dict:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO worker_settings (key, value, updated_by, updated_at)
            VALUES ('paused', %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE
              SET value = EXCLUDED.value,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = CURRENT_TIMESTAMP
            """,
            ("true" if paused else "false", by),
        )
    return load_worker_state()
