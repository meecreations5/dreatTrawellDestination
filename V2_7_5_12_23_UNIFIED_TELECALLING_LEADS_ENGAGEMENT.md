# DreamTrawell CRM V2.7.5.12.23 — Unified Telecalling, Leads & Engagement Performance

**Baseline:** V2.7.5.12.22. This release adds reporting, lead-stage confirmation controls and new read-only relationship intelligence. It does **not** replace the quotation, vendor-pricing, invoice, email, customer/vendor payment or Admin payment-void implementations.

## Business reporting rules

1. **Enquiries:** `createdAt` determines Lead Generated month; unchanged when a lead is edited, quoted, paid or closed.
2. **Deal Won:** the **actual verified booking confirmation date** (`dealWonDateKey`, Asia/Kolkata) determines the month. `dealWonAt` is the matching Firestore timestamp. On first normal closure it defaults to today's business date, regardless of when the enquiry was created. Example: enquiry Sep 15, confirmation Oct 8 → Sep enquiry; Oct closure.
3. **Backdated confirmation:** Admin / Super Admin can enter a past date while closing (with mandatory confirmation reference and explanation of at least eight characters) and can amend an already-closed Won lead from the Admin lead-detail panel; a `leads/{id}/wonDateAudit/{id}` record preserves before/after values. The date cannot be in the future or before the CRM lead-creation date.
4. **Quote Sent:** quotation dispatch evidence determines quotation date; finalized drafts or recent unrelated edits must not be treated as a new quotation event. Quote revisions/individual dispatches may still require a separate quote-level report for exact multi-dispatch counts.
5. **Current status:** reopened/failed/cancelled leads are excluded from current Won counts; historical stage records remain in their timeline. A later re-win is a new current closure snapshot, not an immutable accounting-revenue event.
6. **Conversion attribution:** the Relationship Executive assigned when a lead wins is snapshotted as `dealWonExecutiveUid` / `dealWonExecutiveName`. Telecaller assisted wins are separate and must not be added to primary bookings. Older leads without snapshots use existing assignee/owner fallback; manual audit may be needed.
7. **Payment-triggered automatic conversion:** preserved from the working application. It is marked `customer_payment_auto`; since payment date may differ from the genuine booking confirmation date, the new Management Action Queue flags such records for Admin verification and correction. Never treat the payment date as independently verified booking evidence.
8. **Finance:** quotation prices, vendor costs, invoices, receipts and accounting revenue remain separate from Deal Won reporting. No finance schema changes in this release.

## UI changes

- **Lead closure dialog**: confirmation date displayed and auto-set to today; Admin-only past-date correction with reference/reason. Existing closure remark and lost/cancel requirements remain mandatory.
- **Admin Lead Details**: Admin-only `Deal Won reporting date` section for audited corrections after closure.
- **Admin Engagements**: new `Calls → Relationships → Confirmed Business` panel, retaining all pre-existing dashboard sections. Three tabs: unique-agent relationship-cohort funnel, Telecaller vs executive attribution, and actionable management queue. Monthly events (calls, created leads, sent quotes, wins) are distinct from long-run cohort progress. Same blue/cyan/white/slate palette.
- **Admin Leads Dashboard**: selected-period event cards for Deals Won, Quotes Sent and earlier-created leads won this period; original enquiry-created cohort widgets remain and are labelled as such.
- **Team Leads**: the `Deal Won` card now reports wins by actual confirmation date. A separate `Won from Enquiry Cohort` card retains the earlier created-lead-based conversion measure.
- **Agent Activation Report**: stage and event-date calculation uses shared reporting helpers for monthly win consistency.
- **Connection metric**: a generic `completed` call is no longer evidence that someone answered; use `callConnected`, `connectionStatus` or explicit connected outcome. Telecaller saves an explicit connection status.
- **Productivity Pulse**: Admin may enable Telecaller in the eligible-role list; it is not forcibly switched on.

## Source files / implementation

New modules:
- `lib/reporting/leadReportingDates.mjs`
- `lib/reporting/relationshipPerformance.mjs`
- `lib/correctDealWonDate.js`
- `components/admin/leads/AdminWonDateCorrection.js`
- `components/admin/dashboard/engagements/RelationshipPerformancePanel.js`
- `tests/monthly-relationship-reporting.test.mjs`

