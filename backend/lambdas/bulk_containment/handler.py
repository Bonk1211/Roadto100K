"""
Lambda: bulk-containment (F3)

Two endpoints:
  GET  /api/containment/{account_id}        — preview linked accounts
  POST /api/containment/execute             — one-click bulk lock

Graph traversal logic
---------------------
1st-degree links:
  - direct transactions to/from focal account
  - explicit rows in network_links table

2nd-degree (shared attribute, no direct txn):
  - same device_fingerprint
  - same ip_address
  - same card_bin
  - account created within ±60 min of focal (registration cluster)

For each linked account we surface:
  account_id, account_age_days, status, risk_score (max of stored mule_score),
  rm_exposure (sum of transactions involving the account in last 30d),
  degree (1 | 2), connection_type (txn | device | ip | card_bin | reg_cluster)

Execution writes:
  containment_actions     — single row per execution
  containment_accounts    — one row per account contained
  alerts                  — bulk_containment alert for audit
  bedrock_explanations    — Type 3 incident report
  accounts.status         — 'suspended'
"""

import json
import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.db import _cursor, _new_id, _now, _row_to_dict, _rows_to_list
from shared.bedrock import invoke_incident_report
from shared.models import generate_request_id, now_iso
from shared.kinesis import put_event
from shared.oss import write_incident_report


def handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}) or {}).get("method") \
        or event.get("httpMethod") \
        or "GET"
    path = event.get("rawPath") or event.get("path") or ""

    try:
        if method == "POST" and path.endswith("/execute"):
            return _execute(event)
        return _preview(event)
    except Exception as e:  # noqa: BLE001
        print(f"[bulk-containment] error: {e}")
        return _resp(500, {"error": str(e)})


# ---------------------------------------------------------------------------
# GET /api/containment/{account_id}
# ---------------------------------------------------------------------------

def _preview(event):
    path_params = event.get("pathParameters", {}) or {}
    account_id = path_params.get("account_id", "")
    if not account_id:
        return _resp(400, {"error": "account_id required in path"})

    start = time.time()
    with _cursor() as cur:
        focal = _load_account(cur, account_id)
        if not focal:
            return _resp(404, {"error": f"account {account_id} not found"})
        linked = _traverse_graph(cur, account_id, focal)
        rm_exposure_total = sum(a["rm_exposure"] for a in linked)

    return _resp(200, {
        "request_id": generate_request_id(),
        "focal_account": focal,
        "linked_accounts": linked,
        "total_linked": len(linked),
        "first_degree_count": sum(1 for a in linked if a["degree"] == 1),
        "second_degree_count": sum(1 for a in linked if a["degree"] == 2),
        "total_rm_exposure": round(rm_exposure_total, 2),
        "elapsed_ms": int((time.time() - start) * 1000),
        "timestamp": now_iso(),
    })


# ---------------------------------------------------------------------------
# POST /api/containment/execute
# ---------------------------------------------------------------------------

