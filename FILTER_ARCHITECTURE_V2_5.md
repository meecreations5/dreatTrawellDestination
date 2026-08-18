# DreamTrawell CRM V2.5 - Global Filters and Quotation Workflow

## Goal

V2.5 removes the inconsistent employee/filter logic that had evolved across Leads, Engagements and Travel Agent reporting. Staff choices now come from one canonical Users master, Date + Team form a shared admin reporting scope, and each page keeps only role-specific filters that match the underlying data model.

This version also makes Draft Quotation deletion visible and adds Resend Quote for already-sent quotation revisions.

## 1. Users-only staff directory

Operational staff dropdowns are sourced only from the Firestore `users` collection.

- Leads, Engagements, Travel Agents and Quotations cannot create staff dropdown options.
- Employee filter values use Firebase/Auth UID when available. Legacy Users documents without an Auth UID use a namespaced Users document key (`userdoc:<id>`), never a name/email value.
- Name and email are display/resolution aliases only.
- Duplicate Users documents are merged by UID, email, employee/staff id and Users document aliases.
- A legacy Users row where the name itself is an email is merged with the matching canonical Users row rather than displayed as another employee.
- Name-only legacy rows are merged only when the match is unambiguous and e-mail addresses do not conflict.
- Genuine same-name people remain separate and are disambiguated with email in the label.
- Active users are available in normal operational dropdowns even when they have zero CRM activity.
- Inactive users are retained only for resolving historical ownership/activity; they are not returned to normal active dropdowns.
- Truly unmapped historical CRM identities are not injected into staff selectors.

## 2. User Master - Team / Department

User create/edit now supports `teamName` (Team / Department).

Team values for global filters are derived from active Users master records only. Team is optional for backward compatibility; active users without a team are flagged in User Master Data Health and are available under `Unassigned Team` reporting until corrected.

User Master Data Health now highlights:

- duplicate email groups
- duplicate display-name groups
- Users without an Auth UID
- active Users missing a display name
- active Users missing Team / Department

This is diagnostic only. It does not automatically delete or rewrite Users data.

## 3. Global Admin Reporting Scope

A shared scope appears on the active Admin reporting/listing pages:

- Management Dashboard
- Engagements
- Leads list
- Leads Dashboard
- Travel Agents list
- Travel Agent Dashboard
- Assigned Travel Agents

Global scope contains:

- Date / reporting period
- Team

Default Date scope is `All Time` to preserve existing listing visibility. The available periods are Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month and Custom Date Range.

The scope is persisted in browser localStorage so Date + Team remain selected when navigating between those pages.

### Page-specific meaning

The UI explicitly explains what the same global scope means on each page:

- Engagements: Date = Activity Date; Team = Activity Performer. Acquisition tables use Agent Created By.
- Leads: Date = Lead Created Date; Team = Lead Owner or Current Assignee.
- Assigned Travel Agents: Date = Assignment Date; Team = Current Assignee.
- Travel Agent Dashboard: acquisition uses Agent Created Date / Creator Team; engagement uses Activity Date / Performer Team.
- Travel Agents list: Date = Agent Created Date; Team = Agent Created By.
- Management Dashboard: the selected reporting period applies while Team follows the accountable role shown by each metric.

Date + Team are global because their meaning can be defined consistently at report scope. Person filters remain page-specific because a person has different operational meanings in different modules.

## 4. Lead filters

Admin Lead list/dashboard page-specific filters are:

- Search
- Lead Owner
- Current Assignee
- Stage
- Follow-up status
- Destination

Global Date + Team sit above those controls.

### Lead identity rules

- Lead Owner = lead creator; permanent creator credit.
- Current Assignee = person currently responsible for the lead.
- Global Team includes the lead when either Owner or Current Assignee belongs to the selected team.
- Owner/Assignee options come from Users master only.
- Team selection cascades the available Owner/Assignee choices.

Follow-up options match the current lead fields:

- Due Today
- Overdue
- Upcoming
- No Next Action

Stage options use the CRM's central `LEAD_STAGE_OPTIONS` rather than generic hard-coded stages.

Team-side Leads were also clarified to use Lead Scope (Owned By Me / Assigned to Me / Assigned By Me), real lead stages and the same follow-up concepts.

## 5. Engagement filters

Admin Engagement filters are:

- Search
- Activity Performed By
- Agent Segment
- Channel
- Outcome

