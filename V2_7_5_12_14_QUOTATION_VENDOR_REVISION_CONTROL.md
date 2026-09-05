# V2.7.5.12.14 - Quotation Vendor Revision Control

## Scope
Improves the quotation workflow when vendor pricing changes after a quotation draft or earlier revision already exists.

## What changed

### Vendor price selection inside Quotation Editor
- Added a dedicated **Vendor Price Selection** panel inside the quotation editor.
- User can refresh all received vendor prices for the Lead.
- Pricing modes supported in the editor:
  - No Cost / Direct
  - Single Vendor
  - Multi Vendor
  - Manual Cost
- Any received vendor price can be selected as the quotation cost base; the vendor quote does not have to be Final just to prepare a customer quotation.
- For single-vendor costing, the selected price can be marked **Final Vendor Price** directly from the quotation editor.
- Multi-vendor selection prevents multiple revisions from the same vendor request and requires a common currency.

### Automatic new quotation revision when vendor cost changes
- If an existing quotation **draft** is being edited and the vendor pricing/cost basis changes, silent auto-save will not overwrite the old draft.
- Explicit **Save Draft** or **Send** creates the next quotation revision automatically.
- The old draft is retained in history and marked `superseded`.
- If vendor pricing has not changed, the existing draft continues to update normally.

Example:
- Draft Rev 1 exists with Vendor A cost INR 50,000.
- User selects Vendor B cost INR 47,500 or changes manual cost.
- Save/Send creates Rev 2.
- Rev 1 remains in Quote History as Superseded.

### Create Revision from a draft
- Quote History now allows **Create Revision** from Draft quotations as well as Sent/Final quotations.
- Nested legacy metadata IDs are cleared so a new revision cannot accidentally reuse/overwrite the source quotation record.

### Mark quotation Final
- Quote History now exposes **Mark Final** for any non-final quotation revision.
- Only one quotation revision can remain Final at a time.
- Marking a new revision Final keeps older revisions in history but removes their Final flag.
- Previous Final sent quotations return to Sent status; unsent previous Finals become Superseded.
- Final commercial fields on the Lead are refreshed from the selected final revision, including customer quote amount and vendor-cost selection details.

### Revision assets preserved
- `createQuotationRevision()` now persists shared quotation assets, asset IDs/titles, asset links, and `sourceQuotationId`.
- Creating a revision no longer drops package PDFs/images/documents that were already attached to the quotation.

## Data model
No new Firestore collection and no migration required.
Existing collections continue to be used:
- `leads/{leadId}/quotations`
- `leads/{leadId}/vendorRequests`
- `leads/{leadId}/vendorRequests/{requestId}/vendorQuotes`

## Existing behavior preserved
- Quote Creation/Re-Quote productivity tracking
- PDF/email/WhatsApp quotation flow
- Customer-safe quotation output (vendor cost remains internal)
- Single/multi/manual vendor costing
- Quote History
- All Team User Front access
- Executive Admin module access
