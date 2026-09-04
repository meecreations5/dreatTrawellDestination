# V2.7.5.12.12 - React Key Spread Fix

## Fix
- Removed `key` from the props object spread used by the Engagement quick call result buttons.
- `key` is now passed only as the React list key while `label`, `icon`, and `tone` are passed explicitly.
- This removes the React 19 / Next.js 16 console error: "A props object containing a key prop is being spread into JSX".

## Scope
- No Engagement behaviour, outcomes, Lead Executive Activity workflow, dashboard logic, permissions, or Firestore data model changed.
- No migration is required.