def _execute(event):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "invalid JSON body"})

    mule_account_id = body.get("mule_account_id") or ""
    selected = (
        body.get("selected_account_ids")
        or body.get("account_ids")
        or []
    )
    agent_id = body.get("agent_id") or "auto_verifier"

    if not mule_account_id:
        return _resp(400, {"error": "mule_account_id required"})
    if not isinstance(selected, list):
        return _resp(400, {"error": "selected_account_ids must be a list"})

    start = time.time()
    with _cursor() as cur:
        focal = _load_account(cur, mule_account_id)
        if not focal:
            return _resp(404, {"error": f"mule account {mule_account_id} not found"})

        linked_all = _traverse_graph(cur, mule_account_id, focal)
        selected_set = set(selected) if selected else {a["account_id"] for a in linked_all}
        targets = [a for a in linked_all if a["account_id"] in selected_set]

        # Always include the focal mule itself
        all_account_ids = list({mule_account_id, *(a["account_id"] for a in targets)})
        rm_exposure_total = sum(a["rm_exposure"] for a in targets) + float(focal.get("rm_exposure") or 0)

        # 1. Find or create the mule_case for the focal account
        mule_case_id = _ensure_mule_case(cur, mule_account_id, score=focal.get("risk_score") or 80)

        # 2. Insert containment_actions
        containment_id = _new_id()
        cur.execute(
            """
            INSERT INTO containment_actions
                (containment_id, mule_case_id, initiated_by_agent_id,
                 total_rm_exposure, status, created_at)
            VALUES (%s, %s, %s, %s, 'executing', %s)
            """,
            (containment_id, mule_case_id, agent_id, rm_exposure_total, _now()),
        )

        # 3. Suspend each account + write containment_accounts row
        for acc_id in all_account_ids:
            cur.execute(
                "UPDATE accounts SET status='suspended', updated_at=%s WHERE account_id=%s",
                (_now(), acc_id),
            )
            cur.execute(
                """
                INSERT INTO containment_accounts
                    (containment_account_id, containment_id, account_id,
                     action_taken, selected_by_agent, created_at)
                VALUES (%s, %s, %s, 'suspended', true, %s)
                """,
                (_new_id(), containment_id, acc_id, _now()),
            )
            # Hold any pending withdrawals
            cur.execute(
                """
                UPDATE transactions
                   SET status = 'held_escrow'
                 WHERE (sender_account_id = %s OR receiver_account_id = %s)
                   AND status IN ('pending', 'approved', 'intercepted')
                """,
                (acc_id, acc_id),
            )

        # 4. Bedrock Type 3 incident report
        actions_taken = [
            f"Suspended {len(all_account_ids)} accounts",
            f"Held pending withdrawals in escrow",
            f"Mule cluster centred on {mule_account_id}",
        ]
        report = invoke_incident_report(
            mule_account_id=mule_account_id,
            linked_accounts=targets,
            total_rm_exposure=rm_exposure_total,
            actions_taken=actions_taken,
            pattern_hint=focal.get("scam_type") or "mule_layering",
        )

        # 5. Audit alert + bedrock explanation row
        alert_id = _new_id()
        cur.execute(
            """
            INSERT INTO alerts
                (alert_id, account_id, mule_case_id, alert_type,
                 risk_score, stage, status, priority, created_at)
            VALUES (%s, %s, %s, 'bulk_containment', %s, 'stage_3',
                    'resolved', 'critical', %s)
            """,
            (alert_id, mule_account_id, mule_case_id,
             float(focal.get("risk_score") or 90), _now()),
        )
        cur.execute(
            """
            INSERT INTO bedrock_explanations
                (explanation_id, alert_id, explanation_type,
                 explanation_en, explanation_bm,
                 scam_type, confidence, recommended_action,
                 incident_summary, created_at)
            VALUES (%s, %s, 'incident_report', %s, %s, %s, 0.95, 'block', %s, %s)
            """,
            (
                _new_id(), alert_id,
                report.get("pattern_description", ""),
                "",  # incident reports are EN only
                "mule_account",
                json.dumps(report, default=str),
                _now(),
            ),
        )

        # 6. Mark containment complete
        cur.execute(
            "UPDATE containment_actions SET status='completed' WHERE containment_id=%s",
            (containment_id,),
        )

    # Best-effort OSS mirror + Kinesis emit (non-blocking)
    write_incident_report(report, containment_id)
    put_event(
        event_type="bulk_containment",
        txn_id=containment_id,
        payload={
            "mule_account_id": mule_account_id,
            "contained_count": len(all_account_ids),
            "total_rm_exposure": rm_exposure_total,
            "agent_id": agent_id,
        },
    )

    return _resp(200, {
        "request_id": generate_request_id(),
        "containment_id": containment_id,
        "alert_id": alert_id,
        "mule_account_id": mule_account_id,
        "contained_accounts": all_account_ids,
        "contained_count": len(all_account_ids),
        "total_rm_exposure": round(rm_exposure_total, 2),
        "incident_report": report,
        "actions_taken": actions_taken,
        "elapsed_ms": int((time.time() - start) * 1000),
        "timestamp": now_iso(),
    })


# ---------------------------------------------------------------------------
# Graph traversal
# ---------------------------------------------------------------------------

ACCOUNT_SQL = """
SELECT account_id, user_id, account_type, account_age_days, status,
       device_fingerprint, ip_address, card_bin, created_at
  FROM accounts
 WHERE account_id = %s
"""


def _load_account(cur, account_id: str) -> dict | None:
    cur.execute(ACCOUNT_SQL, (account_id,))
    row = cur.fetchone()
    if not row:
        return None
    acc = _row_to_dict(row)
    acc["risk_score"] = _max_risk_score(cur, account_id)
    acc["rm_exposure"] = _rm_exposure(cur, account_id)
    acc["scam_type"] = _scam_type(cur, account_id)
    return acc


def _max_risk_score(cur, account_id: str) -> float:
    cur.execute(
        """
        SELECT GREATEST(
                 COALESCE(MAX(rs.composite_score), 0),
                 COALESCE(MAX(a.risk_score), 0),
                 COALESCE(MAX(mc.mule_score), 0)
               ) AS max_score
          FROM accounts ac
          LEFT JOIN risk_scores rs ON rs.account_id = ac.account_id
          LEFT JOIN alerts a ON a.account_id = ac.account_id
          LEFT JOIN mule_cases mc ON mc.account_id = ac.account_id
         WHERE ac.account_id = %s
        """,
        (account_id,),
    )
    row = cur.fetchone()
    return float((row or {}).get("max_score") or 0)


def _rm_exposure(cur, account_id: str) -> float:
    cur.execute(
        """
        SELECT COALESCE(SUM(amount), 0) AS total
          FROM transactions
         WHERE (sender_account_id = %s OR receiver_account_id = %s)
           AND timestamp >= NOW() - INTERVAL '30 days'
        """,
        (account_id, account_id),
    )
    row = cur.fetchone()
    return float((row or {}).get("total") or 0)


