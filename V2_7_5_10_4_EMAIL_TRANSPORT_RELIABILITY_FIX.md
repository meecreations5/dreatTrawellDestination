# V2.7.5.10.4 - Email Transport Reliability Fix

## Problem
Lead notification and quotation emails both use the same Firebase callable transport. Legacy CRM user records can have a valid login email but a missing/stale `users.uid`. The callable previously required an exact UID match, so it could reject a valid logged-in CRM user before Brevo was called. Manual lead creation then swallowed that notification error, making the lead look successful while no email was sent.

## Fix
- `sendBrevoEmail` user resolution now uses UID first and safely falls back to the verified Firebase Auth email / legacy email fields.
- When a legacy profile is found by verified login email, the backend repairs its Firebase UID link for future sends.
- Lead notification channels are independent; one recipient failure no longer prevents the other recipient from being attempted.
- Assigned-team email is attempted independently from the Travel Agent acknowledgement.
- Lead notification result (accepted/failed, recipient, Brevo message ID, exact error) is saved on the Lead as `notificationDelivery`.
- Lead-from-engagement uses the same reliable notification flow and passes the actual creator/assignee context.
- Travel Agent lead email copy/subject is more operational and less promotional.
- Callable returns `transportVersion: 2.7.5.10.4` for live deployment verification.

## Deployment
Deploy Firebase Functions and frontend from this same build:

`firebase deploy --only functions:sendBrevoEmail`

Then deploy/restart the Next.js frontend and sign out/in once.

`BREVO_API_KEY` and `BREVO_WEBHOOK_SECRET` must already exist as Firebase Functions secrets.
