# DreamTrawell CRM V2.7.5.12.24.3 — Executive Handover Notifications & First Contact

**Source baseline:** V2.7.5.12.24.2, which includes Telecaller user-level access and manual WhatsApp introduction.

## What was implemented

1. Telecaller assignment now creates the `travelAgentAssignments` record **in the same transaction** as the travel-agent ownership update, with `handoffType: "telecalling_handoff"`, `handoffStatus: "assigned"`, a configurable `firstContactDueAt`, primary contact details, previous call summary and creator attribution. The original agency and engagement history remain unchanged.
2. The new assignment appears through Firestore realtime listeners as a notification for the assigned executive. A bell with unread count appears on mobile and desktop **Team/User** UI; the count persists until the executive **accepts**, not merely reads, the assignment.
3. New **My Handoffs** tab/route (`/my-handoffs`) for active `employee` or `operation_executive` roles. Also linked from the existing **Action Center**. The page displays agent name/contact, Telecaller discussion, assignment date, SLA deadline and current status.
4. **Accept Handover:** Firestore transaction verifies caller's Auth UID is the recipient AND this person is still the agency's assigned owner before writing `acceptedAt` and `acceptedByUid`.
5. **Record First Contact:** A separate Firestore transaction atomically creates an Engagement call record and updates the handover. A connected outcome transitions `accepted → contacted`. `busy` and `no_answer` retain `accepted` status and a logged attempt, never claiming a successful connection.
6. **Management monitoring:** `Admin → Telecalling` shows New/Accepted/Contacted totals and a live overdue queue. Admin/Super Admin can configure a 1–48 calendar-hour SLA (default **4 calendar hours**) for **future** handovers in `settings/telecallingHandoffs`. Managers can view but not edit that setting.
7. Telecaller **Handed Over** list also shows `New assignment sent / Accepted by executive / First contact completed`, subject to the Firestore reader rules below.
8. Explicit Firebase UID mapping: `users` document ID is used to retrieve the selected employee; `assignedToUid` is the employee's **Firebase Auth UID**, which is what the employee's sign-in session and notification query use. The user document ID is retained in `assignedToUserDocId` for reference.

## Database impact

No new collection. Uses:
- `travelAgentAssignments/{handoffId}` — append handover notification/status fields to **new** Telecaller assignment records;
- `travelAgents/{agentId}` — existing assignment owner fields only, in same original handover transaction;
- `engagements/{engagementId}` — one new call activity for each first-contact attempt;
- `settings/telecallingHandoffs` — optional deadline configuration.

Legacy assignment records without `handoffType` are not treated as unread notifications. There is no bulk data migration, no extra booking, and no change to existing quote, payments, invoicing or Deal Won calculations.

### Status definitions

- `assigned`: An interested agent was successfully handed over. Executive has not accepted the task.
- `accepted`: Executive acknowledged it but has not yet recorded a connected call; no-answer/busy attempts do not complete it.
- `contacted`: A connected introduction call was recorded and an Engagement row was written in the same transaction.

The SLA measures **calendar hours** after the handover transaction. Holiday/workshift-aware business-hour SLAs are not part of this release. Admin edits only affect future assignments, not previously stored deadlines. A client device clock generates the initial due timestamp, so production users should have accurate device time; high-assurance SLA enforcement would require a trusted server timestamp function.

## Critical deployment dependency: Firestore rules

**The package does not include the project's live deployed Firestore rules.** You MUST inspect and merge [`V2_7_5_12_24_3_HANDOVER_FIRESTORE_SECURITY.md`](./V2_7_5_12_24_3_HANDOVER_FIRESTORE_SECURITY.md) into the actual working rules and test against Firebase Emulator or a test project **before** giving the feature to team members. Merely extracting the ZIP onto localhost cannot grant the required read/update permissions. Never replace your existing rules with the sample guide. No Firebase Cloud Function changes are required by this feature.

## Local manual test checklist

1. Deploy **merged tested Firestore rules**, then launch the project from its normal folder with `npm run dev`.
2. Telecaller logs in to **User → Telecalling**, calls an unassigned contactable agent, records `Connected - Interested`, chooses an active Relationship Executive and saves handover.
3. Verify there is only **one** assignment audit record and the `travelAgents` owner uses the assignee's Firebase Auth UID; note that the corresponding `users` document ID may be different.
4. Employee signs in on another browser. Check the **unread bell** on desktop/mobile, **My Handoffs** tab, and **Action Center** alert. Do **not** test with the Telecaller account impersonating the executive.
5. Employee accepts. New count decreases; row becomes **Accepted**. Telecaller can see acceptance in **Handed over**.
6. Employee records **No answer**. Verify one Engagement row is created and handover stays **Accepted**. Then record **Connected**; verify one additional Engagement row and status **Contacted**.
7. Admin opens **Admin → Telecalling**: view all status totals and overdue rows. Change SLA 4→2 hours, create a new handover, verify only new record has 2-hour deadline.
8. Test overdue without accepting; it should remain open and show on management queue and employee page (refresh/update is once a minute while UI is open).
9. Ensure another employee cannot read or accept the first person's handover; Telecaller cannot update handover status; non-admin cannot change SLA. Verify directly against Firestore rules, not just hidden UI buttons.
10. Test an agent reassigned to a different owner before acceptance: previous recipient cannot accept or mark contacted.
11. Confirm customer-facing WhatsApp introduction is still **manual**, and no internal WhatsApp/email notification is sent without a separate approved provider integration.
12. Recheck quotations, invoices, payment void, Engagement Intelligence, user role editing, and dashboard reporting on the real development environment.

## Tests run locally

- `node --test tests/*.test.mjs`: **84 passed, 0 failed**.
- Global TypeScript parser checked **425 JS/JSX/MJS files**, no syntax errors.
- **Not run:** Next.js production build (dependencies absent in packaged source environment), Firebase Emulator authorization checks, actual Firebase multi-user transactions or browser QA.
- **Not deployed:** Firestore security rules, app build, or production records.

## Known boundaries

- The notification is an **in-app real-time assignment alert**: the user sees it when the CRM is open or next opened. There is no device push, scheduled server background escalation, automatic WhatsApp/Email to the executive, or independently stored `notifications` collection.
- Admin's overdue queue is checked when the page is opened, with updates while it stays open; it does not send background alerts when nobody is logged in.
- A later reassignment done through the regular agent master does not automatically close the old Telecaller handover record. The earlier assignee is blocked from accepting/contacting after ownership changes; manager should reconcile obsolete handovers. Automated supersession can be added separately after confirming reassignment rules.
- Existing standard Engagement forms do not automatically complete this specific handover. The first contact must be recorded via **My Handoffs** to transition the handover to `contacted`.
