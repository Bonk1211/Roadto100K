#!/usr/bin/env python3
"""
Initialize complete SafeSend PostgreSQL schema with all tables and indexes.
Based on SafeSend PRD v2 ERD.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(__file__))

from shared.db import _get_pg_conn

def init_schema():
    """Create all tables and indexes."""
    conn = _get_pg_conn()
    cursor = conn.cursor()
    
    # Drop all tables in reverse dependency order
    drop_sql = """
    DROP TABLE IF EXISTS model_training_labels CASCADE;
    DROP TABLE IF EXISTS containment_accounts CASCADE;
    DROP TABLE IF EXISTS containment_actions CASCADE;
    DROP TABLE IF EXISTS network_links CASCADE;
    DROP TABLE IF EXISTS agent_actions CASCADE;
    DROP TABLE IF EXISTS bedrock_explanations CASCADE;
    DROP TABLE IF EXISTS alerts CASCADE;
    DROP TABLE IF EXISTS mule_cases CASCADE;
    DROP TABLE IF EXISTS risk_signals CASCADE;
    DROP TABLE IF EXISTS risk_scores CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS accounts CASCADE;
    """
    
    schema_sql = """
    -- ACCOUNTS
    CREATE TABLE accounts (
        account_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        account_type VARCHAR(50),
        account_age_days INT,
        status VARCHAR(50) DEFAULT 'active',
        device_fingerprint VARCHAR(255),
        ip_address VARCHAR(45),
        card_bin VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- TRANSACTIONS
    CREATE TABLE transactions (
        txn_id VARCHAR(255) PRIMARY KEY,
        sender_account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        receiver_account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        amount NUMERIC(15, 2),
        timestamp TIMESTAMP,
        status VARCHAR(50) DEFAULT 'approved',
        channel VARCHAR(50),
        is_first_transfer BOOLEAN DEFAULT FALSE,
        device_match BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- MULE_CASES (before alerts since alerts can reference it)
    CREATE TABLE mule_cases (
        mule_case_id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        mule_score NUMERIC(5, 2),
        stage VARCHAR(50),
        unique_inbound_senders_6h INT,
        avg_inbound_gap_minutes NUMERIC(8, 2),
        inbound_outbound_ratio NUMERIC(5, 2),
        merchant_spend_7d NUMERIC(15, 2),
        status VARCHAR(50) DEFAULT 'monitoring',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- ALERTS
    CREATE TABLE alerts (
        alert_id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        txn_id VARCHAR(255) REFERENCES transactions(txn_id),
        mule_case_id VARCHAR(255) REFERENCES mule_cases(mule_case_id),
        alert_type VARCHAR(50),
        risk_score NUMERIC(5, 2),
        stage VARCHAR(50),
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        processed_ms INTEGER,
        user_display VARCHAR(255)
    );
    
    -- RISK_SCORES (after transactions since it references both)
    CREATE TABLE risk_scores (
        risk_score_id VARCHAR(255) PRIMARY KEY,
        txn_id VARCHAR(255) NOT NULL REFERENCES transactions(txn_id),
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        score_type VARCHAR(50),
        rule_score NUMERIC(5, 2),
        ml_score NUMERIC(5, 2),
        composite_score NUMERIC(5, 2),
        risk_level VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- RISK_SIGNALS
    CREATE TABLE risk_signals (
        signal_id VARCHAR(255) PRIMARY KEY,
        risk_score_id VARCHAR(255) NOT NULL REFERENCES risk_scores(risk_score_id),
        signal_name VARCHAR(255),
        signal_value TEXT,
        points NUMERIC(5, 2),
        fired BOOLEAN DEFAULT TRUE
    );
    
    -- BEDROCK_EXPLANATIONS
    CREATE TABLE bedrock_explanations (
        explanation_id VARCHAR(255) PRIMARY KEY,
        alert_id VARCHAR(255) NOT NULL REFERENCES alerts(alert_id),
        explanation_type VARCHAR(50),
        explanation_en TEXT,
        explanation_bm TEXT,
        scam_type VARCHAR(50),
        confidence NUMERIC(5, 2),
        recommended_action VARCHAR(255),
        incident_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- AGENT_ACTIONS
    CREATE TABLE agent_actions (
        action_id VARCHAR(255) PRIMARY KEY,
        alert_id VARCHAR(255) NOT NULL REFERENCES alerts(alert_id),
        agent_id VARCHAR(255),
        action_type VARCHAR(50),
        decision_label VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- NETWORK_LINKS
    CREATE TABLE network_links (
        link_id VARCHAR(255) PRIMARY KEY,
        source_account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        linked_account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        link_type VARCHAR(50),
        degree INT,
        risk_score NUMERIC(5, 2),
        rm_exposure NUMERIC(15, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- CONTAINMENT_ACTIONS
    CREATE TABLE containment_actions (
        containment_id VARCHAR(255) PRIMARY KEY,
        mule_case_id VARCHAR(255) NOT NULL REFERENCES mule_cases(mule_case_id),
        initiated_by_agent_id VARCHAR(255),
        total_rm_exposure NUMERIC(15, 2),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- CONTAINMENT_ACCOUNTS
    CREATE TABLE containment_accounts (
        containment_account_id VARCHAR(255) PRIMARY KEY,
        containment_id VARCHAR(255) NOT NULL REFERENCES containment_actions(containment_id),
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        action_taken VARCHAR(50),
        selected_by_agent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- MODEL_TRAINING_LABELS
    CREATE TABLE model_training_labels (
        label_id VARCHAR(255) PRIMARY KEY,
        txn_id VARCHAR(255) REFERENCES transactions(txn_id),
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(account_id),
        agent_action_id VARCHAR(255) REFERENCES agent_actions(action_id),
        feature_vector_json JSONB,
        label VARCHAR(50),
        written_to_s3 BOOLEAN DEFAULT FALSE,
        mirrored_to_oss BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Indexes
    CREATE INDEX idx_accounts_user_id ON accounts(user_id);
    CREATE INDEX idx_accounts_status ON accounts(status);
    CREATE INDEX idx_transactions_sender ON transactions(sender_account_id);
    CREATE INDEX idx_transactions_receiver ON transactions(receiver_account_id);
    CREATE INDEX idx_transactions_status ON transactions(status);
    CREATE INDEX idx_risk_scores_txn_id ON risk_scores(txn_id);
    CREATE INDEX idx_risk_scores_account_id ON risk_scores(account_id);
    CREATE INDEX idx_risk_signals_risk_score_id ON risk_signals(risk_score_id);
    CREATE INDEX idx_mule_cases_account_id ON mule_cases(account_id);
    CREATE INDEX idx_mule_cases_status ON mule_cases(status);
    CREATE INDEX idx_alerts_account_id ON alerts(account_id);
    CREATE INDEX idx_alerts_status ON alerts(status);
    CREATE INDEX idx_alerts_alert_type ON alerts(alert_type);
    CREATE INDEX idx_bedrock_explanations_alert_id ON bedrock_explanations(alert_id);
    CREATE INDEX idx_agent_actions_alert_id ON agent_actions(alert_id);
    CREATE INDEX idx_network_links_source ON network_links(source_account_id);
    CREATE INDEX idx_network_links_linked ON network_links(linked_account_id);
    """
    
    try:
        # Drop old tables first
        cursor.execute(drop_sql)
        print("✅ Old tables dropped")
        
        # Create new tables
        cursor.execute(schema_sql)
        conn.commit()
        print("✅ All tables created successfully")
    except Exception as e:
        print(f"❌ Schema creation error: {e}")
        conn.rollback()
    finally:
        cursor.close()

def seed_mock_data():
    """Insert mock data for demo."""
    conn = _get_pg_conn()
    cursor = conn.cursor()
    
    try:
        from datetime import datetime, timedelta
        import random
        
        # Mock accounts
        accounts = [
            ("acc_user_001", "u_john_doe", "personal", 365, "active", "fp_12345", "203.0.113.10", "411111", datetime.now() - timedelta(days=365)),
            ("acc_mule_001", "u_mule_operator", "personal", 6, "monitoring", "fp_67890", "198.51.100.20", "511111", datetime.now() - timedelta(days=6)),
            ("acc_mule_002", "u_money_mover", "personal", 8, "monitoring", "fp_11111", "192.0.2.30", "611111", datetime.now() - timedelta(days=8)),
            ("acc_recipient_001", "u_business_owner", "business", 90, "active", "fp_22222", "203.0.113.40", "711111", datetime.now() - timedelta(days=90)),
            ("acc_scammer_001", "u_scammer", "personal", 3, "soft_blocked", "fp_33333", "198.51.100.50", "811111", datetime.now() - timedelta(days=3)),
        ]
        
        cursor.executemany("""
            INSERT INTO accounts (account_id, user_id, account_type, account_age_days, status, device_fingerprint, ip_address, card_bin, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (account_id) DO NOTHING
        """, accounts)
        
        # Mock transactions
        now = datetime.now()
        transactions = [
            ("txn_0001", "acc_user_001", "acc_recipient_001", 5000.00, now - timedelta(hours=2), "approved", "app", False, True),
            ("txn_0002", "acc_mule_001", "acc_mule_002", 3200.00, now - timedelta(hours=1), "blocked", "mobile_banking", True, False),
            ("txn_0003", "acc_mule_002", "acc_recipient_001", 8000.00, now - timedelta(minutes=30), "warned", "online", False, False),
            ("txn_0004", "acc_scammer_001", "acc_user_001", 1500.00, now - timedelta(minutes=5), "blocked", "api", True, False),
        ]
        
        cursor.executemany("""
            INSERT INTO transactions (txn_id, sender_account_id, receiver_account_id, amount, timestamp, status, channel, is_first_transfer, device_match)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (txn_id) DO NOTHING
        """, transactions)
        
        # Mock risk scores
        risk_scores = [
            ("rs_0001", "txn_0002", "acc_mule_001", "sender_fraud", 65.5, 72.0, 69.2, "high"),
            ("rs_0002", "txn_0002", "acc_mule_002", "mule_detection", 78.0, 85.0, 82.0, "high"),
            ("rs_0003", "txn_0003", "acc_mule_002", "sender_fraud", 55.0, 68.0, 62.5, "medium"),
            ("rs_0004", "txn_0004", "acc_scammer_001", "sender_fraud", 95.0, 98.0, 96.5, "high"),
        ]
        
        cursor.executemany("""
            INSERT INTO risk_scores (risk_score_id, txn_id, account_id, score_type, rule_score, ml_score, composite_score, risk_level)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (risk_score_id) DO NOTHING
        """, risk_scores)
        
        # Mock alerts
        alerts = [
            ("alert_001", "acc_mule_001", "txn_0002", None, "sender_interception", 82.0, "stage_1", "open", "high"),
            ("alert_002", "acc_mule_002", "txn_0003", None, "sender_interception", 62.5, "stage_1", "open", "medium"),
            ("alert_003", "acc_scammer_001", "txn_0004", None, "sender_interception", 96.5, "stage_2", "open", "critical"),
        ]
        
        cursor.executemany("""
            INSERT INTO alerts (alert_id, account_id, txn_id, mule_case_id, alert_type, risk_score, stage, status, priority)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (alert_id) DO NOTHING
        """, alerts)
        
        # Mock mule cases
        mule_cases = [
            ("mule_001", "acc_mule_001", 82.0, "stage_1", 12, 45.5, 2.3, 15000.00, "monitoring"),
            ("mule_002", "acc_mule_002", 78.0, "stage_2", 18, 38.0, 2.8, 28000.00, "under_review"),
        ]
        
        cursor.executemany("""
            INSERT INTO mule_cases (mule_case_id, account_id, mule_score, stage, unique_inbound_senders_6h, avg_inbound_gap_minutes, inbound_outbound_ratio, merchant_spend_7d, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (mule_case_id) DO NOTHING
        """, mule_cases)
        
        # Mock bedrock explanations
        explanations = [
            ("expl_001", "alert_001", "agent_alert", 
             "High-risk mule account detected. Multiple inbound transfers from different senders followed by rapid outbound movements.",
             "Akaun berisiko tinggi dikesan. Berbagai pemindahan masuk dari pengirim berlainan diikuti dengan pergerakan keluar cepat.",
             "mule_account", 0.92, "investigate_containment", "Possible money laundering network"),
        ]
        
        cursor.executemany("""
            INSERT INTO bedrock_explanations (explanation_id, alert_id, explanation_type, explanation_en, explanation_bm, scam_type, confidence, recommended_action, incident_summary)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (explanation_id) DO NOTHING
        """, explanations)
        
        # Mock network links
        network_links = [
            ("link_001", "acc_mule_001", "acc_mule_002", "direct_transaction", 1, 78.0, 11200.00),
            ("link_002", "acc_mule_001", "acc_recipient_001", "timing_cluster", 2, 55.0, 11200.00),
            ("link_003", "acc_scammer_001", "acc_user_001", "shared_ip", 1, 96.5, 1500.00),
        ]
        
        cursor.executemany("""
            INSERT INTO network_links (link_id, source_account_id, linked_account_id, link_type, degree, risk_score, rm_exposure)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (link_id) DO NOTHING
        """, network_links)
        
        conn.commit()
        print("✅ Mock data inserted successfully")
        
    except Exception as e:
        print(f"❌ Mock data insertion error: {e}")
        conn.rollback()
    finally:
        cursor.close()

if __name__ == "__main__":
    print("🗄️  Initializing complete SafeSend schema...")
    init_schema()
    print("🌱 Seeding mock data...")
    seed_mock_data()
    print("✅ Database ready!")
