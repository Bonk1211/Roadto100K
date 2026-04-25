# SafeSend — Product Requirements Document
### Touch 'n Go FinHack Hackathon | Security & Fraud Track

**Version:** 3.0
**Date:** April 2026
**Team Size:** 4
**Hackathon Duration:** 24 Hours

---

## 1. Executive Summary

**SafeSend** is a real-time fraud intelligence and early containment system built for Touch 'n Go's e-wallet platform. It does not attempt to prevent fraud before it starts — the industry already does that, and it is mature. SafeSend solves the gap the industry has not closed: **the window between Stage 1 detection and Stage 4–5 damage**.

Today, by the time a fraud pattern is confirmed and acted upon inside a typical e-wallet platform, multiple transactions have already cleared and funds have left the ecosystem. SafeSend compresses that response window from hours to seconds through two core mechanisms: real-time transfer interception on the sender side, and Mule Account Early Eviction on the receiver side — collapsing the scam's infrastructure before serious volume moves.

**One-line pitch:**
*"The industry detects fraud at Stage 4. SafeSend acts at Stage 1 — before the mule account processes a single ringgit of volume."*

**Platform:** React web application (agent-facing dashboard) + TnG transfer flow simulation (demo)
**Cloud:** AWS (hot path — Lambda, Kinesis, Bedrock, SageMaker, PostgreSQL, SNS, API Gateway) + Alibaba Cloud (cold storage + compliance audit trail — OSS)

---

## 2. Problem Statement

Malaysia lost over **RM 1.2 billion** to scams in 2023 (Bank Negara Malaysia). The dominant scam vectors — Macau scams, fake LHDN notices, investment fraud, love scams — all share the same operational infrastructure: a network of **mule accounts** inside e-wallet platforms that receive scam proceeds and pass them out before detection.

The industry's fraud detection is not broken — it is simply too slow. By the time a suspicious pattern is confirmed at Stage 4 or 5, the mule account has already processed multiple transfers, the funds have left the platform, and TnG faces chargeback liability, merchant trust erosion, and a scammed user who will never return.

**The three losses TnG absorbs per fraud incident:**
1. **Chargeback liability** — reversed transactions that TnG absorbs when funds can't be recovered
2. **User churn** — a scammed user tells 10 people, deletes the app, and does not return
3. **Merchant network poisoning** — mule accounts sitting inside TnG's payee network erode trust for legitimate merchants around them

SafeSend addresses all three by acting at Stage 1–2, while the money is still inside TnG's ecosystem.

---

## 3. Goals & Judging Alignment

| Judging Criterion | How SafeSend Addresses It |
|---|---|
| **AI & Intelligent Systems** | Amazon Bedrock for explainability and natural language queries; AWS SageMaker Isolation Forest for ML scoring; two distinct AI layers with clearly separated roles |
| **Multi-Cloud (AWS + Alibaba)** | AWS owns the real-time hot path (Lambda, Kinesis, Bedrock, SageMaker, PostgreSQL); Alibaba OSS owns the compliance audit trail and cold storage — a genuine architectural reason for both, not checkbox ticking |
| **Technical Implementation** | Event-driven pipeline; sub-500ms scoring; feedback loop with nightly SageMaker retraining; graph traversal for network containment |
| **Impact & Feasibility** | RM 1.2B annual problem; 24M TnG users; fully demo-able in 24 hours with mock data |
| **Presentation** | Mule eviction demo moment is visceral and specific; natural language query is visually impressive; pitch narrative is a TnG business story, not a regulatory story |

---

## 4. Feature Scope (7 Features)

| # | Feature | Origin | Priority |
|---|---|---|---|
| F1 | Transfer Interception — Multi-Signal 3-Way Branch | Deriv payout approval — direct lift | Must have |
| F2 | Mule Account Early Eviction — Stage 1→2→3 | Deriv "no trade" pattern — reframed for TnG | Must have ⭐ |
| F3 | Bulk Network Containment — One-Click Lock | Deriv bulk incident response — direct lift | Must have |
| F4 | AI Explainability Layer — Amazon Bedrock | Both hackathons — already designed | Must have |
| F5 | Agent Dashboard + Alert Queue + Network Graph | Deriv fraud investigator interface — direct lift | Must have |
| F6 | Natural Language Fraud Query — Bedrock | Deriv "blow our minds" — Bedrock prompt + Lambda | Should have |
| F7 | Feedback Loop + SageMaker Retraining | Deriv "learning from outcomes" — direct lift | Should have |

