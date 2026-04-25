# SafeSend — Product Requirements Document
### Touch 'n Go FinHack Hackathon | Security & Fraud Track

**Version:** 2.0  
**Date:** April 2026  
**Team Size:** 4  
**Hackathon Duration:** 24 Hours

---

## 1. Executive Summary

**SafeSend** is a real-time, multi-layer scam prevention system built on top of the Touch 'n Go e-wallet platform. It intercepts scam attempts at three distinct points — in the messaging layer before a user even opens TnG, at the moment of transfer confirmation inside the app, and at the network level before funds leave — combining AWS and Alibaba Cloud services to deliver explainable, bilingual AI-powered fraud protection for Malaysian users.

**One-line pitch:**  
*"Scams in Malaysia don't start in your TnG app. They start in WhatsApp. SafeSend fights fraud at every layer — in your messages, at the moment of transfer, and at the network level — and gets smarter every day."*

---

## 2. Problem Statement

Malaysia lost over **RM 1.2 billion** to scams in 2023 (Bank Negara Malaysia). The most common vectors — Macau scams, fake LHDN notices, investment fraud — all share the same playbook: a scammer contacts the victim via WhatsApp or Telegram, manufactures urgency, and instructs them to transfer money through their e-wallet. By the time fraud is flagged, the money is already gone.

Existing fraud systems are **reactive** — they detect fraud after the transaction completes. SafeSend is **proactive** — it intervenes before the user confirms, and before funds leave the platform.

---

## 3. Goals & Judging Alignment

| Judging Criterion | How SafeSend Addresses It |
|---|---|
| **AI & Intelligent Systems** | Bedrock LLM for bilingual scam explanation; Alibaba PAI for anomaly scoring; two distinct AI layers with clear roles |
| **Multi-Cloud (AWS + Alibaba)** | AWS handles real-time hot path (Kinesis, Lambda, Bedrock); Alibaba handles training, model serving, and storage (PAI, EAS, OSS) |
| **Technical Implementation** | Event-driven, sub-second response pipeline; explainable outputs; production-ready feedback loop |
| **Impact & Feasibility** | Addresses a RM 1.2B annual problem; 24M TnG users; demo-ready in 24 hours |
| **Presentation** | Emotional demo narrative (uncle/aunt persona); bilingual UI; concrete scam type (Macau scam) |

---

## 4. Team Roles & Feature Ownership

### Person A — Full Stack Lead

**Primary Ownership:** User-facing React application, plugin demo page, API integration, bilingual UI

| Feature | Deliverable | Detail |
|---|---|---|
| TnG Transfer Flow (Layer 2 UI) | 3-screen React flow | Screen 1: Enter payee + amount. Screen 2: Review summary. Screen 3: Confirm button → triggers API call to `/api/screen-transaction` |
| SafeSend Interception Screen | Warning screen component | Renders when `action = "hard_intercept"`; displays `explanation_bm` / `explanation_en`; three buttons: Cancel, Proceed Anyway, Report Scam |
| Soft Warning Overlay | Dismissible modal | Renders when `action = "soft_warn"`; yellow banner, user can dismiss and continue |
| Plugin Demo Page (Layer 1 UI) | Standalone React page | Text area to paste message; calls `/api/analyse-message`; displays warning banner with `matched_patterns` and bilingual warning |
| Bilingual Toggle | BM / EN switch | Persists in localStorage; toggles all UI text including dynamic Bedrock explanations |
| API Gateway Wiring | Axios service layer | `src/services/api.ts` — typed wrappers for all endpoints; handles loading states and error boundaries |
| Mobile Responsiveness | Responsive layouts | Transfer flow and warning screen must work on 375px viewport |

**Tech Owned:** React (Vite), Axios, React Router, Tailwind CSS (for interception screen)

---

### Person B — Backend / Cloud Lead

**Primary Ownership:** All AWS Lambda functions, API Gateway configuration, Kinesis streams, Bedrock integration, AWS RDS (PostgreSQL) schema, SNS

| Feature | Deliverable | Detail |
|---|---|---|
| Lambda: `screen-transaction` | Rule engine + orchestrator | Evaluates 7 risk signals → calls EAS for ML score → if score > 30, calls Bedrock → writes to AWS RDS (PostgreSQL) → puts event on Kinesis |
| Lambda: `analyse-message` | Layer 1 NLP rule engine | Regex + keyword matching against scam phrase dictionary; returns risk classification and matched patterns |
| Lambda: `agent-action` | Action handler | Receives Block / Warn / Clear from agent dashboard; triggers SNS SMS (Block), in-app flag (Warn), or OSS label write (Clear); updates AWS RDS (PostgreSQL) alert status |
| Lambda: `get-alerts` | AWS RDS (PostgreSQL) query | Paginated query on `SafeSendAlerts` table; sorted by `risk_score` DESC |
| Lambda: `get-stats` | Aggregation function | Scans AWS RDS (PostgreSQL) for open alerts count, sum of `amount` at risk, blocked count, avg `response_time_ms` |
| Lambda: `get-network-graph` | Graph aggregation | Reads shared payee/device data from Alibaba OSS via signed URL or direct API; returns nodes/edges JSON |
| Amazon Kinesis Data Stream | Event log | Stream name: `safesend-events`; 1 shard; retention 24h; every transaction event published here |
| Amazon RDS PostgreSQL | Alert state store | Table: `SafeSendAlerts`; GSI on `status`, `risk_score`; TTL 7 days |
| Amazon API Gateway (HTTP API) | REST endpoints | All endpoints under `/api/*`; CORS enabled; Lambda proxy integration; throttle 100 req/s |
| Amazon Bedrock | LLM integration | Model: `anthropic.claude-3-haiku-20240307-v1:0`; invoked from `screen-transaction` Lambda; structured JSON prompt (see Section 10) |
| AWS SNS | SMS trigger | Topic: `safesend-user-alerts`; triggered on Block action; message template: "SafeSend: Your TnG transfer of RM {amount} has been blocked. Contact support if this was not you." |
| IAM Roles | Least-privilege roles | Lambda execution role with AWS RDS (PostgreSQL) read/write, Kinesis put, Bedrock invoke, SNS publish, SSM read (for secrets) |

**Tech Owned:** AWS Lambda (Python 3.12), API Gateway, AWS RDS (PostgreSQL), Kinesis, Bedrock, SNS, IAM, SSM Parameter Store (for EAS endpoint + API keys)

---

### Person C — ML / Alibaba Cloud Lead

**Primary Ownership:** Mock dataset, PAI model training, EAS deployment, OSS data pipeline, DataWorks scheduling, feedback loop backend

| Feature | Deliverable | Detail |
|---|---|---|
| Mock Dataset Generation | `mock_transactions.csv` (500 rows) | 475 normal + 25 scam rows per schema in Section 11; stored in Alibaba OSS bucket `safesend-data` |
| PAI Isolation Forest Training | Trained model artifact | Features: `amount_ratio`, `payee_account_age_days`, `is_new_payee`, `hour_of_day`, `device_match`, `prior_txns_to_payee`; contamination = 0.05; scikit-learn compatible |
| Alibaba EAS Deployment | REST endpoint serving model | Endpoint: `POST /api/predict`; input: feature vector JSON; output: fraud score 0–100 + anomaly flag |
| Alibaba OSS Setup | Two buckets | `safesend-data` (training CSV, model artifacts); `safesend-labels` (agent feedback, labelled decisions) |
| OSS Feedback Writer | Lambda calls OSS | When agent takes action, Lambda writes a JSONL record to `safesend-labels/YYYY-MM-DD.jsonl` via pre-signed PUT URL |
| DataWorks Nightly Job | Retraining pipeline | Cron `0 2 * * *` (02:00 SGT); reads latest labels from OSS, retrains Isolation Forest, pushes new artifact to OSS, redeploys to EAS |
| Scam Network Graph Data | Graph JSON in OSS | `safesend-data/graph/network.json`; pre-built from mock data; nodes + edges format (see Section 9) |
| EAS Fallback Mock | Deterministic mock score | If EAS unreachable, Lambda returns score based on rule: `if amount_ratio > 3 and is_new_payee → score 85, else score 20` |

