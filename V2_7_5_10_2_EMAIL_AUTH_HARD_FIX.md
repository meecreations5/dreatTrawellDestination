# V2.7.5.10.2 - Email Auth Hard Fix

## Problem
V2.7.5.10 initially used Firebase Admin ID-token verification on the Next.js server, which failed outside Google Cloud because Application Default Credentials were unavailable. V2.7.5.10.1 replaced that with Identity Toolkit `accounts:lookup`, but that still depends on the Firebase Web API key being usable from the server runtime and adds another provider call before every email.

## Fix
- `/api/send-email` remains authenticated.
- The existing Firebase ID token is verified locally on the Next.js server as an RS256 JWT.
- The signature is checked against Google's official Firebase Secure Token public X.509 certificates.
- Audience, issuer, subject, expiry, issue time and auth time are validated.
- Google certificates are cached using their published `Cache-Control: max-age` value.
- Key rotation is handled by a one-time certificate refresh.
- No Firebase Admin credentials, service-account JSON, Application Default Credentials, or Identity Toolkit API-key lookup is required.
- Brevo sending and the deployed `brevoEmailWebhook` remain unchanged.

## Deployment
Frontend / Next.js deployment only. Firebase Functions do not need to be redeployed for this fix.