Modified: `lib/updateLeadStage.js`, `lib/reopenLead.js`, `lib/leadCustomerPayments.js`, `lib/engagementProductivity.js`, `lib/telecallingService.js`, `lib/dashboard/managementDashboardHelpers.js`, `lib/travelAgentActivationReport.js`, `components/leads/LeadStageCloseModal.js`, `components/productivity/EngagementProductivitySettingsPage.js`, Admin and Team lead-detail pages, Team Leads page, Admin Leads Dashboard page, Admin Engagements page, `package.json`.

## Test status

- **50/50** existing + new Node CRM unit tests pass via `npm run test:all`.
- **10 new** event-date, cohort, connection, attribution and pending-review tests included via `npm run test:reporting`.
- All **407 JS, JSX and MJS source files** parsed with TypeScript syntax parser, no syntax errors.
- **Not yet verified:** complete Next.js production build, deployed Firestore security rules, live Firestore transactions/queries, complete browser visual regression, real historical CRM data reconciliation and role E2E tests. The source ZIP is **not a production-certified build**.

## Deployment / acceptance checklist

1. Take a database backup and snapshot the currently running V2.7.5.12.22 source. Use a staging project or Firebase Emulator first; keep existing `.env.local` and credentials out of ZIP/commit.
2. **Mandatory:** review `V2_7_5_12_23_REPORTING_SECURITY_RULES.md`, merge the new `wonDateAudit` collection permissions and explicit protection of sensitive won-date/closer fields with the actual deployed Firestore rules. The source project does not contain your deployed rules. UI role controls alone are NOT security. If your rules cannot reliably validate Admin-only date corrections and same-day non-Admin updates, move them to an authenticated server-side callable function before production.
3. `npm ci`, then `npm run test:all`, `npm run build`; fix build warnings/errors before deployment. Run Firebase Emulator rules tests (Admin, Telecaller, Executive, unauthenticated, attempted role spoofing).
4. In a test booking: create Sep enquiry, send Sep quote, set Deal Won Oct 8. Confirm Sep enquiry + Sep quote + Oct win across Admin Engagement, Admin Leads Dashboard and Team Leads. Open lead detail and confirm the original creation date stays Sep.
5. Test Admin correcting a previously Won October booking to a genuine verified September date; require booking reference/reason, verify `wonDateAudit`, and confirm the win moves from October to September. Verify that an Executive cannot backdate or write audit entries.
6. Test a reopened Won lead, a payment-auto-converted lead requiring verification, and lead reassignment after winning; primary closure credit must remain with original executive.
7. Test Telecaller unanswered vs connected calls, qualified handovers, dashboard attribution, A+/A no-enquiry queue, overdue leads, and Admin-configured Telecaller Productivity Pulse.
8. Regression-test live quote display/currency, vendor costing, PDF, customer/vendor invoices, customer receipts, vendor payments and Admin payment-void (this release does not modify those modules).
9. After acceptance, deploy frontend and any previously required Cloud Functions, keeping existing Firestore and Storage permissions intact; monitor dashboard counts on real records. Roll back to V2.7.5.12.22 if anomalies appear, preserving new additive history fields.

## Legacy data cautions

Legacy won leads may have only `convertedAt`, `closedAt` or stage-history event timestamps; reporting uses credible closure evidence in that order where present. It NEVER silently assigns the enquiry-created date as a won date. Missing evidence is reported in the Management Action Queue. Historical records whose `convertedAt` represents a later administrative update should be individually corrected by Admin using verified booking references; do not bulk-overwrite without reconciliation.

**Known limitations:** The new relationship funnel uses stable agent IDs; it intentionally will not guess identity from a duplicated name. It derives assistance from the current agent handover metadata, so cross-executive historical reassignments prior to the new snapshot fields might need one-time attribution cleanup. The management action queue shows the first 20 items until a full paginated action management interface is developed. Sent quotation counts are per lead's latest documented sent timestamp, not per individual revision/message.
