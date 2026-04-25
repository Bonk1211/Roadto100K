#!/usr/bin/env python3
"""
Seed 5 mock rows into every SafeSend ERD PostgreSQL table.

This script clears the ERD tables first so repeated runs leave exactly 5 rows
per table.
"""

import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from psycopg2.extras import Json

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

from shared.db import _get_pg_conn


def seed_erd_mock_data():
    conn = _get_pg_conn()
    cursor = conn.cursor()
    now = datetime.now()

    try:
        cursor.execute(
            """
            TRUNCATE TABLE
                model_training_labels,
                containment_accounts,
                containment_actions,
                network_links,
                agent_actions,
                bedrock_explanations,
                alerts,
                mule_cases,
                risk_signals,
                risk_scores,
                transactions,
                accounts
            RESTART IDENTITY CASCADE;
            """
        )

        accounts = [
            ("acc_user_001", "u_aminah", "personal", 920, "active", "dev_a1", "203.0.113.10", "411111", now - timedelta(days=920), now),
            ("acc_user_002", "u_lim", "personal", 610, "active", "dev_b2", "203.0.113.11", "422222", now - timedelta(days=610), now),
            ("acc_mule_001", "u_shadow_one", "personal", 6, "suspended", "dev_m1", "198.51.100.20", "511111", now - timedelta(days=6), now),
            ("acc_mule_002", "u_shadow_two", "personal", 11, "soft_blocked", "dev_m1", "198.51.100.21", "511111", now - timedelta(days=11), now),
            ("acc_merchant_001", "u_nasi_kandar", "merchant", 780, "watchlisted", "dev_c3", "192.0.2.30", "633333", now - timedelta(days=780), now),
        ]
        cursor.executemany(
            """
            INSERT INTO accounts
            (account_id, user_id, account_type, account_age_days, status, device_fingerprint, ip_address, card_bin, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            accounts,
        )

        transactions = [
            ("txn_001", "acc_user_001", "acc_mule_001", 8000.00, now - timedelta(hours=5), "blocked", "wallet_transfer", True, False, now - timedelta(hours=5)),
            ("txn_002", "acc_user_002", "acc_mule_001", 3200.00, now - timedelta(hours=4, minutes=20), "escrowed", "wallet_transfer", True, True, now - timedelta(hours=4, minutes=20)),
            ("txn_003", "acc_user_001", "acc_mule_002", 5000.00, now - timedelta(hours=3, minutes=45), "warned", "wallet_transfer", True, False, now - timedelta(hours=3, minutes=45)),
            ("txn_004", "acc_mule_001", "acc_merchant_001", 7600.00, now - timedelta(hours=2), "blocked", "peer_transfer", False, False, now - timedelta(hours=2)),
            ("txn_005", "acc_mule_002", "acc_merchant_001", 11500.00, now - timedelta(minutes=50), "cancelled", "peer_transfer", False, True, now - timedelta(minutes=50)),
        ]
        cursor.executemany(
            """
            INSERT INTO transactions
            (txn_id, sender_account_id, receiver_account_id, amount, timestamp, status, channel, is_first_transfer, device_match, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            transactions,
        )

        risk_scores = [
            ("risk_001", "txn_001", "acc_mule_001", "sender_fraud", 85.00, 91.00, 89.00, "high", now - timedelta(hours=5)),
            ("risk_002", "txn_002", "acc_mule_001", "mule_detection", 92.00, 94.00, 93.00, "high", now - timedelta(hours=4, minutes=20)),
            ("risk_003", "txn_003", "acc_mule_002", "sender_fraud", 68.00, 72.00, 70.00, "medium", now - timedelta(hours=3, minutes=45)),
            ("risk_004", "txn_004", "acc_mule_001", "mule_detection", 96.00, 89.00, 92.00, "high", now - timedelta(hours=2)),
            ("risk_005", "txn_005", "acc_mule_002", "mule_detection", 74.00, 77.00, 76.00, "high", now - timedelta(minutes=50)),
        ]
        cursor.executemany(
            """
            INSERT INTO risk_scores
            (risk_score_id, txn_id, account_id, score_type, rule_score, ml_score, composite_score, risk_level, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            risk_scores,
        )

        risk_signals = [
            ("signal_001", "risk_001", "Payee account age < 14 days", "6 days", 25.00, True),
            ("signal_002", "risk_002", "Received from 3+ unique senders in 6 hours", "4 senders", 30.00, True),
            ("signal_003", "risk_003", "Amount > 3x user average", "5.8x", 20.00, True),
            ("signal_004", "risk_004", "No merchant spend", "RM 0 in 7 days", 20.00, True),
            ("signal_005", "risk_005", "Shared device fingerprint", "dev_m1", 25.00, True),
        ]
        cursor.executemany(
            """
            INSERT INTO risk_signals
            (signal_id, risk_score_id, signal_name, signal_value, points, fired)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            risk_signals,
        )

        mule_cases = [
            ("mule_001", "acc_mule_001", 93.00, "stage_3", 4, 14.00, 92.00, 0.00, "evicted", now - timedelta(hours=4), now),
            ("mule_002", "acc_mule_002", 76.00, "stage_2", 3, 18.00, 84.00, 0.00, "under_review", now - timedelta(hours=3), now),
            ("mule_003", "acc_merchant_001", 61.00, "stage_1", 3, 24.00, 70.00, 38.00, "monitoring", now - timedelta(hours=2), now),
            ("mule_004", "acc_user_002", 44.00, "stage_1", 2, 35.00, 45.00, 120.00, "cleared", now - timedelta(hours=1), now),
            ("mule_005", "acc_user_001", 58.00, "stage_1", 3, 28.00, 50.00, 80.00, "monitoring", now - timedelta(minutes=30), now),
        ]
        cursor.executemany(
            """
            INSERT INTO mule_cases
            (mule_case_id, account_id, mule_score, stage, unique_inbound_senders_6h, avg_inbound_gap_minutes, inbound_outbound_ratio, merchant_spend_7d, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            mule_cases,
        )

        alerts = [
            ("alert_001", "acc_mule_001", "txn_001", "mule_001", "mule_eviction", 93.00, "stage_3", "open", "critical", now - timedelta(hours=4), None),
            ("alert_002", "acc_mule_002", "txn_003", "mule_002", "mule_eviction", 76.00, "stage_2", "open", "high", now - timedelta(hours=3), None),
            ("alert_003", "acc_merchant_001", "txn_005", "mule_003", "bulk_containment", 61.00, "stage_1", "open", "medium", now - timedelta(hours=2), None),
            ("alert_004", "acc_user_002", "txn_002", "mule_004", "sender_interception", 44.00, "stage_1", "cleared", "low", now - timedelta(hours=1), now - timedelta(minutes=45)),
            ("alert_005", "acc_user_001", "txn_004", "mule_005", "sender_interception", 58.00, "stage_1", "resolved", "medium", now - timedelta(minutes=55), now - timedelta(minutes=20)),
        ]
        cursor.executemany(
            """
            INSERT INTO alerts
            (alert_id, account_id, txn_id, mule_case_id, alert_type, risk_score, stage, status, priority, created_at, resolved_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            alerts,
        )

        bedrock_explanations = [
            ("explain_001", "alert_001", "incident_report", "Stage 3 mule eviction triggered with rapid inbound velocity.", "Pengusiran mule Tahap 3 dicetuskan dengan kelajuan dana masuk tinggi.", "mule_account", 0.96, "execute_containment", "Mule account and linked accounts require immediate containment.", now - timedelta(hours=4)),
            ("explain_002", "alert_002", "agent_alert", "Stage 2 mule alert due to 3 unique inbound senders.", "Amaran mule Tahap 2 kerana 3 penghantar unik.", "mule_account", 0.83, "block", "Review account before withdrawal.", now - timedelta(hours=3)),
            ("explain_003", "alert_003", "incident_report", "Bulk containment candidate linked by timing cluster.", "Calon kawalan pukal dikaitkan melalui kelompok masa.", "mule_account", 0.71, "monitor", "Monitor second-degree accounts.", now - timedelta(hours=2)),
            ("explain_004", "alert_004", "user_warning", "First transfer to a newly reviewed payee.", "Pemindahan pertama kepada penerima yang sedang disemak.", "false_positive", 0.52, "clear", "Likely normal transaction.", now - timedelta(hours=1)),
            ("explain_005", "alert_005", "agent_alert", "Sender-side interception from unusual device.", "Sekatan pihak penghantar daripada peranti luar biasa.", "account_takeover", 0.66, "warn", "Warn user and keep watchlist active.", now - timedelta(minutes=55)),
        ]
        cursor.executemany(
            """
            INSERT INTO bedrock_explanations
            (explanation_id, alert_id, explanation_type, explanation_en, explanation_bm, scam_type, confidence, recommended_action, incident_summary, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            bedrock_explanations,
        )

        agent_actions = [
            ("action_001", "alert_001", "agent_aisha", "execute_containment", "fraud", "Stage 3 mule contained.", now - timedelta(hours=3, minutes=50)),
            ("action_002", "alert_002", "agent_ben", "block", "fraud", "Withdrawal soft-block confirmed.", now - timedelta(hours=2, minutes=45)),
            ("action_003", "alert_003", "agent_aisha", "warn", "monitor", "Monitor linked merchant account.", now - timedelta(hours=1, minutes=50)),
            ("action_004", "alert_004", "agent_chong", "clear", "false_positive", "Known legitimate transfer.", now - timedelta(minutes=45)),
            ("action_005", "alert_005", "agent_devi", "warn", "monitor", "User warned in-app.", now - timedelta(minutes=20)),
        ]
        cursor.executemany(
            """
            INSERT INTO agent_actions
            (action_id, alert_id, agent_id, action_type, decision_label, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            agent_actions,
        )

        network_links = [
            ("link_001", "acc_mule_001", "acc_mule_002", "shared_device", 1, 88.00, 142000.00, now - timedelta(hours=4)),
            ("link_002", "acc_mule_001", "acc_merchant_001", "direct_transaction", 1, 72.00, 31000.00, now - timedelta(hours=3)),
            ("link_003", "acc_mule_002", "acc_merchant_001", "timing_cluster", 2, 61.00, 22100.00, now - timedelta(hours=2)),
            ("link_004", "acc_user_001", "acc_mule_001", "shared_ip", 2, 58.00, 8000.00, now - timedelta(hours=1)),
            ("link_005", "acc_user_002", "acc_mule_002", "card_bin", 2, 54.00, 3200.00, now - timedelta(minutes=30)),
        ]
        cursor.executemany(
            """
            INSERT INTO network_links
            (link_id, source_account_id, linked_account_id, link_type, degree, risk_score, rm_exposure, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            network_links,
        )

        containment_actions = [
            ("contain_001", "mule_001", "agent_aisha", 142000.00, "executed", now - timedelta(hours=3, minutes=48)),
            ("contain_002", "mule_002", "agent_ben", 50000.00, "pending", now - timedelta(hours=2, minutes=40)),
            ("contain_003", "mule_003", "agent_aisha", 22100.00, "pending", now - timedelta(hours=1, minutes=40)),
            ("contain_004", "mule_004", "agent_chong", 3200.00, "partially_failed", now - timedelta(minutes=40)),
            ("contain_005", "mule_005", "agent_devi", 8000.00, "executed", now - timedelta(minutes=15)),
        ]
        cursor.executemany(
            """
            INSERT INTO containment_actions
            (containment_id, mule_case_id, initiated_by_agent_id, total_rm_exposure, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            containment_actions,
        )

        containment_accounts = [
            ("contain_acc_001", "contain_001", "acc_mule_001", "suspended", True, now - timedelta(hours=3, minutes=48)),
            ("contain_acc_002", "contain_002", "acc_mule_002", "withdrawal_blocked", True, now - timedelta(hours=2, minutes=40)),
            ("contain_acc_003", "contain_003", "acc_merchant_001", "escrowed", True, now - timedelta(hours=1, minutes=40)),
            ("contain_acc_004", "contain_004", "acc_user_002", "withdrawal_blocked", False, now - timedelta(minutes=40)),
            ("contain_acc_005", "contain_005", "acc_user_001", "escrowed", True, now - timedelta(minutes=15)),
        ]
        cursor.executemany(
            """
            INSERT INTO containment_accounts
            (containment_account_id, containment_id, account_id, action_taken, selected_by_agent, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            containment_accounts,
        )

        labels = [
            ("label_001", "txn_001", "acc_mule_001", "action_001", Json({"amount_ratio": 9.4, "unique_senders": 4}), "mule", True, True, now - timedelta(hours=3, minutes=40)),
            ("label_002", "txn_002", "acc_mule_001", "action_002", Json({"amount_ratio": 3.8, "device_match": True}), "fraud", True, True, now - timedelta(hours=2, minutes=30)),
            ("label_003", "txn_003", "acc_mule_002", "action_003", Json({"avg_gap_minutes": 18, "merchant_spend": 0}), "mule", True, False, now - timedelta(hours=1, minutes=30)),
            ("label_004", "txn_004", "acc_user_002", "action_004", Json({"amount_ratio": 1.2, "known_user": True}), "false_positive", False, False, now - timedelta(minutes=35)),
            ("label_005", "txn_005", "acc_user_001", "action_005", Json({"device_match": False, "late_night": True}), "normal", False, False, now - timedelta(minutes=10)),
        ]
        cursor.executemany(
            """
            INSERT INTO model_training_labels
            (label_id, txn_id, account_id, agent_action_id, feature_vector_json, label, written_to_s3, mirrored_to_oss, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            labels,
        )

        conn.commit()
        print("Seeded 5 rows into every ERD table.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    seed_erd_mock_data()
