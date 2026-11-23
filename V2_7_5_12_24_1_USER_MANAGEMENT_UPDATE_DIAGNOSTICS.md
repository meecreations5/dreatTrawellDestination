# DreamTrawell CRM V2.7.5.12.24.1: User Update Error Diagnostics Hotfix

## Problem

In the Edit User page, saving a CRM user could fail with the Next.js development console overlay:

    UPDATE USER ERROR: {}

The message originates from `lib/updateUserAccess.js`. It does not tell us whether Firebase rejected the call, the Cloud Function was missing/outdated, the user's login session was invalid, a role permission check failed, or a Firestore database operation failed.

The screen calls Firebase Callable Function `updateUserAccess` in `us-central1`. Running a new Next.js ZIP locally **does not deploy the corresponding Firebase Cloud Function**.

## What changed

1. `lib/updateUserAccess.js` now logs a readable diagnostic string using `console.warn`, avoiding the Next.js error overlay that displayed only `{}`. The Edit User screen continues to display the resulting message in its existing red notification area.
2. Firebase callable error categories are described explicitly: `unauthenticated`, `permission-denied`, `failed-precondition`, `invalid-argument`, `not-found`, `internal`, `unavailable`, `deadline-exceeded`, and `resource-exhausted`.
3. The Cloud Function in `functions/index.js` now logs which stage failed: authenticate actor, validate requested change, load target user, resolve duplicate user profiles, write user/audit transaction, or verify the result. Existing Firebase HttpsErrors retain their original code/message.
4. The existing role model/version check (`2.7.5.8.3`), role permissions, self-elevation restrictions, duplicate-profile synchronization, audit records, and all other CRM modules are left in place.
5. `tests/user-management-errors.test.mjs` adds seven diagnostic regression checks.

**This patch improves diagnosis and deployment consistency; it does not prove or assume the root cause from the browser error alone.** Live Firebase function logs are necessary if the save still fails after deployment.

## Deployment instructions (local Windows project)

From the exact project directory that contains `firebase.json` and `functions/`:

```powershell
cd "D:\TR\DreamTrawell Destination\WebApp\NewCode"
cd functions
npm install
cd ..
firebase use
firebase deploy --only functions:updateUserAccess
npm run dev
```

* `firebase use` must show the **intended CRM Firebase project**. If the wrong project is selected, STOP; select the correct one before deploying.
* The Firebase CLI must be installed and you must be logged in with rights to deploy functions. The app's Firebase settings must point to the same project.
* Deploy **only** `updateUserAccess` for this fix. No Firestore rules change is required by this specific diagnostic patch because the callable uses Firebase Admin SDK and validates roles server-side.
* Avoid manually editing role flags in Firestore to bypass the function.

If a save still fails, reproduce it once, read the exact red message on the **Edit User** page, and inspect:

```powershell
firebase functions:log --only updateUserAccess
```

The log should contain `updateUserAccess failed` with `stage`/`code`/`message` if this version of the function was deployed. Remove personal identifiers before sharing logs.

## Tests and limitations

* `node --check lib/updateUserAccess.js` passed.
* `node --check functions/index.js` passed.
* `npm run test:all` passed: **72/72** tests.
* Not tested against live Firebase, because this development environment does not have the user's authenticated Firebase project access. No CRM user or production record was updated.
* A full `next build` was not run here because dependencies are not installed in the extracted copy. Run `npm install && npm run build` in your development environment before production deployment.
