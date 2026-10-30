# V2.7.5.12.16 - Travel Agent Activity Report

## Added

Admin > Travel Agents > Activity Report.

The report provides Travel Agent-wise and summary counts for:

- Valid Travel Agents
- Agents with activity
- Engagements
- Email engagements
- WhatsApp engagements
- Leads

## Exclusions

- Travel Agents currently marked `invalid_number` are excluded completely.
- Engagement records classified as `not_connected` are excluded from Engagement, Email and WhatsApp counts.
- Not-connected outcomes use the existing Engagement Productivity classifier, including call not picked, no response, busy, not reachable, invalid number, wrong details and equivalent outcomes.

## Filters and export

- All Time
- This Month
- Last 30 Days
- Custom date range
- Search by Travel Agent/code/city/owner
- Optional "Only agents with activity" filter
- CSV download of the currently visible report rows

No Firestore migration or new collection is required.
