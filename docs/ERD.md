ACCOUNTS
- account_id (PK)
- user_id
- account_type
- account_age_days
- status                 -- active, watchlisted, soft_blocked, suspended
- device_fingerprint
- ip_address
- card_bin
- created_at
- updated_at

TRANSACTIONS
- txn_id (PK)
- sender_account_id (FK -> accounts.account_id)
- receiver_account_id (FK -> accounts.account_id)
- amount
- timestamp
- status                 -- approved, warned, blocked, cancelled, escrowed
- channel
- is_first_transfer
- device_match
- created_at

RISK_SCORES
- risk_score_id (PK)
- txn_id (FK -> transactions.txn_id)
- account_id (FK -> accounts.account_id)
- score_type             -- sender_fraud, mule_detection
- rule_score
- ml_score
- composite_score
- risk_level             -- low, medium, high
- created_at

RISK_SIGNALS
- signal_id (PK)
- risk_score_id (FK -> risk_scores.risk_score_id)
- signal_name
- signal_value
- points
- fired                  -- true / false

MULE_CASES
- mule_case_id (PK)
- account_id (FK -> accounts.account_id)
- mule_score
- stage                  -- stage_1, stage_2, stage_3
- unique_inbound_senders_6h
- avg_inbound_gap_minutes
- inbound_outbound_ratio
- merchant_spend_7d
- status                 -- monitoring, under_review, evicted, cleared
- created_at
- updated_at

ALERTS
- alert_id (PK)
- account_id (FK -> accounts.account_id)
- txn_id (FK -> transactions.txn_id, nullable)
- mule_case_id (FK -> mule_cases.mule_case_id, nullable)
- alert_type             -- sender_interception, mule_eviction, bulk_containment
- risk_score
- stage
- status                 -- open, resolved, cleared
- priority
- created_at
- resolved_at

BEDROCK_EXPLANATIONS
- explanation_id (PK)
- alert_id (FK -> alerts.alert_id)
- explanation_type       -- user_warning, agent_alert, incident_report
- explanation_en
- explanation_bm
- scam_type
- confidence
- recommended_action
- incident_summary
- created_at

AGENT_ACTIONS
- action_id (PK)
- alert_id (FK -> alerts.alert_id)
- agent_id
- action_type            -- block, warn, clear, execute_containment
- decision_label         -- fraud, false_positive, monitor
- notes
- created_at

NETWORK_LINKS
- link_id (PK)
- source_account_id (FK -> accounts.account_id)
- linked_account_id (FK -> accounts.account_id)
- link_type              -- direct_transaction, shared_device, shared_ip, timing_cluster, card_bin
- degree                 -- 1 or 2
- risk_score
- rm_exposure
- created_at

CONTAINMENT_ACTIONS
- containment_id (PK)
- mule_case_id (FK -> mule_cases.mule_case_id)
- initiated_by_agent_id
- total_rm_exposure
- status                 -- pending, executed, partially_failed
- created_at

CONTAINMENT_ACCOUNTS
- containment_account_id (PK)
- containment_id (FK -> containment_actions.containment_id)
- account_id (FK -> accounts.account_id)
- action_taken           -- suspended, withdrawal_blocked, escrowed
- selected_by_agent
- created_at

MODEL_TRAINING_LABELS
- label_id (PK)
- txn_id (FK -> transactions.txn_id)
- account_id (FK -> accounts.account_id)
- agent_action_id (FK -> agent_actions.action_id)
- feature_vector_json
- label                  -- normal, fraud, mule, false_positive
- written_to_s3
- mirrored_to_oss
- created_at