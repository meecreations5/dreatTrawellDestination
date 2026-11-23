# DreamTrawell CRM v2.7.5.12.24.2 - User Telecalling & WhatsApp Handover

**Based on:** v2.7.5.12.24.1 (User Management diagnostics hotfix).

## Business requirement

- Let the Telecaller work from the ordinary Team/User frontend, with a Telecalling tab, rather than sending them into the Admin area for their daily calls.
- Once a qualified travel agent has actually been assigned to a Relationship Executive, provide a WhatsApp introduction naming that assigned executive, addressed to the selected agency contact.
- Keep existing role restrictions, lead assignment, call/engagement evidence, quotations, invoices, currency and payment flows intact.

## Implemented changes

1. New user-level route `/telecalling` and **Telecalling** navigation item, permission-gated by `telecalling.view`.
2. Telecaller role now lands at `/telecalling` after Team Login. The team layout permits the Telecalling page and Profile for this role, and redirects restricted team routes away without rendering their content.
3. Telecallers do not mount the regular Productivity Pulse or unrelated Team dashboard. Admin/Manager users retain their existing access.
4. Shared `components/telecalling/TelecallingWorkspace.js` drives both `/telecalling` and `/admin/telecalling` so logging calls and assignment transactions use the same existing code.
5. On a **successful handover transaction**, the workspace switches to the **Handed over** view and displays a WhatsApp handover message based on Firestore `assignedToName`, the selected SPOC name, and mobile/WhatsApp phone. This is not generated merely by selecting an executive before saving.
6. The Handed over list is scoped to the signed-in Telecaller for the Telecaller role. Admin and Manager can see the handovers allowed by their role.
7. Pick the contact if the travel agent has more than one SPOC. The message is composed for that chosen contact.
8. `Open WhatsApp to send` opens a prefilled WhatsApp chat; `Copy message` offers a fallback. **A person must actually press Send in WhatsApp.** The CRM does not record a provider-delivered message nor silently label a prepared message as sent.
9. A contact explicitly marked as not preferring WhatsApp, opted out, or blocked for contact cannot be targeted with the handover message. Missing/invalid phone number or missing manager name also prevents opening a prepared WhatsApp link.
10. Telecallers no longer see an Admin Travel Agent record link they cannot access.

## Approved WhatsApp introduction (generated with actual names)

Hi [Contact Name],

Greetings from DreamTrawell Destination DMC!

Thank you for connecting with us.

Your dedicated Relationship Manager, [Relationship Manager Name], will get in touch with you shortly to understand your upcoming travel requirements and assist you with destination information, quotations and itinerary planning.

We look forward to supporting your business.

Team DreamTrawell
Travel expertise, thoughtfully delivered.

## Files changed from v2.7.5.12.24.1

- `app/(team)/telecalling/page.js` (new)
- `app/admin/telecalling/page.js` (now reuses shared component)
- `components/telecalling/TelecallingWorkspace.js` (shared source, new)
- `components/layout/AppLayout.js`
- `config/appNavigation.js`
- `app/login/page.js`
- `lib/rolePermissions.js`
- `lib/telecallingWhatsApp.mjs` (new)
- `tests/telecaller-user-handover.test.mjs` (new)
- This release note

## Deployment

1. Back up the live working CRM and user data.
2. Use the complete ZIP or overlay the *changed files* ZIP on the v2.7.5.12.24.1 codebase. Do **not** apply the patch to an older version or overwrite a newer production branch without reviewing differences.
3. For localhost: `npm install` if necessary, then `npm run dev`. For production: run `npm run build`, deploy the web app and test the new route.
4. This particular release makes no Cloud Function or Firestore schema changes. It **relies on the Telecaller role, permissions, and Firestore rules from the earlier Telecalling release already being deployed**. If those are not deployed, call logging, handover or reading the team directory will fail.
5. If the previously reported Edit User error still occurs, deploy and diagnose the **v2.7.5.12.24.1** `updateUserAccess` Cloud Function separately, per its own release notes. This release does not attempt to bypass role security.

## Manual acceptance tests

- Login as an active Telecaller via `/login`, confirm `/telecalling` opens in Team/User layout and that the tab is visible on desktop/mobile.
- Attempt to open `/leads`, `/dashboard`, `/admin/users` and payment routes using the Telecaller credentials; verify restricted content is not exposed and Firestore rules reject unauthorized operations.
- Log an interested call for an eligible unassigned agent and hand over to an active Relationship Executive.
- Verify message is shown only after assignment succeeds and uses **that** assigned user's name. Check the preferred SPOC contact and a second contact.
- Open WhatsApp link, check phone and content, and manually send. Verify the CRM has not falsely marked it as delivered.
- Test explicitly opted-out WhatsApp agent, missing manager name and invalid phone (message preparation/link blocked).
- Verify existing Admin `/admin/telecalling` still works, and Admin can see the handover list.
- Re-run regression checks for quotations, invoices, payment void, role editing, reporting and engagements on the normal development environment.

## Verification and limitations

- `node --test tests/*.test.mjs`: **76/76 passed**.
- Source syntax parsing via TypeScript parser: **417 JS/JSX/MJS files parsed, 0 syntax errors**.
- Full Next.js production build and live Firebase authorization/WhatsApp delivery tests were not run in this offline development environment (`node_modules`/Next.js not installed here).
- Automatic WhatsApp Business API delivery would require a separate approved WhatsApp template, business consent/opt-out handling, API configuration, and delivery-status auditing. This release intentionally does not add it.
