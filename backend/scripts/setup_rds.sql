-- SafeSend PostgreSQL Schema (Normalized)
-- Replaces DynamoDB architecture

-- 1. Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    account_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    account_type VARCHAR(50),
    account_age_days INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    device_fingerprint VARCHAR(255),
    ip_address VARCHAR(50),
    card_bin VARCHAR(6),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    txn_id VARCHAR(255) PRIMARY KEY,
    sender_account_id VARCHAR(255) REFERENCES accounts(account_id),
    receiver_account_id VARCHAR(255) REFERENCES accounts(account_id),
    amount DECIMAL(15,2) NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    channel VARCHAR(50),
    is_first_transfer BOOLEAN DEFAULT FALSE,
    device_match BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    alert_id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) REFERENCES accounts(account_id),
    txn_id VARCHAR(255) REFERENCES transactions(txn_id),
    mule_case_id VARCHAR(255),
    alert_type VARCHAR(100),
    risk_score DECIMAL(5,2),
    stage VARCHAR(50),
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(20),
    processed_ms INTEGER,
    user_display VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITHOUT TIME ZONE
);

-- 4. Risk Scores Table
CREATE TABLE IF NOT EXISTS risk_scores (
    risk_score_id VARCHAR(255) PRIMARY KEY,
    txn_id VARCHAR(255) REFERENCES transactions(txn_id),
    account_id VARCHAR(255) REFERENCES accounts(account_id),
    score_type VARCHAR(50),
    rule_score DECIMAL(5,2),
    ml_score DECIMAL(5,2),
    composite_score DECIMAL(5,2),
    risk_level VARCHAR(20),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Risk Signals Table
CREATE TABLE IF NOT EXISTS risk_signals (
    signal_id VARCHAR(255) PRIMARY KEY,
    risk_score_id VARCHAR(255) REFERENCES risk_scores(risk_score_id),
    signal_name VARCHAR(255),
    signal_value TEXT,
    points DECIMAL(5,2),
    fired BOOLEAN DEFAULT FALSE
);

-- 6. Bedrock Explanations Table
CREATE TABLE IF NOT EXISTS bedrock_explanations (
    explanation_id VARCHAR(255) PRIMARY KEY,
    alert_id VARCHAR(255) REFERENCES alerts(alert_id),
    explanation_type VARCHAR(100),
    explanation_en TEXT,
    explanation_bm TEXT,
    scam_type VARCHAR(100),
    confidence DECIMAL(3,2),
    recommended_action VARCHAR(100),
    incident_summary TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Agent Actions Table
CREATE TABLE IF NOT EXISTS agent_actions (
    action_id VARCHAR(255) PRIMARY KEY,
    alert_id VARCHAR(255) REFERENCES alerts(alert_id),
    agent_id VARCHAR(255),
    action_type VARCHAR(50),
    decision_label VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_txn_id ON alerts(txn_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_account_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_txn ON risk_scores(txn_id);
CREATE INDEX IF NOT EXISTS idx_risk_signals_score_id ON risk_signals(risk_score_id);
