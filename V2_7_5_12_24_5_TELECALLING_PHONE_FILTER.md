# DreamTrawell CRM V2.7.5.12.24.5 - Telecalling Number-Based Agent Filter

**Baseline:** V2.7.5.12.24.4 (Telecalling Contact Visibility).

## Requested behaviour

In **User > Telecalling** and **Admin > Telecalling**, show agents with any valid contact phone number recorded in their existing Travel Agent Master document. Make it easy for Telecallers to work only on actionable, callable agents.

## Implemented

1. Added a **Contact number** filter to both the **Call queue** and **Handed over** lists:
   - **With phone number** (default): only eligible agents with at least one valid saved contact number.
   - **All agents**: restores the unfiltered list for the selected tab.
   - **Missing phone number**: identifies eligible agents with no valid contact number, useful for master-data clean-up.
2. The filter displays the count for each option and a visible "Showing X of Y agents" summary.
3. A saved number is found even if it is **not on the primary SPOC**. The contact lookup scans existing `spocs[]`, `genericContact`, supported legacy top-level fields (`spocMobile`, `contactPhone`, `primaryPhone`, `officePhone`, `whatsappNumber`, etc.), and existing alternate/contact-list objects and arrays.
4. Phone fields containing multiple numbers separated by a comma, semicolon, pipe, or slash are recognised as separate contact numbers.
5. Unusable or placeholder values (e.g. `N/A`, `123`, `0000000000`) do not qualify an agent for the default callable list. Phone-number parsing follows the existing 6-15-digit rule, and unrelated numeric fields such as GST, PAN, PIN and bank account numbers are never used as phone numbers.
6. If the primary SPOC has no usable number but an alternate SPOC does, the list shows the alternate contact's correct name and number, not the primary contact's name with the wrong number.
7. When an agent is selected, the side panel lists the available numbers per saved contact, including alternate numbers. Contact search also includes those alternate numbers.
8. The existing unassigned/contactable queue restrictions, handed-over ownership restrictions, calling outcomes, successful handover, executive notifications, manual WhatsApp, permission checks, invoices, dashboards and one-lead-one-booking rules are unchanged.

## Firestore / permissions

- **No schema migration, new collection, Firestore index, Cloud Function or new security rule is needed** for this patch; the filtering is applied to already-authorised `travelAgents` documents in the existing workspace.
- The screen is protected by the existing `telecalling.view` permissions. Still verify that deployed Firestore rules restrict access appropriately for each role.
- This patch does not fetch phone numbers saved **only in an unrelated lead or engagement record** if they have not been copied into the `travelAgents` document. Do not silently merge unrelated personal information between records.
- The "With phone" list does not include agents who are assigned elsewhere, blocked or opted out under the existing call-eligibility workflow. Use the appropriate CRM view to review those records.

## Files changed

- `lib/telecallingContacts.mjs`: broader number lookup and `hasTelecallingPhone` helper.
- `components/telecalling/TelecallingWorkspace.js`: phone-based filter, counters, improved multiple-number display.
- `tests/telecalling-phone-filter.test.mjs`: regression tests for SPOCs, legacy imports, alternate contacts, invalid values and filter UI.

## Local test steps

1. Extract the complete source ZIP **or** copy the changed files into the same relative paths of the existing V2.7.5.12.24.4 CRM project. Never create a nested `DreamTrawell_CRM_Updated` directory inside the app by accident.
2. Stop the Next.js dev server. Clear the local `.next` directory and restart `npm run dev` if the old screen is cached.
3. Log in as Telecaller. Open **User > Telecalling > Call queue**. The Contact number dropdown must default to **With phone number**.
4. Test an agent with only a generic/office number, an alternate SPOC number, a phone in a legacy field, and no number. The first three should be shown; the last should be hidden in the default view and visible through **Missing phone number**.
5. Switch to **All agents** and search by agent name, city or alternate phone number.
6. Select an agent with multiple numbers. Confirm the appropriate name and every saved valid number appear. A Call link should use a valid number and must **not** automatically log a successful call.
7. Confirm restricted or already assigned agents are not added back into the Call queue just because they have a phone number.
8. Verify **Handed over**, **My Handoffs**, quotation, invoicing, payment and management screens continue to behave as before.

## Automated checks

- `node --test tests/*.test.mjs`: **96 tests passed, 0 failed**.
- Syntax parser: **428 JS/JSX/MJS files parsed, 0 errors**.
- Not verified in this container: complete `next build` (dependencies not installed), live Firebase records, multi-user end-to-end testing, deployed rules or actual production behaviour.
- No changes made to the live Firebase database or deployed application.
