# V2.7.5.8.2 - Canonical User Role Persistence

## Problem
A role could save successfully on one `users` document but appear to revert after refresh/login when the same person had a second legacy user document. The auth loader preferred the UID-linked document even when that duplicate contained an older role/access version.

## Fix
- Role changes now synchronize every `users` document matching the same normalized email or Firebase UID.
- Access version is calculated across the whole identity and incremented once.
- The Cloud Function verifies every matching identity document after the write.
- Team/auth login loaders select the newest access version first, then the newest access timestamp, then the UID match as a final tie-breaker.
- `role` remains authoritative over legacy `isAdmin` / `isSuperAdmin` flags.
- `updateUserAccess` reports role model version `2.7.5.8.2`.
- Functions predeploy now uses `node --check index.js`, preventing the Next.js ESLint configuration from blocking deployment of the updated Cloud Function.

## Deployment
Deploy Firebase Functions and frontend from this same build.
