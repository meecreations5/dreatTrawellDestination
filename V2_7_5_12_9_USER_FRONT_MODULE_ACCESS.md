# V2.7.5.12.9 - User Front Module Access

## Purpose
Move day-to-day CRM execution back to the Team/User Front and restore Leads for the Lead & Operations workstream without requiring Admin access.

## User Front role matrix

### Engagement / Relationship Executive
- Dashboard
- Action Center
- Travel Agents
- Engagements
- Meetings
- Destinations
- Profile
- No direct Leads workspace
- Qualified Lead creation from Engagement/Meeting remains available for handover

### Lead & Operations Executive
- Dashboard
- Action Center
- Travel Agents
- Engagements
- Meetings
- Leads
- Destinations
- Profile

## Fixes
- Leads now appear on the User Front for canonical `operation_executive` users.
- Compatibility users stored as `role: employee` + `accessRole: operation_executive` continue to receive the same access.
- Legacy plural `operations_executive` records are now interpreted as Lead & Operations Executive, so older users no longer lose the Leads module.
- Travel Agents is now a first-class User Front navigation module rather than being available only through Engagement navigation.
- Added a User Front Destination Library at `/destination-library` for destination reference without sending execution users into Admin.
- Engagement / Relationship Executive continues to have no direct Leads module.
- Execution roles (`employee`, `operation_executive`) no longer receive Admin workspace module access. Admin/management access remains reserved for control and management roles.
- Mobile User Front navigation can horizontally scroll so the expanded module set remains usable on smaller screens.

## Data / migration
- No Firestore migration required.
- Existing user records using `operations_executive` are handled at runtime and in the Firebase Functions role normalizer.
- Existing Lead ownership/assignee, quotation, payment, Engagement, Action Center, pulse and drill-down logic are unchanged.
