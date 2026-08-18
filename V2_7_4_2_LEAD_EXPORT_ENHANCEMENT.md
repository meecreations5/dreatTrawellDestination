# Dream Trawell CRM V2.7.4.2 - Lead Export Enhancement

## Change
Expanded Lead CSV export to include the major operational, travel, commercial, payment, and closure fields required for management reporting.

## Export coverage

### Lead & ownership
- Lead Code / ID
- Stage / Status
- Closing Potential
- Lead Source
- Lead Owner + email
- Current Assignee + email

### Travel Agent
- Agent Code / Name
- Agent Status / Potential
- Primary SPOC name, mobile, email
- State / City / Sub Area / PIN
- Uses current Travel Agent master when available, with lead snapshot fallback for legacy records

### Traveller & travel
- Customer / Traveller name, mobile, email
- Destination Code / Destination
- Travel Start Date
- Travel End Date
- Travel Month
- Pax / Guests

### Follow-up & quotation
- Next Action date/time and type
- Last Activity
- Quotation Status
- Quotation Revision
- Quotation Sent At
- Selected Vendor

### Commercial & payment
Commercial columns respect Role & Access permissions:
- Customer Quotation / Selling Price (requires Payments -> View Revenue / GP)
- Gross Profit (requires Payments -> View Revenue / GP)
- Margin % (requires Payments -> View Revenue / GP)
- Customer Payment Status / Received / Outstanding (requires Payments -> View Revenue / GP)
- Vendor Cost (requires Payments -> View Vendor Cost)
- Vendor Payment Status / Paid / Outstanding (requires Payments -> View Vendor Cost)

The export reads final values first, then latest/legacy field fallbacks. If Gross Profit or Margin is absent but selling price and cost are available, it derives the values for export without modifying Firestore.

### Lifecycle / closure
- Created At
- Assigned At
- Updated At
- Closure Type
- Closure Reason
- Closure Date
- Closed By
- Closure Note

## Compatibility / safety
- No lead schema migration required.
- Existing filtered-lead behavior is retained: the CSV exports the current filtered result set.
- Main Lead Management export uses the loaded Travel Agent master for current agent/location details when possible.
- Lead Dashboard export now uses the same centralized exporter for consistent columns.
- UTF-8 BOM added for better Excel compatibility with Indian names and currency symbols.
- CSV formula injection protection added.
- Login/authentication pages were not changed.

## Validation
- `node --check` passed for:
  - `lib/exportLeadsCsv.js`
  - `app/admin/leads/page.js`
  - `app/admin/leads/dashboard/page.js`
- Full Next.js build was not run because project dependencies are not installed in this environment.
