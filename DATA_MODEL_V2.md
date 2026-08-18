# DreamTrawell CRM - Lead Ownership & Engagement Model V2

## 1. Simplified lead responsibility model

Every lead now has two different people-related concepts:

- **Lead Owner** - the team member who created the lead. This is permanent creator/conversion credit and does not change when the lead is reassigned.
- **Current Assignee** - the team member currently responsible for follow-up. This can change at any time.

### Reporting rule

- Owner metrics: created/owned leads, won/lost, quotation value, revenue and gross profit credit.
- Assignee metrics: open workload, overdue follow-ups and current action responsibility.

This prevents reassignment from changing historical sales credit.

## 2. Backward compatibility

New leads use:

- `schemaVersion: 2`
- `ownershipModel: creator_owner_v2`
- `ownerUid`, `ownerName`, `ownerEmail`, `ownerRole`
- existing `createdBy*` fields remain written
- existing `assignedTo*` fields remain written

Legacy records are not migrated or rewritten.

The compatibility helper interprets fields differently by schema:

- V2: `ownerUid` is the immutable creator.
- Legacy: creator credit comes from `createdBy*`; legacy `ownerUid` may still be used as an assignee fallback where older screens historically used it that way.

## 3. Travel-agent linkage on new leads

New leads store a stable travel-agent relationship:

- `travelAgentId`
- `agentLinkMode: live_master_v2`
- `agentSnapshot` for audit/fallback
- legacy `agentId`, `agentName`, `travelAgentName`, `agencyName`, `agentCode` are still written

### Why this design

Lead detail pages read the linked `travelAgents/{travelAgentId}` master record for V2 leads. If the travel-agent agency name, contact, SPOC or other master details change later, the lead detail reflects the current master record without rewriting every lead.

Legacy leads continue using their stored snapshot and are therefore unchanged.

List/dashboard screens can keep using lead snapshots where appropriate for speed. This avoids one listener or fan-out write for every lead.

## 4. Travel-agent operational statuses

Supported statuses now include:

- Active
- Inactive
- Invalid Number
- Business Shut Down
- Not Reachable
- Not Interested
- Temporarily Closed
- Wrong Details
- Duplicate
- Do Not Contact
- Blacklisted

Non-contactable statuses cancel pending engagement cadence tasks so the team does not repeatedly call unusable records.

## 5. Engagement productivity definitions

### New Agent Added
A travel-agent master record created by the team member in the selected reporting period. Acquisition credit always follows the creator of the travel-agent master record.

### First Call
A **First Call** is the earliest call engagement linked to a travel-agent record that was created in the selected reporting period. Each new travel agent can contribute **only one First Call**. The credit belongs to the team member who logged that first call.

Repeated calls never increase the First Call count. They are counted under Total Calls / Follow-up or Other Calls instead.

### Acquisition coverage
For the creator of the travel-agent record, the system shows whether each new agent has been called at least once. This produces:

- New Agents Added
- Called
- Pending First Call
- Contact Rate
- Invalid Number
- Business Shut Down

### Activity reporting
For the person performing the work, the system separately shows:

- First Calls
- Follow-up / Other Calls
- Total Calls
- Unique Agents Called
- WhatsApp
- Meetings
- Total Touches
- Last Activity

This separation prevents repeated dialing from inflating new-agent productivity and avoids mixing acquisition ownership with engagement workload.

### Legacy identity handling
Team-member names are resolved through the Users master using UID/email. Records that cannot be resolved are grouped as **Legacy / Unmapped** instead of displaying raw Firebase UIDs or assigning them to a current team member.

## 6. Attendance and Leave simplification

- Login behavior is unchanged from the pre-refactor CRM.
- `/login` and `/admin/login` keep their original separate flows and role behavior.
- Attendance is removed from active CRM navigation, team dashboard actions, management dashboard tabs, and live dashboard subscriptions.
- Leave is removed from active navigation/dashboard presentation.
- Historical Attendance/Leave routes and Firestore data are retained for backward compatibility and audit history; no old records are migrated or deleted.

## 7. Dashboard split

The former 5,000+ line Management Dashboard has been split into:

- `app/admin/dashboard/page.js` - page orchestration, subscriptions, memoized business totals and tab composition.
- `lib/dashboard/managementDashboardHelpers.js` - pure calculations/data normalization.
- `components/admin/dashboard/management/ManagementDashboardUi.js` - reusable dashboard presentation/table/drawer components.

This reduces coupling and makes future extraction into dedicated data hooks/tabs straightforward without changing current business behavior.

## 8. Performance rules used in V2

- No mass migration of legacy lead documents.
- No fan-out updates to all leads when a travel-agent profile changes.
- V2 lead detail uses the stable travel-agent document ID for live master data.
- Existing denormalized lead snapshot fields remain available for fast lists and audit fallback.
- Dashboard calculations are memoized and shared helpers are extracted instead of duplicated.
- Team lead pages query only relevant ownership/assignment fields, including legacy compatibility queries.