---

## 5. Feature Detail

### F1 — Transfer Interception (Multi-Signal, 3-Way Branch)

Every transfer a TnG user initiates is evaluated before funds move. A rule engine and SageMaker ML score run in parallel inside Lambda, combining into a composite risk score (0–100) that determines one of three outcomes in under 500ms.

**8 Rule Signals (Lambda):**

| Signal | Points |
|---|---|
| Payee account age < 14 days | +25 |
| First-ever transfer to this payee | +20 |
| Transfer amount > 3× user's 30-day average | +20 |
| Payee already on mule watchlist | +30 |
| Late-night transaction (10pm–6am) | +10 |
| Device fingerprint mismatch | +15 |
| Sender account age < 7 days | +20 |
| Multiple failed transfers in last hour | +15 |

**Three-Way Branch:**

- **Score 0–39** → Auto-approved silently. Logged to S3 and PostgreSQL.
- **Score 40–69** → Soft warning overlay on confirmation screen. User can dismiss and proceed. Logged.
- **Score 70–100** → Hard SafeSend interception screen. Bedrock generates bilingual explanation specific to this transaction. User must actively choose: Cancel / Proceed Anyway / Report Scam. All choices logged to Kinesis → S3.

**SageMaker ML features fed into scoring:**
`amount_ratio`, `payee_account_age_days`, `is_new_payee`, `hour_of_day`, `device_match`, `prior_txns_to_payee`, `sender_account_age_days`, `inbound_velocity_6h`

---

### F2 — Mule Account Early Eviction (Stage 1 → 2 → 3) ⭐

The wow factor. Instead of watching only the sender (the scam victim), SafeSend watches the receiver — the mule account. Mule accounts have a distinct behavioural signature: receiving money from multiple strangers in a short window, doing nothing with it, then attempting to withdraw or pass it on immediately. SafeSend catches this at Stage 1 and evicts before any withdrawal is requested.

**Why this is different from existing systems:**
Traditional systems flag mule accounts after a withdrawal attempt — Stage 4 or 5. SafeSend flags at Stage 1 (first suspicious inbound pattern), escalates at Stage 2, and auto-evicts at Stage 3 — typically before any withdrawal is even requested. The money is still inside TnG's ecosystem when containment happens.

**Why this protects TnG's business:**
Every mule account inside TnG's payee network that processes scam volume creates chargeback liability and erodes merchant trust. Evicting the mule at Stage 1–2 collapses the scam operation's receiving infrastructure — one eviction protects every potential victim who would have sent money to that account.

**5 Mule Signals (separate Lambda, fires on every inbound transfer):**

| Signal | Points |
|---|---|
| Received from 3+ unique senders in 6 hours | +30 |
| Average time between inbound transfers < 20 minutes | +25 |
| Inbound-to-outbound ratio > 80% (pass-through pattern) | +25 |
| Account age < 30 days | +15 |
| No outbound spend to merchants — only peer transfers | +20 |

**Three-Stage Escalation:**

- **Stage 1 (score 40–59)** → Silent watchlist. Account flagged in PostgreSQL. All future transactions involving this account automatically inherit +30 points on their F1 risk score. No visible action to account holder yet.
- **Stage 2 (score 60–79)** → Agent alert raised on dashboard. Withdrawal capability soft-blocked pending review. Bedrock generates a mule suspicion summary for the agent. Account holder not notified yet.
- **Stage 3 (score 80–100)** → Auto-eviction. Withdrawal blocked. Account suspended. All pending inbound transfers held in escrow inside TnG's system. Bedrock generates incident report. F3 Bulk Containment triggered automatically to scan for linked accounts.

---

### F3 — Bulk Network Containment (One-Click Lock)

When a mule account reaches Stage 3 eviction, SafeSend immediately traverses the transaction graph to find every linked account — by shared device fingerprint, shared IP, overlapping transaction timing, or same card BIN — and presents the agent with a one-click bulk action to contain all of them simultaneously.

**Graph traversal (Lambda):**
Stage 3 eviction triggers a Lambda graph traversal. It queries PostgreSQL for all accounts sharing any attribute with the confirmed mule. Returns a ranked list: 1st-degree (direct transaction link), 2nd-degree (shared device/IP, no direct transaction). Each linked account shows its own risk score and connection type.

