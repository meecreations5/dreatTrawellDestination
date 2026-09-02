# V2.7.5.11.8 - Travel Agent / SPOC Live Sync Restore

## Fix
- Restores live Travel Agent master resolution for every linked Lead with a Travel Agent ID, including legacy Leads that pre-date `schemaVersion: 2` / `live_master_v2`.
- Existing Lead screens now reflect corrected Travel Agent/SPOC name, email and mobile immediately after the Travel Agent profile is updated.
- Preserves the Lead's originally selected SPOC by matching name/mobile/email against the current Travel Agent master; current SPOC email/mobile wins, with Generic Contact and legacy fields only as fallback.
- Adds legacy Travel Agent ID lookup when an older Lead stores a business Travel Agent ID instead of the Firestore document ID.
- New quotation, quotation preview/PDF/WhatsApp, quotation history and Resend Quotation now use the current linked Travel Agent contact instead of the stale Lead snapshot.
- Lead owner/current assignee behavior is unchanged.

## Functional code changed
- `lib/leadOwnership.js`
- `hooks/useLeadTravelAgent.js`
- `app/(team)/leads/[leadId]/page.js`
- `app/admin/leads/[leadId]/page.js`
- `components/leads/QuotationEditor.js`
- `components/leads/QuotationHistory.js`
