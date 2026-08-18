# V2.7.4.3 - Role Change + Periodic Refresh Fix

## Problems Investigated

### 1. Super Admin role change could still return `internal`

The Role & Access save path uses the `updateUserAccess` Firebase callable. The frontend previously passed Firestore-backed override objects directly to the callable and promotion to Super Admin could preserve old role overrides. In addition, a generic callable `internal` response provided no useful diagnosis in the UI.

### 2. CRM pages appeared to refresh/reload periodically

`useAuth()` was mounted in many pages, layouts, guards, sidebars and child components. Each hook instance created its own Firebase Auth listener, Firestore profile listener and a 30-second `setInterval` that replaced the user object even when access had not changed. Pages whose effects depended on the user object could then reload their data and show a loading state every timer cycle.

## Fixes

- Reworked `hooks/useAuth.js` into one browser-wide shared auth store while preserving the existing `useAuth()` API.
- Only one Firebase Auth listener and one current-user Firestore profile listener run per browser tab.
- Removed the repeating 30-second permission refresh timer.
- Temporary access now schedules a one-time refresh at the next actual `Access From` / `Access Until` boundary.
- Edit User data loading now depends on the logged-in user's UID rather than the entire changing user object.
- Promotion to `super_admin` now always:
  - forces the user active;
  - clears individual access overrides;
  - uses unrestricted Super Admin role defaults.
- A logged-in Super Admin can still demote a different Super Admin to another role.
- Self role changes remain blocked.
- Non-Super-Admins still cannot assign or modify the Super Admin role.
- Access override timestamps are normalized to ISO strings before calling Firebase Functions.
- Callable errors now show a useful message instead of only `internal` where possible.
- Backend role/access transaction failures now write structured function logs and return a controlled error.
- Existing Team Login and Admin Login page files remain unchanged.

## Deployment Requirement

This fix changes both frontend code and `functions/index.js`.

After installing the Function dependencies, deploy the updated callable as well as the Next.js application. From the project root:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:updateUserAccess
```

Then deploy/restart the updated Next.js frontend using the project's normal deployment process.

If the frontend is deployed without the updated callable, role changes can still hit an older server implementation and fail.

## Validation Performed

- `node --check hooks/useAuth.js` passed.
- `node --check lib/updateUserAccess.js` passed.
- `node --check functions/index.js` passed.
- Repeating-timer scan confirms the Role & Access auth timer is removed. The only remaining `setInterval` in active source is the historical Attendance page clock (`app/(team)/attendance/page.js`), which updates its displayed attendance duration once per minute and is unrelated to CRM page navigation.
- `app/login/page.js` unchanged from V2.7.4.2.
- `app/admin/login/page.js` unchanged from V2.7.4.2.

## Environment Limitation

A full dependency install / Next production build was not completed in the review environment. Run the normal local/CI `npm run lint` and `npm run build` before production deployment.