**Containment panel on dashboard:**
Confirmed mule at centre of network graph. 1st-degree accounts listed with risk score and connection reason. 2nd-degree accounts listed as monitor candidates. Total RM exposure across all accounts calculated in real time.

**One-click execution:**
Agent reviews list, deselects any obvious false positives, clicks "Execute Containment." Lambda fires in parallel — all selected accounts suspended, all pending withdrawals held in escrow, SNS sends automated notifications to account holders, Bedrock generates a pre-written compliance incident summary. Entire action completes in under 10 seconds.

**TnG business value of this feature:**
Saves fraud analysts 2–4 hours per incident (previously: manual file preparation, one-by-one account locking, manual notification drafting). Reduces human error in bulk actions. Compliance report is auto-generated and ready to file.

---

### F4 — AI Explainability Layer (Amazon Bedrock)

Every flag in the system — sender-side interception or mule-side eviction — gets a plain-language Bedrock explanation. No black box outputs. Every score has a specific, human-readable reason attached, in English and Bahasa Malaysia.

**Three Bedrock Call Types:**

**Type 1 — User-facing warning (F1 hard interception)**
- Audience: TnG end user (potentially elderly, non-technical)
- Output: 2 sentences max, simple language, bilingual, names the specific scam type
- Example: *"Akaun ini baru dibuka 6 hari lepas dan anda tidak pernah hantar wang ke sini. Ini sepadan dengan corak penipuan Macau — sila berhati-hati sebelum meneruskan."*

**Type 2 — Agent alert explanation (F2 mule flag)**
- Audience: Fraud analyst
- Output: Structured paragraph — which mule signals fired, specific values, pattern name, confidence level, recommended action
- More technical; references actual signal values and stage rationale

**Type 3 — Incident report (F3 bulk containment)**
- Audience: TnG compliance team
- Output: Structured incident summary — accounts involved, RM exposure, pattern description, actions taken, full timestamp chain
- Pre-formatted so compliance officer reviews and signs off rather than writing from scratch
- Saves 2–3 hours of manual report writing per incident

**Bedrock prompt structure (all 3 types return structured JSON parsed directly into UI):**
```
{
  "explanation_en": "...",
  "explanation_bm": "...",
  "scam_type": "macau_scam | investment_scam | love_scam | mule_account | account_takeover | false_positive",
  "confidence": "high | medium | low",
  "recommended_action": "block | warn | monitor | clear",
  "incident_summary": "..." // Type 3 only
}
```

---

### F5 — Agent Dashboard + Alert Queue + Network Graph

The internal React web app where TnG fraud analysts work. Unifies sender-side interception alerts (F1) and mule-side eviction alerts (F2) into a single prioritised queue. Everything needed to investigate and act is on one screen.

**Four Dashboard Panels:**

**Stats Bar (top):**
Open alerts, total RM at risk today, transactions auto-approved, transactions blocked, average agent response time. Real-time updates via PostgreSQL polling.

**Alert Queue (left panel):**
All active alerts sorted by risk score descending. Each row: account ID, alert type (Sender Interception / Mule Eviction), risk score, RM at risk, time since flagged, current stage. Colour-coded: red (Stage 3 / score >70), amber (Stage 2 / score 40–69), yellow (Stage 1 monitoring). Clicking a row opens the detail panel.

**Detail Panel (centre):**
Full transaction history for the flagged account, risk signals that fired with individual point contributions, SageMaker score, Bedrock explanation for this specific alert, and three action buttons: Block / Warn / Clear.

**Network Graph (right panel):**
D3.js force-directed graph. Flagged account at centre, linked accounts as nodes coloured by risk level. Clicking any node loads that account's detail in the centre panel. When F3 bulk containment triggers, the containment action panel overlays here with the account list and one-click Execute button.

**Action outcomes:**
- **Block** → Lambda suspends account + holds withdrawals + SNS notifies user + logs to S3 (label: fraud=1)
- **Warn** → Lambda sends in-app warning to user + adds to watchlist + logs to S3
- **Clear** → Removes from queue + logs to S3 (label: false_positive=0) for retraining

---

### F6 — Natural Language Fraud Query (Bedrock)

Gives fraud analysts an investigative tool beyond the alert queue. Instead of waiting for the system to surface alerts, analysts ask questions in plain English or BM and get instant results across the live transaction database. Turns passive alert-watching into active fraud hunting.

