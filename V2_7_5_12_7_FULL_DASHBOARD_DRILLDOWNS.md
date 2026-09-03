# DreamTrawell CRM V2.7.5.12.7 - Full Engagement Dashboard Drill-downs

## Objective
Make the Engagement Dashboard fully auditable from the numbers shown on screen. Managers and team members can click dashboard KPIs/cards/section headers and immediately see the exact records behind the count.

## Key changes

### Call Connected restored as a separate KPI
- `Call Connected` is shown separately from `Agents Connected`.
- `Call Connected` counts every successful connected call record, including repeat connected calls to the same Travel Agent.
- `Agents Connected` remains a unique Travel Agent count.
- Clicking either KPI opens the exact underlying records.

### Travel Agent Name is primary in drill-downs
- Drill-down cards show Travel Agent Name as the main record identity whenever available.
- For Lead & Operations events that only stored a Lead ID, the drawer resolves the linked Lead and Travel Agent master to recover:
  - Travel Agent Name
  - Lead code
  - Destination
  - SPOC/contact where available

### All KPI cards are clickable
Team Engagement Dashboard:
- 34 / 34 `MetricCard` instances have drill-down actions.

Admin Engagement Dashboard:
- 26 / 26 Business KPI cards
- 6 / 6 Priority Action cards
- 23 / 23 Health cards
- 5 / 5 Summary cards
- 4 / 4 Funnel cards
- 4 / 4 Command-header cards
all open exact underlying records.

### Important dashboard areas now drill down
- Engagement Task Queue header -> exact currently visible tasks
- Priority Business Action Center header -> combined priority tasks/leads
- Tasks Due Today -> exact task list
- Overdue Tasks -> exact overdue list
- Payment Pending -> exact Leads
- Hot Leads -> exact Leads
- Revision Pending -> exact Leads
- Active Queries -> exact Leads
- Today's Team Agent Activity -> exact Engagement records
- Agent Portfolio -> exact Travel Agent records
- Agent Data Quality & Cadence Risks -> affected Travel Agent records
- Engagement Health -> exact Engagement records
- Engagement Conversion Funnel -> exact Engagement/Lead records
- Agent Warmth -> exact Travel Agent relationship records
- Outcome Performance -> exact Engagement records
- Asset Performance -> exact asset-sharing Engagement records
- Team Engagement Performance -> exact Engagement records
- Agent Engagement Overview -> exact Engagement records

### Follow-up queue
- Admin `+N more follow-ups` is now a clickable `View all` control opening the full exact follow-up list.
- Team `My Engagement` follow-up card can expand/collapse all follow-ups instead of leaving the remaining count non-actionable.

## Existing functionality retained
- Role-based Engagement vs Lead & Operations workstreams
- Quote / Re-Quote activity capture
- 15-minute productivity pulse
- Lead owner / assignee handover model
- Travel Agent/SPOC sync
- Meetings, destinations, quotations and payments
- Existing filters and Action Center

## QA
- Full project parser: 372 JS/JSX/TS/TSX files, 0 parse errors.
- Changed-file alias import check: 0 missing imports.
- Clickable KPI audit passed for all dashboard metric card components listed above.
