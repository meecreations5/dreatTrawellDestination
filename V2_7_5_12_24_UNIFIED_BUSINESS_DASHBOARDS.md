# DreamTrawell CRM V2.7.5.12.24
## Unified Business Intelligence and Dashboard Reconciliation
Release date: 20 November 2026
Source baseline: V2.7.5.12.23

### Approved business contract
- ONE lead = at most ONE active confirmed booking. An enquiry that mentions both Thailand and Malaysia is still counted once. This release does not add structured multi-destination bookings.
- Lead generation is dated by lead.createdAt; quotation activity by actual quotation dispatch date; confirmed business by actual Deal Won confirmation date.
- A September enquiry won in October contributes one lead in September, one Deal Won and its booked INR value in October.
- Sales booked value, expected gross profit, invoices and cash collections are different metrics. Do not substitute one for another.
- Financial dashboards report INR. A quotation or vendor cost in another currency is NOT assumed to be INR, and raw INR and foreign values are never summed together.
- The existing Telecaller can receive assisted closure attribution; the closing executive receives primary business credit. The same booking is not duplicated in company totals.

### Implementation summary
1. Added lib/reporting/businessIntelligence.mjs. The canonical booking summary enforces one active won lead per document ID, Deal Won date periods, explicit INR-only financial verification, reconciled selling/vendor cost and expected gross profit. It returns verified and pending lists plus safe agent/destination/executive groupings. Same-name agents with different IDs are separate.
2. Added a finance snapshot on a normal Deal Won stage update. Only explicit final customer AND vendor INR fields can be marked verified automatically. Legacy, mixed-currency, missing-cost or uncertain values are marked for review rather than reported as zero cost or fabricated INR profit.
3. Added Admin-only client verification workflow at /admin/business-verification. Admin supplies verified INR selling, INR vendor cost, booking reference and mandatory reason. The transaction writes both the booking snapshot and the immutable audit event at leads/{leadId}/confirmedBusinessAudit/{auditId}. The web UI must not be considered a security boundary: deployed Firebase rules must enforce Admin-only changes (see SECURITY document).
4. The existing customer-payment auto-conversion still updates the lead to Converted, but its financial snapshot is provisional and requires verification. Payment receipt alone cannot attest to the actual booking date or final INR economics.
5. Reopened leads clear the current active won financial snapshot; Admin confirmation-date corrections retain the INR values and update the snapshot's effective date consistently.
6. Management Overview and Finance use one confirmed-business panel, booking-level drill-down, coverage/pending indicator and INR-only grouped destination/agent/executive rankings. Team Finance tables now use closing executive attribution, not creation-cohort gross profit.
7. Admin Leads Dashboard separates New Enquiries, Quotes Sent and Deals Won by their respective event dates. Confirmed INR booked value and expected GP match the shared summary; destination value chart excludes unverified amounts.
8. Travel Agent Dashboard uses each won booking's actual confirmation month and verified INR value and GP. Telecaller dashboard shows assisted booked INR separately; executive panel shows primary booked INR and GP. Team lead list gains a scope-limited confirmed business summary.
9. Accounts & Invoicing displays all-time issued Travel Agent invoice and verified Vendor invoice INR totals with outstanding calculations based on invoice currency allocation. This is explicitly NOT monthly cash flow or sales booked value.
10. Finance deliberately suppresses the old mixed-currency cumulative lead balances from the headline monthly cards. Those figures were neither true INR totals nor transaction-date cash flow; the original payment records and Accounts operations remain unchanged.

### Financial snapshot model
A won lead can contain `confirmedBusiness`:
```
{
  version: 1,
  currency: "INR",
  verified: true,
  wonDateKey: "2026-10-08",
  sellingAmountInr: 200000,
  vendorCostInr: 170000,
  grossProfitInr: 30000,
  source: "closing_final_inr_fields" | "admin_verified",
  needsReview: false,
  originalSellingAmount: <original value>,
  originalSellingCurrency: <original ISO currency>,
  originalVendorAmount: <original value>,
  originalVendorCurrency: <original ISO currency>,
  quotationId: <reference>
}
```
Legacy records without such a trustworthy verified snapshot are **not** auto-migrated. Historical verified amount coverage will start low until Finance reviews those bookings in the Admin verification workspace. Their Deal Won counts remain visible while unverified INR amounts do not enter booked value/GP.

