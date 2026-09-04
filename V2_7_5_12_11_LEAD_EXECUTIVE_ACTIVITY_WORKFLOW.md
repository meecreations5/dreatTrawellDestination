# V2.7.5.12.11 - Lead Executive Activity Workflow

## Purpose

Make Lead & Operations activity entry simple and auditable from the User Front Lead detail page without duplicate reporting.

## Standard Lead Executive activities

1. Quote Creation
2. Re-Quote
3. Lead Follow-up
4. Vendor Coordination
5. Supplier Coordination
6. Group Coordination
7. Ticket Editing
8. Payment Follow-up
9. Other Operations Activity

## Capture model

- Quote Creation: automatic from quotation editor / quotation events.
- Re-Quote: automatic for quotation revision Rev 2 and above.
- Lead Follow-up: reuses the existing Lead follow-up form and next-follow-up sync.
- Vendor Coordination: structured quick activity form.
- Supplier Coordination: structured quick activity form.
- Group Coordination: structured quick activity form.
- Ticket Editing: structured quick activity form.
- Payment Follow-up: structured quick activity form linked to the Lead/payment context.
- Other Operations Activity: structured generic operations activity form.

## User Front changes

The Lead Activity tab now contains a new `Lead Executive Activities` panel with all 9 activity choices.

The Lead header also includes a `+ Activity` shortcut to return directly to the Activity workspace.

Manual operational activity captures:

- Status: Pending / In Progress / Waiting / Completed
- Priority
- Party type
- Party/company name
- Contact person
- Purpose
- Result
- Waiting reason when Waiting is selected
- Next action
- Due/next-action date and time
- Additional note
- Payment side and amount for Payment Follow-up
- Ticket correction/editing details for Ticket Editing
- Custom activity title for Other Operations Activity

Party/company is required for Vendor Coordination, Supplier Coordination, Group Coordination and Payment Follow-up so Admin can see whom the activity relates to.

## Recent Operational Work

The Lead page now shows recent operational work from both:

- `workTasks` for manual activities and Lead follow-up tasks
- `workActivityEvents` for automatic CRM-captured activity such as Quote Creation and Re-Quote

Manual task events are de-duplicated from the automatic event stream using the task/work-unit identity.

Open manual activities can be moved to:

- In Progress
- Waiting
- Completed

Waiting requires a reason.

## Existing system integration

No new Firestore collection was added.

The workflow extends the existing:

- `workTasks`
- `workActivityEvents`
- Lead timeline
- Action Center
- Productivity Pulse
- Team Engagement Dashboard
- Admin Engagement Dashboard

The manual Lead timeline mirror uses `skipDailyActivity` so the same work is not double-counted after the structured Work Task event is already recorded.

## Dashboard / productivity changes

Added canonical support for:

- `payment_follow_up`
- `other_operations`

Historical `payment_management` activity remains supported.

Lead & Operations dashboard now includes:

- Payment Follow-up
- Other Operations

Payment drill-down includes both new `payment_follow_up` records and historical `payment_management` events.

Productivity Pulse execution mix includes Other Operations, and Next Focus includes Group Coordination, Ticket Editing, Payment Follow-up and Other Operations Activity.

## Admin drill-down detail

Operational drill-down now exposes structured details where available:

- Travel Agent
- Lead
- Destination
- Team member
- Party/company
- Contact person
- Result
- Waiting reason
- Next action
- Payment side / amount
- Activity note

## Compatibility

- Existing Quote / Re-Quote automatic tracking is preserved.
- Existing Lead Follow-up to Engagement sync is preserved.
- Existing quotation, vendor costing and payment workflows are preserved.
- Existing historical task/event types remain readable.
- No data migration is required.
- No Firestore rules file is included or changed in this source build.
