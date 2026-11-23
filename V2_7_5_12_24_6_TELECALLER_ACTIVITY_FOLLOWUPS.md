# DreamTrawell CRM V2.7.5.12.24.6 — Telecaller Activity & Follow-ups

**Source baseline:** V2.7.5.12.24.5 (Phone Filter). **Not deployed.**

## User requirement

After saving a call **without assigning** the travel agent, the Telecaller must be able to find the call again, and all upcoming follow-up commitments must remain visible, with contact details and direct access to save the next call.

## User and Admin Telecalling views

The same `TelecallingWorkspace` component is used in `/telecalling` (User) and `/admin/telecalling` (Admin).

| View | Contents |
| --- | --- |
| Call queue | Unassigned, contactable agents eligible for new calls (phone filter defaults to With Phone) |
| My Calls | Agents personally contacted by the signed-in user, including blocked or assigned agents for historical reference |
| Follow-ups | Open scheduled reminders for contactable, unassigned agents; owned by the last Telecaller who saved the call (Admin/Manager can monitor all) |
| Interested - Pending Assignment | Interested, unassigned agents, with qualifying calls saved by this Telecaller (Admin/Manager can monitor all) |
| Handed over | Existing team assignments and WhatsApp introduction (no change to notification or acceptance workflow) |
| Excluded | Previously contacted agents whose last call outcome was Not Interested or Invalid Number |

Follow-ups have **All Scheduled / Overdue / Due Today / Upcoming** filters based on the user's local date. The due count and list update every minute while the workspace is open. Follow-up rows show the available contact, clickable number where allowed, last call outcome, exact scheduled date/time, and the latest discussion notes. The Follow-ups view defaults to **All Agents** under the phone filter so a pending follow-up cannot disappear solely because the contact number was deleted.

## After saving a call

- **Follow-up date provided:** Save actual call to `engagements`, update the existing `travelAgents.telecallerFollowUpAt`, switch to **Follow-ups**, and keep the agent unassigned.
- **No Answer / Busy / Switched Off with no new date:** Preserve any existing scheduled follow-up; do not accidentally remove it. A new date explicitly reschedules the next call.
- **Connected - Follow-up Required:** A follow-up date is mandatory.
- **Connected - Interested, no next date:** The previous pending reminder closes; agent appears under Interested - Pending Assignment and My Calls.
- **Not Interested / Invalid Number:** No further Telecalling; agent can still be found in My Calls and Excluded.
- **Handover:** Agent moves to Handed Over, the existing executive notification triggers, and the Telecaller's open-follow-up list no longer includes it. Relationship Executive manages further follow-up.

Each successive call is logged as another `engagements` record; it does **not** create a duplicate lead, agent or confirmed booking. A current reminder is stored in the existing `telecallerFollowUpAt` field. There is **one active pending Telecaller follow-up per unassigned travel agent**, not an independent task for every historical call.

The **My Calls** view subscribes to the current user's existing engagements using `where('createdByUid','==',auth.uid)` and filters `source='telecalling'` client-side. This makes an earlier call visible even if another Telecaller subsequently called the same agent. It uses an equality query; no new composite index or collection is required. If Firestore denies that read, the UI displays a warning and falls back to the Travel Agent's `telecallerLastCalledByUid` field. The workspace does not silently claim full call-history coverage when Firestore access is denied.

## Access control and Firestore rules

This release does not introduce any new Firestore fields, indexes, collections, Cloud Functions, or permission *roles*.

**Verify the deployed `engagements` read rules**, which were not present in the source ZIP. The call history query needs to allow an authenticated Telecaller to read **only their own** engagement records (`createdByUid == request.auth.uid`). In the actual deployed rules, preserve pre-existing valid Admin / Executive reads and do **not** grant Telecallers unconditional read access to all `engagements`. A narrowly scoped illustrative clause for the existing `match /engagements/{id}` is:

```js
// Merge within your existing /engagements/{id} match and add your
// existing server-verified active-Telecaller role check.
allow read: if request.auth != null &&
  resource.data.get('createdByUid','') == request.auth.uid;
```

This illustration is **not a complete production ruleset**: it requires the existing **active Telecaller role** helper to prevent unrelated roles using this route. It intentionally matches the app's creator-scoped query. Firestore evaluates existing grants together, and the actual source uses role/identity mappings. If you also restrict `source == 'telecalling'` in Firestore rules, update the query to explicitly filter that source and add the required composite index. Do not deploy this snippet without role checks or Emulator tests. No rules have been changed or deployed here.

Existing ability to read approved `travelAgents`, create `engagements` and update Telecalling fields on `travelAgents` is also required.

## Important limitations

- The ownership of the single active follow-up is inferred from `telecallerLastCalledByUid`. If two Telecallers call the same unassigned agent, the latest Telecaller becomes the owner of that current reminder. If independent ownership is needed across multiple Telecallers, that should be a separately approved data-model change, not a silent schema modification.
- Reading **My Calls** may require a Firestore rules adjustment. Without it, the UI falls back to a narrower list and explains the limitation.
- **No external WhatsApp, email or push reminder** is sent for Telecaller follow-ups in this release. The due queue is an in-app workflow, not a background alert system.
- A Date/Time picked by a Telecaller uses the browser's local timezone. Verify against Asia/Kolkata users in acceptance testing.
- Calling a phone through `tel:` does not automatically record success. Users must save the actual call outcome.

## Files changed

- `components/telecalling/TelecallingWorkspace.js`
- `lib/telecallingActivity.mjs` (new shared view/date logic)
- `lib/telecallingCore.mjs` (follow-up outcome date validation)
- `lib/telecallingService.js` (preserve pending reminder on a failed attempt)
- `tests/telecalling-followup-activity.test.mjs` (new regression tests)

## Local validation

1. Apply changed files onto v2.7.5.12.24.5, respecting the folder paths. Do not extract an extra nested project folder into the running app.
2. Stop Next.js, delete `.next`, and restart `npm run dev`. Use a Telecaller account to open **User → Telecalling**.
3. Choose an unassigned agent with a valid number, record Connected - Follow-up Required for tomorrow 3 PM, and save **without assigning**. Confirm Follow-ups and My Calls show the agent; the call exists in Engagement history.
4. On another agent, record Busy with a follow-up date. Save another Busy attempt without replacing the date. The reminder should remain. On a later connected call without a new due date, it should disappear from Follow-ups while the call logs remain in My Calls.
5. Test Overdue, Due Today and Upcoming filters, and change the Contact Number dropdown to Missing Phone / All Agents to verify no scheduled action is lost.
6. Save Connected - Interested without a follow-up: the record should go to Interested - Pending Assignment and My Calls, with no Team Handover notification yet.
7. Hand over an interested agent; confirm the existing notification and acceptance workflow still work and the agent is no longer in the Telecaller follow-up list.
8. Save Not Interested / Invalid Number and confirm the agent appears under Excluded and cannot be called again using the Telecalling form.
9. Test multiple Telecaller identities, creator-scoped engagement reads and denied cross-user reads in the Firebase Emulator. Verify all existing Lead, Payment, Invoice, Quotation and Business Dashboard screens have not changed.

## Automated checks

- `node --test tests/*.test.mjs`: **103 passed / 0 failed**.
- TypeScript syntax parser: **430 JS/JSX/MJS files, 0 parse errors**.
- Not run: full Next.js production build (no installed `node_modules`), authenticated browser QA, Firestore Emulator rules verification, production data checks.

**No production app, security rules or Firebase data were changed.**
