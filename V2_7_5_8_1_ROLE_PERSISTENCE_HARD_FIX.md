# V2.7.5.8.1 - Role Persistence Hard Fix

## Fixed
- Explicit `users.role` is now the master role source. Legacy `isAdmin` / `isSuperAdmin` flags are fallback-only and can no longer overwrite a valid role after refresh.
- `updateUserAccess` now verifies the persisted Firestore role and legacy flags after the transaction.
- Edit User re-reads Firestore from the server after save before showing success.
- Client refuses to use an older deployed `updateUserAccess` function and reports its role-model version.
- Safe duplicate legacy user documents with the same email/UID are synchronized for role/status identity fields. Conflicting non-empty UIDs are not auto-synchronized.

## Deployment
Deploy both frontend and Firebase Functions. The required callable role-model version is `2.7.5.8.1`.
