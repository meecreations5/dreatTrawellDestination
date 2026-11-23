# DreamTrawell CRM — Firestore Security Merge Checklist for Handover Notifications

**Do not deploy this as a complete rules file.** The checked-in CRM source has no authoritative `firestore.rules`. Merge the intent below with the **currently deployed** project rules after examining your Firebase Auth UID ↔ `users` document ID mapping and any existing overlapping `allow` clauses. A broad existing `allow write` defeats restrictive rules because Firestore permissions are additive.

## Required collection access

| Path | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `travelAgentAssignments/{id}` | Assignee (matching `request.auth.uid`), original Telecaller (matching `assignedByUid`), or authorised Manager/Admin | Existing permitted Telecaller handover creation with selected target validated | Only the assignee can mark `accepted` or record a valid first-contact attempt; managers may separately audit | Nobody should delete handover audit |
| `travelAgents/{agentId}` | Keep existing role-appropriate restrictions | Unchanged | Telecaller may assign eligible unassigned agent; original assignee must still own agent when accepting/contacting; no generic reassignment privilege for Telecaller | Unchanged |
| `engagements/{engagementId}` | Existing scoped Engagement read | New `source = telecalling_handoff_first_contact` by authenticated assigned executive | Existing restrictions | Existing restrictions |
| `settings/telecallingHandoffs` | Active Telecaller/Executive/Manager/Admin | Admin/Super Admin only | Admin/Super Admin only; 1–48 hour SLA | Deny or Admin-controlled per policy |

### Suggested validation constraints for `travelAgentAssignments`

Adapt your helper functions to the **real deployed rules**. Do not assume `users/{request.auth.uid}` exists for every user. The application may store the canonical user under a different Firestore document ID with its `uid` field set to the Firebase Auth UID.

```javascript
// Add conditions to your existing match /travelAgentAssignments/{assignmentId}.
// Below is a LOGIC GUIDE, not a replacement ruleset.
//
// READ: signedIn && (
//   resource.data.assignedToUid == request.auth.uid ||
//   resource.data.assignedByUid == request.auth.uid ||
//   canManageHandoffs() // Manager/Admin from your deployed identity helper
// )
//
// CREATE: dtCanCall() && request.resource.data.source == 'telecalling'
//  && request.resource.data.handoffType == 'telecalling_handoff'
//  && request.resource.data.handoffStatus == 'assigned'
//  && request.resource.data.assignedByUid == request.auth.uid
//  && request.resource.data.firstContactHours is int
//  && request.resource.data.firstContactHours >= 1
//  && request.resource.data.firstContactHours <= 48
//  && request.resource.data.assignedToUid is string
//  && request.resource.data.assignedToUserDocId is string
//  // validate target via users/{assignedToUserDocId}.uid == assignedToUid
//  // AND require getAfter(travelAgents/{agentId}).assignedToUid == assignedToUid
//
// UPDATE: signedIn && resource.data.assignedToUid == request.auth.uid
//   && resource.data.handoffType == 'telecalling_handoff'
//   && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
//      'handoffStatus', 'acceptedAt', 'acceptedByUid', 'acceptedByName',
//      'lastContactAttemptAt', 'lastContactAttemptOutcome',
//      'contactAttemptCount', 'firstContactAt',
//      'firstContactEngagementId', 'firstContactByUid'
//   ])
//   && (
//     // assigned -> accepted: only accepted* fields + status, accepter==auth UID
//     // accepted -> accepted: record 'busy' / 'no_answer' attempt, count +1;
//     // accepted -> contacted: require connected event and an Engagement
//     //                    written in same transaction as the status update.
//   )
//
// DELETE: false
```

**Use Firestore Rules `getAfter()`** in the update checks where appropriate to ensure the first-contact Engagement row exists in the same transaction, has matching `agentId`, `handoffId`, `createdByUid`, and `callConnected`, and that it cannot be reused across unrelated handovers. The above examples intentionally omit project-specific identity helpers and are **not production-ready**.

### Required indexes / query assumptions

- Executive and Bell subscribe with `where('assignedToUid', '==', auth.uid)` (equality-only, no composite index).
- Telecaller sees their own handover status with `where('assignedByUid', '==', auth.uid)` (equality-only).
- Manager/Admin monitor reads `where('source', '==', 'telecalling')`; permit this scoped query through the Admin/Manager rule.
- The read rule for the assignee should be broad enough to support the `assignedToUid` query **without client-side permission filtering of `handoffType`**. The UI filters legacy assignment rows after reading; Firestore evaluates rules against every potential query result.

### Settings rules

Grant authenticated active Telecaller/Executive/Manager/Admin `get()` on `settings/telecallingHandoffs`. Only Admin/Super Admin should create/update, and validate:
- Only `firstContactHours`, `updatedByUid`, and `updatedAt` are affected.
- `firstContactHours` is an integer between 1 and 48.
- `updatedByUid == request.auth.uid` and the timestamp is server-supplied (`request.time`).

A missing settings read permission triggers a 4-hour fallback in the UI; this must not be mistaken for a successful custom-SLA deployment.

### Security acceptance cases

1. Telecaller can create a qualified handover to an active eligible executive, not an admin/finance/disabled user.
2. Telecaller cannot change assignment `handoffStatus` or read another Telecaller's unrelated assignments.
3. Assigned executive can query only their own assignment rows; cannot change `assignedToUid`, history, date, due date, or contact details.
4. Another executive cannot accept or record first contact, even with the record ID.
5. Manager can view all handovers/overdue counts but cannot arbitrarily backdate an acceptance.
6. Only Admin/Super Admin can change the SLA setting.
7. Existing quotation, vendor, payment, invoices and Deal Won permissions still pass regressions.

**No Firebase Cloud Function deployment is required for these client/Firestore changes.** Do not confuse this with the previous independent `updateUserAccess` Cloud Function diagnostics hotfix.
