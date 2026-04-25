# SafeSend — Product Requirements Document
### Touch 'n Go FinHack Hackathon | Security & Fraud Track

**Version:** 4.0 (build-aligned)
**Date:** April 2026
**Team Size:** 4
**Hackathon Duration:** 24 Hours

> v4 supersedes v3. Reflects what the team actually shipped: Alibaba EAS for the
> ML hot path, AWS for orchestration + GenAI, an autonomous 5-agent verification
> team (AgentOps), real PostgreSQL graph traversal for bulk containment, and an
> SQS-driven worker pipeline. Everything in this document maps to deployed code.

---

## 1. Executive Summary

**SafeSend** is a real-time fraud-intelligence and early-containment system for
Touch 'n Go's e-wallet platform. It does not duplicate the industry's mature
Stage-4 detection — it closes the gap between Stage-1 detection and Stage-4
damage by intercepting on the sender side, evicting mules on the receiver side,
and arbitrating every flag through an autonomous 5-agent verification team
before an analyst ever sees it.

**Three core mechanisms:**
1. **Sender-side transfer interception** — every transfer scored in <500ms
   (rules + Alibaba EAS Isolation Forest + Bedrock explainability).
2. **Receiver-side mule early eviction** — Stage 1 silent watchlist → Stage 2
   agent alert → Stage 3 auto-suspend, all before a single ringgit clears.
3. **Autonomous verification + bulk containment** — five Bedrock-streaming
   agents arbitrate every alert; on Stage 3 mule eviction, one click locks the
   entire linked-account cluster via real PostgreSQL graph traversal.

**One-line pitch:**
> *"The industry detects fraud at Stage 4. SafeSend acts at Stage 1, with five
> AI agents arguing the case in real time and a one-click bulk lock that
> collapses the mule's network in under 10 seconds."*

**Platform**
- Agent-facing AgentOps dashboard (React + Vite + Tailwind)
- TnG transfer-flow web app (React + Vite — wired to live API Gateway)

**Cloud**
- **AWS hot path** — Lambda, API Gateway HTTP, Bedrock (Claude Haiku), RDS
  PostgreSQL, Kinesis, SQS, SNS, SSM Parameter Store, EventBridge.
- **Alibaba Cloud** — EAS (Elastic Algorithm Service) hosts the Isolation
  Forest scorer; OSS holds the compliance label + incident-report mirror for
  Malaysian data sovereignty.

The multi-cloud split is genuine: Alibaba owns ML + sovereign storage; AWS
owns orchestration + GenAI + transactional state.

---

## 2. Problem Statement

Malaysia lost over **RM 1.2 billion** to scams in 2023 (Bank Negara Malaysia).
Macau scams, fake LHDN notices, investment fraud and love scams all share one
operational chokepoint: **mule accounts inside e-wallet platforms**. By the
time a typical mule is flagged today, it has already cleared multiple
transfers and the funds have left the platform.

**Three losses TnG absorbs per fraud incident:**
1. Chargeback liability on reversed transactions.
2. User churn — a scammed user tells 10 people, deletes the app, never returns.
3. Merchant network poisoning — mules sitting in TnG's payee graph erode
   trust for legitimate merchants nearby.

SafeSend addresses all three by acting at Stage 1–2, while the money is still
inside TnG.

---

## 3. Goals & Judging Alignment

| Judging Criterion | How SafeSend v4 Addresses It |
|---|---|
| **AI & Intelligent Systems** | Two distinct AI surfaces with clearly separated roles: (a) Alibaba EAS Isolation Forest for sub-second ML scoring; (b) AWS Bedrock Claude Haiku in three modes — user warning (Type 1), agent mule alert (Type 2), compliance incident report (Type 3); (c) **5-agent autonomous verification team** (Transaction, Behaviour, Network, Compliance, Victim profiler) streaming reasoning into the dashboard with weighted-confidence arbitration. |
| **Multi-Cloud (AWS + Alibaba)** | Genuine architectural split: Alibaba EAS = ML hot path; Alibaba OSS = compliance audit trail + sovereign data; AWS = orchestration + GenAI + transactional state. The hand-off is on every screening request, not a checkbox. |
| **Technical Implementation** | Event-driven SQS pipeline; sub-500ms screening; 5-agent verification with rules fast-path and Bedrock streaming fallback; real PostgreSQL graph traversal (transactions + network_links + shared device/IP/BIN + registration cluster); partial-batch SQS failure handling with DLQ; SSM-backed config; nightly EC2-hosted retraining loop. |
| **Impact & Feasibility** | RM 1.2B annual problem; 24M TnG users; demo-able end-to-end in 24 hours with mock + injected synthetic alerts; one-click bulk containment compresses 4-hour analyst workflow into <10s. |
| **Presentation** | Mule eviction → 5 agents stream verdicts → bulk containment with auto-generated compliance report. Visceral, specific, and the AgentOps lane gives judges something they have not seen before in a hackathon fraud demo. |

