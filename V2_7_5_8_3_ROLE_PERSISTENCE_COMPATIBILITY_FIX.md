# V2.7.5.8.3 - Role Persistence Compatibility Fix

## Root cause
Older open CRM tabs used client-side role normalization. Because those builds did not know the new `operation_executive` key, they could rewrite it back to `employee` when Firestore pushed the updated user record.

## Fix
- Authentication/login reads no longer write `role`, `isAdmin`, or `isSuperAdmin`. Authorization fields are server-managed only.
- Operation Executive is stored backward-compatibly as `role: employee` plus `accessRole: operation_executive`. Old CRM builds therefore see a valid Employee role and stop rewriting it.
- Current CRM resolves `accessRole` first and still displays/authorizes the user as Operation Executive.
- Team Management list/detail resolve the effective role correctly.
- Firebase Functions use the same effective role model.
- Team queries include Employee so compatibility-stored Operation Executives remain selectable.
- Role model version is `2.7.5.8.3`.

## Deployment
Deploy Firebase Functions and frontend from the same build. After deployment, close/reopen or hard-refresh old CRM tabs once so every active session is on the server-managed role model.
