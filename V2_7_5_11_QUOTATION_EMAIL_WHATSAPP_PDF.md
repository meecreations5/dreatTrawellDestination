# V2.7.5.11 - Quotation Email + WhatsApp PDF Share

## Quotation email design
- Quotation email now uses the same DreamTrawell branded shell/design system as the Travel Agent Lead acknowledgement email.
- Restores consistent logo header, blue hero, red accent strip, quotation reference card, quotation/itinerary card and team signature.
- Keeps the concise quotation subject format: `Quotation | Destination | Lead ID | Rev X`.

## Shareable quotation PDF
- Adds real browser-generated PDF creation using `html2pdf.js`.
- Uploads the customer-safe PDF through authenticated Firebase callable `uploadQuotationPdf`.
- Stores `pdfUrl`, `quotationPdfUrl`, `pdfStoragePath`, `pdfStatus` and `pdfGeneratedAt` on the quotation.
- Stores the latest quotation PDF URL on the Lead.
- PDF excludes internal vendor cost, GP and margin, matching the existing customer PDF rules.
- If PDF generation/upload fails, quotation is returned to Draft and Email/WhatsApp is not dispatched.

## Email + WhatsApp
- Email and WhatsApp are both ON by default when both contact details exist.
- The same PDF link is included in quotation email and WhatsApp message.
- WhatsApp also tells the Travel Agent that an email copy was sent when email succeeds.
- WhatsApp tab is pre-opened from the user click to reduce popup blocking after async PDF/email work.
- Email and WhatsApp dispatch are independent: email failure does not stop WhatsApp from being prepared, and vice versa.

## Important WhatsApp behavior
- Current CRM uses WhatsApp Web (`wa.me`). It prepares/opens the message with the PDF link; the team member must press Send in WhatsApp.
- Automatic WhatsApp delivery requires WhatsApp Business Cloud API integration and is not claimed in this build.

## Deployment
1. Run `npm install` because `html2pdf.js` is a new frontend dependency.
2. Deploy Firebase Function `uploadQuotationPdf` (or deploy all Functions).
3. Deploy/restart the frontend.
