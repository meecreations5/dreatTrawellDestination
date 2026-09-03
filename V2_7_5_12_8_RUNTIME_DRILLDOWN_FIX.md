# V2.7.5.12.8 - Runtime Drill-down Fix

Baseline: V2.7.5.12.7 Full Dashboard Drill-downs

## Fixed

- Admin Engagement Dashboard runtime error: `isOpenTask is not defined`.
  - Five new drill-down handlers now use the existing Admin helper `isOpenEngagementTask()`.
- Team Engagement Dashboard `Active Queries` drill-down referenced undefined `isActiveQueryLead`.
  - It now uses the existing `isActiveLead()` helper, matching the KPI count logic.
- Team Engagement Dashboard `Asset Shares` drill-down referenced undefined `getAssetCount`.
  - Added the shared asset-count helper using the same fields already used by the KPI summary: `assetShareCount`, `sharedAssetIds`, and `sharedAssets`.

## Validation

- Undefined-reference scan on all four files changed by V2.7.5.12.7: clean for TS2304/TS2552/TS2448/TS2454.
- Full project syntax parse: 372 JS/JSX/TS/TSX files, 0 parse errors.
- No data model, Firestore collection, role-access, quotation, payment, engagement, or pulse logic changed in this patch.
