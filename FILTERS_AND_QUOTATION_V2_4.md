# Dream Trawell CRM V2.4 — Filter Model & Draft Quotation Delete

## 1. Canonical Team Directory

All updated reporting/filter screens now use a shared `lib/teamDirectory.js` source built from the Firestore `users` collection.

Key rules:
- UID is the primary identity when available.
- Email and document ID are aliases for the same user.
- Obvious legacy duplicate user documents are merged safely.
- Name-only legacy activity maps to a current user only when the name is unique.
- Genuine same-name users remain separate and are shown with email in selectors.
- Active users remain visible in team reporting even when they have zero activity.
- Unresolvable historical records are labelled `Legacy / Unmapped` instead of showing Firebase UIDs as names.
- Team is read from `teamName`, `team`, `departmentName`, `department`, or `branch`, including object-style team/department fields.

## 2. Engagement Dashboard Filters

Primary filters are now:
- Search
- Team
- Team Member
- Agent Segment
- Channel
- Outcome
- Activity From Date
- Activity To Date

Semantics:
- Date = engagement/activity date.
- Team Member = person who performed/logged the activity.
- Acquisition views interpret the selected member as the agent creator.
- Team selection cascades the Team Member options.
- Outcome uses the configured Engagement Outcome master and keeps legacy outcomes filterable.
- Agent Segment supports New, Existing, Never Contacted, Contacted, and Invalid / Closed.
- Active filters are visible as removable chips with Clear All.
- The business snapshot now uses the selected period rather than mixing a Last-30-Days filter with Today-only metrics.

## 3. Lead List & Lead Dashboard Filters

Primary filters are now:
- Search (list view)
- Team
- Lead Owner
- Current Assignee
- Stage
- Follow-up
- Lead Created Date / Created From-To

Rules:
- Lead Owner = permanent creator credit.
- Current Assignee = current working responsibility.
- Team selection cascades Owner and Assignee choices.
- Unassigned is available as a dedicated Assignee filter.
- Follow-up values: Due Today, Overdue, Upcoming, No Next Action.
- Stage options come from the real `LEAD_STAGE_OPTIONS` master rather than generic/non-matching stage values.
- Legacy stage values are normalized before filtering.
- Team performance uses the canonical staff directory, separates Owner credit from Assignee workload, and can show active zero-activity members.

## 4. Travel Agent Filters

Primary filters are now:
- Search
- Team
- Created By
- Agent Status
- Contact Status
- Location
- Created Date

Contact Status supports:
- Never Contacted
- Contacted Today
- Contacted
- Follow-up Due Today
- Overdue

The old second assignment-filter strip was removed from the primary Travel Agent list to reduce filter overload. Assignment remains an operational field and action on the record itself.

The list/card view also shows `Added by <team member>` so the Created By filter is auditable visually.

## 5. Team / Member Reporting Cleanup

- Duplicate team member rows caused by UID/email/name variants are consolidated.
- Missing active users with zero records remain visible where team performance is shown.
- Raw Firebase UIDs are no longer used as display names.
- Truly unmapped history is separated as Legacy / Unmapped.
- Travel Agent acquisition invalid-number and business-shut-down counts now use the operational Travel Agent `status` field consistently.

## 6. Draft Quotation Delete

A safe Delete Draft flow is available in Quotation History.

Rules:
- Only unsent Draft quotations can be deleted.
- Admin/Super Admin can delete any draft.
- A team member can delete a draft they created.
- Sent, shared, approved, accepted, or final quotations cannot be deleted through this action.
- Deletion is a soft delete (`isDeleted`, `deletedAt`, `deletedBy...`) rather than a physical Firestore delete.
- Deleted drafts disappear from normal Quotation History.
- Lead and Travel Agent records are not deleted.
- Quotation revision numbers are not renumbered/reused.
- Latest quotation/draft pointers on the Lead are recalculated.
- If the only quotation draft moved a lead to Quote Pending, the previous stage can be restored when the draft is removed.
- A Lead Timeline audit entry is written for the deletion.

## 7. Login Safety

No login/authentication change is part of V2.4.

Verified unchanged against V2.3.1:
- `/app/login/page.js`
- `/app/admin/login/page.js`
- `/app/page.js` landing screen with Team Login and Admin Login buttons

## 8. Validation

- All JavaScript/JSX files were parsed with the TypeScript JSX parser after the changes.
- Result: 0 syntax errors.
- Full `next build` / ESLint was not run because this supplied project copy has no `node_modules` and the environment npm registry is configured as `https:///`.
