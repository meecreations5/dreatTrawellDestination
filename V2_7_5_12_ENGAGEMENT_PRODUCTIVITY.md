# V2.7.5.12 - Engagement & Productivity Upgrade

This release is an incremental upgrade on V2.7.5.11.8 Travel Agent SPOC Live Sync. Existing quotation, payment, lead ownership, travel-agent/SPOC sync and other CRM modules are intentionally left intact.

## Engagement
- Added canonical `call_connected`, plus Busy and Not Reachable outcomes.
- Added Quick Call Result controls to the active Travel Agent engagement form.
- Separates call connection result from the business outcome (requirement, follow-up, meeting, quote, reconnected, etc.).
- Stores backward-compatible productivity fields: call attempted, connection status, meaningful engagement and business progress stage.
- Corrected successful-connection reporting so Call Not Picked / No Response / Busy / Not Reachable / invalid records do not count as connected.

## Lead Follow-up Sync
- Lead `connected` now mirrors to Engagement as `call_connected` instead of `general_update`.
- The mirrored Engagement remains credited to the team member who performed the Lead follow-up.
- Legacy `not_picked` is normalized to `call_not_picked`.
- Lead follow-up quick times respect the work schedule defaults.

## Productivity Pulse
- Default interval: 15 minutes, configurable from Admin > Settings > Engagement & Productivity.
- Configurable interval, work schedule, self-rating requirement, today summary, next-focus prompt and enabled roles.
- Default work schedule: 10:30 start; lunch 14:00-15:00; evening break 17:30-18:15; work-end remains optional/configurable.
- Break windows are skipped; the final interval before each break is still captured.
- Stores objective interval metrics plus 1-5 self-rating and next focus in `productivityPulses`.
- Metrics: engagements, calls, connected calls, connection rate, unique agents, meaningful engagements and requirements.
- Settings update in real time for logged-in users.
- Pulse is mounted in both Team and Admin layouts, while role settings decide who receives it.

## Dashboards
- Team Dashboard adds business productivity KPIs: engagements, connected calls, connection rate, unique agents touched, meaningful engagements and requirements generated.
- Admin Engagement adds Today's Productivity Pulses table with team pulse/self-rating/activity visibility.
- Existing engagement funnel and dashboard sections remain in place.

## Operation Executive - Destination Access
- Operation Executive receives Destination module access.
- Allowed: view and edit destination content.
- Not allowed by default: create or delete destinations.
- Create/Delete controls are permission-aware in both destination card/list flows.

## Cadence / Work Schedule
- Shared work-schedule helper centralizes 10:30 start and both break windows.
- Automated cadence/follow-up suggestions are aligned away from blocked work windows.

## Deployment note
The supplied repository does not include Firestore security rules. If production Firestore rules are restrictive, ensure authenticated team roles can read `settings/engagementProductivity`, team members can write their own `productivityPulses`, and authorised Admin/management roles can read pulse records.
