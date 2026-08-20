# Dream Trawell CRM V2.7.5 - Simple Role + Team Access

This release supersedes the configurable per-user Allow / Deny / Default / Scope / Expiry model introduced in V2.7.4.

## Simple access rule

1. Every active CRM user automatically gets the standard Team/User workspace.
2. Role controls which Admin modules the user can open.
3. Per-user access overrides, temporary access and configurable data scopes are no longer used by the active access resolver or User Management UI.
4. Existing legacy override fields may remain in old Firestore documents for backward compatibility, but are ignored and cleared when a user profile is saved.

## Admin access by role

- Super Admin: all Admin modules.
- Admin: all normal Admin modules; Role Management itself is reserved for Super Admin.
- Manager: Dashboard, Travel Agents, Engagements, Meetings and Leads Admin modules.
- Operation Executive: Travel Agents, Engagements, Meetings and Leads Admin modules.
- Employee / Sales / Operations Executive: Travel Agents Admin module plus the full Team/User workspace.
- Finance: Dashboard, Leads and Vendors Admin modules, plus finance-related operational permissions.
- Associate / Partner: Team/User workspace only.

## Team/User assignment rules

- Travel Agent: an active Team/User can claim an unassigned Travel Agent using **Assign to Me**.
- Travel Agent reassignment/unassignment to another employee: Manager, Admin or Super Admin only.
- Lead creation: normal Team/User is automatically assigned to self; Manager/Admin/Super Admin can assign another team member.
- Meeting scheduling: normal Team/User is automatically assigned to self; Manager/Admin/Super Admin can assign another team member.

## User Management UI

Edit User and Add User now focus on:
- Basic user information
- Role
- Active status
- Automatic Team/User access summary
- Admin modules included with the selected role

The old individual permission matrix and temporary-access editor are not used.

## Authentication / refresh behavior

- Existing Team Login and Admin Login pages are unchanged.
- The browser-wide shared authentication/profile listener remains in place.
- No repeating 30-second permission timer is used.

## Backend

`functions/index.js` now resolves operational permissions from fixed role defaults and ignores individual access overrides. `updateUserAccess` saves the simplified profile/role model and clears obsolete override fields.

## Validation performed

- Parsed all 350 JS/JSX files with TypeScript's JavaScript/JSX parser (`--noResolve`) successfully.
- `node --check` passed for modified non-JSX access/auth/backend files.
- Team Login and Admin Login page SHA-256 values match the V2.7.4.3 baseline byte-for-byte.
- Full `npm install` / Next production build could not be completed in this environment because dependency installation did not complete.

## Deployment note

Deploy both the updated Next.js application and Firebase Functions. If only the frontend is deployed, the live project can continue using older callable-function access logic.