**Tech Owned:** Alibaba PAI, EAS, OSS, DataWorks, Python (scikit-learn, pandas, boto3 for cross-cloud calls)

---

### Person D — Frontend / Demo Lead

**Primary Ownership:** Agent dashboard UI, D3.js network graph, Recharts stats visualisation, pitch deck, demo rehearsal

| Feature | Deliverable | Detail |
|---|---|---|
| Agent Dashboard Layout | React + Tailwind shell | Left sidebar nav; top stats bar; main content area split: alert list (left) + detail panel (right) |
| Live Alert Feed | Alert table component | Columns: TXN ID, User, Amount, Risk Score (colour-coded badge), Scam Type, Status, Time; sorted by risk score DESC; auto-refreshes every 10s via polling `/api/alerts` |
| Transaction Detail Panel | Expandable detail view | Shows: payee info, user history, amount vs 30d avg bar chart, triggered signals checklist, Bedrock explanation (bilingual tabs), network graph link |
| Risk Signals Checklist | Visual signal breakdown | Each of 7 signals shown as green tick / red cross; e.g., "New payee ✗ (6 days old)" |
| AI Explanation Display | Bilingual card | Two tabs: BM / EN; renders `explanation_bm` and `explanation_en` from Bedrock response |
| Action Buttons | Block / Warn / Clear | POST to `/api/alerts/{txn_id}/action`; optimistic UI update; shows confirmation toast |
| Stats Bar | 4-metric top bar | Open Alerts, RM at Risk Today, Transactions Blocked, Avg Response Time; data from `/api/stats` |
| D3.js Network Graph | Force-directed graph | Nodes: accounts (circle) + devices (square); edges: transaction links + shared-device links; colour: red = flagged, grey = normal; click node → opens account detail modal |
| Recharts Bar/Line Charts | Amount pattern chart | 30-day transaction history for selected user; highlights current flagged amount as red bar |
| Pitch Deck | 12-slide deck | Problem → Scale → Solution → Architecture → Layer 1 Demo → Layer 2 Demo → Agent Demo → Feedback Loop → Tech Stack → Team → Metrics → Ask |
| Demo Script & Rehearsal | Written script + timing | Uncle persona narrative; exact text for each screen; contingency lines if EAS is slow |

**Tech Owned:** React, Tailwind CSS, D3.js, Recharts, Axios, Figma (wireframes), PowerPoint/Canva (pitch deck)

---

## 5. Confirmed Feature Scope

### Layer 1 — Scam Message Detector (WhatsApp/Telegram Plugin)

A standalone React web demo page that scans pasted message text for known scam language patterns. Triggers a pre-warning before the user opens TnG to transfer money.

**Owner:** Person A (UI) + Person B (Lambda backend)

**What it detects:**
- Urgency phrases: "akaun anda dibekukan," "LHDN," "hadiah," "segera," "dalam masa 24 jam"
- Impersonation cues: bank names (Maybank, CIMB, RHB), government agencies (PDRM, SPRM, BNM, LHDN), police references
- Instruction patterns: "pindahkan wang ke akaun selamat," requests for OTP, "akaun sementara selamat"
- Links to newly registered or suspicious domains (regex: domain age heuristic via pattern matching)
- Monetary urgency: "RM", "ringgit", "wang", combined with action verbs

**Output:** A banner/overlay warning in Bahasa Malaysia and English explaining the risk, listing matched patterns, with a link to a scam education resource (BNMLINK).

---

### Layer 2 — In-App Transfer Interception (SafeSend Warning Screen)

Before a user confirms a payment, the system evaluates the transaction against a rule engine + ML score. If the risk score exceeds a threshold, the standard confirmation screen is replaced with a SafeSend warning screen.

**Owner:** Person A (UI) + Person B (Lambda rule engine + Bedrock) + Person C (EAS ML score)

**Risk signals evaluated (Lambda rule engine — 7 signals, each adds points):**

| Signal | Condition | Weight |
|---|---|---|
| New payee account | `payee_account_age_days < 14` | +20 |
| First-ever transfer | `is_new_payee = true` | +15 |
| Amount spike | `amount_ratio > 3.0` | +20 |
| Late-night transaction | `hour_of_day` between 22–6 | +10 |
| Device mismatch | `device_match = false` | +15 |
| Payee in scam graph | `payee_flagged = true` | +30 |
| Round-number amount | `amount % 1000 == 0` AND `amount > 5000` | +5 |

Rule engine score (0–100) is combined with EAS ML score via weighted average: `final_score = 0.4 * rule_score + 0.6 * ml_score`

**Action thresholds:**
- `final_score < 40` → Proceed normally, log to Kinesis
- `final_score 40–70` → Soft warning overlay (dismissible)
- `final_score > 70` → Hard SafeSend interception screen (Bedrock explanation required)

**User options:** Proceed anyway / Cancel / Report as scam

---

### Layer 3 — ML Fraud Scoring (Alibaba PAI + EAS)

**Owner:** Person C

A trained Isolation Forest anomaly detection model served via Alibaba EAS. Returns a fraud score (0–100) for every transaction, used by Layer 2.

**Model details:**
- Algorithm: Isolation Forest (`sklearn.ensemble.IsolationForest`)
- Contamination: 0.05 (5% of training data expected to be anomalous)
- Features: `amount_ratio`, `payee_account_age_days`, `is_new_payee`, `hour_of_day`, `device_match`, `prior_txns_to_payee`
- Training data: 500 rows (475 normal, 25 scam) stored in Alibaba OSS
- Score normalisation: Isolation Forest anomaly score mapped to 0–100 via `score = (1 - raw_score) * 100`

---

### Feature 4 — Agent Dashboard

**Owner:** Person D (UI) + Person B (Lambda APIs)

An internal React web interface for fraud analysts to review flagged transactions, take action, and feed decisions back into the model.

---

### Feature 5 — Feedback Loop & Model Retraining

**Owner:** Person C (pipeline) + Person B (Lambda OSS writer)

Every agent decision is logged to Alibaba OSS as a labelled training example. DataWorks nightly job retrains and redeploys the model.

---

### Feature 6 — Scam Network Graph

**Owner:** Person D (D3.js visualisation) + Person C (graph data in OSS) + Person B (Lambda aggregation endpoint)

A visual force-directed graph of connections between flagged payee accounts, shared device fingerprints, and transaction patterns.

---

## 6. User Flows

### Flow A — Messaging Layer (End User, Pre-Transfer)
```
User receives WhatsApp message →
User copies message text into plugin demo page →
Plugin calls POST /api/analyse-message →
Lambda scans for scam phrases (regex + keyword dict) →
  is_scam = false → "No suspicious content detected" (green)
  is_scam = true  → Yellow warning banner appears:
    - "Amaran: Mesej ini mengandungi bahasa yang biasa digunakan dalam penipuan."
    - Lists matched_patterns (e.g., ["LHDN", "pindahkan wang", "segera"])
    - Link to BNMLINK scam checker
```

---

### Flow B — Transfer Interception (End User, In-App)
```
User opens TnG web app →
User enters payee (phone/account number) + amount →
User taps "Confirm" →
Frontend POST /api/screen-transaction →
Lambda rule engine evaluates 7 signals (< 100ms) →
Lambda calls EAS /api/predict for ML score (< 200ms) →
Lambda computes final_score = 0.4 * rule_score + 0.6 * ml_score →
  final_score < 40  →
    Response: action = "proceed"
    Frontend shows standard confirmation → transaction proceeds
  
  final_score 40–70 →
    Response: action = "soft_warn"
    Frontend shows dismissible yellow overlay with brief warning
    User can dismiss → transaction proceeds
    User can cancel → transaction aborted
    All choices logged to Kinesis
  
  final_score > 70 →
    Lambda calls Bedrock for bilingual explanation (< 500ms)
    Response: action = "hard_intercept" + full explanation JSON
    Frontend replaces confirmation screen with SafeSend Warning Screen:
      - Displays explanation_bm (primary) / explanation_en (toggle)
      - Shows triggered signals list
      - Shows risk score badge
      - Three buttons: Cancel | Proceed Anyway | Report as Scam
    User choice → POST /api/user-choice → logged to Kinesis → OSS
    Alert written to AWS RDS (PostgreSQL) for agent review
```

