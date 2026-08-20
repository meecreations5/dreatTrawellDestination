# V2.7.5.8 - Operation Executive Role Persist Fix

## Issue
Selecting **Operation Executive** in Team Management could show a successful save, but after refresh the user returned to the previous/Employee role.

## Root cause
The new `operation_executive` role was added in V2.7.5.6. Older deployed versions of the `updateUserAccess` Firebase callable (including V2.7.5.5) do not recognize that key and normalize it to `employee`. The old callable still returns success, which caused a false success message in the frontend.

## Fix
- Latest `functions/index.js` recognizes and persists `operation_executive`.
- `updateUserAccess` now verifies the role returned by the server matches the requested role.
- If an outdated callable changes `operation_executive` to `employee`, the UI now shows a clear deployment error instead of a false success.
- Callable response includes `roleModelVersion: 2.7.5.8` for easier future diagnostics.

## Deployment requirement
This fix requires deployment of the updated Firebase Function as well as the frontend.

```bash
firebase deploy --only functions:updateUserAccess
```

If user creation with the new role is used, deploy the complete functions bundle so `createUser` is also current.
