# V2.7.5.12.23: Firestore security and audit merge checklist

**Do not replace your existing deployed rules with this document.** This repository does not include the current Firestore security rules. The following is a **policy and testing checklist**, not a paste-ready ruleset. Match the real Firebase Auth UID -> `users` document mapping and merge with all existing `leads`, `engagements`, and team permissions. Firestore allows a request if *any* matching `allow` condition is true; a permissive existing rule can bypass an added restrictive rule.

## Required access policies

| Data/path | Admin / Super Admin | Relationship Executive / Lead Executive | Telecaller |
|---|---|---|---|
| `leads/{leadId}` normal stage updates | Existing authorised scope | Existing authorised scope | No new generic edit access |
| Set current-day Deal Won date upon authorised stage conversion | Yes | Yes, for leads authorised to close | No unless previously granted explicit close-won authority |
| Backdate / correct any existing Deal Won date and booking evidence | **Yes, after server validation, evidence and reason** | **No** | **No** |
| Change existing `dealWonExecutiveUid` / closer snapshot | Admin audited correction only | No | No |
| `leads/{leadId}/wonDateAudit/{auditId}` create | **Yes, only with original+new values, actor, timestamp and reason** | No | No |
| Audit update / delete | **No** | **No** | **No** |
| Read won-date audit | Admin and authorised management only | As needed by approved lead scope | No |

### Enforce server-side, not only with a hidden button

- When changing `dealWonDateKey`, `dealWonAt`, `dealWonDateSource`, `bookingConfirmationReference`, `dealWonExecutiveUid`, `dealWonExecutiveName` or conversion metadata, distinguish an authorised *new* same-day conversion from an Admin-audited correction to an already Won lead. Use Firestore `request.resource.data.diff(resource.data).affectedKeys()` restrictions, explicit role checks and timestamp/key validation, or a secured Firebase callable Function with authoritative server role lookup. The supplied client code checks roles/required fields for usability, but cannot substitute for backend authorisation.
- Ensure Admin corrections write both the lead update and immutable audit record atomically; the frontend transaction does this, subject to your actual rules.
- Validate the lead still has a current Won stage, that the selected date is a real day, is not in the future or before creation, and has an actual booking reference and a reason of at least eight characters.
- `lead.stageHistory` and customer-payment history remain intact. Never grant DELETE permissions to the audit collection or enable direct Telecaller edits to invoice/payment or conversion-date fields.
- Maintain existing V2.7.5.12.22 payment void and Telecaller security requirements. This release does not replace those rules.

### Minimum Emulator tests (mandatory before production)

1. Admin valid date correction and audit succeeds; date and audit agree.
2. Executive / Telecaller / unauthenticated user cannot create won-date audit or change a recorded month via direct Firestore SDK calls.
3. Executive is allowed to close an authorised lead today, but cannot set an arbitrary earlier `dealWonDateKey` or tamper with frozen closer identity.
4. Admin cannot delete or rewrite an earlier audit entry.
5. An unauthorised account cannot read lead data outside its allowed team/agent scope.
6. Simultaneous Admin corrections result in a coherent final lead and distinguishable audit history.
7. Existing quotation, payment, invoice, assignment and engagement operations still pass their security tests.

## Deployment note

If the currently deployed rules permit broad writes to lead documents, **do not activate Admin-only date correction in production until those writes are restricted**. Prefer a server-side callable for privileged corrections when the rule set cannot express the required invariants robustly. Keep the new review workflows on a staging Firebase project until all checks pass.
