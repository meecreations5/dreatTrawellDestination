# V2.7.5.12.22 - Firestore Rules MERGE GUIDE (do not replace your current rules)

**Important:** These changes are a security prerequisite, not just an optional UI feature. The codebase shipped without the project’s actual deployed Firestore rules. This is a **reference addendum**: adapt the identity helper to your live Firebase user document mapping, merge with the rules already deployed and test in the Firestore Emulator. Existing broad `allow write` statements can override narrower rules because Firestore grants access if *any* matching rule allows it.

## Role and identity requirements

- Payment void: active Admin or Super Admin only, including when a payment is already linked to an invoice.
- Telecaller: can read contactable unassigned travel agent records, record calls in `engagements`, update *only* telecalling/handover metadata on `travelAgents`, read directory entries for eligible assignees, and create `travelAgentAssignments` audit entries. No other payments, quotations or lead writes.
- Finance can continue existing invoice/payment operations but **cannot** void payments.
- For accurate counters, zero out deleted/voided sums in financial readers; existing verified/paid status filters already ignore `status: "voided"`.
- The current source may maintain user documents by an internal document ID rather than Firebase Authentication UID. Verify the live mapping before using `users/$(request.auth.uid)` in rules. Restrict contactable/assignee data accordingly.

### Example helpers, assuming `users/{auth.uid}` is authoritative

```js
function dtCurrentUserPath() {
  return /databases/$(database)/documents/users/$(request.auth.uid);
}
function dtUserActive() {
  return request.auth != null && exists(dtCurrentUserPath()) &&
    get(dtCurrentUserPath()).data.get('active', false) == true;
}
function dtAdmin() {
  return dtUserActive() && get(dtCurrentUserPath()).data.get('role', '') in ['admin', 'super_admin'];
}
function dtTelecaller() {
  return dtUserActive() && get(dtCurrentUserPath()).data.get('role', '') == 'telecaller';
}
function dtCanCall() {
  return dtAdmin() || dtTelecaller() ||
    (dtUserActive() && get(dtCurrentUserPath()).data.get('role', '') == 'manager');
}
```

### Payment adjustment rules (merge into each existing payment subcollection match)

```js
// Under /leads/{leadId}/customerPayments/{paymentId}
allow update: if dtAdmin() &&
  resource.data.get('status', '') != 'voided' &&
  request.resource.data.status == 'voided' &&
  request.resource.data.get('voided', false) == true &&
  request.resource.data.get('voidReason', '') is string &&
  request.resource.data.get('voidReason', '').size() >= 8 &&
  request.resource.data.diff(resource.data).affectedKeys().hasOnly([
    'statusBeforeVoid','status','voided','voidReason','voidedAt',
    'voidedByUid','voidedByName','voidAuditId','updatedAt',
    'invoiceId','invoiceNumber','allocatedAt','allocatedBy','invoiceAllocatedBeforeVoid'
  ]);
// Repeat for /leads/{leadId}/vendorPayments/{paymentId}.
// Do not allow DELETE on payment records.
```

```js
match /leads/{leadId}/paymentVoidAudit/{auditId} {
  allow read: if dtAdmin();
  allow create: if dtAdmin() && request.resource.data.auditAction == 'payment_voided' &&
    request.resource.data.paymentId is string && request.resource.data.reason is string;
  allow update, delete: if false;
}
```

The existing invoice rules also need to allow `allocatedTotal` and `allocationUpdatedAt` updates for Admin during a void transaction. The v2.7.5.12.21 invoice addendum already contains this metadata allowance. Verify the exact deployed rule path and status restrictions.

### Telecalling (merge into existing matches; example validation logic)

```js
// travelAgents/{agentId} - do not grant unrestricted edit to Telecaller.
allow read: if dtTelecaller();
allow update: if dtCanCall() &&
  resource.data.get('assignedToUid', '') == '' &&
  resource.data.get('accountManagerUid', '') == '' &&
  resource.data.get('assignedTo', '') == '' &&
  resource.data.get('assignedToName', '') == '' &&
  request.resource.data.diff(resource.data).affectedKeys().hasOnly([
    // Telecalling contact event
    'telecallerLastCalledByUid','telecallerLastCalledByName',
    'telecallerLastOutcome','telecallerLastSummary','telecallerLastCallAt',
    'telecallerQualification','telecallerCallCount','telecallerLastConnectedAt',
    'telecallerFollowUpAt','updatedAt',
    // Qualified handover event (verify assignee is active and role-eligible)
    'assignedToUid','accountManagerUid','assignedToName','assignedToEmail',
    'assignedTo','assignedTeam','assignedRole','assignmentStatus',
    'assignmentPriority','assignedAt','assignedByUid','assignedByName',
    'telecallerHandoffAt','telecallerHandoffByUid',
    'telecallerHandoffByName','telecallerHandoffReason','updatedByUid'
  ]) &&
  // Do not let a non-admin caller replace one assignee with another.
  (request.resource.data.get('assignedToUid', '') != resource.data.get('assignedToUid', '')
    ? resource.data.get('telecallerQualification', '') == 'qualified' &&
      request.resource.data.get('assignedToUid', '') != '' &&
      exists(/databases/$(database)/documents/users/$(request.resource.data.assignedToUid)) &&
      get(/databases/$(database)/documents/users/$(request.resource.data.assignedToUid)).data.get('role','') in ['employee','operation_executive'] &&
      get(/databases/$(database)/documents/users/$(request.resource.data.assignedToUid)).data.get('active', false) == true
    : true);
```

```js
// engagements/{engagementId}
allow create: if dtCanCall() && request.resource.data.get('source','') == 'telecalling' &&
  request.resource.data.get('createdByUid','') == request.auth.uid &&
  request.resource.data.get('channel','') == 'call' &&
  request.resource.data.get('agentId','') is string;
// travelAgentAssignments/{assignmentId}
allow create: if dtCanCall() && request.resource.data.get('source','') == 'telecalling' &&
  request.resource.data.get('assignedByUid','') == request.auth.uid;
```

**Additional directory read restriction:** allow the Telecaller to query `users` with `where('role','in',['employee','operation_executive'])` (and only those role-specific directory records). If your rules cannot support this with fine-grained field exposure, expose a separate minimal directory collection or secured callable endpoint instead of granting access to all user records.

**Do not paste this example as-is into a production ruleset** without adapting your identity mapping, testing unauthorised writes, simulating an already-assigned agent, and testing simultaneous handovers. In particular, the example `dtCanCall()` checks a role and should be further tightened with matching `request.auth.uid` in telecaller metadata and `getAfter()` where needed. It is the deployment checklist, not a security certification.
