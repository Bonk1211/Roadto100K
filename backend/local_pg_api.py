#!/usr/bin/env python3
"""
Local PostgreSQL-backed API for the SafeSend agent dashboard.

This mirrors the mock-api routes the React dashboard already calls, but reads
from the ERD PostgreSQL tables using DATABASE_URL from backend/.env.
"""

import json
import os
from datetime import date, datetime
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import psycopg2
from dotenv import load_dotenv


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

PORT = int(os.environ.get("PG_API_PORT", "4100"))


def get_conn():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set in backend/.env")
    return psycopg2.connect(database_url)


def json_default(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def fetch_all_dicts(cursor):
    cols = [desc[0] for desc in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def risk_band(score):
    score = float(score or 0)
    if score < 40:
        return "low"
    if score < 71:
        return "medium"
    return "high"


def frontend_status(db_status):
    if db_status == "cleared":
        return "cleared"
    if db_status == "resolved":
        return "warned"
    return "open"


def frontend_edge_type(link_type):
    return {
        "direct_transaction": "transaction",
        "shared_device": "shared_device",
        "shared_ip": "shared_ip",
        "timing_cluster": "overlapping_timing",
        "card_bin": "same_card_bin",
    }.get(link_type, "shared_attribute")


def parse_stage(stage):
    text = str(stage or "stage_1")
    if text in ("stage_1", "1"):
        return 1
    if text in ("stage_2", "2"):
        return 2
    if text in ("stage_3", "3"):
        return 3
    return 1


def load_alerts():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                a.alert_id,
                a.account_id,
                a.txn_id,
                a.mule_case_id,
                a.alert_type,
                a.risk_score,
                a.stage,
                a.status,
                a.priority,
                a.created_at,
                a.resolved_at,
                t.sender_account_id,
                t.receiver_account_id,
                t.amount,
                t.timestamp,
                t.channel,
                t.is_first_transfer,
                t.device_match,
                receiver.account_age_days AS payee_account_age_days,
                receiver.user_id AS payee_name,
                receiver.account_id AS payee_account,
                mc.unique_inbound_senders_6h,
                mc.avg_inbound_gap_minutes,
                mc.inbound_outbound_ratio,
                mc.merchant_spend_7d,
                mc.status AS mule_status,
                ca.total_rm_exposure AS containment_total_rm_exposure,
                be.explanation_en,
                be.explanation_bm,
                be.scam_type,
                be.confidence
            FROM alerts a
            JOIN accounts receiver ON receiver.account_id = a.account_id
            LEFT JOIN transactions t ON t.txn_id = a.txn_id
            LEFT JOIN mule_cases mc ON mc.mule_case_id = a.mule_case_id
            LEFT JOIN containment_actions ca ON ca.mule_case_id = a.mule_case_id
            LEFT JOIN bedrock_explanations be ON be.alert_id = a.alert_id
            ORDER BY
                CASE a.stage WHEN 'stage_3' THEN 3 WHEN 'stage_2' THEN 2 ELSE 1 END DESC,
                a.risk_score DESC,
                a.created_at DESC;
            """
        )
        rows = fetch_all_dicts(cur)

        cur.execute(
            """
            SELECT risk_score_id, signal_name, signal_value, points, fired
            FROM risk_signals
            ORDER BY signal_id;
            """
        )
        signals_by_risk = {}
        for signal in fetch_all_dicts(cur):
            signals_by_risk.setdefault(signal["risk_score_id"], []).append(signal)

        cur.execute(
            """
            SELECT txn_id, risk_score_id
            FROM risk_scores
            ORDER BY created_at DESC;
            """
        )
        risk_by_txn = {}
        for row in fetch_all_dicts(cur):
            risk_by_txn.setdefault(row["txn_id"], row["risk_score_id"])

        cur.execute(
            """
            SELECT
                nl.source_account_id,
                nl.linked_account_id,
                linked.user_id AS display_name,
                nl.link_type,
                nl.degree,
                nl.risk_score,
                nl.rm_exposure
            FROM network_links nl
            JOIN accounts linked ON linked.account_id = nl.linked_account_id
            ORDER BY nl.risk_score DESC;
            """
        )
        links = fetch_all_dicts(cur)

    alerts = []
    for row in rows:
        score = row["risk_score"] or 0
        txn_id = row["txn_id"] or f"no_txn_{row['alert_id']}"
        risk_id = risk_by_txn.get(row["txn_id"])
        signals = [
            {
                "id": f"{risk_id}_{idx}",
                "label": signal["signal_name"],
                "triggered": bool(signal["fired"]),
                "weight": float(signal["points"] or 0),
                "detail": signal["signal_value"],
            }
            for idx, signal in enumerate(signals_by_risk.get(risk_id, []), start=1)
        ]

        account_id = row["account_id"]
        linked_accounts = [
            {
                "account_id": link["linked_account_id"],
                "display_name": link["display_name"],
                "risk_score": float(link["risk_score"] or 0),
                "connection_type": link["link_type"],
                "degree": int(link["degree"] or 1),
                "rm_exposure": float(link["rm_exposure"] or 0),
                "selected": True,
            }
            for link in links
            if link["source_account_id"] == account_id
        ]

        stage_number = parse_stage(row["stage"])
        amount = row["amount"] or 0
        rm_at_risk = row["containment_total_rm_exposure"] or sum(
            account["rm_exposure"] for account in linked_accounts
        ) or amount
        user_avg = 850
        txn = {
            "txn_id": txn_id,
            "user_id": row["sender_account_id"] or "system",
            "payee_id": account_id,
            "payee_name": row["payee_name"] or account_id,
            "payee_account": row["payee_account"] or account_id,
            "amount": float(amount),
            "timestamp": row["timestamp"] or row["created_at"],
            "hour_of_day": (row["timestamp"] or row["created_at"]).hour,
            "device_match": bool(row["device_match"]) if row["device_match"] is not None else True,
            "prior_txns_to_payee": 0,
            "is_new_payee": bool(row["is_first_transfer"]) if row["is_first_transfer"] is not None else False,
            "payee_account_age_days": int(row["payee_account_age_days"] or 0),
            "user_avg_30d": user_avg,
            "amount_ratio": round(float(amount) / user_avg, 2) if user_avg else 0,
        }

        alert = {
            "id": row["alert_id"],
            "txn": txn,
            "score": float(score),
            "band": risk_band(score),
            "account_id": account_id,
            "alert_type": row["alert_type"],
            "stage": row["stage"],
            "priority": row["priority"],
            "mule_stage": stage_number,
            "rm_at_risk": float(rm_at_risk),
            "signals": signals,
            "explanation": {
                "explanation_en": row["explanation_en"] or "No Bedrock explanation stored yet.",
                "explanation_bm": row["explanation_bm"] or "Tiada penjelasan Bedrock disimpan lagi.",
                "scam_type": row["scam_type"] or "mule_account",
                "confidence": "high" if float(row["confidence"] or 0) >= 0.8 else "medium",
            },
            "status": frontend_status(row["status"]),
            "created_at": row["created_at"],
            "decided_at": row["resolved_at"],
        }

        if row["alert_type"] in ("mule_eviction", "bulk_containment"):
            alert["mule_profile"] = {
                "account_id": account_id,
                "stage": stage_number,
                "unique_inbound_senders_6h": int(row["unique_inbound_senders_6h"] or 0),
                "avg_inbound_gap_minutes": float(row["avg_inbound_gap_minutes"] or 0),
                "inbound_outbound_ratio": float(row["inbound_outbound_ratio"] or 0),
                "merchant_spend_7d": float(row["merchant_spend_7d"] or 0),
                "withdrawal_status": "blocked" if stage_number == 3 else "soft_blocked",
                "escrow_amount": float(rm_at_risk),
            }
            alert["containment_accounts"] = linked_accounts

        alerts.append(alert)

    return alerts


def load_stats():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*), COALESCE(SUM(risk_score), 0) FROM alerts WHERE status = 'open';")
        open_count, risk_sum = cur.fetchone()
        cur.execute("SELECT COALESCE(SUM(total_rm_exposure), 0) FROM containment_actions;")
        rm_at_risk = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM agent_actions WHERE action_type IN ('block', 'execute_containment');")
        blocked = cur.fetchone()[0]
    return {
        "open_alerts": int(open_count),
        "rm_at_risk": float(rm_at_risk),
        "blocked_today": int(blocked),
        "avg_response_ms": int(float(risk_sum or 0) + 120),
    }


def load_network_graph():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT account_id, user_id, status, account_age_days, device_fingerprint, ip_address, card_bin FROM accounts ORDER BY account_id;")
        accounts = fetch_all_dicts(cur)
        cur.execute("SELECT source_account_id, linked_account_id, link_type, risk_score, rm_exposure FROM network_links ORDER BY link_id;")
        links = fetch_all_dicts(cur)

    nodes = [
        {
            "id": account["account_id"],
            "type": "account",
            "label": account["user_id"],
            "flagged": account["status"] in ("watchlisted", "soft_blocked", "suspended"),
            "metadata": {
                "account": account["account_id"],
                "status": account["status"],
                "age_days": account["account_age_days"] or 0,
                "device": account["device_fingerprint"] or "",
                "ip": account["ip_address"] or "",
                "card_bin": account["card_bin"] or "",
            },
        }
        for account in accounts
    ]
    edges = [
        {
            "source": link["source_account_id"],
            "target": link["linked_account_id"],
            "type": frontend_edge_type(link["link_type"]),
            "weight": float(link["rm_exposure"] or link["risk_score"] or 1),
        }
        for link in links
    ]
    return {"nodes": nodes, "edges": edges}


def record_decision(alert_id, body):
    action = body.get("action")
    agent_id = body.get("agent_id", "agent_console")
    status = "cleared" if action == "clear" else "resolved"
    action_id = f"action_api_{alert_id}_{int(datetime.now().timestamp())}"

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE alerts
            SET status = %s, resolved_at = CURRENT_TIMESTAMP
            WHERE alert_id = %s
            """,
            (status, alert_id),
        )
        cur.execute(
            """
            INSERT INTO agent_actions
            (action_id, alert_id, agent_id, action_type, decision_label, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (action_id) DO NOTHING
            """,
            (
                action_id,
                alert_id,
                agent_id,
                action,
                "false_positive" if action == "clear" else "fraud",
                "Recorded from local Postgres API",
            ),
        )
        conn.commit()

    alert = next((item for item in load_alerts() if item["id"] == alert_id), None)
    return {
        "ok": True,
        "sms_sent": action in ("block", "warn"),
        "alert": alert,
    }


def execute_containment(body):
    account_ids = body.get("account_ids", [])
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT account_id, user_id
            FROM accounts
            WHERE account_id = ANY(%s)
            ORDER BY account_id
            """,
            (account_ids,),
        )
        accounts = fetch_all_dicts(cur)

    contained = [
        {
            "account_id": account["account_id"],
            "display_name": account["user_id"],
            "risk_score": 80,
            "connection_type": "direct_transaction",
            "degree": 1,
            "rm_exposure": 10000,
            "selected": True,
        }
        for account in accounts
    ]
    return {
        "ok": True,
        "incident_id": f"INC-PG-{int(datetime.now().timestamp())}",
        "contained_accounts": contained,
        "total_rm_exposure": sum(item["rm_exposure"] for item in contained),
        "sns_sent": len(contained),
        "incident_summary": "Postgres-backed containment demo executed.",
        "executed_at": datetime.now(),
    }


class Handler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,x-api-key")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == "/health":
                return self.respond({"ok": True, "service": "local-pg-api"})
            if path == "/api/alerts":
                return self.respond(load_alerts())
            if path == "/api/stats":
                return self.respond(load_stats())
            if path == "/api/network-graph":
                return self.respond(load_network_graph())
            return self.respond({"error": "Not found"}, status=404)
        except Exception as exc:
            return self.respond({"error": str(exc)}, status=500)

    def do_POST(self):
        path = urlparse(self.path).path
        body = self.read_json()
        try:
            if path.startswith("/api/alerts/") and path.endswith("/decision"):
                alert_id = path.split("/")[3]
                return self.respond(record_decision(alert_id, body))
            if path == "/api/containment/execute":
                return self.respond(execute_containment(body))
            return self.respond({"error": "Not found"}, status=404)
        except Exception as exc:
            return self.respond({"error": str(exc)}, status=500)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def respond(self, payload, status=200):
        data = json.dumps(payload, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("localhost", PORT), Handler)
    print(f"SafeSend local Postgres API running on http://localhost:{PORT}")
    server.serve_forever()
