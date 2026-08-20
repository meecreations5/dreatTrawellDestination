# Dream Trawell CRM V2.7.5.6 - Role Permissions + Quotation PDF

## Role updates

- Employee / Sales / Operations Executive
  - Full Team/User workspace.
  - Admin access: Travel Agents.
  - Travel Agent actions use full access in the Admin module.

- Operation Executive (new role)
  - Full Team/User workspace.
  - Admin access: Travel Agents, Engagements, Meetings and Leads.
  - These selected Admin modules use full operational access.
  - New employee ID prefix: `DT-OPE-###`.

- Existing legacy `operations_executive` role values remain mapped to `employee` for backward compatibility. The new distinct role key is `operation_executive`.

## Quotation PDF

- Added `Generate PDF` in the Quotation Editor so a quotation can be reviewed/exported before sending.
- Added `PDF` on each saved quotation card.
- Added `Generate PDF` inside the saved quotation detail modal.
- PDF view uses A4 print styling and the existing Dream Trawell branding/signature snapshot when available.
- Customer-visible quotation body, travel details, recipient details and customer quotation amount are included.
- Internal vendor cost, gross profit, margin and internal note are deliberately excluded from the PDF.
- No new PDF npm dependency is required. The browser opens a print-ready A4 quotation and automatically opens the Print / Save as PDF dialog. A visible `Save as PDF / Print` button remains available if automatic printing is blocked.

## Compatibility

- Existing Login pages and login redirect flow are unchanged.
- Existing roles remain supported.
- Existing quotation drafts/sent revisions remain usable; legacy saved HTML can also be exported.
