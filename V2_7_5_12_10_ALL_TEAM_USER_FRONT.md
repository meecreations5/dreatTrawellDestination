# V2.7.5.12.10 - All Team User Front

## Purpose
Make the full operational User Front available to every active team user, while keeping Role & Access administration in Admin.

## User Front modules for all active team users
- Dashboard
- Action Center
- Travel Agents
- Engagements
- Meetings
- Leads
- Destinations
- Profile

## Operational access inside Leads
For Leads owned by or assigned to the signed-in user, the User Front continues to provide the existing operational workflow, including:
- Lead details and editing
- Lead follow-up
- Quote creation
- Re-Quote / quotation revisions
- Vendor coordination data used by the Lead/Quotation flow
- Customer/vendor payment recording already available in Lead Payments

## Role behaviour
Roles no longer hide normal User Front modules.

Role/workstream is still used for:
- Engagement vs Lead & Operations KPI attribution
- 15-minute productivity pulse metrics
- Manager reporting and scorecards
- Admin/management workspace access

## Admin boundary
- Role & Access / Team Management remains an Admin control function.
- Normal execution users do not need Admin access for day-to-day CRM work.
- Existing Admin/Manager management reporting is unchanged.

## Scope / security
This release changes module availability, not ownership/accountability rules.
- Personal operational records continue to use existing own/assigned record scope for normal team roles.
- Managers/Admin retain their broader existing scopes.
- Lead creator/owner and current-assignee rules remain unchanged.

## Migration
No Firestore data migration is required.
