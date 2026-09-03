# V2.7.5.12.5 - Lead & Operations Activity Capture Fix

## Problem fixed
Lead & Operations users could perform real CRM work (especially quotation revisions / Re-Quotes) but the 15-minute Productivity Pulse only recognised canonical `workActivityEvents` task types such as `requote_follow_up`. Quotation workflow events were mirrored as generic `lead_quotation` events, so Re-Quote work could exist in the Lead timeline without appearing in the pulse or Lead & Operations dashboard.

## Changes
- Added shared `workActivityClassifier` for actual CRM activity.
- Quotation revision > 1 is classified as **Re-Quote**.
- Initial quotation draft/edit activity is classified as **Quote Creation / Quote Work**.
- Vendor requirement/follow-up/pricing activity is classified as **Vendor Coordination**.
- Customer/vendor payment activity is classified as **Payment / Operations**.
- Existing structured Lead Follow-up, Group Coordination, Supplier Coordination and Ticket Editing task events remain supported.
- Opening Quotation Editor now logs `Quote Creation started` or `Re-Quote started` immediately so work is visible even before save/send.
- Save/share/final quotation events continue the same work unit and are de-duplicated for pulse metrics.
- Pulse can also infer older same-day generic quotation events from their action/title/note (including `Rev 2`, `Rev 3`, etc.).
- Team Dashboard Lead & Operations KPIs now use actual performed activity events, not only manually-created work tasks.
- Admin Action Center exact activity log uses canonical labels such as Re-Quote, Quote Creation, Vendor Coordination and Payment / Operations.
- Admin productivity pulse summary now includes vendor/payment execution mix.
- Added Payment / Operations to the structured work-task type list.

## Unchanged
Engagement workflow, role/module permissions, Lead owner/assignee model, quotations, PDF/email/WhatsApp delivery, payments, vendor payment, Travel Agent/SPOC sync, meetings, destinations, work schedule and pulse interval settings remain intact.

## QA
- Full JS/JSX/TS/TSX syntax parse completed with 0 parse errors.
- Operational classifier tests cover initial quote, Re-Quote, vendor, payment and on-ground activity.
