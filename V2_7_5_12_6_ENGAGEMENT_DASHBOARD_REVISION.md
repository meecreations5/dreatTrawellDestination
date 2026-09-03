# V2.7.5.12.6 - Engagement Dashboard Revision

## Purpose
Reflect Lead & Operations execution activity directly inside the Engagement Dashboard, using the same canonical activity feed already used by the 15-minute Productivity Pulse.

## Team Engagement Dashboard
For `operation_executive` / Lead & Operations users, the Engagement Dashboard now becomes a role-aware Lead & Operations dashboard while retaining permitted Engagement visibility.

New execution KPIs:
- Work Actions
- Quote Work
- Re-Quote
- Lead Follow-up
- Vendor Coordination
- Supplier Coordination
- Group Coordination
- Ticket Editing
- Payment / Operations
- Completed Work

The top dashboard header is also role-aware for Lead & Operations users and surfaces Work Actions and Re-Quote instead of only relationship-call metrics.

## Admin Engagement Dashboard
Added a dedicated **Lead & Operations Activity** section using the selected Date, Team, Performer and Search filters.

Each execution KPI is clickable. Clicking opens a right-side detail panel showing the exact underlying records including:
- Performer
- Activity type/status
- Lead / Lead code
- Travel Agent
- Destination
- Vendor / supplier / counterparty when available
- Activity date/time
- Note / activity detail
- Direct link to the related Lead

## Re-Quote behaviour
Re-Quote is classified from the real quotation workflow. Revision 2 and above is treated as Re-Quote activity.

Multiple events for the same work unit (for example Re-Quote started, saved and sent) are de-duplicated in KPI/drill-down counts so one Re-Quote does not appear as multiple jobs.

## Data model
No new Firestore collections and no migration are introduced in this revision.

The dashboard reads the existing:
- `engagements`
- `leads`
- `engagementTasks`
- `workActivityEvents`

## Compatibility
Engagement / Relationship Executive workflow remains relationship and qualified-lead-generation focused.

Lead & Operations activity capture from V2.7.5.12.5 remains the source of truth for Quote/Re-Quote and other operational work.
