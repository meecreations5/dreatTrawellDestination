# V2.7.5.4 - Lead Owner Assignment Fix

## Issue
A normal Team/User who permanently owned/created a Lead could open and edit that Lead, but the Assign Lead action still showed:

`You do not have permission to assign this lead.`

The cause was that generic `leads.assign` remains disabled for normal Team/User roles, so the record-level owner relationship was never evaluated.

## Fix
- Permanent Lead Owner/creator can assign or reassign their own Lead from the Team/User Lead Detail page.
- This remains true after the Lead is handed off to another current assignee.
- Generic `leads.assign` remains disabled for normal Team/User roles, so they cannot assign arbitrary unrelated Leads.
- Being only the current assignee does not automatically give arbitrary reassignment rights.
- Manager/Admin/Super Admin assignment behavior remains unchanged.
- Lead Owner is never overwritten when Current Assignee changes.

## Validation
Validated the access helper directly:
- own Lead: assign allowed
- assigned-only Lead: assign denied for normal Team/User
- unrelated Lead: assign denied
- own Lead edit: allowed

Modified file: `lib/rolePermissions.js`.