---

### Flow C — Agent Review (Internal Analyst)
```
Agent opens dashboard →
Stats bar loads from GET /api/stats →
Alert table loads from GET /api/alerts (sorted by risk_score DESC) →
Agent clicks alert row →
Detail panel loads from GET /api/alerts/{txn_id} →
  Shows: payee info, signal checklist, bilingual Bedrock explanation,
         amount pattern chart, network graph link
Agent takes action:
  Block  → POST /api/alerts/{txn_id}/action { action: "block" }
         → Lambda updates AWS RDS (PostgreSQL) status = "blocked"
         → Lambda triggers SNS SMS to user
         → Lambda writes label=1 record to Alibaba OSS
  Warn   → POST /api/alerts/{txn_id}/action { action: "warn" }
         → Lambda updates AWS RDS (PostgreSQL) status = "warned"
         → Lambda sets in-app warning flag in AWS RDS (PostgreSQL) user record
  Clear  → POST /api/alerts/{txn_id}/action { action: "clear" }
         → Lambda updates AWS RDS (PostgreSQL) status = "cleared"
         → Lambda writes label=0 record to Alibaba OSS (false positive)
→ Stats bar re-fetches every 10 seconds
```

---

### Flow D — Feedback Loop (Automated, Nightly)
```
Alibaba OSS safesend-labels/ accumulates JSONL files from agent decisions →
DataWorks nightly cron (02:00 SGT) triggers PAI retraining job →
PAI reads latest CSV from safesend-data/ + new labels from safesend-labels/ →
PAI retrains Isolation Forest with updated dataset →
New model artifact (.pkl) pushed to safesend-data/models/latest.pkl →
EAS model swap triggered (zero downtime blue/green) →
Lambda EAS_ENDPOINT env var unchanged — same endpoint, new model serving
```

---

## 7. API Contract Definitions

All endpoints are exposed via **Amazon API Gateway (HTTP API)**.  
Base URL: `https://{api-id}.execute-api.ap-southeast-1.amazonaws.com`  
Content-Type: `application/json`  
Authentication: API Key header `x-api-key: {key}` (for hackathon; prod would use Cognito JWT)

**Standard error envelope (all endpoints):**
```json
{
  "error": true,
  "code": "VALIDATION_ERROR | INTERNAL_ERROR | NOT_FOUND | TIMEOUT",
  "message": "Human-readable error string",
  "request_id": "uuid-v4"
}
```

---

### 7.1 POST /api/analyse-message
**Owner:** Person B (Lambda) | **Caller:** Person A (Plugin UI)  
**Purpose:** Layer 1 — scan a pasted message for scam indicators.