### Example test: September enquiry / October booking
- Lead created 15 September 2026; quotation sent in September; actual confirmed date 8 October 2026.
- Combined Thailand + Malaysia enquiry: 1 lead, 1 booking (the existing structured destination remains unchanged).
- Approved selling INR 200,000, vendor cost INR 170,000, expected gross profit INR 30,000.
- September: 1 lead generated; no October booking value in September.
- October: 1 Deal Won, INR 200,000 booked value, INR 170,000 cost, INR 30,000 expected GP.
- November customer receipt: belongs to November payments, does not change October booked business.

### Availability and known limitations
- Existing working quotation creation/sending, original currency values, vendor quote lifecycle, payment allocation and invoicing logic are retained.
- Monthly collected/paid cash and historical outstanding-as-of balances require a separate transaction-date, void-status and multi-currency ledger reconciliation. They are **not** implemented in this release. Do not describe the existing lead-level cumulative balances as monthly cash.
- No genuine revenue-recognition or GST accounting calculations are added; expected GP is commercial selling minus vendor cost on verified comparable amounts.
- The one-structured-destination limitation remains, so a combined Thailand + Malaysia package cannot be automatically split across destination revenue. Its one booking is attributed to the existing selected destination only.
- Booking snapshots are client-written and require the Firebase rules restrictions and audit controls documented separately. Review rules before production, especially if your existing lead update rules are broad.
- Actual live Firebase data was not accessed or changed. No automatic backfill or live migration was run.

### Automated test results
- 65 automated tests passed (`node --test tests/*.test.mjs`), including 15 business-intelligence tests.
- 412 JS/JSX/MJS files parsed with TypeScript's JSX/JS parser without syntax errors.
- Complete Next.js build NOT verified: dependencies are not installed; offline `npm ci` failed with `ENOTCACHED` for `zod-validation-error-4.0.2.tgz`. No network installation was attempted.
- Firebase Emulator authorization, live browser regression and real accounting-data reconciliation remain required before production.

### Local acceptance checklist
1. Merge existing V2.7.5.12.22 and .23 Firebase security requirements plus this release's security addendum. Never replace the deployed full rules with an isolated snippet.
2. Install project dependencies in a network-enabled local environment. Run `npm ci`, `npm run test:all`, `npm run build`, and the existing Firebase Emulator security suite.
3. Test the September-created/October-won example in Management, Admin Leads, Travel Agent, Team and Engagement dashboards; verify one counted booking and identical verified booked INR totals for the same scope.
4. Test a combined Thailand + Malaysia enquiry: one converted booking and one amount, with no extra destination allocation.
5. Test SGD quotation / AED vendor source amounts: initially show Needs INR review, not currency-mislabeled profit. Verify exact approved INR equivalents through Admin; ensure audit record is created.
6. Verify an older won lead without a snapshot appears in Pending INR Review; use `/admin/business-verification` to confirm actual figures and see matching dashboard totals.
7. Test reopen / cancel, Admin date correction, Telecaller assisted vs executive primary attribution, and name collisions for different agents.
8. Test that an auto-conversion triggered by customer payment remains financially pending until booking date and verified INR amounts are confirmed.
9. Compare individual booking drill-down amounts to all dashboard totals; verify no duplicate business value. Check account invoice reporting as separate all-time figures.
10. Test Admin vs non-Admin direct Firestore writes. All non-Admin attempts to alter verified snapshots or create audit entries must fail.
11. Smoke test existing quotations (INR/SGD), PDF/email, vendor payment and Admin void, vendor invoice, GST totals, team role access and call/engagement activity. Keep production data untouched during testing.

### Deployment status
Source implementation and offline tests complete. Production readiness remains conditional on Firebase rules integration, the complete Next.js build and real database/UAT reconciliation. Deploy to staging first; avoid promoting until business balances are signed off.
