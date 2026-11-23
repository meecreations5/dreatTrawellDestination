# V2.7.5.12.24 Firebase financial snapshot security contract

**This is a policy and merge checklist, NOT a complete deployable Firestore rules file.** The current production Firestore rules were not supplied. Firestore `allow` conditions are OR-ed: appending one new restrictive `allow` statement does NOT override any broader pre-existing `allow write` / `allow update` statement. Merge constraints into ALL applicable existing lead-update routes, or secure the action with a Firebase callable using server-side role checking.

## New protected data
- `leads/{leadId}.confirmedBusiness` contains INR booked selling, vendor cost, expected gross profit and verification provenance.
- `leads/{leadId}.confirmedBusinessVerifiedAt` is a server timestamp recorded on verification.
- `leads/{leadId}/confirmedBusinessAudit/{auditId}` is append-only verification history. It stores before/after, actor, reason, booking reference and server-side timestamp.
- Normal conversion may initialize an INR snapshot only from confirmed explicit-INR final values, and only when the caller has permission to close that lead Won.
- Reopening a converted lead clears the current snapshot, but normal stage history is retained.
- Admin-only verification revises booked INR and writes the audit event atomically; it never changes invoice or payment documents.

## Required rules
1. Look up roles authoritatively from the real `users/{request.auth.uid}` mapping (or existing trusted custom claims). Never trust client-provided `user.role`, display names or request body for privilege.
2. For every `leads/{leadId}` write rule, restrict changes to `confirmedBusiness`, `confirmedBusinessVerifiedAt`, `dealWonDateKey`, `dealWonAt`, `dealWonDateSource`, `dealWonExecutiveUid` and `dealWonExecutiveName`. A regular executive must not arbitrarily edit a verified snapshot or backdate a Win by directly calling the SDK.
3. Permit an authorised ordinary stage conversion to create the first snapshot only under the existing close-won permission and the verified final-INR data precondition; otherwise set verified=false. Do not grant Telecaller general financial write access.
4. Permit updates to already verified booked financial fields only to Admin/Super Admin via a validated operation. Validate currently-Won stage, INR currency, selling > 0, cost >= 0, 2 decimal places, expected GP equals selling minus cost, non-empty booking reference and meaningful reason.
5. Restrict audit create to Admin/Super Admin; actor UID must match the authenticated UID. Require matching lead update and audit write in one atomic operation; enforce immutability: allow update/delete = false. Only authorised management may read audit records.
6. Do NOT allow soft-deleted, cancelled or reopened leads to be re-verified as live Won. Prevent a non-Admin user from marking a snapshot verified by modifying only the map.
7. Where rules cannot enforce the cross-document invariants safely (including verifying a reason/audit exists), implement a secure Firebase callable Function using server-side Admin SDK authorization and transaction checks. Do not rely on the current UI-only Admin gate.
8. Preserve existing payment void, outgoing/vendor invoice, quotation, engagement, Telecaller and role-management rules. Do not replace any old rules with this addendum.

## Emulator acceptance (mandatory)
- Admin creates a verified snapshot and paired audit; records match. Revisions create new audit events without deleting prior entries.
- Non-Admin executive, Telecaller, unauthenticated session and out-of-scope users cannot alter verified INR values or create/delete audit entries, even through direct SDK calls.
- Authorized executive can close an allowed lead; cannot rewrite it afterward without privilege, or set backdated dates directly.
- Cancellation/reopening clears live converted summary correctly while historical actions remain auditable.
- Mixed-currency quote/vendor amounts cannot be marked verified as INR without a documented verified INR equivalent.
- All original quotation, invoice, payment and engagement Firebase permission tests still pass.

## Production warning
No Firebase project or live database was accessed for this release. The security rules have NOT been merged or deployed. Do not activate production finance-verification writes until you have completed the rule merge and Emulator tests. If existing lead update rules are overly broad, use the callable alternative instead of adding a weak extra rule.
