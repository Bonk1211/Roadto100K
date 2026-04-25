-- SQL Schema for SafeSend using PostgreSQL
-- This replaces the previous DynamoDB tables

CREATE TABLE IF NOT EXISTS safesend_alerts (
    txn_id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(50) NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Index for querying by status and risk_score (replaces DynamoDB GSI)
CREATE INDEX IF NOT EXISTS idx_safesend_alerts_status_risk 
ON safesend_alerts (status, risk_score);

CREATE TABLE IF NOT EXISTS safesend_telegram_chat_history (
    chat_id VARCHAR(255) PRIMARY KEY,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Note: To simulate DynamoDB's TTL feature, you can run a cron job or pg_cron 
-- to periodically delete expired rows:
-- DELETE FROM safesend_alerts WHERE expires_at < NOW();
-- DELETE FROM safesend_telegram_chat_history WHERE expires_at < NOW();