**Request:**
```json
{
  "message_text": "Akaun LHDN anda akan dibekukan. Sila pindahkan RM8,000...",
  "language_hint": "BM"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `message_text` | string | Yes | Raw message content, max 2000 chars |
| `language_hint` | `"BM" \| "EN" \| "auto"` | No | Default: `"auto"` |

**Response `200 OK`:**
```json
{
  "request_id": "3f2a1b4c-...",
  "is_scam": true,
  "risk_level": "high",
  "confidence": 0.91,
  "matched_patterns": [
    { "pattern": "LHDN", "category": "government_impersonation" },
    { "pattern": "dibekukan", "category": "urgency" },
    { "pattern": "pindahkan wang", "category": "transfer_instruction" },
    { "pattern": "RM8,000", "category": "monetary_amount" }
  ],
  "warning_en": "This message contains language commonly used in Macau scams. Do not transfer any money until you call the official agency directly.",
  "warning_bm": "Mesej ini mengandungi bahasa yang biasa digunakan dalam penipuan Macau. Jangan pindahkan wang sehingga anda menghubungi agensi rasmi secara terus.",
  "scam_type_hint": "macau_scam",
  "education_url": "https://bnmlink.bnm.gov.my/scam-check",
  "processed_at": "2026-04-25T10:30:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `is_scam` | boolean | True if any high-confidence pattern matched |
| `risk_level` | `"low" \| "medium" \| "high"` | low < 0.4, medium 0.4–0.7, high > 0.7 |
| `confidence` | float 0–1 | Weighted match confidence |
| `matched_patterns` | array | Each pattern matched with its category |
| `warning_en` / `warning_bm` | string | Bilingual warning copy |
| `scam_type_hint` | string | Best-guess scam category |
| `education_url` | string | Link to BNM scam checker |

---

### 7.2 POST /api/screen-transaction
**Owner:** Person B (Lambda) | **Caller:** Person A (TnG Transfer UI)  
**Purpose:** Layer 2 — evaluate a transaction before confirmation.

**Request:**
```json
{
  "user_id": "USR-00123",
  "session_id": "sess-abc-xyz",
  "payee_id": "60123456789",
  "payee_name": "Ahmad bin Razak",
  "amount": 8000.00,
  "currency": "MYR",
  "device_id": "DEV-fingerprint-hash-abc",
  "timestamp": "2026-04-25T02:15:00Z",
  "user_avg_30d": 450.00
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | Yes | Hashed user identifier |
| `session_id` | string | Yes | Current session UUID |
| `payee_id` | string | Yes | Payee phone/account number |
| `payee_name` | string | No | Display name |
| `amount` | float | Yes | Transfer amount in MYR |
| `currency` | string | No | Default: `"MYR"` |
| `device_id` | string | Yes | Hashed device fingerprint |
| `timestamp` | ISO8601 | Yes | Transaction timestamp (used for `hour_of_day`) |
| `user_avg_30d` | float | Yes | User's 30-day average transaction amount |

**Response `200 OK` — action: proceed:**
```json
{
  "request_id": "7d4e2f1a-...",
  "txn_id": "TXN-20260425-00891",
  "action": "proceed",
  "final_score": 22,
  "rule_score": 15,
  "ml_score": 27,
  "triggered_signals": [],
  "processed_ms": 183,
  "timestamp": "2026-04-25T02:15:00Z"
}
```

**Response `200 OK` — action: soft_warn:**
```json
{
  "request_id": "7d4e2f1a-...",
  "txn_id": "TXN-20260425-00892",
  "action": "soft_warn",
  "final_score": 55,
  "rule_score": 50,
  "ml_score": 58,
  "triggered_signals": [
    { "signal": "amount_spike", "label_en": "Amount is 5× your monthly average", "label_bm": "Jumlah adalah 5× purata bulanan anda", "weight": 20 },
    { "signal": "late_night", "label_en": "Transaction at 2:15 AM", "label_bm": "Transaksi pada pukul 2:15 pagi", "weight": 10 }
  ],
  "soft_warning_en": "This transfer is larger than usual and made late at night. Please verify before confirming.",
  "soft_warning_bm": "Pemindahan ini lebih besar dari biasa dan dibuat lewat malam. Sila sahkan sebelum mengesahkan.",
  "processed_ms": 247,
  "timestamp": "2026-04-25T02:15:01Z"
}
```

**Response `200 OK` — action: hard_intercept:**
```json
{
  "request_id": "7d4e2f1a-...",
  "txn_id": "TXN-20260425-00893",
  "action": "hard_intercept",
  "final_score": 87,
  "rule_score": 80,
  "ml_score": 91,
  "triggered_signals": [
    { "signal": "new_account", "label_en": "Payee account is only 6 days old", "label_bm": "Akaun penerima hanya 6 hari", "weight": 20 },
    { "signal": "new_payee", "label_en": "You have never sent money here before", "label_bm": "Anda tidak pernah hantar wang ke sini sebelum ini", "weight": 15 },
    { "signal": "amount_spike", "label_en": "Amount is 17× your monthly average", "label_bm": "Jumlah adalah 17× purata bulanan anda", "weight": 20 },
    { "signal": "late_night", "label_en": "Transaction at 2:15 AM", "label_bm": "Transaksi pada pukul 2:15 pagi", "weight": 10 },
    { "signal": "payee_flagged", "label_en": "Payee linked to 4 other flagged accounts", "label_bm": "Penerima dikaitkan dengan 4 akaun yang ditandakan", "weight": 30 }
  ],
  "bedrock_explanation": {
    "explanation_en": "This account was created just 6 days ago and you have never sent money here before. This transfer matches a known Macau scam pattern where scammers impersonate government agencies to pressure you into moving money quickly.",
    "explanation_bm": "Akaun ini baru dicipta 6 hari lepas dan anda tidak pernah hantar wang ke sini sebelum ini. Pemindahan ini sepadan dengan corak penipuan Macau di mana penipu menyamar sebagai agensi kerajaan untuk menekan anda memindahkan wang dengan cepat.",
    "scam_type": "macau_scam",
    "confidence": "high"
  },
  "payee_info": {
    "payee_id": "60123456789",
    "account_age_days": 6,
    "is_new_payee": true,
    "prior_txns_to_payee": 0,
    "flagged_in_network": true,
    "linked_flagged_accounts": 4
  },
  "processed_ms": 489,
  "timestamp": "2026-04-25T02:15:01Z"
}
```

| Field | Type | Description |
|---|---|---|
| `txn_id` | string | Unique transaction ID, used for subsequent `/user-choice` and agent action calls |
| `action` | enum | `proceed \| soft_warn \| hard_intercept` |
| `final_score` | int 0–100 | Weighted combination of rule + ML scores |
| `rule_score` | int 0–100 | Lambda rule engine score |
| `ml_score` | int 0–100 | Alibaba EAS Isolation Forest score |
| `triggered_signals` | array | Each triggered risk signal with bilingual labels |
| `bedrock_explanation` | object | Only present when `action = "hard_intercept"` |
| `payee_info` | object | Only present when `action != "proceed"` |
| `processed_ms` | int | End-to-end processing time in milliseconds |

---

### 7.3 POST /api/user-choice
**Owner:** Person B (Lambda) | **Caller:** Person A (Warning Screen)  
**Purpose:** Log the user's decision on the warning screen.

**Request:**
```json
{
  "txn_id": "TXN-20260425-00893",
  "user_id": "USR-00123",
  "choice": "cancel",
  "timestamp": "2026-04-25T02:15:45Z"
}
```

| Field | Type | Values | Description |
|---|---|---|---|
| `choice` | enum | `cancel \| proceed \| report` | User's decision |

**Response `200 OK`:**
```json
{
  "request_id": "9c1a3b2d-...",
  "txn_id": "TXN-20260425-00893",
  "choice_recorded": true,
  "message": "Your choice has been recorded. Stay safe.",
  "message_bm": "Pilihan anda telah direkodkan. Jaga diri.",
  "report_reference": null
}
```

If `choice = "report"`, response includes:
```json
{
  "report_reference": "RPT-20260425-00041",
  "message": "Thank you for reporting. Our fraud team will review this within 24 hours.",
  "message_bm": "Terima kasih kerana membuat laporan. Pasukan penipuan kami akan menyemak dalam masa 24 jam."
}
```

---

### 7.4 GET /api/alerts
**Owner:** Person B (Lambda) | **Caller:** Person D (Agent Dashboard)  
**Purpose:** Fetch paginated list of flagged alerts for the agent queue.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | `open` | Filter: `open \| blocked \| warned \| cleared \| all` |
| `limit` | int | 20 | Max 100 |
| `cursor` | string | — | Pagination cursor from previous response |
| `sort_by` | string | `risk_score` | `risk_score \| created_at` |

**Response `200 OK`:**
```json
{
  "request_id": "2b4f8a1c-...",
  "alerts": [
    {
      "txn_id": "TXN-20260425-00893",
      "user_id": "USR-00123",
      "user_display": "User ***123",
      "payee_id": "60123456789",
      "payee_name": "Ahmad bin Razak",
      "amount": 8000.00,
      "currency": "MYR",
      "final_score": 87,
      "scam_type": "macau_scam",
      "status": "open",
      "user_choice": "cancel",
      "triggered_signal_count": 5,
      "created_at": "2026-04-25T02:15:01Z",
      "updated_at": "2026-04-25T02:15:01Z"
    }
  ],
  "total": 14,
  "has_more": false,
  "next_cursor": null
}
```

---

### 7.5 GET /api/alerts/{txn_id}
**Owner:** Person B (Lambda) | **Caller:** Person D (Alert Detail Panel)  
**Purpose:** Full detail for a single alert including Bedrock explanation and all signals.

**Response `200 OK`:**
```json
{
  "request_id": "5e3c7d9b-...",
  "txn_id": "TXN-20260425-00893",
  "user_id": "USR-00123",
  "user_display": "User ***123",
  "amount": 8000.00,
  "currency": "MYR",
  "final_score": 87,
  "rule_score": 80,
  "ml_score": 91,
  "scam_type": "macau_scam",
  "status": "open",
  "user_choice": "cancel",
  "created_at": "2026-04-25T02:15:01Z",
  "triggered_signals": [
    { "signal": "new_account", "label_en": "Payee account is only 6 days old", "label_bm": "Akaun penerima hanya 6 hari", "weight": 20, "triggered": true },
    { "signal": "new_payee", "label_en": "You have never sent money here before", "label_bm": "Anda tidak pernah hantar wang ke sini sebelum ini", "weight": 15, "triggered": true },
    { "signal": "amount_spike", "label_en": "Amount is 17× your monthly average", "label_bm": "Jumlah adalah 17× purata bulanan anda", "weight": 20, "triggered": true },
    { "signal": "late_night", "label_en": "Transaction at 2:15 AM", "label_bm": "Transaksi pada pukul 2:15 pagi", "weight": 10, "triggered": true },
    { "signal": "device_mismatch", "label_en": "Different device from usual", "label_bm": "Peranti berbeza dari biasa", "weight": 15, "triggered": false },
    { "signal": "payee_flagged", "label_en": "Payee linked to 4 other flagged accounts", "label_bm": "Penerima dikaitkan dengan 4 akaun yang ditandakan", "weight": 30, "triggered": true },
    { "signal": "round_amount", "label_en": "Large round-number transfer", "label_bm": "Pemindahan nombor bulat yang besar", "weight": 5, "triggered": true }
  ],
  "bedrock_explanation": {
    "explanation_en": "This account was created just 6 days ago and you have never sent money here before. This transfer matches a known Macau scam pattern where scammers impersonate government agencies to pressure you into moving money quickly.",
    "explanation_bm": "Akaun ini baru dicipta 6 hari lepas dan anda tidak pernah hantar wang ke sini sebelum ini. Pemindahan ini sepadan dengan corak penipuan Macau di mana penipu menyamar sebagai agensi kerajaan untuk menekan anda memindahkan wang dengan cepat.",
    "scam_type": "macau_scam",
    "confidence": "high"
  },
  "payee_info": {
    "payee_id": "60123456789",
    "payee_name": "Ahmad bin Razak",
    "account_age_days": 6,
    "is_new_payee": true,
    "prior_txns_to_payee": 0,
    "flagged_in_network": true,
    "linked_flagged_accounts": 4,
    "network_graph_url": "/api/network-graph?focal_node=60123456789"
  },
  "user_history": {
    "user_avg_30d": 450.00,
    "amount_ratio": 17.78,
    "txn_count_30d": 12,
    "txn_history": [
      { "date": "2026-04-24", "amount": 120.00 },
      { "date": "2026-04-22", "amount": 890.00 },
      { "date": "2026-04-20", "amount": 45.50 }
    ]
  }
}
```

---

### 7.6 POST /api/alerts/{txn_id}/action
**Owner:** Person B (Lambda) | **Caller:** Person D (Agent Dashboard action buttons)  
**Purpose:** Agent takes action on a flagged transaction.

**Request:**
```json
{
  "action": "block",
  "agent_id": "AGENT-007",
  "notes": "Confirmed Macau scam — payee linked to known mule network cluster #4"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `action` | enum | Yes | `block \| warn \| clear` |
| `agent_id` | string | Yes | Agent identifier |
| `notes` | string | No | Free text, max 500 chars |

**Response `200 OK`:**
```json
{
  "request_id": "4a7b2c1e-...",
  "txn_id": "TXN-20260425-00893",
  "action_taken": "block",
  "agent_id": "AGENT-007",
  "timestamp": "2026-04-25T02:22:10Z",
  "downstream_actions": {
    "database_updated": true,
    "sms_sent": true,
    "sms_to": "60123****89",
    "oss_label_written": true,
    "label_file": "safesend-labels/2026-04-25.jsonl"
  },
  "updated_status": "blocked"
}
```

**Downstream actions by choice:**

| Action | AWS RDS (PostgreSQL) | SNS SMS | OSS Label | In-App Flag |
|---|---|---|---|---|
| `block` | status → "blocked" | Yes — "Your transfer blocked" | label = 1 (scam) | Yes |
| `warn` | status → "warned" | No | label = 1 (suspicious) | Yes |
| `clear` | status → "cleared" | No | label = 0 (false positive) | No |

---

### 7.7 GET /api/stats
**Owner:** Person B (Lambda) | **Caller:** Person D (Stats Bar)  
**Purpose:** Aggregate metrics for the dashboard stats bar.

**Response `200 OK`:**
```json
{
  "request_id": "8f1d3a5c-...",
  "period": "today",
  "open_alerts": 14,
  "rm_at_risk_today": 127500.00,
  "transactions_blocked": 3,
  "transactions_warned": 6,
  "transactions_cleared": 2,
  "avg_response_time_ms": 312,
  "model_accuracy_pct": 92.0,
  "last_updated": "2026-04-25T10:30:00Z"
}
```

---

### 7.8 GET /api/network-graph
**Owner:** Person B (Lambda) | **Caller:** Person D (D3.js graph)  
**Purpose:** Return graph nodes and edges for the scam network visualisation.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `focal_node` | string | — | If set, return only the subgraph within 2 hops of this node |
| `min_risk_score` | int | 50 | Only include nodes with score above this threshold |

**Response `200 OK`:**
```json
{
  "request_id": "1c9f4b2a-...",
  "nodes": [
    {
      "id": "60123456789",
      "type": "account",
      "label": "Acct ***789",
      "risk_score": 87,
      "status": "blocked",
      "account_age_days": 6,
      "is_focal": true
    },
    {
      "id": "60198765432",
      "type": "account",
      "label": "Acct ***432",
      "risk_score": 76,
      "status": "open",
      "account_age_days": 11,
      "is_focal": false
    },
    {
      "id": "DEV-abc123",
      "type": "device",
      "label": "Device ***123",
      "risk_score": 82,
      "status": "flagged",
      "is_focal": false
    }
  ],
  "edges": [
    {
      "id": "edge-001",
      "source": "60123456789",
      "target": "60198765432",
      "relationship": "shared_device",
      "weight": 0.9,
      "label": "Same device fingerprint"
    },
    {
      "id": "edge-002",
      "source": "60123456789",
      "target": "DEV-abc123",
      "relationship": "used_device",
      "weight": 1.0,
      "label": "Transaction device"
    }
  ],
  "cluster_count": 2,
  "total_nodes": 7,
  "total_edges": 9
}
```

**Node types:** `account | device`  
**Edge relationships:** `shared_device | transaction | same_ip | same_registration_time`  
**D3.js rendering:** Accounts = circles, Devices = squares; colour scale: green (score < 40) → yellow (40–70) → red (> 70)

---

### 7.9 POST /api/fraud-score (Internal: Lambda → Alibaba EAS)
**Owner:** Person C (EAS endpoint) | **Caller:** Person B (Lambda, internal only — not exposed to frontend)  
**Purpose:** Lambda calls Alibaba EAS Isolation Forest model.

**Request (Lambda → EAS):**
```json
{
  "instances": [
    {
      "amount_ratio": 17.78,
      "payee_account_age_days": 6,
      "is_new_payee": 1,
      "hour_of_day": 2,
      "device_match": 1,
      "prior_txns_to_payee": 0
    }
  ]
}
```

**Response (EAS → Lambda):**
```json
{
  "predictions": [
    {
      "fraud_score": 91,
      "is_anomaly": true,
      "raw_isolation_score": -0.41,
      "model_version": "v3-20260425"
    }
  ]
}
```

---

### 7.10 OSS Feedback Label Record (Lambda → Alibaba OSS)
**Owner:** Person B (Lambda writer) + Person C (OSS schema)  
**Purpose:** Each agent decision writes one JSONL line to `safesend-labels/YYYY-MM-DD.jsonl`.

**JSONL record format:**
```json
{
  "txn_id": "TXN-20260425-00893",
  "agent_id": "AGENT-007",
  "action": "block",
  "label": 1,
  "amount_ratio": 17.78,
  "payee_account_age_days": 6,
  "is_new_payee": 1,
  "hour_of_day": 2,
  "device_match": 1,
  "prior_txns_to_payee": 0,
  "final_score": 87,
  "scam_type": "macau_scam",
  "agent_notes": "Confirmed Macau scam — payee linked to known mule network cluster #4",
  "recorded_at": "2026-04-25T02:22:10Z"
}
```

**Label mapping:** `block → 1`, `warn → 1`, `clear → 0`

---

## 8. Tech Stack (Full Detail)

### AWS Services

| Service | Configuration | Role |
|---|---|---|
| **Amazon API Gateway (HTTP API)** | Region: ap-southeast-1; CORS: `*` (hackathon); throttle: 100 RPS; stage: `prod` | Single entry point for all frontend → backend calls |
| **AWS Lambda (Python 3.12)** | Memory: 512 MB; timeout: 10s; concurrency: 10 reserved; layers: `requests`, `boto3` | One function per endpoint; rule engine + orchestration logic |
| **Amazon Bedrock** | Model: `anthropic.claude-3-haiku-20240307-v1:0`; max tokens: 512; temperature: 0; region: us-east-1 | Bilingual scam explanation generation; structured JSON output |
| **Amazon Kinesis Data Streams** | Stream: `safesend-events`; shards: 1; retention: 24h | Append-only event log for every transaction event and user choice |
| **Amazon RDS PostgreSQL** | Table: `SafeSendAlerts`; PK: `txn_id`; GSI1: `status-risk_score-index`; TTL: `expires_at` (7 days); on-demand capacity | Real-time alert state; the agent dashboard reads and writes here |
| **AWS SNS** | Topic: `safesend-user-alerts`; protocol: SMS (Southeast Asia); sender ID: `SafeSend` | User SMS notifications when transaction is blocked |
| **AWS SSM Parameter Store** | Parameters: `/safesend/eas-endpoint`, `/safesend/eas-api-key`, `/safesend/bedrock-region` | Secure storage of Alibaba EAS credentials; Lambda reads at cold start |
| **Amazon CloudWatch** | Log groups per Lambda; metric alarms for error rate > 5%; dashboard for processed_ms percentiles | Observability; latency tracking for demo |
| **AWS IAM** | Role: `safesend-lambda-exec`; policies: AWS RDS (PostgreSQL) CRUD, Kinesis PutRecord, Bedrock InvokeModel, SNS Publish, SSM GetParameter, CloudWatch Logs | Least-privilege execution role |

---

### Alibaba Cloud Services

| Service | Configuration | Role |
|---|---|---|
| **Alibaba PAI (Platform for AI)** | Region: ap-southeast-1 (Singapore); instance type: ecs.c6.xlarge for training job; framework: scikit-learn 1.4 | Trains Isolation Forest on transaction CSV; outputs `.pkl` model artifact to OSS |
| **Alibaba EAS (Elastic Algorithm Service)** | Instance type: ecs.c6.large (2 vCPU, 4 GB); autoscaling: 1–3 instances; model framework: scikit-learn; latency target: < 100ms | Serves fraud score REST endpoint; called by Lambda `screen-transaction` |
| **Alibaba OSS (Object Storage Service)** | Bucket 1: `safesend-data` (ap-southeast-1); Bucket 2: `safesend-labels` (ap-southeast-1); ACL: private; versioning: enabled | `safesend-data`: training CSV, model artifacts, graph JSON; `safesend-labels`: agent-labelled JSONL |
| **Alibaba DataWorks** | Workspace: `safesend-ws`; cron: `0 2 * * *` (02:00 SGT); task: Python PAI SDK script | Schedules nightly model retraining pipeline |
| **Alibaba RAM (Resource Access Management)** | AccessKey for EAS endpoint auth; scoped to EAS InvokeService + OSS read/write | Cross-cloud auth from Lambda to Alibaba services |

---

### Frontend & Demo Stack

| Component | Technology | Detail |
|---|---|---|
| **User App (TnG Transfer + Plugin)** | React 18 + Vite 5 + TypeScript | Routing: React Router v6; 4 routes: `/transfer`, `/warning`, `/plugin`, `/` |
| **Agent Dashboard** | React 18 + Vite 5 + TypeScript | Separate Vite app in `packages/agent-dashboard` |
| **Styling** | Tailwind CSS 3.4 | Dark theme for agent dashboard; TnG blue theme for user app |
| **HTTP Client** | Axios 1.6 | Typed with TypeScript generics; base URL from `VITE_API_BASE_URL` env var |
| **Network Graph** | D3.js v7 | Force-directed simulation; zoom/pan; click-to-expand nodes |
| **Charts** | Recharts 2.x | Bar chart for amount history; line chart for model accuracy over time |
| **State Management** | React Context + `useState` | No Redux needed for hackathon scope |
| **Polling** | `setInterval` + `useEffect` | Stats bar: 10s; alert table: 10s; manual refresh button |
| **Monorepo** | pnpm workspaces | `packages/user-app`, `packages/agent-dashboard`, `packages/plugin`, `packages/mock-api` |
| **Mock API** | Express.js (Node 20) | `packages/mock-api` — identical response shapes as Lambda; used for offline dev |

---

### Architecture Summary

```
[Plugin Demo Page (React)]
        ↓ POST /api/analyse-message
[API Gateway HTTP API]
        ↓
[Lambda: analyse-message]
        → Regex/keyword rule engine
        → Returns: is_scam, matched_patterns, bilingual warning

[TnG Web App (React)]
        ↓ POST /api/screen-transaction
[API Gateway HTTP API]
        ↓
[Lambda: screen-transaction]
        ├→ Rule engine (7 signals) → rule_score
        ├→ Alibaba EAS → ml_score (Isolation Forest)
        ├→ final_score = 0.4 * rule_score + 0.6 * ml_score
        ├→ if final_score > 70: Bedrock Claude Haiku → explanation JSON
        ├→ AWS RDS (PostgreSQL): write alert record (if score > 40)
        └→ Kinesis: log transaction event
        → Returns: action + full response contract (see Section 7.2)

[Agent Dashboard (React)]
        ↓ GET /api/alerts (polling 10s)
        ↓ GET /api/alerts/{txn_id} (on click)
        ↓ POST /api/alerts/{txn_id}/action (on button click)
        ↓ GET /api/stats (polling 10s)
        ↓ GET /api/network-graph?focal_node=...
[API Gateway] → [Lambda: get-alerts / get-stats / agent-action / get-network-graph]
        → AWS RDS (PostgreSQL) reads/writes
        → SNS SMS (on block)
        → OSS label write (on any action)

[Nightly: Alibaba DataWorks 02:00 SGT]
        → Read safesend-labels/*.jsonl from OSS
        → Merge with safesend-data/mock_transactions.csv
        → PAI: retrain Isolation Forest
        → Push new model to safesend-data/models/latest.pkl
        → EAS: swap serving model (zero downtime)
```

---

## 9. Detailed 24-Hour Build Timeline

### Hours 0–2 | Setup & Scaffold (All Hands)

**All:**
- Git monorepo initialised with pnpm workspaces
- Folder structure: `packages/user-app`, `packages/agent-dashboard`, `packages/plugin`, `packages/mock-api`, `infra/lambda`, `infra/iac`, `data/`
- Mock data schema agreed (Section 11) and CSV template created
- API contracts reviewed and signed off (this document)
- Environment variables template: `.env.example` committed

**Person A:**
- `packages/user-app`: Vite + React + TypeScript + Tailwind scaffolded
- React Router: `/` (home), `/transfer` (flow), `/warning` (intercept), `/plugin` (Layer 1 demo)
- Axios service file `src/services/api.ts` with typed stubs for all endpoints
- TnG colour theme in `tailwind.config.ts` (blue #0066CC)

**Person B:**
- AWS account + IAM role `safesend-lambda-exec` created
- Kinesis stream `safesend-events` (1 shard) created
- AWS RDS (PostgreSQL) table `SafeSendAlerts` created with GSI
- Lambda functions scaffolded (empty handlers) + deployed via AWS SAM or manual zip
- API Gateway HTTP API created with all routes registered (returning 501 stubs)
- SSM parameters populated: `/safesend/eas-endpoint`, `/safesend/eas-api-key`

**Person C:**
- Alibaba OSS buckets created: `safesend-data`, `safesend-labels`
- Mock dataset Python script written (`data/generate_mock_data.py`): 475 normal + 25 scam rows
- CSV uploaded to `safesend-data/mock_transactions.csv`
- Alibaba PAI workspace `safesend-ws` initialised
- RAM AccessKey created and given to Person B for SSM

**Person D:**
- `packages/agent-dashboard`: Vite + React + TypeScript + Tailwind scaffolded
- Layout shell: top stats bar, left alert list, right detail panel
- Figma wireframes for 3 screens (transfer flow, SafeSend warning, agent dashboard)
- Pitch deck outline (12 slides) created

---

### Hours 2–6 | Core Backend & ML

**Person B (priority: Lambda + API Gateway fully functional):**
- `screen-transaction` Lambda: rule engine logic complete (7 signals, weighted scoring)
- `analyse-message` Lambda: regex keyword dictionary loaded; returns correct `is_scam` + `matched_patterns`
- `get-alerts` Lambda: AWS RDS (PostgreSQL) query + pagination working
- `agent-action` Lambda: AWS RDS (PostgreSQL) update + SNS SMS stub (SNS wired but SMS not yet tested)
- `get-stats` Lambda: AWS RDS (PostgreSQL) scan with aggregation
- **Integration test:** Postman collection covers all endpoints with correct request/response shapes

**Person C (priority: EAS endpoint live and returning scores):**
- PAI training job: runs `sklearn.IsolationForest` on 500-row CSV; contamination=0.05
- Model artifact `.pkl` exported and uploaded to `safesend-data/models/v1.pkl`
- EAS deployment: model wrapped in Flask inference script, deployed to EAS instance
- EAS endpoint tested: `POST /api/predict` with sample feature vector returns `fraud_score`
- EAS endpoint URL + API key provided to Person B for SSM

**Person A (priority: core transfer flow screens functional):**
- Screen 1 (Enter Amount): amount input, next button
- Screen 2 (Enter Payee): phone/account input, payee name display, next button
- Screen 3 (Confirm): summary card, "Confirm Transfer" button → calls `POST /api/screen-transaction`
- Wired to mock-api initially; switches to real API Gateway URL via env var

**Person D (priority: agent dashboard layout + data wiring):**
- Stats bar component: fetches `GET /api/stats` on mount; displays 4 metrics
- Alert table component: fetches `GET /api/alerts`; columns: TXN ID, Amount, Score badge, Type, Status, Time
- Risk score badge: green (< 40), yellow (40–70), red (> 70) colour coding
- Detail panel: triggered on row click; fetches `GET /api/alerts/{txn_id}`

---

### Hours 6–12 | AI Integration & End-to-End Pipeline

**Person B (priority: Bedrock integration + full pipeline test):**
- `screen-transaction` Lambda: adds Bedrock `invoke_model` call when `rule_score > 60`
- Bedrock prompt structured exactly per Section 10 (Bedrock Prompt Reference)
- JSON response parsed: `explanation_en`, `explanation_bm`, `scam_type`, `confidence` extracted
- Full pipeline tested end-to-end: Transfer UI → API Gateway → Lambda rule engine → EAS → Bedrock → AWS RDS (PostgreSQL) → response back to UI
- Lambda error handling: if EAS times out (>1s), fall back to deterministic mock score

**Person A (priority: SafeSend warning screen + bilingual toggle):**
- Hard intercept screen: shows `explanation_bm` (primary), `explanation_en` (toggle)
- Triggered signals list: renders `triggered_signals` array as checklist with bilingual labels
- Risk score badge on warning screen
- Three action buttons: Cancel (→ POST `/api/user-choice` `choice=cancel`), Proceed Anyway (→ `choice=proceed` + confirmation modal), Report as Scam (→ `choice=report` + thank-you screen)
- Bilingual toggle (BM/EN) button — persists in `localStorage`
- Soft warning overlay modal: dismissible, yellow, shows 1-line warning

**Person C (priority: OSS feedback logging + DataWorks):**
- OSS JSONL writer: Python utility function used by Lambda via pre-signed PUT URL
- DataWorks nightly job: Python script that reads OSS labels, retrains model, deploys to EAS
- DataWorks cron configured: `0 2 * * *`; can trigger manually for demo
- Demo retraining: manually trigger one PAI retraining cycle to show feedback loop live

**Person D (priority: agent dashboard fully wired):**
- Alert detail panel: all fields from `GET /api/alerts/{txn_id}` displayed
- Signals checklist: renders each signal with green tick / red cross + bilingual label
- Bedrock explanation card: BM tab (default) + EN tab
- Block / Warn / Clear buttons: POST to `/api/alerts/{txn_id}/action`; optimistic status update; toast notification
- User history amount chart: Recharts BarChart of `txn_history` array; current flagged amount as red bar

---

### Hours 12–18 | Network Graph + Plugin + Integration

**Person C + D (priority: D3.js network graph):**
- Mock graph JSON built in OSS: 3 scam clusters with 7–10 nodes each; edges include `shared_device` and `transaction` relationships
- `GET /api/network-graph` Lambda returns graph from OSS (Person B wires Lambda to read OSS JSON)
- D3.js force-directed graph: nodes (accounts=circles, devices=squares); coloured by risk score; zoom/pan; click node → modal with account info
- "View in Network" link on detail panel → opens graph focused on `focal_node=payee_id`
- 2–3 scam clusters clearly visible in demo; connected mule accounts highlighted

**Person A (priority: plugin demo page):**
- `/plugin` route: text area to paste message, "Analyse" button → calls `POST /api/analyse-message`
- Warning banner component: `is_scam=true` → yellow banner with matched patterns badges
- Safe banner: `is_scam=false` → green "No suspicious content detected" state
- Demo message pre-loaded: "Akaun LHDN anda akan dibekukan..." button to auto-fill

**Person B (priority: SNS SMS + end-to-end integration test):**
- SNS SMS fully wired: Block action → Lambda → SNS → test phone number receives SMS
- Full integration test: plugin demo → transfer → hard intercept → agent block → SMS received
- Fix any broken API calls discovered during integration
- Lambda cold start optimisation: warm concurrency for `screen-transaction`

**All (integration testing):**
- Run all three demo flows (Flow A, B, C) end-to-end
- Fix CORS issues, env var mismatches, API shape mismatches
- Confirm `processed_ms < 500` for the hard intercept flow

---

### Hours 18–22 | Polish & Demo Prep

**Person A + D (priority: UI polish):**
- Mobile-responsive warning screen (375px viewport)
- Loading spinners on all API calls (Axios interceptors)
- Error boundary: if API Gateway times out, show friendly error + "Try again" button
- TnG branding: logo, blue colour scheme on user app
- Agent dashboard: dark theme polish; table hover states; action button loading state

**Person B (priority: error handling + fallbacks):**
- Lambda: `try/except` around EAS call → fall back to deterministic mock score
- Lambda: `try/except` around Bedrock call → fall back to 3 pre-canned response strings (one per scam type)
- Lambda: structured CloudWatch logging for `processed_ms` and error types
- API Gateway: 504 timeout → friendly JSON error response (not raw AWS error)

**Person C (priority: training artifacts + pitch materials):**
- PAI training job screenshots captured for pitch deck slide
- EAS endpoint performance screenshot (latency metrics)
- OSS label store screenshot showing JSONL records accumulating
- Prepare "live demo of retraining" script for Act 4 of demo

**Person D (priority: pitch deck + demo script):**
- Pitch deck: 12 slides finalised with architecture diagram, demo screenshots, metrics
- Demo script: written word-for-word for each act; uncle persona narrative
- Timing: Act 1 = 1 min, Act 2 = 1.5 min, Act 3 = 1 min, Act 4 = 30s, open/close = 1 min total
- Contingency lines: if EAS slow → "We have a fallback built in — watch." → mock score shown
- Architecture diagram: exported as PNG for pitch deck and submission

---

### Hours 22–24 | Rehearsal & Submission

**All:**
- Two full dry runs of the demo (uncle persona narrative, 5 minutes each)
- Both runs timed; trim anything over 5:15
- Verify all three layers working on demo machine (not localhost — use deployed URLs)
- Backup: localhost `mock-api` running as contingency if cloud services are unreliable

**Person D:**
- Submit on hackathon platform: link to deployed app + GitHub repo + pitch deck PDF
- Architecture diagram included in submission

**Contingency Protocol:**
- EAS slow → Lambda deterministic fallback active (score from rules only); announce "our fallback system" — it's a feature
- Bedrock slow → pre-canned JSON response string in Lambda env var; response is identical
- API Gateway down → switch to localhost mock-api; same frontend URL points to local port
- AWS RDS (PostgreSQL) cold → pre-seed with 3 demo alerts so dashboard is never empty

---

## 10. Bedrock Prompt (Reference)

```python
prompt = f"""
You are a fraud analyst for a Malaysian e-wallet called Touch 'n Go.
A transaction has been flagged by our anomaly detection system.

Transaction details:
- Amount: RM {amount}
- Payee: "{payee}"
- Time: {time}
- Payee account age: {payee_age_days} days
- Prior transactions to this payee: {prior_txns}
- ML fraud score: {score}/100

Risk signals triggered: {signals}

Instructions:
1. In 2 sentences, explain WHY this transaction looks suspicious to a non-technical user.
   Write in simple language an elderly Malaysian would understand.
   Provide both English and Bahasa Malaysia versions.
2. Classify the most likely scam type from:
   [macau_scam | investment_scam | love_scam | account_takeover | mule_account | false_positive]
3. Confidence level: high / medium / low

Respond ONLY in valid JSON. No preamble, no markdown.
Format:
{{
  "explanation_en": "...",
  "explanation_bm": "...",
  "scam_type": "...",
  "confidence": "..."
}}
"""
```

**Canned fallback responses (pre-seeded in Lambda env var for demo safety):**

```json
{
  "macau_scam": {
    "explanation_en": "This account was created just days ago and you have never sent money here before. This matches a Macau scam where scammers pretend to be government officers to pressure you.",
    "explanation_bm": "Akaun ini baru dibuka beberapa hari lepas dan anda tidak pernah hantar wang ke sini. Ini sepadan dengan penipuan Macau di mana penipu berpura-pura menjadi pegawai kerajaan.",
    "scam_type": "macau_scam",
    "confidence": "high"
  }
}
```

---

## 11. Mock Data Schema

### CSV Schema (`mock_transactions.csv`)

```
user_id, txn_id, timestamp, amount, user_avg_30d, amount_ratio,
payee_id, payee_account_age_days, is_new_payee, hour_of_day,
device_match, prior_txns_to_payee, payee_flagged, label
```

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Hashed user ID (e.g., `USR-00001`) |
| `txn_id` | string | Unique transaction ID |
| `timestamp` | ISO8601 | Transaction datetime |
| `amount` | float | Transfer amount in MYR |
| `user_avg_30d` | float | User's 30-day average transfer |
| `amount_ratio` | float | `amount / user_avg_30d` |
| `payee_id` | string | Payee phone/account (hashed) |
| `payee_account_age_days` | int | Days since payee account created |
| `is_new_payee` | int | 1 if first transfer to this payee, 0 otherwise |
| `hour_of_day` | int | 0–23, hour of transaction |
| `device_match` | int | 1 if same device as usual, 0 if new device |
| `prior_txns_to_payee` | int | Count of prior transactions to this payee |
| `payee_flagged` | int | 1 if payee in known scam network, 0 otherwise |
| `label` | int | Ground truth: 1 = scam, 0 = normal |

**Scam pattern rule (label = 1, 25 rows):**
`amount_ratio > 3.0` AND `is_new_payee = 1` AND `payee_account_age_days < 14`

**Normal pattern rule (label = 0, 475 rows):**
`amount_ratio` between 0.3–1.8, `is_new_payee = 0`, `hour_of_day` 8–21, `device_match = 1`

### Network Graph JSON Schema (`safesend-data/graph/network.json`)

```json
{
  "generated_at": "2026-04-25T00:00:00Z",
  "nodes": [
    {
      "id": "string (account or device ID)",
      "type": "account | device",
      "label": "display label (masked)",
      "risk_score": "int 0–100",
      "status": "blocked | open | flagged | normal",
      "account_age_days": "int (accounts only)",
      "cluster_id": "int (scam cluster identifier)"
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "node id",
      "target": "node id",
      "relationship": "shared_device | transaction | same_ip | same_registration_time",
      "weight": "float 0–1",
      "label": "human-readable description"
    }
  ]
}
```

**Pre-built mock clusters:**
- Cluster 1: 4 mule accounts + 1 shared device — Macau scam ring
- Cluster 2: 3 accounts sharing registration time and IP — account takeover ring
- Cluster 3: isolated flagged account — single mule

---

## 12. User Flows

*(See Section 6 for full detail)*

### Flow A — Messaging Layer (End User, Pre-Transfer)
Plugin scans pasted message → `POST /api/analyse-message` → warning banner if `is_scam = true`

### Flow B — Transfer Interception (End User, In-App)
Transfer confirm → `POST /api/screen-transaction` → action = `proceed | soft_warn | hard_intercept` → appropriate UI rendered

### Flow C — Agent Review (Internal Analyst)
Dashboard → `GET /api/alerts` → click → `GET /api/alerts/{txn_id}` → action → `POST /api/alerts/{txn_id}/action`

### Flow D — Feedback Loop (Automated, Nightly)
OSS labels → DataWorks cron → PAI retrain → EAS redeploy

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Alibaba EAS slow / unreliable during demo | Medium | High | Lambda deterministic fallback: `if amount_ratio > 3 and is_new_payee → score 85`. Pre-warm EAS endpoint 30 min before demo |
| Bedrock latency > 3s during pitch | Medium | High | Pre-generate 3 canned responses in Lambda env var. Use real Bedrock for judging Q&A, canned for demo flow |
| PAI training fails during hackathon | Low | Medium | Local scikit-learn model (`data/fallback_model.pkl`) committed to repo. Lambda can load from local if EAS unreachable |
| Browser extension blocked by Chrome | High | Low | Plugin is a standalone React web demo page — this risk is already mitigated by design |
| AWS RDS (PostgreSQL) cold start empty dashboard | Medium | High | Pre-seed `SafeSendAlerts` table with 3 demo alerts before demo. Seeding script: `scripts/seed-demo-data.py` |
| CORS errors in demo | Medium | Medium | API Gateway CORS configured with `*` origin; test from deployed URL (not localhost) 2 hours before demo |
| Team runs out of time | Medium | High | Priority order: Layer 2 intercept → Agent dashboard → Layer 1 plugin → Network graph. Core demo (Layers 1+2 + dashboard) wins without graph |
| EAS cross-cloud latency > 500ms | Low | Medium | Lambda calls EAS with 800ms timeout; falls back to deterministic score. EAS in same region (Singapore) minimises latency |

---

## 14. Success Metrics (for Pitch)

| Metric | Target | How Measured |
|---|---|---|
| Scam detection recall | ≥ 92% | 23/25 scam rows correctly flagged by Isolation Forest on test set |
| False positive rate | < 8% | < 38/475 normal rows incorrectly flagged |
| Interception latency | < 500ms | CloudWatch `processed_ms` p95 on `screen-transaction` Lambda |
| Bedrock explanation quality | Bilingual, ≤ 2 sentences, references scam type | Manual review of 5 sample outputs |
| Feedback loop demo | ≥ 1 live retraining cycle | DataWorks job triggered and EAS model version incremented |
| Dashboard update latency | < 15s after transaction flagged | Polling interval: 10s; AWS RDS (PostgreSQL) write: < 50ms |

---

## 15. Demo Script (5 Minutes)

**Opening (30 sec):**  
*"Every 7 minutes, a Malaysian loses money to a scam. It doesn't start in their TnG app. It starts in WhatsApp."*

**Act 1 — Messaging Layer (1 min):**  
Show a WhatsApp screenshot: "Akaun LHDN anda akan dibekukan. Sila pindahkan RM8,000 ke akaun selamat dengan segera."  
Click "Auto-fill" on plugin demo page. Click "Analyse". Warning banner appears in 200ms. Matched patterns: LHDN, dibekukan, pindahkan wang, segera.  
*"Layer 1 caught this before he ever opened TnG."*

**Act 2 — Transfer Interception (1.5 min):**  
Switch to TnG web app. Enter amount: RM8,000. Payee: 60123456789. Tap Confirm.  
SafeSend warning screen appears. Read the Bahasa Malaysia text aloud:  
*"Tunggu sebentar — Akaun ini baru didaftarkan 6 hari lepas..."*  
Show risk signals checklist: 5 red crosses. Risk score badge: 87/100.  
Uncle pauses. Clicks Cancel. Savings intact.  
*"500 milliseconds. That's how long it takes SafeSend to protect him."*

**Act 3 — Agent Dashboard (1 min):**  
Flip to agent dashboard. Stats bar: 14 open alerts, RM127,500 at risk. Click the RM8,000 alert row. Detail panel expands. Bedrock explanation reads: *"Transaction matches Macau scam pattern — escalating amount to newly registered account."*  
Click "View in Network" — D3.js graph appears. This payee is connected to 4 other blocked accounts in Cluster 1.  
Agent clicks Block. Toast: "Transaction blocked. SMS sent to user."

**Act 4 — Feedback Loop (30 sec):**  
Show OSS label store: new JSONL line appears.  
*"Every decision the agent makes teaches the model. Tomorrow it's smarter."*  
Trigger DataWorks job manually. PAI retraining screen. EAS model version: v1 → v2.

**Close (30 sec):**  
*"SafeSend is the first system that fights scams at every layer — in your messages, at the moment of transfer, and at the network level. With 24 million TnG users, this is RM 1.2 billion worth of protection."*

---

*Document prepared for Touch 'n Go FinHack Hackathon, April 2026. Internal use only. v2.0*
