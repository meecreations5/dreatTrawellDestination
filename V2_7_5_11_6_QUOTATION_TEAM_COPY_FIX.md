# DreamTrawell CRM V2.7.5.11.6 - Quotation Team Copy Fix

## Problem
Quotation email could be accepted/sent to the Travel Agent while the concerned team member did not receive a copy. The previous behavior depended on `quotationCcSelectedTeamMember`, whose default was changed to false during email deliverability hardening.

## Fix
- Every successful quotation Email dispatch now creates a separate internal quotation copy for the concerned team member.
- The selected quotation signature/team member is preferred as the internal-copy recipient.
- If that profile has no usable email, the logged-in sender email is used as fallback.
- Customer and team copies are separate Brevo messages rather than customer CC/BCC.
- The internal copy uses the same quotation email body and PDF link.
- Internal-copy messages deliberately omit `lead_` and `quotation_` tracking tags so their webhook events cannot overwrite Travel Agent/customer delivery status.
- Internal-copy accepted/failed state, recipient, message ID and failure reason are stored on the quotation record.
- New quotation send starts the internal copy immediately after Brevo accepts the customer email and lets it run in parallel with WhatsApp/Firestore completion to minimize extra wait.
- Resend Quotation uses the same internal-copy rule.
- If the team copy fails during a new quotation send, the customer send is not rolled back; the user receives a partial-notification warning.

## Files changed / added
- `components/leads/QuotationEditor.js`
- `lib/resendQuotation.js`
- `lib/quotationInternalCopy.js` (new)
- `V2_7_5_11_6_QUOTATION_TEAM_COPY_FIX.md`

## Deployment
Frontend only. No Firebase Function redeployment is required because the existing authenticated `sendBrevoEmail` callable is reused.
