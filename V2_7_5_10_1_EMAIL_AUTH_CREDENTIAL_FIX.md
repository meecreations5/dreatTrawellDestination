# Dream Trawell CRM V2.7.5.10.1 - Email Auth Credential Fix

## Problem
After V2.7.5.10, sending a quotation/email from the hosted Next.js CRM could fail with:

`Credential implementation provided to initializeApp() ... Could not load the default credentials.`

The V2.7.5.10 `/api/send-email` authentication guard used Firebase Admin `verifyIdToken()`. Firebase Admin automatically works inside Firebase/Google Functions, but the Dream Trawell Next.js website runtime is not guaranteed to have Google Application Default Credentials (ADC).

## Fix
- Removed Firebase Admin / ADC dependency from the website-side email authentication check.
- `/api/send-email` remains authenticated.
- The logged-in Firebase ID token is now validated using Firebase Auth's REST account lookup endpoint and the existing Firebase Web API key.
- No service-account JSON file is required on the website server.
- Firebase Functions, including `brevoEmailWebhook`, continue using Firebase Admin normally.
- Brevo delivery tracking, message IDs, webhook handling, subject/content hardening, and the V2.7.5.8.3 role compatibility model remain unchanged.

## Required environment
The Next.js deployment must already have `NEXT_PUBLIC_FIREBASE_API_KEY` configured (the same key used by the existing Firebase client login). Optional server-only alias: `FIREBASE_WEB_API_KEY`.

## Deployment
- Deploy/restart the Next.js frontend/server using this build.
- The already-deployed `brevoEmailWebhook` does not need to be redeployed for this fix.