**How it works:**
A query input box at the top of the agent dashboard. Query is sent to Lambda, which uses Bedrock to translate natural language into a PostgreSQL SQL WHERE clause. Results return as a filtered account list in the alert queue panel for immediate action.

**Example queries:**

| Query | What it pulls |
|---|---|
| "Show me accounts that topped up from 3+ senders in 24 hours and haven't spent anything" | Mule inbound pattern, sorted by inbound count |
| "Find accounts registered in the last 7 days with transfers over RM 5,000" | New account high-value screen |
| "Which payees received money from users flagged this week" | Cross-contamination check |
| "Show all accounts linked to device ID X" | Device fingerprint cluster |
| "Accounts with deposit but no merchant spend in 48 hours" | No-spend pattern — pre-withdrawal screen |

**Why this is worth building in 24 hours:**
One new Lambda function + one Bedrock prompt template + one text input on the dashboard. All data is already in PostgreSQL from F1/F2 logging. Build time: 3–4 hours for Person B. Demo impact: disproportionately large — judges immediately understand and remember it.

---

### F7 — Feedback Loop + SageMaker Retraining

Every agent decision becomes a labelled training example. A nightly SageMaker job picks up all new labels, retrains the Isolation Forest model, and redeploys the endpoint. The model improves from real TnG fraud decisions, not just the initial synthetic dataset.

**Label collection (real-time):**
Every agent action in F5 triggers Lambda to write a labelled record to S3 — the full feature vector for that transaction (all rule signals + account metadata) plus the agent's label (fraud=1 or false_positive=0).

**Nightly retraining (automated):**
EventBridge cron triggers a SageMaker training job at 2am. Job reads all labelled records from S3, merges with original synthetic dataset, retrains Isolation Forest, pushes new model artifact to SageMaker endpoint with zero-downtime swap. Lambda calls updated endpoint from next morning.

**Alibaba OSS role:**
All labelled data is mirrored to Alibaba OSS as the compliance audit trail — a genuine multi-cloud data sovereignty story. Malaysian transaction data stored in-region on Alibaba OSS. AWS SageMaker trains on it but the source of truth sits locally.

**Model health panel on dashboard:**
Current model version, last training date, number of new labels since last retrain, accuracy delta vs previous version. Gives agents visibility into how their decisions improve the system over time.

---

## 6. User Flows

### Flow A — Sender-Side Transfer Interception (End User)

```
User initiates transfer in TnG web app
→ Enters payee + amount → taps Confirm
→ API Gateway → Lambda fires
→ In parallel:
    [1] Rule engine evaluates 8 signals → partial score
    [2] SageMaker endpoint called → ML score
→ Scores combined → composite risk score (0–100)

Score 0–39  → Silent auto-approve
             → Transaction proceeds
             → Logged to S3 + PostgreSQL

Score 40–69 → Soft warning overlay appears
             → User dismisses → transaction proceeds (logged)
             → User cancels → transaction stopped (logged)

Score 70–100 → Hard SafeSend interception screen
              → Bedrock Type 1 call → bilingual explanation rendered
              → User chooses:
                  Cancel         → transaction stopped, logged
                  Proceed Anyway → transaction proceeds with flag, logged
                  Report Scam    → transaction stopped, scam report filed, logged
→ All paths: Kinesis event → S3 label store
```

---

### Flow B — Mule Account Early Eviction (Automated, Background)

```
Any account receives an inbound transfer
→ Mule detection Lambda fires (parallel to F1, does not block transfer)
→ Queries PostgreSQL for account's inbound pattern (last 6 hours)
→ Evaluates 5 mule signals → mule risk score (0–100)

Score 0–39  → No action. Transfer proceeds normally.

Score 40–59 → STAGE 1: Silent watchlist
             → Account flagged in PostgreSQL
             → All future F1 checks on this account inherit +30 points
             → No notification to account holder

Score 60–79 → STAGE 2: Agent alert raised
             → Withdrawal capability soft-blocked (pending review)
             → Bedrock Type 2 call → mule suspicion summary for agent
             → Alert appears in dashboard queue (amber)
             → Account holder not notified

Score 80–100 → STAGE 3: Auto-eviction
              → Withdrawal blocked
              → Account suspended
              → Pending inbound transfers held in escrow
              → Bedrock Type 3 call → incident report generated
              → F3 Bulk Containment triggered
              → Alert appears in dashboard queue (red)
              → SNS notification to account holder
```

