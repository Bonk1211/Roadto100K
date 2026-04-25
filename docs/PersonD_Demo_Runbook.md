# Person D Demo Runbook - SafeSend v3

## 5-minute story

Opening, 30s:
"Fraud detection is not broken. It is too slow. SafeSend closes the window between the first suspicious inbound transfer and the moment a mule account drains the money."

Act 1, transfer interception, 1m:
Show the TnG transfer flow. Send RM 8,000 to a new payee. SafeSend hard-intercepts with bilingual Bedrock text. User cancels.

Act 2, mule early eviction, 1.5m:
Open the agent dashboard. Select the Stage 3 mule alert. Point to the inbound sender count, average inbound gap, no merchant spend, blocked withdrawals, and escrow amount.

Act 3, bulk containment, 1m:
Open Network. The Stage 3 mule is pinned at the center. Review linked accounts, RM exposure, and connection reasons. Deselect any false positive if needed, then click Execute Containment.

Act 4, natural language query, 30s:
Narrate the planned query capability: "Show me accounts that topped up from 3 or more senders in the last 24 hours and have not spent anything." If F6 is not wired, use this as a roadmap line.

Close, 30s:
"The money is still inside TnG. The mule never withdraws, linked accounts are contained, and every decision becomes a training label for tomorrow's model."

## Backup narration

"For demo safety, this is running on seeded fraud data behind the same API contract the live Lambda and PostgreSQL pipeline will use."

"If Bedrock or SageMaker is slow during judging, the frontend keeps the same flow and the backend falls back to deterministic mock scoring and canned explanations."

## Final rehearsal checklist

- Start mock API on `http://localhost:4000`.
- Start agent dashboard on `http://localhost:5175`.
- Confirm alert queue loads with Stage 3 at the top.
- Confirm Stage 3 detail shows mule profile and containment preview.
- Confirm Network graph renders with the Stage 3 mule in the center.
- Confirm Execute Containment shows incident success.
- Run the script twice and keep the full demo under 5m 15s.
