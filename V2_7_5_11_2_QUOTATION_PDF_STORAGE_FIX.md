# V2.7.5.11.2 - Quotation PDF Storage Fix

## Fix
- Fixes `createShareableQuotationPdf()` failing with generic Firebase `internal`.
- Quotation PDF upload now sends the Firebase web app's configured Storage bucket to the callable Function.
- The Function validates the bucket belongs to the same Firebase project.
- Adds safe fallback support for both modern `<project>.firebasestorage.app` and legacy `<project>.appspot.com` default bucket names.
- Storage bucket resolution/upload is now inside explicit error handling, so the CRM receives an actionable Storage error instead of bare `internal`.
- Existing Brevo send/delivery flow and quotation email template are unchanged.

## Deployment
1. Deploy `uploadQuotationPdf`: `firebase deploy --only functions:uploadQuotationPdf`
2. Restart/deploy the updated Next.js frontend.
3. Test one quotation with Email + WhatsApp.
