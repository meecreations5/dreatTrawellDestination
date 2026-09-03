# DreamTrawell CRM V2.7.5.12.2 - Daily Activity & Follow-ups

This release extends V2.7.5.12.1 without replacing the existing Engagement, Lead, Quotation, Payment, Travel Agent, SPOC live-sync, role/access, or Productivity Pulse flows.

## Unified Action Center

The existing Action Center is now the single daily follow-up and work queue for team members and managers.

Tracked structured activity types:

### Lead activity
- Quote
- Re-Quote
- Vendor Coordination
- Quote Creation
- Lead Follow-up

### On-ground activity
- Group Coordination
- Supplier Coordination
- Ticket Editing

Exact work statuses:
- Pending
- In Progress
- Waiting
- Completed
- Skipped
- Cancelled
- Overdue is derived from the due time while preserving the exact workflow status.

Team members can start work, mark waiting with a reason, reschedule, complete, and use the existing Lead Follow-up form directly from the queue.

## Lead Follow-up Integration

The existing Lead follow-up flow remains the source of truth.

When a Lead follow-up is logged:
- the matching structured Lead Follow-up task is automatically completed;
- duplicate open Lead Follow-up tasks are cancelled as superseded;
- if another follow-up date is selected, the next structured Lead Follow-up task is automatically created for the current lead assignee;
- the existing Lead -> Engagement sync remains intact, so the performer continues to receive the engagement in their own activity.

Existing open Lead next-action dates are also shown as virtual Lead Follow-up rows until structured task records exist, preserving compatibility with older leads.

## Manager Daily Activity Status

Admin/Manager Action Center now includes a date-wise team status table with:
- Due
- Completed
- Pending
- In Progress
- Waiting
- Overdue Now
- Lead Actions
- On-ground Activities
- Engagements
- Connected Engagements

It supports the existing global team scope and a team-member filter.

## Exact Activity Log

The selected day's activity log combines:
- work-task creation/status/reschedule events;
- tracked Lead timeline activity;
- actual Engagement records.

Each entry includes the time, team member, activity type/group, detail, related Lead/Travel Agent, and exact status.

Lead actions that already use the CRM's `logLeadAction` helper are mirrored into the manager activity stream on a best-effort basis, including existing quotation/revision/vendor/assignment/stage/payment/remark flows that use that helper. This does not block the original Lead action if activity tracking is unavailable.

## Team Dashboard

The Team Dashboard adds a Unified Follow-up Queue summary:
- My Open Work
- Work Due Today
- Work Overdue

Each card opens the Action Center.

## Productivity Pulse

The 15-minute Productivity Pulse now also measures structured work activity so non-call operational work is visible:
- Work Actions
- Work Completed
- Lead Work
- On-ground Work

Existing Engagement metrics and the configurable work/break schedule remain intact.

## New Firestore collections

- `workTasks`
- `workActivityEvents`

The source package does not include deployed Firestore security-rule files. Production Firebase rules must allow the intended team/admin reads and writes for these collections before deployment. The application code uses existing role/team scoping in the UI, but server-side Firestore rules remain the security boundary.

## Compatibility

No data migration is required. Existing Lead next-action dates, Engagement Tasks, Engagement records, and Lead timeline data continue to work. New structured records are additive.
