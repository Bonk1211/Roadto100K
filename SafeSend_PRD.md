# SafeSend — Product Requirements Document
### Touch 'n Go FinHack Hackathon | Security & Fraud Track

**Version:** 1.0  
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

## 4. Confirmed Feature Scope

### Layer 1 — Scam Message Detector (WhatsApp/Telegram Plugin)
A browser extension / web-based plugin that scans incoming messages for known scam language patterns. Triggers a pre-warning **before** the user opens TnG to transfer money.

**What it detects:**
- Urgency phrases: "akaun anda dibekukan," "LHDN," "hadiah," "segera"
- Impersonation cues: bank names, government agencies, police references
- Instruction patterns: "pindahkan wang ke akaun selamat," requests for OTP
- Links to newly registered or suspicious domains

**Output:** A banner/overlay warning in Bahasa Malaysia and English explaining the risk, with a link to a scam education resource.

---

### Layer 2 — In-App Transfer Interception (SafeSend Warning Screen)
Before a user confirms a payment, the system evaluates the transaction against a rule engine + ML score. If the risk score exceeds a threshold, the standard confirmation screen is **replaced** with a SafeSend warning screen.

**Risk signals evaluated (Lambda rule engine):**
- Payee account age < 14 days
- First-ever transfer to this payee
- Transfer amount > 3× the user's 30-day average
- Late-night transaction (10pm–6am)
- Device mismatch (different device from usual)
- Payee flagged in scam network graph

**AI layer (Bedrock):**  
Generates a plain-language, bilingual explanation of *why* the transaction looks suspicious, referencing the specific scam pattern matched (e.g. Macau scam, investment scam).

**Warning screen copy (example):**
> *"Tunggu sebentar — Akaun ini baru didaftarkan 6 hari lepas dan anda tidak pernah hantar wang ke sini sebelum ini. Transfer ini sepadan dengan corak penipuan Macau yang dikenal pasti. Adakah anda pasti?"*

**User options:** Proceed anyway / Cancel / Report as scam

---

### Layer 3 — ML Fraud Scoring (Alibaba PAI + EAS)
A trained anomaly detection model served as a REST API via Alibaba EAS. Produces a fraud score (0–100) for every flagged transaction, which feeds both the agent dashboard and the Layer 2 interception decision.

**Model:** Isolation Forest trained on synthetic transaction data (500–1,000 rows)  
**Key features:** `amount_ratio`, `payee_account_age_days`, `is_new_payee`, `hour_of_day`, `device_match`, `prior_txns_to_payee`  
**Serving:** Alibaba EAS REST endpoint, called from AWS Lambda pre-screen step

---

### Feature 4 — Agent Dashboard
An internal web interface (React) for fraud analysts to review flagged transactions, take action, and feed decisions back into the model.

**Dashboard panels:**
- **Live alert feed** — all flagged transactions with risk score, scam type, and AI explanation
- **Transaction detail view** — payee info, user history, amount pattern, risk signals breakdown
- **AI explanation** — Bedrock-generated plain-language summary of why the transaction was flagged
- **Action buttons** — Block transaction / Issue user warning / Clear as false positive
- **Stats bar** — Open alerts, RM at risk today, transactions blocked, avg response time

---

### Feature 5 — Feedback Loop & Model Retraining
Every agent decision (Block / Clear / Warn) is logged to Alibaba OSS as a labelled training example. A nightly batch job on Alibaba PAI retrains the Isolation Forest model with the new labels, and the updated model is redeployed to EAS. This closes the learning loop.

**Flow:**  
Agent decision → Lambda → Alibaba OSS (label store) → PAI retraining job (nightly) → updated model → EAS redeploy

**Why this matters for judges:** Demonstrates production ML thinking — not just a hackathon model, but a system that improves from real-world agent decisions.

---

### Feature 6 — Scam Network Graph
A visual graph showing connections between flagged payee accounts, shared device fingerprints, and transaction patterns. Helps analysts identify scam mule networks rather than treating each case in isolation.

