# Dream Trawell CRM V2.6.5 - Manual WhatsApp Meeting Notifications

## What changed

Meeting notifications now use the workflow requested by the business:

- Email remains automatic through the existing Brevo integration.
- WhatsApp is manual by default.
- After a meeting is scheduled, rescheduled, or cancelled, the CRM shows notification status for both the Travel Agent and the assigned Team Member.
- For each recipient with a WhatsApp/mobile number, the CRM shows an **Open WhatsApp** button.
- Clicking the button opens WhatsApp Web/App with the meeting message already filled in. The user reviews the message and presses **Send** inside WhatsApp.
- Opening WhatsApp is logged as `opened`; the CRM does not incorrectly claim that a manual WhatsApp message was delivered.

## Meeting notification flow

1. Save / reschedule / cancel the meeting.
2. The meeting record is saved first.
3. Email is sent automatically to:
   - the Travel Agent / primary contact, when an email is available;
   - the assigned Team Member, when an email is available.
4. WhatsApp messages are prepared for both recipients when a mobile/WhatsApp number is available.
5. A post-save notification panel shows Email status and WhatsApp actions.
6. The user clicks **Open WhatsApp** for the Travel Agent and/or Team Member.
7. WhatsApp Web/App opens with the message pre-filled.
8. The user presses **Send** in WhatsApp.

## WhatsApp message content

The prepared message includes:

- scheduled / rescheduled / cancelled event label;
- Travel Agent name;
- assigned Team Member;
- meeting type;
- start and end time;
- location or online meeting link;
- agenda;
- cancellation reason where relevant;
- Google Maps directions for in-person meetings when available.

## Logging

`meetingNotificationLogs` can now contain:

- `sent` - automatic Email or Cloud API WhatsApp was sent;
- `prepared` - manual WhatsApp message was prepared;
- `opened` - the user clicked Open WhatsApp;
- `missing_contact` - recipient contact was unavailable;
- `failed` - automatic delivery failed.

For manual WhatsApp, `opened` does **not** mean delivered. The final Send action happens inside WhatsApp and cannot be confirmed by the CRM without WhatsApp Business API delivery webhooks.

## Optional WhatsApp Cloud API

Manual WhatsApp is the default and needs no Meta API configuration.

If automatic WhatsApp is required later, set:

```env
NEXT_PUBLIC_MEETING_WHATSAPP_MODE=cloud
```

and keep the existing WhatsApp Business Cloud API credentials/template configuration from V2.6.4.

If this variable is absent or any value other than `cloud`, meeting WhatsApp notifications use the manual WhatsApp Web/App flow.

## Files changed from V2.6.4

- `components/meetings/MeetingNotificationActionsModal.js` - new post-save Email/WhatsApp action panel.
- `components/meetings/MeetingSchedulerModal.js` - passes meeting notification results to the workspace instead of treating manual WhatsApp as a failure.
- `components/meetings/MeetingsWorkspace.js` - shows notification actions after schedule/reschedule/cancel.
- `lib/meetingNotifications.js` - automatic Email + manual WhatsApp preparation by default; Cloud API remains optional.
- `lib/whatsapp.js` - returns whether the WhatsApp window was opened, allowing popup-block feedback.

## Not changed

- Login / authentication.
- Meeting assignment rules.
- Travel Agent linking.
- Users-table Team Member selection.
- Meeting conflict checking.
- Meeting Firestore schema.
- Leads / quotations / filters.
