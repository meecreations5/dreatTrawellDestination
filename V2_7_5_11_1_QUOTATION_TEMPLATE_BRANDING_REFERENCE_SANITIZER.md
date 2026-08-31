# DreamTrawell CRM V2.7.5.11.1

## Quotation Email Template + Branding Signature + Client Reference Sanitizer

### 1. Restored earlier quotation emailer design
- Restored the quotation subject body presentation to the earlier DreamTrawell quotation email layout shown by the business team.
- Restored hero title: **Your Travel Quotation Is Ready**.
- Keeps Branding Settings logo and tagline in the header.
- Restored the two-column Quotation Ref / Destination summary.
- Restored the bordered **Quotation Details** section containing the full structured quotation.
- Keeps the shareable quotation PDF link without replacing the established emailer design.
- The same restored design is used for quotation preview, first send and resend.

### 2. Branding-driven quotation signature restored
- Quotation signatures again use the full shared signature builder.
- Company logo, company name, website and social links are taken from `settings/branding`.
- Selected team member name/designation/email/mobile continue to come from the selected team member profile.
- Removed the recent quotation-only suppression of signature logo/social icons.

### 3. Microsoft Word / Outlook clipboard garbage removed
- Added shared `lib/richTextSanitizer.js`.
- Removes Word/Outlook clipboard metadata such as:
  - `Normal 0 false false false EN-IN X-NONE X-NONE`
  - equivalent EN-US / locale variants
  - Office XML/style/comment metadata
- Sanitization is applied during paste, lead creation, lead-from-engagement creation, timeline logging and notification generation.
- Existing affected timeline/client-reference records are also cleaned at display time where possible.

### 4. WhatsApp reference cleanup
- Lead acknowledgement WhatsApp now uses sanitized Client Reference text.
- Word/Outlook metadata will no longer be included in the `Reference Shared` block.
- Quotation WhatsApp continues to include the customer quotation PDF link.
- Quotation email + WhatsApp remain enabled together by default when both recipient details are available.

### 5. Quotation resend consistency
- Resent quotation email now uses the same restored quotation email template.
- Resend signature is rehydrated with current Branding Settings.
- Resent WhatsApp includes the saved customer quotation PDF link when available.

## Modified / Added Files
- `app/(team)/leads/create/page.js`
- `components/engagement/CreateLeadModal.js`
- `components/leads/ActivityViewerModal.js`
- `components/leads/AssignLeadModal.js`
- `components/leads/ClientReferenceCard.js`
- `components/leads/LeadTimeline.js`
- `components/leads/QuotationEditor.js`
- `lib/createLeadFromEngagement.js`
- `lib/createManualLead.js`
- `lib/emailTemplates.js`
- `lib/logLeadAction.js`
- `lib/resendQuotation.js`
- `lib/sendLeadNotifications.js`
- `lib/richTextSanitizer.js` (new)

## Validation
- `node --check` passed for every modified JS file.
- Word/Outlook artifact sanitizer tested against the reported `Normal 0 false false false EN-IN X-NONE X-NONE` pattern and EN-US variant.
- Restored quotation email HTML was generated in a local template test and confirmed to contain the expected title, tagline, reference card, quotation-details block, PDF link, signature and footer.
- Full ESLint / Next.js build was not run because project dependencies are not installed in this sandbox; an offline `npm ci` attempt timed out without creating `node_modules`.