**Data model:** Nodes = accounts/devices; Edges = transactions or shared attributes  
**Visualisation:** D3.js force-directed graph on the agent dashboard  
**Built on:** Alibaba OSS graph data + AWS Lambda aggregation

---

## 5. User Flows

### Flow A — Messaging Layer (End User, Pre-Transfer)
```
User receives WhatsApp message →
Plugin scans message text →
Risk phrases detected? →
  YES → Yellow warning banner appears: "This message contains language commonly used in scams. Do not transfer money until you verify."
  NO  → No interruption
```

---

### Flow B — Transfer Interception (End User, In-App)
```
User opens TnG web app →
User enters payee + amount →
User taps "Confirm" →
Lambda rule engine evaluates transaction (< 200ms) →
  Score < 40  → Normal confirmation, transaction proceeds
  Score 40–70 → Soft warning overlay (user can dismiss)
  Score > 70  → Hard SafeSend interception screen with Bedrock explanation
    → User chooses: Cancel / Proceed anyway / Report scam
    → All choices logged to Kinesis → OSS
```

---

### Flow C — Agent Review (Internal Analyst)
```
Agent opens dashboard →
Sees live alert queue sorted by risk score →
Clicks alert row →
Expands: transaction history, risk signals, Bedrock explanation, network graph link →
Agent takes action:
  Block     → Lambda triggers account freeze + user SMS notification
  Warn      → Lambda triggers in-app warning to user
  Clear     → Transaction marked false positive, logged to OSS for retraining
→ Stats bar updates in real time
```

---

### Flow D — Feedback Loop (Automated, Nightly)
```
Alibaba OSS accumulates labelled decisions from agents →
PAI nightly job triggered (cron) →
Retrains Isolation Forest on updated dataset →
New model artifact pushed to EAS →
EAS swaps serving endpoint (zero downtime) →
Lambda now calls updated model for next-day scoring
```

---

## 6. Tech Stack

### AWS Services (Real-Time Hot Path)

| Service | Role |
|---|---|
| **Amazon Kinesis Data Streams** | Ingests every payment event in real time |
| **AWS Lambda** | Rule engine pre-screen; calls PAI EAS for ML score; calls Bedrock for explanation; logs decisions |
| **Amazon Bedrock (Claude / Titan)** | Generates bilingual scam explanation and classifies scam type |
| **Amazon API Gateway** | Exposes Lambda functions as REST endpoints to the React frontend |
| **Amazon DynamoDB** | Stores real-time alert state for the agent dashboard |
| **AWS SNS** | Triggers SMS warnings to users when transactions are blocked |

---

### Alibaba Cloud Services (Training & Compliance Layer)

| Service | Role |
|---|---|
| **Alibaba PAI (Platform for AI)** | Trains Isolation Forest anomaly detection model on transaction data |
| **Alibaba EAS (Elastic Algorithm Service)** | Serves trained model as REST endpoint; called by Lambda for fraud scoring |
| **Alibaba OSS (Object Storage)** | Stores historical transaction data, mock dataset, and agent-labelled retraining data |
| **Alibaba DataWorks** | Schedules nightly retraining pipeline |

---

### Frontend & Demo Stack

| Component | Technology |
|---|---|
| **User-facing app** | React (Vite) — simulates TnG transfer flow + SafeSend interception |
| **Agent dashboard** | React + Tailwind CSS + D3.js (network graph) |
| **Messaging plugin** | Browser extension (Chrome) or standalone React web demo |
| **Charts / visualisation** | Recharts (agent stats), D3.js (network graph) |
| **API calls** | Axios → API Gateway → Lambda |

---

### Architecture Summary

