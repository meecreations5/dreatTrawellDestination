# DreamTrawell CRM V2.7.5.11.4 - Quotation PDF Header Layout Fix

## Fixed
- Corrected the malformed/raw quotation PDF header seen in generated/shareable PDFs.
- Added render-critical inline styles to the PDF company header, logo, quotation reference, prepared date and Prepared For card.
- Prevents html2canvas/html2pdf from losing outer header CSS when rendering the quotation from the isolated iframe.
- Constrains the branding logo to the intended 54x54 size, eliminating the large blank area caused by the logo's natural dimensions.
- Adds same-origin `/logo.png` fallback if a configured branding logo cannot load during PDF capture.
- Keeps the existing customer quotation body, pricing, terms, email template, Brevo delivery tracking and WhatsApp/PDF-link flow unchanged.
- Applies to both Generate/Download PDF and the shareable PDF uploaded for Email/WhatsApp.

## Deployment
Frontend/Next.js only. No Firebase Function redeployment is required for this change.
