# V2.7.5.10.3 - Firebase Brevo Send Fix

## Problem
The Next.js `/api/send-email` path could return a non-JSON runtime error. The client then logged `Brevo email error: {}` and replaced the useful error with `Email sending failed`.

## Fix
- Added authenticated Firebase callable `sendBrevoEmail`.
- Email sending no longer depends on the Next.js API route or server-side Firebase token verification.
- Firebase callable authentication supplies `request.auth` directly.
- Only active CRM users can send.
- Brevo API key is stored as Firebase Secret `BREVO_API_KEY`.
- Verified sender defaults to `outbound@dreamtrawelldestination.com` unless Firebase Functions environment overrides it.
- Brevo message ID is returned for delivery webhook tracking.
- Brevo provider errors are surfaced with HTTP status/provider code instead of `{}`.
- Existing `brevoEmailWebhook` remains unchanged.

## Required deployment
1. `firebase functions:secrets:set BREVO_API_KEY`
2. `firebase deploy --only functions:sendBrevoEmail`
3. Deploy/restart the frontend.

The value for `BREVO_API_KEY` must be the same Brevo API key already used by the previous Next.js email route.
