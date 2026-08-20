# V2.7.5.3 - Lead Edit/Follow-up + Engagement Assign to Me

## Changes

### Team Lead access after hand-off
- A Team/User who created a Lead keeps edit access after the Lead is assigned to another team member.
- Legacy leads where the current user is recorded as the assigner also keep edit access.
- The current assignee continues to have normal edit access.
- Unrelated users do not gain Lead edit access.
- The existing simplified Admin-role access model is unchanged.

### Lead follow-ups
- Follow-up logging now validates `leads.edit` against the Lead before writing.
- Lead creators/current assignees/recorded assigners can add follow-ups according to the Team Lead relationship rules.

### Engagement Detail - Travel Agent assignment
- Added `Assign to Me` for an unassigned linked Travel Agent.
- After assignment, the page shows `Already Assigned • <name>`.
- Reuses the same Travel Agent self-assignment rules used by the Team Travel Agent pages.
- Legacy Travel Agent collection aliases fetched by Engagement Detail are respected during self-assignment.
- Fixed the Engagement Detail page to correctly read `user` and `authLoading` from `useAuth()`.

## Validation
- Parsed 351 JS/JSX files successfully using the TypeScript JSX parser.
- `lib/rolePermissions.js`, `lib/logFollowUp.js`, and `lib/assignTravelAgent.js` passed `node --check`.
- Permission behavior was tested for creator, current assignee, legacy assigner, and unrelated user cases.
- Team Login and Admin Login files are byte-for-byte unchanged from V2.7.5.2.
- Full Next.js build/lint was not run because this packaged source does not contain installed dependencies (`node_modules`).

## Deployment
- Frontend/client code only for this patch.
- No Firebase Functions deployment is required for V2.7.5.3.