---

### Flow C — Bulk Network Containment (Agent + Automated)

```
F2 Stage 3 auto-eviction triggers
→ Lambda graph traversal fires
→ Queries PostgreSQL for accounts sharing:
    - Device fingerprint
    - IP address range
    - Transaction timing cluster (±10 min)
    - Card BIN
→ Returns ranked list:
    1st-degree: direct transaction link + individual risk score
    2nd-degree: shared attribute, no direct transaction + risk score
→ Total RM exposure calculated across all linked accounts

Agent sees containment panel on dashboard:
→ Confirmed mule at centre of network graph
→ Linked accounts listed with scores + connection type
→ Agent reviews, deselects any false positives

Agent clicks "Execute Containment":
→ Lambda fires in parallel for all selected accounts:
    - Account suspended
    - Pending withdrawals held in escrow
    - SNS notification sent to each account holder
    - Bedrock Type 3 incident summary generated
→ Compliance report available for download
→ All actions logged to S3 + mirrored to Alibaba OSS
→ Entire execution: < 10 seconds
```

---

### Flow D — Natural Language Fraud Query (Agent)

```
Agent types query in dashboard search bar
→ Lambda receives query string
→ Bedrock translates natural language → PostgreSQL SQL WHERE clause
→ Lambda executes filter against live transaction data
→ Results returned as filtered account list in alert queue panel
→ Agent can act on any result directly (Block / Warn / Clear)
→ Query + results logged to S3 for audit trail
```

---

### Flow E — Feedback Loop + SageMaker Retraining (Automated, Nightly)

```
Agent takes action in F5 (Block / Warn / Clear)
→ Lambda writes labelled record to S3:
    {feature_vector, agent_label, timestamp, agent_id}
→ Record mirrored to Alibaba OSS (compliance copy)

Nightly at 2am — EventBridge triggers SageMaker training job:
→ Reads all labelled records from S3
→ Merges with original synthetic dataset
→ Retrains Isolation Forest model
→ Evaluates accuracy delta vs previous model
→ If accuracy improves → deploys new endpoint (zero downtime)
→ If accuracy regresses → keeps current endpoint, flags for review
→ Dashboard model health panel updates:
    - New model version
    - Training date
    - Labels contributed since last retrain
    - Accuracy delta
```

---

## 7. Tech Stack

### AWS Services (Real-Time Hot Path)

| Service | Role |
|---|---|
| **Amazon API Gateway** | Exposes Lambda functions as REST endpoints to the React frontend |
| **AWS Lambda** | Rule engine (F1); mule detection (F2); graph traversal (F3); Bedrock orchestration (F4); NL query translation (F6); label writer (F7) |
| **Amazon Kinesis Data polling** | Ingests all payment events and alert events in real time |
| **Amazon Bedrock (Claude)** | Type 1 user warnings, Type 2 agent explanations, Type 3 incident reports, NL query translation |
| **AWS SageMaker** | Isolation Forest training + endpoint serving for ML fraud score |
| **Amazon PostgreSQL** | Real-time alert state, account mule watchlist, transaction pattern store |
| **Amazon S3** | Label store for retraining; audit trail for all decisions |
| **Amazon SNS** | User notifications (account warnings, suspension notices) |
| **Amazon EventBridge** | Nightly cron trigger for SageMaker retraining job |

---

### Alibaba Cloud Services (Compliance + Cold Storage)

| Service | Role |
|---|---|
| **Alibaba OSS** | Mirror of S3 label store — compliance audit trail, Malaysian data sovereignty narrative |

---

### Frontend Stack

| Component | Technology |
|---|---|
| **Agent Dashboard** | React + Vite + Tailwind CSS |
| **Network Graph** | D3.js force-directed graph |
| **Charts / Stats** | Recharts (stats bar, model health panel) |
| **TnG Transfer Flow Demo** | React — simulates transfer flow + SafeSend interception screen |
| **API calls** | Axios → API Gateway → Lambda |

---

### Architecture Overview

