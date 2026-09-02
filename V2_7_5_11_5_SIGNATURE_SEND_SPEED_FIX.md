# V2.7.5.11.5 — Signature + Quotation Send Speed Fix

## Signature
- Restores the company logo in email signatures by resolving the same current and legacy Branding Settings logo fields used by the quotation email header.
- Converts legacy relative logo paths to absolute CRM-hosted URLs so email clients can load them.
- Falls back to the hosted DreamTrawell logo only when no usable branding logo is available.
- Keeps company name, team member details, social icons and Branding Settings website data.
- Website text in the signature is clickable again.

## Quotation send performance
- Removes forced Firebase ID-token refreshes before PDF upload and before Brevo send. Firebase callable functions already attach/refresh the current Auth token when required.
- Preloads `html2pdf.js` while the Send confirmation is being reviewed.
- Loads selected team profile, Branding Settings and communication settings in parallel.
- Reuses the already-loaded Branding Settings in PDF generation instead of reading Firestore again.
- Uses native FileReader base64 conversion for the PDF upload payload.
- Reduces PDF image/font wait limits and canvas render scale/quality to a balanced production setting for faster generation and a smaller upload payload.
- Writes quotation-PDF metadata and lead PDF metadata in parallel.
- Writes final quotation status and timeline logging in parallel; lead + quotation final status writes are also parallelized.
- Resend path reuses the already-loaded Branding Settings during PDF generation.

## Files changed from V2.7.5.11.4
1. `components/leads/QuotationEditor.js`
2. `lib/signatureUtils.js`
3. `lib/quotationPdf.js`
4. `lib/quotationPdfShare.js`
5. `lib/sendEmailViaBrevo.js`
6. `lib/resendQuotation.js`
7. `V2_7_5_11_5_SIGNATURE_SEND_SPEED_FIX.md`

## Deployment
Frontend/Next.js update is required. No new Firebase Function was added and no existing Function code was changed in this version.
