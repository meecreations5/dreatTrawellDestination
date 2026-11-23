# DreamTrawell CRM V2.7.5.12.21 - Accounts & Invoicing MVP

**Based on source:** V2.7.5.12.20. Does not overwrite vendor costing, existing quotations, payment history, engagement, or multilingual dictation.

## What is included

### Travel Agent invoices (outgoing)
- Admin > Accounts & Invoicing > Travel agent invoices. Linked from Leads > [Lead] > Invoices tab.
- New draft from any linked CRM lead; final issue is blocked unless the live lead stage is `converted` (Closed - Won).
- Travel agent name, GSTIN and address can be copied from Agent Master; finance can correct the billing record before issuing.
- Line items, quantity, unit price, discount, selectable No GST / CGST+SGST / IGST with **zero tax by default**; financial year invoice serial number from `DT/26-27/00001` allocated in Firestore transaction when the invoice is issued.
- Selected invoice currency is independent of vendor currency; explicit INR exchange-rate snapshot for internal accounting. No guessed real-time exchange rates.
- Draft -> Issued -> Void (no hard delete); issued values locked. Number is never reused on void.
- A4 invoice preview, PDF download, browser print, hosted PDF link emailed through the existing authenticated Brevo endpoint, plus manual WhatsApp PDF-link sharing. Actual email delivery depends on Brevo and is not proven by initial provider acceptance.
- Finance-editable legal company name, address, PAN, GSTIN, bank coordinates and default terms. The supplier/buyer details are stored with the invoice as a historical snapshot.

### Vendor invoices (incoming)
- Register original PDF/photo invoice from the vendor (10 MB max), linked to Vendor Master and a lead.
- Exact vendor ID + case-insensitive vendor invoice number de-duplication enforced by deterministic Firestore doc ID and transaction.
- Vendor invoice number/date, due date, line items, tax, INR/foreign currency, INR internal equivalent, uploaded source document.
- Received -> Verified or Disputed; Finance/Accounts can review originals, add dispute reason.
- Vendors are NOT issued invoices by DreamTrawell. The original vendor invoice is retained as the accounting source.

### Payments and role-based access
- No duplicate payment ledgers: the existing `leads/{leadId}/customerPayments` and `/vendorPayments` remain the cash source of truth.
- Verified customer receipts and paid vendor payment entries can be **allocated** to exactly one invoice when the currency matches. Allocation adds `invoiceId` metadata to the existing payment and stores the allocation total in the invoice transaction.
- Invoice balances are displayed from actually linked valid payments; unrelated lead receipts are not automatically deducted (particularly important where one booking has multiple invoices).
- Finance can unlink an existing payment allocation without deleting or changing the original cash record. The existing payment-status actions now block status changes of allocated entries until they are unlinked. Foreign-currency invoice and INR receipt mismatch is intentionally blocked from allocation until a controlled FX settlement adjustment is developed. This avoids silently subtracting unlike amounts.
- Admin/Super Admin/Finance: manage all; Manager: read both; Lead & Operations Executive: read outgoing only; Engagement Executive: no invoice access.

## Data model (new Firestore collections)
- `travelAgentInvoices/{id}` - outgoing invoice snapshots, items, totals, currency, INRequivalent, statuses, issueNumber, PDF link, optional allocations.
- `vendorInvoices/{vendorId__vendorInvoiceNumber}` - received vendor invoice and file metadata, review status, items, original currency, INR value.
- `invoiceSequences/{financialYear}` - atomic financial-year counter.
- `settings/invoicing` - legal entity, invoice and banking settings.
- Invoice allocation metadata added to *existing* payment documents, not new payment entries.
- Firebase Storage `invoices/vendor/{leadId}/{vendorId}/{filename}` and `invoices/outgoing/{leadId}/{agentId}/{filename}`.

## Setup
1. Back up the CRM project; replace source using full ZIP or changed-file ZIP.
2. **Merge and deploy the security rules addendum** `V2_7_5_12_21_INVOICE_MODULE_RULES.md`, adapting the user identity lookup to your current deployed rules. Do not overwrite your restored legacy Firestore rules wholesale.
3. `npm ci && npm run test:crm && npm run test:invoices && npm run build`. The change doesn't require new NPM dependencies.
4. Restart the app or redeploy.
5. Finance login > Accounts & Invoicing > Company & Bank Details. Set the legal invoicing entity, address, GSTIN if registered, bank details; save.
6. On a Closed-Won lead > Invoices tab, open invoicing > create Travel Agent Invoice Draft > select currency and manual confirmed selling amount; inspect every amount; issue > download PDF > email PDF link.
7. For vendors, upload PDF/image, enter invoice number + amount/currency/tax, register > verify. Do not create outgoing invoices on behalf of vendor.
8. From original Lead > Payments tab, record and verify customer receipt / vendor paid entry; return to invoice and allocate matching-currency payment. Check outstanding value.

## Limitations & accounting compliance blockers
- **GST:** Does not choose a GST rate or tax category automatically. HSN/SAC, GSTIN, place of supply, RCM, statutory signature, bill-of-supply vs tax-invoice classification, foreign currency tax reporting and TDS/TCS/GST ITC must be checked by your CA. CGST Rule 46 defines mandatory details.
- **IRN/QR:** No GST IRP e-invoice registration, IRN or signed QR code integration. Entities subject to e-invoicing must complete the required IRP compliance process before using this as a statutory e-invoice. As of this release, India e-invoicing mandates apply to eligible taxpayers with aggregate turnover >= INR 5 crore in any relevant previous FY; check exemptions with CA.
- No credit note, debit note, proforma invoice, GST return export, automated vendor invoice OCR, bill approval routing, payment splitting or partial FX reconciliation yet.
- No full production Next.js build or live Firebase/Brevo/Storage testing in this environment. Verify on localhost / test project before production.
- Firestore Storage public download-token URLs should not be exposed to general users. Outgoing PDFs can be shared only intentionally with the travel agent.

## Source files introduced / changed
- `lib/invoiceCore.mjs` (pure computations, fiscal-year numbering, validation)
- `lib/invoiceService.js` (Firestore transactions, Storage, email and allocation)
- `components/invoices/InvoicePaper.js`
- `components/invoices/LeadInvoicesTab.js`
- `app/admin/invoices/page.js`
- `config/adminSidebar.js`
- `lib/leadCustomerPayments.js` and `lib/leadVendorPayments.js` (allocated payment status safeguard)
- `lib/rolePermissions.js`
- `app/admin/leads/[leadId]/page.js`
- `app/globals.css`
- `tests/invoices.test.mjs`
- `package.json`
- `V2_7_5_12_21_INVOICE_MODULE_RULES.md` (rules deployment instructions)