```
[TnG Transfer Flow (React Demo)]
         ↓ confirm transfer
[API Gateway]
         ↓
[Lambda — F1 Rule Engine]
    ├──→ [SageMaker Endpoint] → ML fraud score
    ├──→ [Bedrock] → bilingual explanation (if score > 70)
    ├──→ [PostgreSQL] → alert state written
    └──→ [Kinesis] → event logged

[Lambda — F2 Mule Detection] (fires on every inbound transfer)
    ├──→ [PostgreSQL] → inbound pattern queried + watchlist updated
    ├──→ [Bedrock] → mule suspicion / incident report
    └──→ [Lambda — F3 Graph Traversal] (if Stage 3)
              └──→ [PostgreSQL] → linked accounts pulled
                    └──→ [SNS] → bulk notifications

[Agent Dashboard (React)]
    ├── Alert queue ← PostgreSQL polling
    ├── Network graph ← Lambda F3 results
    ├── NL Query box → [Lambda F6] → [Bedrock] → PostgreSQL filter
    └── Actions → [Lambda] → Block/Warn/Clear
                    ├──→ [SNS] → user notification
                    ├──→ [S3] → label written
                    └──→ [Alibaba OSS] → compliance mirror

[EventBridge — nightly 2am]
    → [SageMaker Training Job]
         → reads S3 labels
         → retrains Isolation Forest
         → redeploys endpoint
         → dashboard model health panel updates
```

---

## 8. Team Responsibilities & 24-Hour Timeline

### Team Roles

| Person | Role | Primary Ownership |
|---|---|---|
| **Person A** | Full Stack Lead | React TnG transfer demo + SafeSend interception screen + API Gateway wiring |
| **Person B** | Backend / Cloud | All Lambda functions + Kinesis + PostgreSQL + Bedrock integration + NL query (F6) |
| **Person C** | ML / Data | Mock dataset generation + SageMaker training + endpoint deployment + S3 setup + EventBridge + Alibaba OSS |
| **Person D** | Frontend / Demo | Agent dashboard (React + Tailwind) + D3.js network graph + pitch deck + demo script + rehearsal |

---

### 24-Hour Build Timeline

#### Hours 0–2 | Setup & Alignment
- **All:** Git repo initialised, environment variables agreed, mock data schema confirmed, API contracts defined between frontend and Lambda
- **A:** Vite + React project scaffolded, routing set up (transfer flow / dashboard), Tailwind configured
- **B:** AWS Lambda skeleton functions deployed, API Gateway endpoints created, PostgreSQL tables created (alerts, watchlist, transactions)
- **C:** S3 buckets created, Alibaba OSS bucket created, mock dataset CSV generation started (500 rows)
- **D:** Wireframes for 4 screens (transfer flow, SafeSend warning, agent dashboard, containment panel), pitch deck outline started

#### Hours 2–6 | Core ML & Backend
- **C:** Mock CSV complete (475 normal + 25 mule/fraud rows), SageMaker training job running, Isolation Forest model training, SageMaker endpoint deployed and returning scores
- **B:** F1 Lambda rule engine complete (8 signals, composite scoring logic), F2 mule detection Lambda complete (5 signals, 3-stage escalation logic), both tested locally with mock payloads
- **A:** TnG transfer flow screens functional in React (enter amount → payee → confirm button), connects to F1 Lambda via API Gateway
- **D:** Agent dashboard layout complete — stats bar, alert queue table, detail panel placeholder, network graph placeholder

#### Hours 6–12 | AI Integration
- **B:** Bedrock integration complete — all 3 prompt types working, returning structured JSON, parsed correctly; end-to-end F1 pipeline tested (rule engine → SageMaker → Bedrock → PostgreSQL → API response)
- **A:** SafeSend interception screen built — bilingual warning text renders from Bedrock response, Cancel / Proceed / Report buttons functional, all choices logged to Kinesis
- **C:** S3 label writer Lambda working, Alibaba OSS mirror working, EventBridge cron configured for SageMaker retrain (demo-triggerable manually)
- **D:** Alert queue wired to PostgreSQL polling (live updates), detail panel renders Bedrock explanation, Block / Warn / Clear buttons call Lambda and update stats bar

#### Hours 12–18 | F2 Mule + F3 Containment + F6 NL Query
- **B:** F3 graph traversal Lambda complete, linked accounts returned correctly from PostgreSQL, one-click bulk containment action wired (SNS notifications + parallel account suspension + Bedrock incident report)
- **C + D:** D3.js network graph built — nodes coloured by risk level, clickable, loads account detail on click; containment panel overlay built showing linked account list + Execute button + RM exposure total
- **B:** F6 NL query Lambda complete — Bedrock translates query to PostgreSQL filter, results returned to dashboard; 5 example queries tested and working
- **A:** Full end-to-end flow tested: transfer → interception → agent alert → mule escalation → Stage 3 → containment panel → one-click execute
- **All:** Integration testing, broken API calls fixed

