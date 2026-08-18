# V2.6.8 - New Agent Call Reconciliation

## Why Admin could show 0 while Team showed new-agent calls

Two different issues were present in the Admin Engagement dashboard:

1. The Team dashboard recognizes Travel Agent creation dates from `createdAt`, `addedAt`, and legacy `createdOn`, while the Admin Engagement dashboard did not include `createdOn`. Legacy/new records stored with `createdOn` were therefore not classified as new in Admin reporting.
2. Team `New Agents Called` means a unique newly-added Travel Agent had at least one call attempt. Admin `New Agents Contacted` was counting only successful connections. A call with Invalid Number, Business Shut Down, No Answer, etc. could therefore appear in Team calling activity but not in Admin successful-contact counts.

## Reconciled metrics

Admin now separates these meanings:

- **New Agents Added** - Travel Agent master profiles created in the selected period.
- **New Agents Called** - unique newly-added Travel Agents with at least one call attempt in the selected period, regardless of call outcome.
- **New Agents Connected** - unique newly-added Travel Agents successfully reached in the selected period.
- **Existing Agents Contacted** - unique pre-existing Travel Agents successfully reached.
- **Total Unique Contacted** - deduplicated successfully contacted Travel Agents.
- Invalid Number / Business Shut Down / Wrong Details remain visible separately.

This lets a team result such as `26 New Agents Called` reconcile correctly even when some of those 26 calls were unsuccessful or invalid.

## Legacy compatibility

Travel Agent creation date now recognizes:

- `createdAt`
- `addedAt`
- `createdOn`
- `created_at`
- `registeredAt`

Engagement-to-agent matching now canonicalizes these possible references:

- Travel Agent document `id`
- `agentId`
- `travelAgentId`
- `agencyId`
- embedded Travel Agent ID
- legacy agent name fallback

All matching identifiers resolve to one canonical Travel Agent key before unique counts are calculated.

## UI changes

The Team Agent Activity table now shows both:

- New Called
- New Connected

alongside Existing Contacted, Unique Contacted, Calls, Meetings, Invalid No., and Business Shut.

Meetings moved into the secondary Activity row so the top business flow remains focused on Agent Added -> Called -> Connected -> Lead -> Quote -> Converted.

## Validation

343 JS/JSX files parsed successfully with 0 syntax errors.