---

## 4. Feature Scope (8 features — v3 +1)

| # | Feature | Status | Priority |
|---|---|---|---|
| F1 | Transfer Interception — 8 signals + Alibaba EAS + 3-way branch | Built | Must have |
| F2 | Mule Early Eviction — Stage 1→2→3 with watchlist inheritance into F1 | Built | Must have ⭐ |
| F3 | Bulk Network Containment — real PostgreSQL graph traversal + one-click lock | Built | Must have |
| F4 | AI Explainability — Bedrock Type 1/2/3 (user / agent / incident report) | Built | Must have |
| F5 | **AgentOps Dashboard — autonomous 5-agent verification team** | Built | Must have ⭐ |
| F6 | Natural Language Fraud Query — Bedrock → whitelisted JSON → safe SQL | Built | Should have |
| F7 | Feedback Loop — agent labels → S3 + OSS + nightly Alibaba EAS retrain | Built | Should have |
| F8 | **(NEW)** End-user choice logging — Cancel/Proceed/Report → label + audit | Built | Should have |

---

## 5. Feature Detail

### F1 — Transfer Interception (8 signals + ML + 3-way branch)

`backend/lambdas/screen_transaction/handler.py` →
`POST /api/screen-transaction`

Every transfer is evaluated before funds move. A rule engine + Alibaba EAS
Isolation Forest run; outputs combine into a composite risk score (0–100).

**8 Rule Signals** (each value tunable via env / SSM):

| Signal | Points |
|---|---|
| Payee account age < 14 days | 20 |
| First-ever transfer to this payee | 15 |
| Amount > 3× user 30-day average | 20 |
| Late-night (10pm – 6am) | 10 |
| Device fingerprint mismatch | 15 |
| Payee linked to flagged accounts | 30 |
| Large round-number transfer (>RM 5k, ÷RM 1k) | 5 |
| **Payee already on mule watchlist (Stage 1+)** ⭐ NEW | 30 |

The **watchlist signal** is the F2-into-F1 inheritance the v3 PRD called for
but never wired: `screen_transaction` queries `mule_cases` for the payee at
the start of every screening (`shared.mule.get_watchlist_stage`). Any payee
flagged at Stage 1+ inherits +30 points on the sender side. This collapses
mule operations the moment a single victim has been intercepted.

**Composite scoring**
`final_score = 0.4 * rule_score + 0.6 * eas_score` (env: `RULE_WEIGHT`,
`ML_WEIGHT`).

**3-way branch**
- `0–39` → `proceed` — silent auto-approve, Kinesis log only.
- `40–69` → `soft_warn` — bilingual overlay; user dismisses or cancels; choice
  logged via F8.
- `70–100` → `hard_intercept` — Bedrock Type 1 bilingual explanation; user
  must Cancel / Proceed Anyway / Report Scam (all logged via F8).

Every alert (score ≥40) is enqueued to the verify SQS so the **5-agent team
(F5)** automatically opens a verification run.

After scoring, F2 receiver evaluation runs unconditionally (`evaluate_receiver`
in `shared.mule`), so even a clean sender-side transfer can flip a payee onto
the mule watchlist.

---

### F2 — Mule Account Early Eviction ⭐

`backend/lambdas/mule_detector/handler.py` + `backend/layer/shared/mule.py`
→ `POST /api/mule-detect` (also called inline by F1)

**5 Mule Signals** (PRD §11 features come straight off the receiver row):

