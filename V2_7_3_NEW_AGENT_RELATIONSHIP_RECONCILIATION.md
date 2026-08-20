# Dream Trawell CRM V2.7.3 - New Agent Relationship Reconciliation

## Business rule locked

A **New Agent** in engagement reporting means a Travel Agent that the team member is contacting for the first time. The Travel Agent profile may already have existed in the CRM for days or months.

This is now kept separate from **New Agent Added**, which means the Travel Agent master/profile itself was created in the selected period.

## Metric definitions

- **New Agents Added**: Travel Agent profiles created in the selected period.
- **New Agents Called**: unique Travel Agents whose first call by that team member falls inside the selected period.
- **New Agents Connected**: unique Travel Agents whose first successful connection by that team member falls inside the selected period.
- **Existing Agents Contacted**: unique Travel Agents successfully contacted in the selected period where that team member already had a successful connection before the selected period.
- **Total Unique Contacted**: deduplicated Travel Agents successfully reached in the selected engagement scope.

Invalid Number, Business Shut Down and Wrong Details remain separate outcomes and are not counted as successful connections.

## Filter reconciliation

The Admin Engagement Agent Segment filter now uses relationship history rather than Travel Agent profile creation date:

- New / First Contact
- Existing / Repeat Contact
- Never Contacted
- Contacted
- Invalid / Closed

When an Activity Performer is selected, the New/Existing relationship is evaluated against that team member's own engagement history.

## Team Dashboard reconciliation

The Team Dashboard now separates:

- **New Agents Added Today**: profiles created by the logged-in user today.
- **New Agents Called**: Travel Agents called by that user for the first time today, even if the profile was already present in the CRM.

## Data safety

No existing Travel Agent, Lead or Engagement records are migrated or rewritten. The correction is reporting/classification logic only.
