# V2.7.5.10 - Email Deliverability Hardening

## Verified external setup (20 Aug 2026)

Screenshots supplied by the user confirm the active sender is:

- `DreamTrawell Destination <outbound@dreamtrawelldestination.com>`
- Brevo sender: Verified
- Brevo IP type: Shared IP
- DKIM: configured for `dreamtrawelldestination.com`
- DMARC: configured
- Gmail original-message test: SPF PASS, DKIM PASS, DMARC PASS
- Sample Gmail message was accepted/delivered by Gmail in about 1 second

Conclusion: SPF/DKIM/DMARC authentication is working for the tested message. The remaining intermittent issues are primarily recipient filtering/inbox classification, shared-IP/domain reputation, individual recipient suppression/bounces, and the CRM previously not tracking the post-submission delivery lifecycle.

## Code hardening

### Authenticated Brevo transport
- `/api/send-email` now requires a valid Firebase ID token.
- Recipient addresses are normalized and validated.
- CC/BCC are deduplicated and limited.
- Oversized/base64-embedded email images are rejected.
- A plain-text alternative is always submitted to Brevo.
- Brevo `messageId` is returned to the CRM.
- Transactional and engagement sender environment variables are supported separately.

### Operational subject lines
Quotation subject is now concise and operational:

`Quotation | <Destination> | <Lead Ref> | Rev <n>`

Vendor rate request subject:

`Rate Request | <Destination> | <Lead Ref>`

Travel requirement acknowledgement subject was changed from promotional wording to:

`Travel Requirement Update | <Lead Ref>`

### Less promotional HTML for quotations/vendors
- Quotation and vendor messages use a restrained B2B shell instead of a marketing-style hero/gradient layout.
- Quotation/vendor signatures omit social-media icons and duplicate logo artwork.
- Quotation asset CTA buttons are replaced with simple text links.
- Quotation plain-text fallback now preserves readable line breaks.
- Default quotation auto-CC/BCC is off.
- Vendor requests no longer auto-CC the sender.

### Separate engagement routing
General Travel Agent engagement emails are explicitly classified as `engagement`. Transactional quotation/vendor/meeting/lead-operation emails remain `transactional`.

Optional environment variables:

- `BREVO_TRANSACTIONAL_SENDER_EMAIL`
- `BREVO_TRANSACTIONAL_SENDER_NAME`
- `BREVO_ENGAGEMENT_SENDER_EMAIL`
- `BREVO_ENGAGEMENT_SENDER_NAME`

Existing `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` remain fallback values.

### Correct sent/delivery semantics
Quotation creation now uses a pending/sending state until the requested channel is actually accepted.

Email status meanings:

- `accepted` - Brevo accepted the API request; not a delivery confirmation.
- `delivered` - recipient mail server accepted the message.
- `deferred` - recipient server temporarily delayed it.
- `soft_bounce` - temporary delivery failure.
- `hard_bounce` - permanent delivery failure.
- `blocked` - Brevo/recipient policy blocked the message.
- `invalid_email` - invalid/non-existent recipient.
- `spam` - complaint/spam event.
- `submission_failed` - Brevo never accepted the API request.

CRM UI deliberately labels Delivered as `Delivered to mail server` because inbox/Promotions/Spam placement happens after SMTP acceptance.

### Brevo transactional webhook
New Firebase HTTP function:

`brevoEmailWebhook`

The function stores:
- Brevo message ID(s)
- sending IP
- recipient
- subject
- delivery status
- failure reason
- delivered/deferred/bounce/blocked timestamps
- open/click timestamps when enabled
- Brevo preview/mirror link when provided
- complete nested `emailEvents` history

Webhook status is protected against regression (for example, an older `request/accepted` event cannot overwrite `delivered`) and old resend events are retained in history without overwriting the newest send attempt.

## Deployment

1. Set the webhook secret:

```bash
firebase functions:secrets:set BREVO_WEBHOOK_SECRET
```

2. Deploy Functions:

```bash
firebase deploy --only functions
```

3. Deploy/restart the Next.js frontend.

4. In Brevo > Transactional > Webhooks, point a webhook to the deployed `brevoEmailWebhook` URL. Supply the same secret either as:

- query token: `?token=<BREVO_WEBHOOK_SECRET>`, or
- `x-dreamtrawell-webhook-token` header if configuring the webhook programmatically.

Enable at minimum:
- Sent / Request
- Delivered
- Deferred
- Soft Bounce
- Hard Bounce
- Blocked
- Invalid Email
- Error
- Spam

Opened / Clicked are optional diagnostics and should not be treated as perfectly reliable engagement signals.

## Deliverability note

This release improves authentication safety, content characteristics and diagnosis, but no sender can force Gmail to place a message in Primary. Gmail/recipient providers decide Primary vs Promotions vs Spam using reputation, user engagement and message characteristics.

The supplied Brevo screenshot shows Shared IP. For low/irregular B2B volume this is generally appropriate. A dedicated IP should only be considered when sending volume is sufficiently high and consistent to warm and maintain it.
