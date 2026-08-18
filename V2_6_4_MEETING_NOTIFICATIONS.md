# DreamTrawell CRM V2.6.4 - Meeting Notifications

## Implemented

Meeting notifications now run when a meeting is:

- Scheduled
- Rescheduled
- Cancelled

Recipients:

1. Respective Travel Agent / primary SPOC
2. Assigned Team Member from the Users master

Channels:

- Email through the existing Brevo email route
- WhatsApp through the WhatsApp Business Cloud API template route

Meeting creation/rescheduling/cancellation is not rolled back if a notification fails. The meeting is saved first, and notification failures are logged separately.

## Contact resolution

### Travel Agent
The system resolves the primary contact from the Travel Agent master using the primary SPOC / generic contact / legacy contact fields.

### Team Member
The system resolves the Team Member from the Users master. The shared Team Directory now also carries the user's mobile/WhatsApp number where available.

## Notification audit

Each attempt is written to:

`meetingNotificationLogs`

with:

- meetingId
- eventType
- recipientType
- recipientName
- recipientEmail
- recipientWhatsapp
- channel
- status
- providerMessageId
- error
- createdAt
- createdByUid / createdByName

The meeting also stores a compact `notificationSummary` and `lastNotificationEvent`.

## Required WhatsApp configuration

Add these variables to the deployment environment. Do not commit the real values to source control.

```text
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_GRAPH_API_VERSION=...
WHATSAPP_MEETING_TEMPLATE_NAME=meeting_notification
WHATSAPP_MEETING_TEMPLATE_LANGUAGE=en_US
```

The WhatsApp template must be an approved utility template. The body variables are sent in this order:

1. Recipient name
2. Event label (Meeting Scheduled / Rescheduled / Cancelled)
3. Travel Agent name
4. Meeting date and time
5. Meeting type
6. Assigned Team Member
7. Location / meeting link / phone
8. Agenda or cancellation reason

Suggested template body:

```text
Hello {{1}},

{{2}}.
Travel Agent: {{3}}
Date & Time: {{4}}
Meeting Type: {{5}}
Assigned Team Member: {{6}}
Location / Link: {{7}}
Agenda / Note: {{8}}

Dream Trawell Destinations
```

## Email

Email uses the existing `/api/send-email` Brevo implementation and does not require a new email provider.

## Important

WhatsApp auto-send requires the WhatsApp Business Cloud API configuration above. If it is not configured, the meeting still saves and the user gets a warning that the WhatsApp notification could not be sent.