def _scam_type(cur, account_id: str) -> str | None:
    cur.execute(
        """
        SELECT a.alert_type
          FROM alerts a
         WHERE a.account_id = %s
         ORDER BY a.created_at DESC
         LIMIT 1
        """,
        (account_id,),
    )
    row = cur.fetchone()
    return (row or {}).get("alert_type")


def _traverse_graph(cur, focal_id: str, focal: dict) -> list[dict]:
    """Build deduplicated linked-account list with degree + connection_type."""
    linked: dict[str, dict] = {}

    # 1st-degree: direct transactions
    cur.execute(
        """
        SELECT DISTINCT
               CASE WHEN sender_account_id = %s THEN receiver_account_id
                    ELSE sender_account_id END AS other_id
          FROM transactions
         WHERE sender_account_id = %s OR receiver_account_id = %s
        """,
        (focal_id, focal_id, focal_id),
    )
    for r in cur.fetchall():
        oid = r.get("other_id")
        if oid and oid != focal_id:
            linked.setdefault(oid, {"degree": 1, "connection_type": "transaction"})

    # 1st-degree: explicit network_links
    cur.execute(
        """
        SELECT linked_account_id AS other_id, link_type, degree
          FROM network_links
         WHERE source_account_id = %s
        UNION
        SELECT source_account_id AS other_id, link_type, degree
          FROM network_links
         WHERE linked_account_id = %s
        """,
        (focal_id, focal_id),
    )
    for r in cur.fetchall():
        oid = r.get("other_id")
        if not oid or oid == focal_id:
            continue
        deg = int(r.get("degree") or 1)
        if oid in linked and linked[oid]["degree"] <= deg:
            continue
        linked[oid] = {"degree": deg, "connection_type": r.get("link_type") or "network_link"}

    # 2nd-degree: shared attributes
    if focal.get("device_fingerprint"):
        _add_shared(cur, linked, focal_id, "device_fingerprint", focal["device_fingerprint"], "shared_device")
    if focal.get("ip_address"):
        _add_shared(cur, linked, focal_id, "ip_address", focal["ip_address"], "shared_ip")
    if focal.get("card_bin"):
        _add_shared(cur, linked, focal_id, "card_bin", focal["card_bin"], "shared_card_bin")

    # 2nd-degree: registration cluster (created ±60 min of focal)
    if focal.get("created_at"):
        cur.execute(
            """
            SELECT account_id
              FROM accounts
             WHERE account_id <> %s
               AND created_at BETWEEN
                     (%s::timestamp - INTERVAL '60 minutes')
                     AND (%s::timestamp + INTERVAL '60 minutes')
            """,
            (focal_id, focal["created_at"], focal["created_at"]),
        )
        for r in cur.fetchall():
            oid = r.get("account_id")
            if oid and oid not in linked:
                linked[oid] = {"degree": 2, "connection_type": "reg_cluster"}

    # Hydrate each linked account with risk/exposure
    enriched: list[dict] = []
    for oid, meta in linked.items():
        cur.execute(ACCOUNT_SQL, (oid,))
        row = cur.fetchone()
        if not row:
            continue
        acc = _row_to_dict(row)
        enriched.append({
            "account_id": acc["account_id"],
            "account_age_days": acc.get("account_age_days"),
            "status": acc.get("status"),
            "degree": meta["degree"],
            "connection_type": meta["connection_type"],
            "risk_score": _max_risk_score(cur, oid),
            "rm_exposure": round(_rm_exposure(cur, oid), 2),
        })

    enriched.sort(key=lambda x: (x["degree"], -x["risk_score"], -x["rm_exposure"]))
    return enriched


def _add_shared(cur, linked: dict, focal_id: str, column: str, value: str, label: str):
    cur.execute(
        f"SELECT account_id FROM accounts WHERE {column} = %s AND account_id <> %s",
        (value, focal_id),
    )
    for r in cur.fetchall():
        oid = r.get("account_id")
        if not oid:
            continue
        # Only add as 2nd-degree if not already 1st-degree
        if oid not in linked:
            linked[oid] = {"degree": 2, "connection_type": label}


def _ensure_mule_case(cur, account_id: str, score: float) -> str:
    cur.execute(
        "SELECT mule_case_id FROM mule_cases WHERE account_id = %s ORDER BY created_at DESC LIMIT 1",
        (account_id,),
    )
    row = cur.fetchone()
    if row:
        return row["mule_case_id"]
    mule_case_id = _new_id()
    cur.execute(
        """
        INSERT INTO mule_cases
            (mule_case_id, account_id, mule_score, stage, status, created_at, updated_at)
        VALUES (%s, %s, %s, 'stage_3', 'evicted', %s, %s)
        """,
        (mule_case_id, account_id, score, _now(), _now()),
    )
    return mule_case_id


# ---------------------------------------------------------------------------
# HTTP plumbing
# ---------------------------------------------------------------------------

def _resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,x-api-key",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }
