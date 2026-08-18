# Dream Trawell CRM V2.7.0 — Final Sync, Browser Branding & Performance Pass

## 1. Lead Follow-up → Travel Agent Engagement Sync

When a team member logs a follow-up from a Lead, the CRM now mirrors that activity into the same team member's Engagement timeline against the linked Travel Agent.

### Stored linkage

- `leadId`
- `sourceLeadId`
- `sourceFollowUpId`
- `travelAgentId` / `agentId`
- follow-up channel
- follow-up summary
- mapped engagement outcome
- next follow-up date (when present)
- actor UID / name / email
- `sourceType: lead_follow_up`
- `autoSyncedFromLead: true`

The Engagement document uses a deterministic ID based on the Lead follow-up ID, so retrying the sync does not create a second engagement for the same follow-up.

If a legacy Lead has no Travel Agent ID, the Lead follow-up is still saved and its follow-up record is marked `skipped_missing_travel_agent_id` instead of linking the activity to the wrong agent.

## 2. Browser Favicon / PWA Branding

A complete icon family was regenerated from the existing Dream Trawell `public/logo.png`:

- `app/favicon.ico`
- `app/icon.png`
- `app/apple-icon.png`
- `public/favicon.ico`
- `public/favicon-16x16.png`
- `public/favicon-32x32.png`
- `public/favicon-48x48.png`
- `public/apple-touch-icon.png`
- PWA icons from 48px through 512px

The web manifest is also aligned to the Dream Trawell CRM name and current CRM scope.

## 3. Browser Page Titles

A central route-aware title manager now sets useful browser-tab titles across Team and Admin routes.

Examples:

- `Team Dashboard | Dream Trawell`
- `My Leads | Dream Trawell`
- `Travel Agent Profile | Dream Trawell`
- `Management Dashboard | Dream Trawell`
- `Lead Management | Dream Trawell`
- `Meeting Management | Dream Trawell`
- `Branding Settings | Dream Trawell`

Dynamic detail routes are normalized to readable titles rather than exposing Firestore IDs in the tab title.

## 4. Performance Optimisation

### Lead details code splitting

Heavy workspaces are now lazy-loaded on both Admin and Team Lead Details instead of being included in the initial route execution:

- Quotation Editor
- Quotation History
- Customer Quotation workspace
- Vendor workspace
- Vendor Quote form
- Vendor Quote side panel
- Vendor Follow-up modal
- Payments workspace
- Activity detail modal
- Assignment modal

This is especially important because the Quotation Editor is one of the largest client modules in the project.

### Dashboard chart code splitting

Recharts-based charts on the Admin Management Dashboard and Engagement Dashboard are loaded as separate client chunks with lightweight loading placeholders.

### Route shell optimisation

Unnecessary `force-dynamic` flags were removed from the Team and Admin client-only shell layouts so Next.js can make its normal route-rendering/caching decisions instead of forcing every route through a dynamic shell.

### Network / PWA improvements

- Firestore DNS/preconnect hints added.
- Service-worker registration deferred until browser idle time after page load.
- Service worker reduced to navigation fallback + small brand/PWA asset caching instead of intercepting application JavaScript/CSS requests.
- Old Attendance app-shell entry removed from the service worker.

### Production configuration

- gzip compression explicitly enabled.
- `x-powered-by` response header disabled.
- production console noise removed while preserving `console.error`.

## 5. Compatibility

- Existing Login page unchanged.
- Existing Admin Login page unchanged.
- Existing landing/login-choice page unchanged.
- No existing Lead, Engagement or Travel Agent records are migrated or rewritten in bulk.
- Existing V2.6.9 Travel Agent status synchronization remains intact.
- Existing Meeting / Email / WhatsApp / Quotation functionality remains intact.

## 6. Validation

- 340 JS/JSX files parsed successfully with the TypeScript JSX parser.
- 0 JSX syntax errors.
- All local imports added/changed in this pass resolve to files in the project.
- Login file SHA-256 hashes match the V2.6.9 baseline.
- ZIP archive integrity is checked during packaging.

A full `next build` could not be completed in the sandbox because dependency installation did not finish successfully, so run `npm ci` and `npm run build` in the deployment environment before production rollout.