#### Hours 18–22 | Polish & Demo Prep
- **A + D:** UI polish — bilingual toggle (BM/EN) on warning screen, loading states on all async calls, mobile-responsive layout on transfer demo
- **B:** Error handling in all Lambda functions, fallback mock scores if SageMaker endpoint is slow, retry logic on Bedrock calls
- **C:** SageMaker training screenshots prepared for pitch deck, model health panel wired to dashboard, manual retrain trigger tested for demo
- **D:** Demo script written and rehearsed (full 5-minute run), pitch deck finalised, architecture diagram exported

#### Hours 22–24 | Rehearsal & Submission
- **All:** Two full dry runs of complete demo — time each act, fix any broken flows
- **D:** Submission package prepared on time
- **Contingency:** If SageMaker endpoint is unreliable during demo, deterministic mock score function in Lambda (score = weighted signal sum, no ML call needed) — demo must not break under any circumstance

---

## 9. Demo Script (5 Minutes)

**Opening (30 sec):**
*"Fraud detection in Malaysia is not broken. It is just too slow. By the time a mule account is flagged today, it has already processed RM 40,000 across 12 victims. SafeSend acts at Stage 1 — before the first ringgit of scam volume clears."*

**Act 1 — Transfer Interception (1 min):**
Show the TnG transfer demo. User enters RM 8,000 to a payee registered 6 days ago. Hits Confirm. SafeSend intercepts — hard warning screen appears with Bedrock-generated bilingual explanation: *"Akaun ini baru dibuka 6 hari lepas..."* User cancels. Explain the 3-way branch logic — most transfers are approved silently in milliseconds, only the suspicious ones are caught.

**Act 2 — Mule Early Eviction (1.5 min):**
Flip to the agent dashboard. Show a mule account that has received transfers from 4 different senders in 3 hours — each sender just topped up and sent immediately. Stage 1 silent flag at transfer 1. Stage 2 agent alert at transfer 3. Stage 3 auto-eviction at transfer 4 — withdrawal blocked, funds in escrow, agent notified. *"The money is still inside TnG's ecosystem. The mule never got to withdraw a single ringgit."* Show the Bedrock-generated incident report auto-populating.

**Act 3 — Bulk Network Containment (1 min):**
Stage 3 eviction triggers graph traversal. Network graph appears — confirmed mule at centre, 6 linked accounts fan out as nodes. Total RM exposure shown: RM 142,000 across the network. Agent reviews the list, clicks "Execute Containment." All 6 accounts suspended in under 10 seconds. SNS notifications sent. Compliance report generated. *"What used to take a fraud analyst 4 hours now takes 10 seconds."*

**Act 4 — Natural Language Query (30 sec):**
Agent types: *"Show me accounts that topped up from 3 or more senders in the last 24 hours and haven't spent anything."* Results populate in the alert queue instantly. *"This is proactive fraud hunting — not waiting for alerts, but going looking."*

**Close (30 sec):**
*"SafeSend doesn't add another layer to an already mature fraud detection system. It closes the gap between detection and damage — acting at Stage 1, protecting TnG's ecosystem, its merchants, and its 24 million users. The model gets smarter every time an agent makes a decision. Tomorrow it is faster. Next week it is more accurate."*

---

## 10. Bedrock Prompts (Reference)

### Type 1 — User Warning
```python
prompt = f"""
You are a fraud protection system for Touch 'n Go, a Malaysian e-wallet.
A transfer has been flagged before the user confirms it.

Transaction:
- Amount: RM {amount}
- Payee account age: {payee_age_days} days
- Prior transfers to this payee: {prior_txns}
- ML fraud score: {score}/100
- Risk signals: {signals}

Write a warning for the user (may be elderly, non-technical).
- Maximum 2 sentences
- Simple, clear language
- Name the specific scam type if confident
- Provide English and Bahasa Malaysia versions

Return ONLY valid JSON, no markdown, no preamble:
{{
  "explanation_en": "...",
  "explanation_bm": "...",
  "scam_type": "macau_scam | investment_scam | love_scam | mule_account | account_takeover | false_positive",
  "confidence": "high | medium | low"
}}
"""
```

