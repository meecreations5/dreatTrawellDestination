# Dream Trawell CRM V2.7.5.11.3 - Quotation PDF Render Fix

## Fixes

- Fixed shareable quotation PDFs that could upload successfully but open as blank documents.
- Replaced the `left: -12000px` html2canvas staging element with an isolated same-origin render frame at normal coordinates.
- Waits for quotation images and document fonts before PDF capture.
- Passes explicit render dimensions to html2canvas for long quotation documents.
- Adds a safety check so suspiciously empty PDF output is rejected instead of uploaded/shared.
- Removed the customer-facing PDF footer text:
  `This PDF contains customer-visible quotation details only. Internal vendor cost, GP and margin are excluded.`
- The footer removal applies to both browser-generated/downloaded quotation PDFs and PDFs uploaded for Email/WhatsApp sharing.
- Resending an existing quotation now regenerates the PDF first, so quotations that previously stored a blank PDF link are repaired on resend.
- Quotation commercial/internal fields remain excluded from customer PDFs; only the explanatory internal sentence was removed.

## Deployment

Frontend/Next.js deployment only. The existing V2.7.5.11.2 `uploadQuotationPdf`, `sendBrevoEmail`, and `brevoEmailWebhook` Functions do not need to be redeployed for this patch.
