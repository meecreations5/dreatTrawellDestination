# V2.6.9 - Engagement Outcome -> Travel Agent Status Sync

This update keeps the Travel Agent master status synchronized with permanent engagement outcomes.

## Permanent outcome synchronization

When a new engagement is saved with one of the permanent outcomes below, the linked `travelAgents/{travelAgentId}` document is updated automatically:

- `Invalid Number` -> `invalid_number`
- `Business Shut Down / Not in Business` -> `business_shut_down`
- `Wrong Details` -> `wrong_details`
- `Do Not Contact` -> `do_not_contact`
- `Not Interested` -> `not_interested` (existing permanent-outcome behaviour retained)
- `Blacklisted` aliases are also supported by the central mapper.

Legacy/synonym values such as `wrong number`, `business closed`, `not in business`, and `no longer in business` normalize to the same canonical master status.

## Follow-up protection

For a permanent/non-contactable outcome the CRM now also:

- clears `nextEngagementAt`;
- clears `nextEngagementTaskId`;
- disables the active new-agent sequence;
- cancels open `engagementTasks` for that Travel Agent;
- records the source engagement ID, outcome, user UID/name/email and update timestamp on the Travel Agent master.

This prevents an Invalid Number or closed business from returning to the automatic follow-up queue.

## Engagement form behaviour

When a permanent outcome is selected:

- the form shows a clear warning that the Travel Agent master status will change;
- any already-selected follow-up time is cleared;
- follow-up scheduling/assignment controls are hidden;
- after save, the user sees confirmation that the Travel Agent status was synchronized.

Temporary outcomes such as No Response, Call Not Picked, Follow-up Required, Meeting Scheduled, etc. do **not** change the Travel Agent master status.

## Backward compatibility

- No existing Travel Agent or Engagement records are migrated or rewritten.
- The behavior applies when an engagement is saved after this update.
- Existing manual Travel Agent status controls continue to work as before.
- Login/authentication, Lead ownership, Meeting and Quotation flows are unchanged.
