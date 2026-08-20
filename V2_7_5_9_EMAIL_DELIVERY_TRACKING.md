# V2.7.5.9 - Email Delivery Tracking & False-Sent Fix

## Problem

Quotation and vendor emails previously treated a successful Brevo API submission as if the recipient had received the email. The CRM did not retain the Brevo message ID and had no transactional webhook, so Delivered / Deferred / Bounce / Blocked / Invalid Email events could not be diagnosed.

Vendor requests could also remain marked `sent` even when the email submission failed or the vendor email was missing.

## Changes

### Brevo send response
- `/api/send-email` now returns the Brevo `messageId` explicitly.
- CRM send helpers retain the provider name and message ID.
- A plain-text `textContent` alternative is sent together with the HTML email.
- CRM tracking tags are added for quotation and vendor-request emails.

### Quotation email tracking
Quotation documents now support:
- `emailStatus`
- `emailDeliveryStatus`
- `emailLastEvent`
- `emailLastEventAt`
- `emailProvider`
- `emailProviderMessageId`
- `emailProviderMessageIds`
- `emailRecipient`
- `emailSubject`
- `emailAcceptedAt`
- `emailDeliveredAt`
- bounce / deferred / blocked timestamps
- `emailDeliveryReason`
- `emailError`
- nested `emailEvents` history

If Brevo rejects the email submission, the quotation records `submission_failed` instead of silently looking successful.

### Vendor email tracking
- Vendor request ID is allocated before sending so Brevo tags can point to the exact request document.
- `accepted` means Brevo accepted the request; it no longer means Delivered.
- A vendor request is no longer marked Sent when all requested communication channels fail.
- Failed vendor communication does not advance the Lead to the next vendor/quotation workflow stage.
- Vendor request cards show delivery state and the provider reason.

### Brevo transactional webhook
New Firebase HTTP function:

`brevoEmailWebhook`

Supported important events include:
- request / accepted
- delivered
- deferred
- soft_bounce
- hard_bounce
- blocked
- invalid_email
- error / failed
- spam
- opened / unique_opened / proxy_open
- click / clicked

Every event is saved on the related quotation/vendor request and in an `emailEvents` subcollection.

## Required deployment

1. Create a webhook secret:

```bash
firebase functions:secrets:set BREVO_WEBHOOK_SECRET
```

Use a long random value and keep the same value for the Brevo webhook URL token.

2. Deploy the Functions:

```bash
firebase deploy --only functions
```

3. Deploy/restart the Next.js frontend because `/api/send-email` and the CRM UI were also changed.

4. In Brevo Transactional Webhooks, create a webhook using the deployed function URL and append the same token:

```text
https://<DEPLOYED-BREVO-WEBHOOK-URL>?token=<BREVO_WEBHOOK_SECRET>
```

Enable at minimum these transactional events:
- Sent / Request
- Delivered
- Deferred
- Soft Bounce
- Hard Bounce
- Blocked
- Invalid Email
- Error
- Spam

Opened and Clicked may also be enabled if desired.

## Status meaning in CRM

- `Email accepted` - Brevo accepted the API request. Delivery is not yet confirmed.
- `Email delivered` - Brevo received a delivery event from the recipient mail server.
- `Email deferred` - recipient server temporarily delayed the message.
- `Soft bounce` - temporary delivery failure.
- `Hard bounce` - permanent delivery failure.
- `Email blocked` - message was blocked before delivery.
- `Invalid email` - recipient address was rejected as invalid.
- `Email send failed` - Brevo did not accept the API submission.

## External deliverability requirement

This code makes the failure visible; it cannot repair DNS authentication by itself. SPF, DKIM and DMARC alignment must match the actual domain used in `BREVO_SENDER_EMAIL` inside the deployed environment.
