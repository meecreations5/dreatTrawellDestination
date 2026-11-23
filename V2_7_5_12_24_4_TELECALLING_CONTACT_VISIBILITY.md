# DreamTrawell CRM V2.7.5.12.24.4 — Telecalling Contact Visibility

**Source baseline:** V2.7.5.12.24.3 (Executive Handover Notifications).

## What changed

1. **User → Telecalling** and **Admin → Telecalling**, both **Call Queue** and **Handed Over**, now display the available travel-agent contact name, phone number, email address and city directly in each list row.
2. Each authorised Telecalling row has a separate **Call** (`tel:`) action if the number is usable and the agent's status permits contact, plus **Email contact** when a valid email exists. The call link only opens the device's dialer; it does not automatically record a connected call or change engagement metrics.
3. Search includes the agency, code, city, primary and alternate SPOC names, numbers and emails, and general agency contact details.
4. The selected agent's sidebar shows **all recorded SPOC contacts** and any distinct office/general contact number or email, with their primary SPOC/office labels. A user can see alternative numbers without going into Admin Travel Agent Master.
5. Contact lookup uses the actual existing Firestore fields: `spocs[].name/mobile/email/phone`, `genericContact.phone/email`, `address.city` and supported legacy direct `phone`, `mobile`, `contactNumber`, `phoneNumber`, and `whatsappNumber` fields. When no number is recorded, the UI says so; it does not invent one.
6. **User → My Handoffs** now displays the assigned travel-agent contact name, phone and email directly in the list and offers a Call link. The contact panel remains available after selecting a handover.
7. Newly created handover documents now save the preferred actual contact number and email even when the travel-agent record only has a general/office number (previously `genericContact.phone` was ignored by the handover snapshot).
8. The existing Telecaller roles, handover notifications, manual WhatsApp introduction, one-lead-one-booking, financial dashboards, payments and quotation logic remain unchanged.

## Security and integration

- No new Firestore collection, data migration, Cloud Function, new role or schema field is required for this patch.
- The UI remains protected by `telecalling.view` and the existing assigned-executive My Handoffs permission. Firestore access is still enforced by the **deployed rules**, not by this UI alone; verify those rules against the actual role accounts before production use.
- It **does not expand** who can read the Telecalling queue. Unrelated Relationship Executives should not gain read access to another executive's handover record.
- The patch does not backfill older handover documents with missing `contactPhone` fields. For those, review the Travel Agent Master or create a correctly recorded new handover as appropriate; do not duplicate assignments merely for backfill.
- The app will **not automatically dial**, send a WhatsApp message, or count a connected call when a Call link is clicked. Record the actual outcome through the existing workflow.
- Calls are disabled for rows in blocked contact status; pre-existing consent policies must still be respected by callers.

## Local acceptance checklist

1. Sign in with the Telecaller role and open `User → Telecalling`. Confirm the Call Queue displays contact person, phone and email directly; open **Handed Over** and confirm the same.
2. Test a primary SPOC with a mobile number, a primary SPOC without a number but with an alternate SPOC number, and an imported agent with only `genericContact.phone`.
3. Search by the primary contact's name, alternate contact's number, email, and city. The list must find the appropriate agency.
4. Select an agent with two SPOCs. Confirm both contacts display in the right-side detail panel and no phone is assigned to the wrong contact's name.
5. Confirm the Call link opens a `tel:` handler without saving a call, changing a relationship grade or changing handover status. Only manually saved real outcomes should update Engagement.
6. Hand over an interested agent whose phone is recorded only as `genericContact.phone`, then log in as the assigned Relationship Executive. **My Handoffs** must show the contact phone and email directly on the list row.
7. Test missing/invalid phone: show a clear message with no clickable `tel:` link. Test non-contactable status: no dial shortcut in Telecalling.
8. Verify another executive cannot view someone else's handover, and the Telecaller cannot access finance modules.
9. Recheck the existing manual WhatsApp introduction for agents with SPOC and general office numbers.
10. Recheck basic quotation, business dashboard and payment screen operations after deploying.

## Local verification

- `node --test tests/*.test.mjs`: **90 passed, 0 failed** (including six new contact visibility tests).
- TypeScript syntax parser checked **427 JavaScript/JSX/MJS source files**, with **0 parser errors**.
- **Not run:** `next build` (no installed `node_modules` in this offline source copy), authenticated browser/end-to-end QA, live Firebase authorization checks.
- **Not deployed:** The web app, Firebase rules or functions.
