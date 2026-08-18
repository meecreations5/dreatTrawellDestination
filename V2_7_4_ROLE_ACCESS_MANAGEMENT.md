> **Superseded by V2.7.5 Simple Role + Team Access.** The configurable per-user override model documented below is retained only as historical implementation context; the active system now uses automatic Team/User access plus role-based Admin module access.

# V2.7.4 - Role & Access Management

## Scope

This build continues from V2.7.3 and implements the Role + Individual Access Override foundation requested for Dream Trawell CRM.

## Implemented

- Role-default permission templates.
- Per-user `Use Role Default` / `Allow` / `Deny` overrides.
- Temporary access windows with `accessFrom` and `accessUntil`.
- Data scopes: None, Own, Assigned, Own + Assigned, Team, All.
- Role & Access editor in Team Management user profile.
- Access audit history UI.
- `/admin/roles` role-default reference page.
- Admin/team navigation filtering from effective permissions.
- Route/page permission checks for protected CRM areas.
- Direct-record scope helpers for Leads, Travel Agents, Engagements, and Meetings.
- Fine-grained action checks added to key lead, travel-agent, meeting, quotation, vendor, payment, document, destination, communication-template, and settings write paths.
- Commercial visibility permissions for vendor cost and revenue/GP data.
- Firebase callable `updateUserAccess` with server-side validation and audit logging.
- Super Admin safeguards and protection against self-escalation.
- Backward compatibility with legacy role permission fields.
- Real-time user permission refresh in authenticated sessions.

## Important Fix

The previous auth loader regenerated stored user permissions from the role and could overwrite individual access choices. V2.7.4 resolves effective access from role defaults plus active user overrides without replacing the override configuration.

## Login/Auth Boundary

The following login page files are unchanged from the uploaded V2.7.3 baseline:

- `app/login/page.js`
- `app/admin/login/page.js`

Permission-related auth helpers were changed only to resolve authenticated-session access and refresh permissions.

## Validation Performed

- Compared the updated tree against the uploaded V2.7.3 ZIP.
- Confirmed both login pages are byte-for-byte unchanged.
- `node --check` passed for all modified non-JSX permission/auth/service/config/backend JavaScript files, including `functions/index.js`.

## Validation Limitation

A complete dependency install did not finish in the execution environment, so ESLint and `next build` could not be completed here. Run the normal local/CI validation before production deployment:

```bash
npm ci
npm run lint
npm run build
```

## Production Security Note

The uploaded repository does not include Firestore/Storage security rule files. Application-level and callable-function permission checks do not replace restrictive Firebase security rules. Production hardening should enforce the same authorization model in deployed Firestore/Storage rules wherever clients can access Firebase directly.

## V2.7.4.1 - Super Admin Role Change Fix

- Fixed an over-restrictive Super Admin safeguard in Team Management.
- A logged-in Super Admin can now change the role of a different Super Admin to Admin, Manager, Employee, Associate, Partner, or Finance.
- Self role changes remain blocked, so the currently logged-in Super Admin cannot accidentally demote or restrict themselves.
- Non-Super-Admins still cannot modify an existing Super Admin or assign the Super Admin role.
- A user who remains Super Admin must stay active and cannot receive restrictive individual overrides; change the user's role first before reducing access.
- Backend legacy-active handling now treats only `active: false` as inactive, preserving compatibility with older user records where the field is missing.
- Login pages remain unchanged.