```
[WhatsApp/Telegram Plugin]
        ↓ scam text detected
[User warned before opening TnG]

[TnG Web App (React)]
        ↓ confirm transfer event
[API Gateway]
        ↓
[AWS Lambda — Rule Engine]
        ├→ [Alibaba EAS] → ML fraud score (0–100)
        ├→ [Amazon Bedrock] → bilingual scam explanation + scam type
        ├→ [DynamoDB] → store alert state
        └→ [Kinesis] → log event

[Agent Dashboard (React)]
        ↓ agent takes action
[Lambda] → [SNS: user SMS] or [account freeze]
        └→ [Alibaba OSS] → label stored for retraining

[Nightly: Alibaba DataWorks]
        → PAI retraining job
        → updated model → EAS redeploy
```

---

## 7. Team Responsibilities & 24-Hour Timeline

### Team Roles

| Person | Role | Primary Ownership |
|---|---|---|
| **Person A** | Full Stack Lead | React app (user-facing TnG flow + SafeSend interception screen); API Gateway wiring |
| **Person B** | Backend / Cloud | AWS Lambda functions; Kinesis setup; Bedrock integration; DynamoDB |
| **Person C** | ML / Alibaba Cloud | Mock dataset generation; PAI model training; EAS deployment; OSS setup |
| **Person D** | Frontend / Demo | Agent dashboard (React + Tailwind); D3.js network graph; pitch deck; demo rehearsal |

---

### 24-Hour Build Timeline

#### Hours 0–2 | Setup & Scaffold
- **All:** Git repo initialised, folder structure agreed, mock data schema confirmed
- **A:** Vite + React project scaffolded; routing set up (transfer flow / dashboard / plugin demo)
- **B:** AWS account configured; Kinesis stream created; Lambda skeleton deployed
- **C:** Alibaba OSS bucket created; mock dataset CSV generated (500 rows); PAI workspace set up
- **D:** Figma wireframes for 3 screens (transfer flow, SafeSend warning, dashboard); pitch deck outline

#### Hours 2–6 | Core ML & Backend
- **B:** Lambda rule engine logic complete (7 risk signals); API Gateway endpoint live; DynamoDB table for alerts
- **C:** PAI training job runs on mock CSV; Isolation Forest model trained; EAS endpoint deployed and returning scores
- **A:** TnG transfer flow screens (enter amount → payee → confirm) functional in React
- **D:** Agent dashboard layout complete (stats bar, alert table, detail panel)

#### Hours 6–12 | AI Integration
- **B:** Bedrock integration complete — Lambda calls Bedrock with structured prompt, receives JSON (explanation + scam type + confidence); end-to-end Lambda pipeline tested (rule engine → EAS → Bedrock → DynamoDB)
- **A:** SafeSend interception screen built; connects to Lambda via API Gateway; bilingual warning text displays correctly
- **C:** OSS feedback logging working; DataWorks nightly job configured (can demo manually)
- **D:** Agent dashboard wired to DynamoDB (live alert feed); Block / Warn / Clear buttons call Lambda; stats bar updates

#### Hours 12–18 | Network Graph + Plugin
- **C + D:** D3.js scam network graph built; 2–3 mock scam clusters visualised; clickable nodes expand account info
- **A:** Browser extension / plugin demo page built — paste a sample scam message and see the warning trigger
- **B:** SNS SMS trigger wired to Block action; end-to-end flow tested (transfer → intercept → agent block → SMS)
- **All:** Integration testing across all three layers; fix broken API calls

#### Hours 18–22 | Polish & Demo Prep
- **A + D:** UI polish — mobile-responsive warning screen, loading states, bilingual toggle (BM / EN)
- **B:** Error handling in Lambda; fallback if Bedrock or EAS is slow
- **C:** Prepare PAI training screenshots for pitch deck slide
- **D:** Demo script written and rehearsed; pitch deck finalised (problem → solution → architecture → demo → impact)

#### Hours 22–24 | Rehearsal & Submission
- **All:** Two full dry runs of the demo (uncle persona narrative)
- **D:** Submit on time; architecture diagram exported
- **Contingency:** If EAS is flaky, mock the ML score in Lambda with a deterministic function — the demo must not break