| Signal | Predicate | Points |
|---|---|---|
| Unique inbound senders 6h | `>= 3` | 30 |
| Average gap between inbound transfers | `< 20 min` | 25 |
| Inbound-to-outbound ratio | `> 80%` | 25 |
| Account age | `< 30 days` | 15 |
| Merchant spend last 7d | `== 0` | 20 |

Features are aggregated **live from PostgreSQL** in
`shared.mule.aggregate_receiver_features` — no external dependency, no
hardcoded EC2 IP (the v3 build had `mule_detector` POSTing to an EC2
`/mule-alert` endpoint; that's gone in v4).

**3-stage escalation**
- **Stage 1 (40–59)** — silent watchlist. Row in `mule_cases` (`status='monitoring'`).
  Future F1 screenings on this payee inherit `+30` (see F1 watchlist signal).
- **Stage 2 (60–79)** — agent alert. Inserts `alerts` row
  (`alert_type='mule_eviction'`, `priority='high'`). Account flipped to
  `status='monitoring'`. Bedrock Type 2 explanation written to
  `bedrock_explanations`. Alert enters the verify SQS.
- **Stage 3 (80–100)** — auto-eviction. Account suspended on the spot.
  Pending withdrawals held in escrow. Alert priority `critical`. Type 2
  explanation written. Stage-3 cases surface in the AgentOps queue with the
  Bulk Containment panel pre-loaded.

---

### F3 — Bulk Network Containment

`backend/lambdas/bulk_containment/handler.py` →
`GET  /api/containment/{account_id}`     — preview
`POST /api/containment/execute`          — one-click lock

**Real graph traversal** (no mock data):

1st-degree (any of):
- Direct transactions (sender/receiver edge in `transactions`)
- Explicit edges in `network_links`

2nd-degree (any of):
- Same `device_fingerprint`
- Same `ip_address`
- Same `card_bin`
- Account created within ±60 minutes of focal mule (registration cluster)

For each linked account the API surfaces `account_age_days`, `status`,
`risk_score` (max of `risk_scores.composite_score`, `alerts.risk_score`,
`mule_cases.mule_score`), `rm_exposure` (sum of last-30d transactions
involving the account), `degree`, and `connection_type`.

**Execute** writes:
- `containment_actions` — single row per execution
- `containment_accounts` — one row per contained account
- `accounts.status='suspended'` for every selected account + the focal mule
- `transactions.status='held_escrow'` for any pending withdrawals on those
  accounts
- `alerts` row of type `bulk_containment` for audit
- `bedrock_explanations` row holding the **Bedrock Type 3 incident report**
- Best-effort: Kinesis event + Alibaba OSS mirror of the incident report

Whole pipeline target: <10s for ≤50 accounts.

---

### F4 — AI Explainability Layer (Bedrock — three types)

`backend/layer/shared/bedrock.py`

- **Type 1 — User warning** (`invoke_bedrock`)
  Audience: TnG end user (potentially elderly). Output: 2 sentences,
  bilingual, names the scam type. Used by F1 hard intercept.

- **Type 2 — Agent mule alert** (`invoke_mule_alert`) ⭐ NEW vs v3 build
  Audience: fraud analyst. Output: structured pattern_name, signals_fired,
  confidence, recommended_action. Used by F2 Stage 2/3.

- **Type 3 — Compliance incident report** (`invoke_incident_report`) ⭐ NEW
  Audience: TnG compliance team. Output: incident_title, pattern_description,
  accounts_involved, total_rm_exposure, actions_taken, recommended_followup.
  Used by F3 bulk containment. Mirrored to OSS as
  `safesend-incidents/YYYY-MM-DD/{containment_id}.json`.

All three return strict JSON; on Bedrock failure each falls back to a
deterministic template so the demo never breaks.

---

### F5 — AgentOps Dashboard ⭐ (replaces v3 single-queue dashboard)

`frontend/apps/agent-dashboard/`
`backend/layer/shared/verification.py`
`backend/lambdas/verify_alert/handler.py`

This is the v4 differentiator. Instead of a single alert queue with three
buttons, every alert is auto-verified by **five Bedrock-streaming agents
arguing in parallel**:

| Agent | Lens |
|---|---|
| Transaction Analyst | Amount, channel, first-transfer status, exfiltration signature |
| Behaviour Analyst | Device match, account ages, takeover indicators |
| Network Analyst | Mule cluster membership, layering ratio, inbound senders |
| Compliance Officer | BNM PSA / AMLA thresholds, scam typology, SOP |
| Victim Profiler | Sender coercion patterns (Macau / love / investment) |

**Pipeline:**
1. F1/F2 inserts an alert + enqueues `{"alert_id": ...}` to SQS
   (`safesend-verify-queue`, DLQ + max-receive 3).
2. `verify_alert` Lambda picks up the message (BatchSize=1, partial-batch
   failure response). Reserved concurrency 5 caps RDS connection storms.
3. **Rules fast-path** (`rules_classify`) — for obvious-block / obvious-clear
   cases the team skips Bedrock and emits five rule-based verdicts. Saves
   cost + latency on tail traffic.
4. Otherwise the five agents run as `asyncio.gather` tasks streaming Bedrock
   tokens into `agent_streams.partial_text` (flushed every 0.18s). Falls back
   to a deterministic mock pipeline when `VERIFY_MOCK=1`.
5. Arbiter (`arbitrate`) does confidence-weighted voting and writes
   `verification_runs.final_verdict`, agreement %, and an `agent_actions`
   audit row labelled `auto_verifier`.
6. Stale runs (>120s) are auto-expired.

The dashboard polls `/api/verifications/active` at 400ms while a run is live
and 1.5s while idle, plus `/api/agent-stats?window_minutes=60` and a worker
state pause/resume control. Agents render as a streaming lane (live partial
text), a decision feed with consensus + agreement, and an analytics strip
(blocks/warns/clears per agent, latency p50/p95).

Inject + reverify endpoints (`/api/verifications/inject`,
`/api/alerts/{id}/reverify`) let the demo fire scripted scenarios without
touching the user app.

---

### F6 — Natural Language Fraud Query

`backend/lambdas/fraud_query/handler.py` → `POST /api/fraud-query`

Bedrock translates English/BM into a strict JSON filter spec
(`{filters[], sort_by, limit}`), the handler validates against a
`FIELD_MAP` whitelist + `ALLOWED_OPS` set, and builds a parameterised SQL
join across `alerts × transactions × accounts`. No raw NL→SQL — every field
and op is whitelisted.

Tested queries:
- *"Show accounts that topped up from 3+ senders in 24h and haven't spent."*
- *"Find accounts < 7 days old with transfers over RM 5,000."*
- *"Show all accounts linked to device ID X."*

---

### F7 — Feedback Loop + Retraining

- `backend/lambdas/agent_action/handler.py` writes the agent's Block / Warn /
  Clear to `agent_actions` (label `fraud=1` / `false_positive=0`).
- `backend/lambdas/user_choice/handler.py` (F8) writes the end-user's
  Cancel/Proceed/Report.
- Both publish to Kinesis + best-effort `shared.oss.write_label` so the
  Malaysian data-sovereignty story is real, not a stub.
- `backend/lambdas/retrain_trigger/handler.py` is invoked by EventBridge
  (rate(1 day)) and POSTs the EC2-hosted FastAPI scorer's `/retrain`
  endpoint. The scorer reads the merged S3 + OSS labels and republishes the
  Alibaba EAS model.

---

### F8 — End-user Choice Logging ⭐ NEW

`backend/lambdas/user_choice/handler.py` → `POST /api/user-choice`

The v3 user-app `submitUserChoice` quietly swallowed errors because the
endpoint didn't exist. v4 ships it:

- Validates `choice ∈ {cancel, proceed, report}`
- Updates `alerts.user_choice` (best-effort; tolerates schema drift)
- Sets alert status (`cancel→cleared`, `report→blocked`, `proceed` keeps open)
- Writes audit row to `agent_actions` with `agent_id='user:{user_id}'`
- Publishes Kinesis `user_choice` event
- Best-effort OSS label JSONL line

This makes the user-app's Cancel/Proceed/Report buttons real training data,
not UI theatre.

---

## 6. User Flows

### Flow A — Sender-side Transfer Interception (live API)

```
TnG transfer flow (user-app /confirm)
  -> screenTransaction() POST /api/screen-transaction
  -> screen_transaction Lambda
        -> get_watchlist_stage(payee)        [F2 inheritance]
        -> evaluate_signals (8 rules)
        -> call_eas (Alibaba EAS Isolation Forest)
        -> compute composite score
        -> action = proceed | soft_warn | hard_intercept
        -> if hard_intercept: invoke_bedrock (Type 1)
        -> if score >= 40:
             - put_alert (RDS chain: accounts -> transactions -> alerts -> risk_scores -> risk_signals -> bedrock_explanations)
             - publish_verify_message (SQS)  [F5 verification]
        -> evaluate_receiver(payee)          [F2 always]
             - aggregate features from transactions/accounts
             - score 5 mule signals -> Stage 0/1/2/3
             - upsert mule_cases (Stage 1+)
             - insert mule alerts row + Bedrock Type 2 (Stage 2+)
             - suspend account immediately (Stage 3)
             - publish_verify_message for the mule alert
        -> Kinesis transaction_screened event
        -> response

Response
  proceed       -> /done
  soft_warn     -> /confirm modal -> user choice -> POST /api/user-choice -> /done
  hard_intercept -> /intercept     -> user choice -> POST /api/user-choice -> /done
```

### Flow B — AgentOps Verification

```
Alert inserted (sender_interception OR mule_eviction)
  -> SQS message {"alert_id": "..."}
  -> verify_alert Lambda (reserved concurrency 5, BatchSize 1)
        -> load_alert_context (RDS join: alerts × transactions × accounts × mule_cases × bedrock_explanations)
        -> rules_classify (fast-path)
              if obvious-high or obvious-low -> emit 5 rule findings, skip Bedrock
        -> else asyncio.gather over [txn, behavior, network, policy, victim]:
              each agent runs invoke_model_with_response_stream
              partial text flushed to agent_streams every 0.18s
              final JSON parsed -> agent_findings row
        -> arbitrate -> final_verdict + agreement %
        -> finalise_run + agent_actions audit row (agent_id=auto_verifier)
        -> alerts.status -> resolved / cleared
Dashboard polls /api/verifications/active at 400ms while run live
```

### Flow C — Bulk Network Containment

```
Stage 3 mule eviction (or any mule alert at the dashboard)
  -> agent opens Network tab -> ContainmentPanel
  -> GET /api/containment/{mule_account_id}
        bulk_containment Lambda traverses graph:
          1st-degree: transactions edges + network_links rows
          2nd-degree: shared device_fingerprint / ip_address / card_bin / ±60min reg cluster
        per-account: risk_score, rm_exposure (last 30d), degree, connection_type
  -> agent reviews, deselects false positives
  -> POST /api/containment/execute {mule_account_id, account_ids[]}
        -> ensure mule_cases row + containment_actions row
        -> accounts.status='suspended' for all targets + focal
        -> transactions.status='held_escrow' for pending withdrawals
        -> invoke_incident_report (Bedrock Type 3)
        -> alerts row (bulk_containment) + bedrock_explanations row
        -> Kinesis bulk_containment event
        -> Alibaba OSS write_incident_report (best-effort)
        -> respond with incident_report JSON for inline rendering
```

### Flow D — Natural Language Fraud Query

```
agent types EN/BM question -> POST /api/fraud-query
  -> Bedrock returns strict JSON filter spec
  -> handler validates fields/ops against whitelist
  -> parameterised SQL on alerts × transactions × accounts
  -> filtered alerts list rendered in queue
```

### Flow E — Feedback + Retraining

```
F5 agent action (block/warn/clear) | F8 user choice (cancel/proceed/report)
  -> agent_actions row + alerts.status update
  -> Kinesis event
  -> OSS label JSONL append (best-effort)

EventBridge rate(1 day)
  -> retrain_trigger Lambda -> POST EC2 FastAPI /retrain
        scorer reads S3 + OSS labels, retrains Isolation Forest, redeploys to Alibaba EAS
```

---

## 7. Tech Stack (deployed)

### AWS

| Service | Role |
|---|---|
| API Gateway HTTP | All public REST endpoints |
| Lambda | F1 screen, F2 mule_detector, F3 bulk_containment, F4 bedrock helpers, F5 verify_alert + verifications + agent_stats + worker_state + inject + reverify, F6 fraud_query, F7 retrain_trigger, F8 user_choice, plus get_alerts / get_stats / get_network_graph / agent_action |
| Bedrock (Claude Haiku) | Types 1/2/3 + 5-agent streaming verification + NL→filter-spec |
| RDS PostgreSQL | Alerts, transactions, accounts, mule_cases, network_links, containment, verification runs/findings/streams, agent_actions, bedrock_explanations |
| Kinesis | `safesend-events` — append-only event log |
| SQS | `safesend-verify-queue` (+ DLQ) — drives the autonomous worker |
| SNS | `safesend-user-alerts` — block notifications |
| EventBridge | Nightly retrain trigger |
| SSM Parameter Store | EAS endpoint + key, OSS creds, Bedrock region |

### Alibaba Cloud

| Service | Role |
|---|---|
| **EAS** | Isolation Forest fraud scorer — sub-second hot-path ML |
| **OSS** | Compliance label JSONL + Type-3 incident reports — Malaysian data sovereignty |

### Frontend

| App | Stack |
|---|---|
| `user-app` (TnG transfer flow) | React + Vite + Tailwind, axios → API Gateway |
| `agent-dashboard` (AgentOps) | React + Vite + Tailwind, D3 force graph, Recharts, polling at 400ms/1.5s, ContainmentPanel, NL query box |

---

## 8. Architecture Overview

```
[user-app /confirm]
     │ POST /api/screen-transaction
     ▼
[Lambda: screen_transaction]
     ├─ get_watchlist_stage(payee) ────────────────────── RDS mule_cases
     ├─ rule engine (8 signals)
     ├─ call_eas(features) ────────────────────────────── Alibaba EAS Isolation Forest
     ├─ Bedrock Type 1 (if hard_intercept) ───────────── AWS Bedrock (Claude Haiku)
     ├─ put_alert ─────────────────────────────────────── RDS alerts/...
     ├─ publish_verify_message ───────────────────────── SQS verify-queue
     ├─ evaluate_receiver(payee)
     │     ├─ aggregate_receiver_features ─────────────── RDS transactions
     │     ├─ score 5 mule signals
     │     ├─ upsert mule_cases / insert alerts (Stage 2+)
     │     ├─ Bedrock Type 2 (Stage 2+)
     │     ├─ accounts.status='suspended' (Stage 3)
     │     └─ publish_verify_message
     └─ Kinesis transaction_screened

[SQS verify-queue]
     ▼
[Lambda: verify_alert] (reservedConcurrency 5)
     ├─ rules_classify (fast-path)
     ├─ asyncio.gather → 5 Bedrock streaming agents
     │       txn / behavior / network / policy / victim
     ├─ agent_streams (partial text every 0.18s) ──────── RDS
     ├─ agent_findings (final verdicts) ───────────────── RDS
     ├─ arbitrate → final_verdict + agreement %
     └─ verification_runs row + agent_actions audit ───── RDS

[agent-dashboard]
     ├─ Agent Ops tab     polls /api/verifications/active + /api/agent-stats
     ├─ Network tab       ContainmentPanel +
     │                    GET /api/containment/{id}
     │                    POST /api/containment/execute → Bedrock Type 3
     │                                                  + Kinesis + OSS mirror
     └─ Settings/model    /api/worker/{state|pause|resume}, retrain trigger

[EventBridge daily 02:00]
     → retrain_trigger Lambda → EC2 FastAPI /retrain
            → reads S3 + OSS labels → retrains Isolation Forest → republishes to EAS
```

---

## 9. Demo Script (5 min)

**Opening (30s)** — *"Industry detects fraud at Stage 4. SafeSend acts at Stage 1, verifies it with five AI agents in parallel, and locks the entire mule network in one click."*

**Act 1 — Transfer interception (1 min)**
User-app → enter RM 8,000 to a 6-day-old payee. Hit Confirm. SafeSend
intercepts. Bedrock bilingual Type 1 explanation renders. Show the 8 signals
firing — including the new **payee-on-watchlist** signal (we pre-flagged the
payee from earlier traffic). User cancels. Choice posts to `/api/user-choice`,
the alert's user_choice column is set, label flushed to Kinesis + OSS.

**Act 2 — AgentOps verification (1.5 min)**
Flip to dashboard. The alert from Act 1 is already running. Five lanes
(Transaction / Behaviour / Network / Compliance / Victim) stream Bedrock
reasoning live. Within ~3s the arbiter resolves with 4/5 agreement → BLOCK.
Decision feed updates. Worker analytics show p50 latency per agent. *"Five
specialists deliberate, one verdict — every alert, no human in the loop
unless we want one."*

**Act 3 — Mule eviction + bulk containment (1.5 min)**
A mule account that received transfers from 4 senders in 3 hours has hit
Stage 3 in the queue. Open the Network tab. ContainmentPanel: type the mule
account_id → preview shows 1st-degree (3 direct transactions) + 2nd-degree
(2 shared device, 1 reg cluster). RM exposure RM 142,000 across 6 accounts.
Click **Execute Containment**. Watch:

- All 6 + focal mule flip to `suspended` in <10s.
- Pending withdrawals → `held_escrow`.
- Bedrock Type 3 incident report renders inline.
- OSS mirror written.

*"What used to take a fraud analyst 4 hours now takes 9 seconds, and the
compliance officer just signs the report instead of writing it."*

**Act 4 — NL fraud query (30s)**
*"Show accounts that received money from 3+ senders in 24 hours and haven't
spent anything."* Bedrock translates → whitelisted JSON spec → safe SQL →
filtered list lands in the queue.

**Close (30s)** — *"Two clouds doing what they're each best at. Five AI
specialists, not one black box. A live link from Stage 1 detection to Stage
3 eviction to one-click cluster takedown — all backed by code that's
deployed right now."*

---

## 10. Bedrock Prompt Reference

### Type 1 — User warning (`shared.bedrock.invoke_bedrock`)
Returns `{explanation_en, explanation_bm, scam_type, confidence}`.

### Type 2 — Agent mule alert (`shared.bedrock.invoke_mule_alert`)
Returns `{explanation_en, pattern_name, signals_fired[], confidence, recommended_action}`.

### Type 3 — Compliance incident report (`shared.bedrock.invoke_incident_report`)
Returns `{incident_title, pattern_description, accounts_involved[], total_rm_exposure, actions_taken[], recommended_followup, report_timestamp}`.

All three use Claude Haiku (`anthropic.claude-3-haiku-20240307-v1:0`),
`temperature=0`, strict JSON parsing with `{...}` extraction, and
deterministic fallbacks.

### Verification agent prompts (`shared.verification._BEDROCK_PROMPTS`)
Each agent gets a one-line role priming the lens it should apply, plus the
`_BEDROCK_OUTPUT` JSON contract: `{verdict, confidence, evidence[], reasoning}`.

### NL fraud query (`fraud_query._bedrock_translate`)
Strict JSON filter spec: `{filters[{field, op, value}], sort_by, limit, summary}`.
Field/op whitelist enforced server-side.

---

## 11. Mock Data Schema (matches `init_full_schema.py`)

Tables (PK first):
- `accounts(account_id, user_id, account_type, account_age_days, status, device_fingerprint, ip_address, card_bin, …)`
- `transactions(txn_id, sender_account_id, receiver_account_id, amount, timestamp, status, channel, is_first_transfer, device_match, …)`
- `mule_cases(mule_case_id, account_id, mule_score, stage, unique_inbound_senders_6h, avg_inbound_gap_minutes, inbound_outbound_ratio, merchant_spend_7d, status, …)`
- `alerts(alert_id, account_id, txn_id, mule_case_id, alert_type, risk_score, stage, status, priority, …)`
- `risk_scores`, `risk_signals`, `bedrock_explanations`, `agent_actions`
- `network_links(link_id, source_account_id, linked_account_id, link_type, degree, risk_score, rm_exposure, …)`
- `containment_actions(containment_id, mule_case_id, initiated_by_agent_id, total_rm_exposure, status, …)`
- `containment_accounts(containment_account_id, containment_id, account_id, action_taken, selected_by_agent, …)`
- `model_training_labels(label_id, txn_id, account_id, agent_action_id, feature_vector_json, label, written_to_s3, mirrored_to_oss, …)`
- `verification_runs`, `agent_findings`, `agent_streams`, `worker_settings` (created by `init_verification_schema.py`)

Demo seed: 450 normal + 30 sender-fraud + 20 mule = 500 rows in
`seed_erd_mock_data.py`.

**Recommended migration for v4** (run once):
```sql
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS user_choice VARCHAR(20);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS processed_ms INT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS user_display VARCHAR(64);
```

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Alibaba EAS endpoint slow / unreachable | `shared.eas_client._fallback_score` returns deterministic rule-based score in <1ms; Lambda never blocks. |
| Bedrock latency or rate-limit during pitch | All three Bedrock helpers fall back to deterministic templates; verification worker has `VERIFY_MOCK=1` toggle for cost-free streaming agents. |
| RDS connection storm under demo load | `verify_alert` reserved concurrency = 5, `screen_transaction` reserved concurrency = 10. Move to RDS Proxy if scaling beyond demo. |
| OSS creds missing | `shared.oss._get_bucket()` returns None and writes log line; never raises — compliance mirror degrades gracefully. |
| EC2 retrain endpoint down | Nightly retrain is non-blocking; existing EAS endpoint keeps serving last-good model. |
| Bulk containment locks legitimate accounts | Agent reviews + deselects 2nd-degree candidates before clicking Execute; every action logs to `containment_accounts` for full audit + reversibility. |
| User-choice endpoint absent in v3 | Built and deployed in v4 (`/api/user-choice`). |

---

## 13. Success Metrics

| Metric | Target |
|---|---|
| Sender screening latency (p95) | < 500ms |
| Verification run latency (5 agents, Bedrock streaming) | < 6s |
| Verification run latency (rules fast-path) | < 200ms |
| Mule eviction time-to-suspend (Stage 3) | < 2s from inbound transfer |
| Bulk containment ≤50 accounts | < 10s |
| NL fraud query | < 3s |
| OSS compliance mirror success rate | > 99% (best-effort tolerated) |

---

## 14. Endpoints Cheat Sheet

| Method | Path | Lambda |
|---|---|---|
| POST | `/api/screen-transaction` | screen_transaction |
| POST | `/api/user-choice` ⭐ | user_choice |
| POST | `/api/mule-detect` ⭐ refactored | mule_detector |
| GET  | `/api/containment/{account_id}` ⭐ | bulk_containment (preview) |
| POST | `/api/containment/execute` ⭐ | bulk_containment (execute) |
| GET  | `/api/network-graph` | get_network_graph (mock data; bulk_containment is the real one) |
| POST | `/api/fraud-query` | fraud_query |
| GET  | `/api/alerts`, `/api/alerts/{txn_id}` | get_alerts |
| POST | `/api/alerts/{txn_id}/action` | agent_action |
| POST | `/api/alerts/{alert_id}/reverify` | reverify_alert |
| GET  | `/api/stats` | get_stats |
| GET  | `/api/agent-stats` | agent_stats |
| GET  | `/api/verifications/recent`, `active`, `queue`, `{run_id}`, `{run_id}/streams` | verifications |
| POST | `/api/verifications/inject` | inject_alert |
| GET/POST | `/api/worker/state` `/pause` `/resume` | worker_state |

---

## 15. What changed from v3 → v4

| Area | v3 (PRD) | v4 (built) |
|---|---|---|
| ML hot path | "AWS SageMaker Isolation Forest" | **Alibaba EAS** Isolation Forest (kept SageMaker as fallback in spec only) |
| Mule detector | POST to hardcoded EC2 IP, no DB write | Refactored: features aggregated from RDS, writes mule_cases + alerts + Bedrock Type 2 + suspends Stage 3 |
| Stage-1 watchlist inheritance | Specified, not built | `payee_on_mule_watchlist` signal +30 in F1 |
| Bulk containment | Mock data only | Real PostgreSQL graph traversal + Bedrock Type 3 + OSS mirror + DB writes |
| Bedrock | Type 1 only | Type 1 + Type 2 + Type 3 |
| Agent dashboard | "Single queue + Block/Warn/Clear" | **AgentOps**: 5 streaming agents per alert + arbiter + analytics + worker controls |
| User choice | endpoint missing | `/api/user-choice` deployed; user-app intercept screen → real label |
| OSS | hardcoded `oss_label_written = True` | `shared.oss` writes JSONL labels + incident reports (best-effort) |
| Multi-cloud framing | "AWS hot path / Alibaba cold storage" | "Alibaba ML hot path + sovereign storage / AWS orchestration + GenAI + transactional" |

---

*SafeSend PRD v4 — Touch 'n Go FinHack Hackathon, April 2026. Internal use only.*