Global Date + Team sit above those controls.

`Assigned To` is no longer used as the engagement person concept. Engagement accountability is Activity Performed By.

Agent Segment supports:

- All Agent Segments
- New Agents
- Existing Agents
- Never Contacted
- Contacted
- Invalid / Closed

Standard channels are:

- Call
- WhatsApp
- Email
- Meeting

Legacy channels/outcomes are appended only when they actually exist in current engagement records, so old data remains filterable without inventing new options.

The selected Team is matched to the canonical Activity Performer Users record. Acquisition reporting remains creator-based rather than performer-based.

The team-side Engagement channel set has also been aligned to Call / WhatsApp / Email / Meeting where those filters are used.

## 6. Travel Agent filters

### All Travel Agents

- Search
- Created By
- Agent Status
- Contact Status
- Location
- global Date + Team

Global Team = Agent Created By team. Created By comes from Users master only.

Agent Status uses the centralized operational Travel Agent status list, including Active, Inactive, Invalid Number, Business Shut Down, Not Reachable, Not Interested, Temporarily Closed, Wrong Details, Duplicate, Do Not Contact and Blacklisted.

Contact Status supports:

- Never Contacted
- Contacted Today
- Contacted
- Follow-up Due Today
- Overdue

### Assigned Travel Agents

- Search
- Assigned To
- Assignment Status
- Priority
- Category
- global Date + Team

Here Team = Current Assignee team and Date = Assignment Date. Creator and assignee meanings are not mixed.

### Travel Agent Dashboard

The dashboard does not use one ambiguous Team Member selector for both concepts.

- Acquisition = Agent Creator
- Engagement Activity = Activity Performer

First Call is credited once per new agent to the person who actually made the first call; repeated calls are follow-up/other calls.

## 7. Management Dashboard

Management uses the shared Users directory rather than maintaining another independent Users subscription.

This provides two improvements:

- staff rows use the same canonical UID/name/email resolution as the listing pages
- one shared Users snapshot serves the active admin reporting pages, reducing duplicate Firestore subscriptions

Team/member performance rows are canonicalized before grouping so name/email/UID variants do not create separate performance rows.

## 8. Draft Quotation deletion

Draft deletion is now visible in both places where users work with a saved draft:

- Quotation History / revision card and detail view
- Quotation Editor footer while editing a saved draft

Draft detection is backward-compatible with older unsent quotation records that may not contain the newer `isDraft: true` flag.

Rules:

- Only unsent drafts can be deleted.
- Admin/Super Admin can delete any draft.
- Other users can delete their own draft when creator identity is available.
- Delete is a soft delete (`isDeleted`, `deletedAt`, `deletedBy...`).
- Lead, Travel Agent and previous quotation revisions are not deleted.
- Quotation revision numbers are not renumbered/reused.
- Lead latest quotation/draft pointers are recalculated.
- A quotation timeline/audit entry is written.

## 9. Resend Quote

Sent/final/shared quotation revisions now expose `Resend Quote`.

Rules:

- Drafts cannot use Resend Quote; they must be edited/sent first.
- Resend reuses the existing saved quotation revision/document.
- It does not create a new revision and does not mutate pricing, itinerary or vendor data.
- User selects Email and/or WhatsApp depending on available recipient contact details.
- Email uses the saved itinerary/assets/signature details from the quotation.
- WhatsApp reuses the saved quotation reference/assets/signature data and opens the existing WhatsApp Web send flow.
- Resend count, last resend metadata and communication timeline/audit are updated.

If quotation content/pricing must change, use Create Revision instead of Resend Quote.

## 10. Legacy data / compatibility

No bulk migration of existing Leads, Engagements, Travel Agents or Quotations is required.

Legacy identity strings are resolved against Users master at read/report time. Existing historical records are not rewritten just to support the new filters.

## 11. Login and excluded modules

The Team Login, Admin Login and landing/login-choice page are intentionally unchanged from V2.3.1/V2.4.

Attendance and Leave remain outside the active CRM navigation/dashboard scope as previously requested; historical data/routes are not deleted by this V2.5 work.

## 12. Validation

The complete JS/JSX source tree is syntax-parsed with TypeScript's JSX parser before packaging.

A complete Next.js build/ESLint run could not be completed in this environment because dependency installation did not finish within the available execution window. The partial install is removed before packaging and `node_modules` is not included in the deliverable.