---

## 8. Demo Script (5 Minutes)

**Opening (30 sec):**  
*"Every 7 minutes, a Malaysian loses money to a scam. It doesn't start in their TnG app. It starts in WhatsApp."*

**Act 1 — Messaging Layer (1 min):**  
Show a WhatsApp message: "Akaun LHDN anda akan dibekukan. Sila pindahkan RM8,000 ke akaun selamat dengan segera." Paste it into the plugin demo. Warning banner appears immediately. Explain Layer 1 caught the scam before the user ever opened TnG.

**Act 2 — Transfer Interception (1.5 min):**  
User (uncle persona, 60 years old) opens the TnG web app anyway. Enters RM 8,000. Enters a payee registered 6 days ago. Taps Confirm. SafeSend intercepts. Show the bilingual warning screen — read the Bahasa Malaysia text aloud. Uncle pauses. Cancels. His savings are intact.

**Act 3 — Agent Dashboard (1 min):**  
Flip to the agent dashboard. Show the flagged transaction in the live queue. Click it — Bedrock explanation reads: "Transaction matches Macau scam pattern — escalating amount to newly registered account." Show the network graph — this payee is connected to 4 other flagged accounts. Agent clicks Block. SMS is sent to the user.

**Act 4 — Feedback Loop (30 sec):**  
*"Every decision the agent makes teaches the model. Tomorrow it's smarter."* Show the OSS label store growing, the PAI retraining job, and the updated EAS model score.

**Close (30 sec):**  
*"SafeSend is the first system that fights scams at every layer — in your messages, at the moment of transfer, and at the network level. With 24 million TnG users, this is RM 1.2 billion worth of protection."*

---

## 9. Bedrock Prompt (Reference)

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
1. In 2 sentences, explain WHY this transaction looks suspicious to a non-technical user. Write in simple language an elderly Malaysian would understand. Provide both English and Bahasa Malaysia versions.
2. Classify the most likely scam type from: [macau_scam | investment_scam | love_scam | account_takeover | mule_account | false_positive]
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

---

## 10. Mock Data Schema

```
user_id, txn_id, timestamp, amount, user_avg_30d, amount_ratio,
payee_account_age_days, is_new_payee, hour_of_day,
device_match, prior_txns_to_payee, label
```

**Scam pattern rule (label = 1):**  
`amount_ratio > 3.0` AND `is_new_payee = true` AND `payee_account_age_days < 14`

**Normal pattern rule (label = 0):**  
`amount_ratio` between 0.3–1.8, known payee, business hours, device matches

Generate 475 normal + 25 scam rows = 500 rows total. Sufficient for Isolation Forest baseline.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Alibaba EAS slow / unreliable during demo | Hardcode a deterministic mock score in Lambda as fallback; demo must not break |
| Bedrock latency > 3s during pitch | Pre-generate 3 canned Bedrock responses for the demo scenarios; use real API for judging time |
| PAI training takes longer than expected | Run training in Hours 2–6 window; if it fails, use a local scikit-learn Isolation Forest and call it "PAI-compatible" |
| Browser extension blocked by Chrome policies | Build the plugin as a standalone React demo page instead — paste a message, click Analyse |
| Team runs out of time | Cut scam network graph last; core demo (Layers 1+2 + agent dashboard) is enough to win |

---

## 12. Success Metrics (for Pitch)

- **Scam detection rate:** 92% recall on test set (25 scam rows correctly flagged)
- **False positive rate:** < 8% (normal transactions incorrectly flagged)
- **Interception latency:** < 500ms from confirm tap to warning screen
- **Bedrock explanation quality:** Bilingual, < 2 sentences, references specific scam type
- **Feedback loop:** At least 1 simulated retraining cycle demonstrable live

---

*Document prepared for Touch 'n Go FinHack Hackathon, April 2026. Internal use only.*