### Type 2 — Agent Mule Alert
```python
prompt = f"""
You are a fraud analyst assistant for Touch 'n Go.
A mule account has been flagged at Stage {stage}.

Account profile:
- Account age: {account_age_days} days
- Unique inbound senders (6h): {unique_senders}
- Average time between inbound transfers: {avg_gap_minutes} minutes
- Inbound-to-outbound ratio: {ratio}%
- Merchant spend: {merchant_spend}
- Mule risk score: {score}/100

Write a structured alert explanation for a fraud analyst.
Include: which signals fired, pattern name, confidence, recommended action.

Return ONLY valid JSON:
{{
  "explanation_en": "...",
  "pattern_name": "...",
  "signals_fired": ["..."],
  "confidence": "high | medium | low",
  "recommended_action": "block | warn | monitor"
}}
"""
```

### Type 3 — Incident Report (Bulk Containment)
```python
prompt = f"""
You are generating a compliance incident report for Touch 'n Go's fraud team.

Incident summary:
- Confirmed mule account: {mule_account_id}
- Linked accounts contained: {linked_accounts}
- Total RM exposure: RM {total_exposure}
- Actions taken: {actions}
- Timestamp: {timestamp}

Generate a structured incident report suitable for compliance filing.
Professional tone. Include: pattern description, accounts involved, 
actions taken, RM exposure, recommended follow-up.

Return ONLY valid JSON:
{{
  "incident_title": "...",
  "pattern_description": "...",
  "accounts_involved": [...],
  "total_rm_exposure": ...,
  "actions_taken": [...],
  "recommended_followup": "...",
  "report_timestamp": "..."
}}
"""
```

---

## 11. Mock Data Schema

```
account_id, txn_id, timestamp, amount, user_avg_30d, amount_ratio,
payee_account_age_days, is_new_payee, hour_of_day, device_match,
prior_txns_to_payee, sender_account_age_days, unique_inbound_senders_6h,
avg_inbound_gap_minutes, inbound_outbound_ratio, merchant_spend_7d, label
```

**Fraud label = 1 (sender-side):**
`amount_ratio > 3.0` AND `is_new_payee = true` AND `payee_account_age_days < 14`

**Mule label = 2 (receiver-side):**
`unique_inbound_senders_6h >= 3` AND `avg_inbound_gap_minutes < 20` AND `inbound_outbound_ratio > 80`

**Normal label = 0:**
`amount_ratio` 0.3–1.8, known payee, business hours, device match, low inbound velocity

Generate: 450 normal (label=0) + 30 sender-fraud (label=1) + 20 mule (label=2) = 500 rows total.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| SageMaker endpoint slow / cold during demo | Pre-warm endpoint 30 min before demo; have deterministic mock score (weighted signal sum) in Lambda as instant fallback |
| Bedrock latency > 3s during pitch | Pre-generate 3 canned Bedrock responses for the 3 demo scenarios; use real API during judging Q&A |
| SageMaker training takes longer than expected | Run training in Hours 2–6; if it fails, use local scikit-learn Isolation Forest serialised as joblib, invoke from Lambda directly |
| PostgreSQL polling lag on dashboard live updates | Pre-seed dashboard with mock alert data for demo; real polling as backup |
| D3.js network graph too complex to build in time | Fallback: static SVG of network with 3 nodes — still tells the containment story visually |
| Team runs out of time | Cut F6 NL Query last — core demo (F1 + F2 + F3 + F5) is sufficient to win. F6 is polish. |

---

## 13. Success Metrics (for Pitch)

- **Fraud detection recall:** ≥ 90% on test set (27/30 fraud rows correctly flagged)
- **False positive rate:** < 10% (normal transactions incorrectly flagged)
- **Interception latency:** < 500ms from confirm tap to warning screen appearing
- **Mule eviction latency:** < 2 seconds from Stage 3 trigger to account suspension
- **Bulk containment speed:** < 10 seconds to contain all linked accounts
- **NL query response:** < 3 seconds from query submission to results in queue
- **Feedback loop:** At least 1 simulated retraining cycle demonstrable live during pitch

---

*SafeSend PRD v3 — Touch 'n Go FinHack Hackathon, April 2026. Internal use only.*
