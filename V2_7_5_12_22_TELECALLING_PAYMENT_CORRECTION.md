# DreamTrawell CRM v2.7.5.12.22 - Telecalling & Admin Payment Correction

**Base:** v2.7.5.12.21 Accounts & Invoicing. No intentional alteration to quotations, FX conversion, invoicing tax rules, vendors, engagement score formulas, or multilingual dictation.

## What changed

### A. Admin-only Void Mistaken Payment
- Under a Lead > Payments, Admin and Super Admin see **Void mistaken entry** for customer receipts and vendor payments.
- Confirmation shows direction, party, amount and transaction reference; correction reason (minimum eight characters) is mandatory.
- A Firestore transaction atomically marks the original payment `status: "voided"`, saves the prior status, actor/reason/time and creates an immutable snapshot under `leads/{leadId}/paymentVoidAudit/{id}`.
- If the payment was allocated to a Travel Agent or Vendor invoice, the same transaction reverses that invoice allocation, clears active invoice metadata on the payment, and preserves the old invoice reference in the void audit.
- Existing ledger cards filter voided records from active views; Admin sees them in the **Voided (Audit)** tab. They are never physically removed. Evidence attachments are retained.
- Existing vendor and customer summary rebuilders run after the transaction; no other payments are changed. If summary rebuild fails the UI reports a partial-completion warning and the Admin must reconcile, rather than voiding again.
- Non-admin users cannot void. Finance cannot void.
- **Only use for an incorrect CRM record. A real bank transfer must be reconciled with an adjustment/refund, not represented as never occurring.**

### B. Telecaller / Relationship Activation Role
- New role available from Admin > Team Management > Add/Edit User.
- Role can enter only the **Admin > Telecalling** workspace. It cannot manage Leads, Quotations, Vendors, Payments, Invoices, Users or system settings.
- Call queue shows contactable, unassigned agents, phone number/SPOC, calling status and follow-up, with search. Excludes `do_not_contact`, blacklisted, invalid number, business shut down and other non-contactable agents.
- Caller chooses outcome (connected interested, connected follow-up, connected not interested, no answer, busy, switched off, invalid number), enters a meaningful summary and optional next follow-up date.
- Calls are written to the existing `engagements` collection as standard attempted/connected call evidence, so they count in Travel Agent Engagement Intelligence without double-writing a second engagement.
- When a connected interested call has been recorded, the agent is eligible for handover to an active Relationship Executive (`employee`) or Lead & Operations Executive. Transaction rejects agents already assigned to another owner; existing assignment is not overwritten.
- Handover updates the existing `travelAgents` assignment fields and creates a traceable record in `travelAgentAssignments`; all earlier telecaller engagements remain linked to the same travel agent.
- Calling is manual or via the device `tel:` link. No automatic outbound dialer, call recording or WhatsApp automation is added.
- Voice-assisted English/Hindi/Marathi call notes reuse the existing Engagement VoiceNoteTextarea and its configured translation endpoint.

## Deployment
1. Back up your existing working CRM code and Firebase data.
2. Use this full ZIP as a source reference or the changed-files ZIP to merge into your current project. Do not overwrite a newer production codebase.
3. Deploy the updated `functions/index.js` for role creation; otherwise the Cloud Function will reject `telecaller` users.
4. **Mandatory:** Review and merge `V2_7_5_12_22_SECURITY_RULES_ADDENDUM.md` into the actual Firestore rules and test in a Firebase Emulator. This source ZIP does not contain the deployed Firestore rules. No role-based data safety is guaranteed by UI checks alone.
5. Run `npm ci`, `npm run test:crm`, `npm run test:invoices`, `npm run test:telecalling`, `npm run build` in your real project environment.
6. Test with Admin, Super Admin, Finance, Manager and a restricted Telecaller user, including direct URL attempts to restricted pages.
7. Test a *dummy* payment first: check audit, balance, old invoice allocation, amount/currency, and history before correcting a real record. The screenshot showed **INR 7,150** while the chat mentioned INR 7,200, so identify the exact payment ID and amount before voiding.
8. Test concurrent handoff to ensure existing assignments are never overwritten.

## Known limitations
- Complete Next.js build and live Firebase Emulator / Auth / invoice allocation tests were not run in the sandbox; business-critical acceptance tests are required before production deployment.
- The lead's denormalised payment summaries are recalculated after, not atomically within, the initial void transaction. An error is surfaced; admin must reconcile.
- Existing currency mismatch in lead payment summary cards is an independent open defect; this release does not change FX accounting logic or try to infer INR from a foreign-currency quotation.
- The initial Telecalling queue reads all travel agent documents client-side. For very large datasets use server pagination and a limited directory/read model.
- Call outcome `Not interested` / `Invalid number` removes the agent from the Telecalling queue but does not automatically modify the legacy master status or cancel scheduled tasks. Admin should review that status.
