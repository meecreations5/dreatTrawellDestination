# Dream Trawell CRM V2.7.2 - Open Query Travel Month

## Objective
Provide a month-wise view of travel dates for every currently open query/lead in the CRM.

## Business rule
The travel pipeline includes only open leads. Terminal outcomes are excluded:
- Closed - Won
- Closed - Lost
- Closed - Cancelled / Invalid

This means Lost queries are never included, and neither are other already-closed records.

## What was added

### Open Queries by Travel Month
The Admin Lead Dashboard now contains an `Open Queries by Travel Month` section.

It:
- Uses every non-deleted, currently open lead in the system.
- Groups leads by their Travel Month.
- Shows a separate `Travel Date Missing` bucket.
- Highlights past travel months in red when a lead is still open after its planned travel month.
- Allows clicking a month to open the exact Admin Leads listing for that month.
- Intentionally ignores the Lead Created Date global scope because this report is about upcoming/open travel, not when the lead was created.
- Still respects the selected Team scope.

### Lead travel date fields
Lead records now support normalized additive fields:
- `travelStartDate`
- `travelEndDate`
- `travelDate` (start-date compatibility alias)
- `travelMonth` (`YYYY-MM`)
- `travelDateSource`

Legacy travel-date aliases are still read where available.

### Lead detail editing
Both Team and Admin Lead Detail pages now include a Travel Date control:
- Travel Start Date
- Travel End Date (optional)

Updating the date writes an audit entry to the Lead timeline.

### Lead creation
Travel dates can now be captured while creating a lead:
- Manual Team Lead creation
- Lead creation from Engagement
- Travel Agent Engagement -> Lead flow

The fields are optional so existing workflows and old records remain compatible.

### Quotation synchronization
If Travel Month/Travel Dates are entered in the quotation workspace, saving a draft or creating/sending a quotation also synchronizes those values back to the Lead master record. This keeps month-wise reporting usable even when the travel date is first captured during quotation preparation.

### Lead listing
Admin Lead cards and table now show:
- Travel date/range
- Days remaining to travel
- Past-travel warning
- Travel Date Missing

Team `My Leads` cards also display the same travel-date context.

### Admin Lead filters
Added:
- Travel Month
- Travel Date Missing
- Open Leads Only

Clicking a month card from the dashboard automatically applies the correct filters.

## Compatibility
- No old lead is bulk-migrated.
- Old travel-date fields are read where available.
- Leads without a travel date appear under `Travel Date Missing`.
- Login/authentication was not changed.
- Existing payment-upload, meeting, engagement, quotation and status-sync features remain intact.

## Validation
- 344 JS/JSX files parsed with the TypeScript JSX parser.
- 0 syntax errors.
