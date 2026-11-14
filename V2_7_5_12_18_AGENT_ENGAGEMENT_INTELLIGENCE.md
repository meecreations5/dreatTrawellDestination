# DreamTrawell Destination CRM — V2.7.5.12.18
## Agent Engagement Intelligence & A+/A/B/C Relationship Grading

**Baseline:** V2.7.5.12.17 (Relationship Activation & Communication role access). Prior changes are retained.

### Implemented

1. **New report:** Admin > Travel Agents > Engagement Intelligence
   - Route: `/admin/travel-agents/engagement-intelligence`
   - Relationship scores/grades per Travel Agent, executive filter, A+/A/B/C filters, search, sort, export CSV.
   - KPI cards: eligible agents, connected calls, outbound communications logged, documented replies, A+/A agents with no qualified enquiries during the rolling 30-day window.
   - Per-agent expandable score breakdown, call attempts/success/failure, WhatsApp/email inbound and outbound, meetings completed, active contact days/weeks, last real connection, content category counts and suggested next action.
   - Direct link to the agent's daily engagement workspace.
   - Link from existing Activation & Conversion report. Both reports are intentionally separate (engagement health vs. actual leads/closures).
2. **Travel Agent engagement workspace:** displays a live 30-day relationship grade mini-summary using that agent's already loaded engagement records. The grade does not change the Travel Agent master status.
3. **Engagement entry form:** new optional "Communication / Discussion Purpose" classification and explicit "Agent's Response" for outgoing WhatsApp/email. Incoming WhatsApp/email is counted as an incoming reply. New metadata fields: `communicationPurpose`, `agentResponseStatus`.
4. **Communication send modals:** users can select a communication purpose; outbound communication is logged as `direction: outbound`, with `agentResponseStatus: not_confirmed`. Recorded WhatsApp Web handoff is **not** represented as proof of delivery or reply. A blocked WhatsApp popup is not logged as a successful handoff by the simpler modal.
5. **Meeting completion:** new meeting-generated engagement records are explicitly marked `status: completed` and `meetingStatus: completed`; older generated records with `meetingId` and `engagedAt` are also recognised. Scheduled meetings do not earn completed-meeting points.
6. **Pure calculation + tests:** `lib/travelAgentEngagementIntelligence.js` and `lib/engagementIntelligenceTaxonomy.js` are reusable and testable. No database migration, new Firestore collection, or scheduled job is required.

### Recommended grading formula (rolling 30 days)

| Evidence | Maximum score | Definition |
|---|---:|---|
| Connected call / completed meeting | 25 | 3+ verified conversations to earn 25; failed or unknown call outcomes excluded |
| Confirmed WhatsApp/email two-way communication | 25 | 3+ different channel/day reply events to earn 25; repeated messages on the same channel/day don't inflate score |
| Meaningful business discussion | 20 | 2+ different days with two-way dialogue about requirements, rates, feedback, business opportunities or completed meetings |
| Relationship consistency | 15 | Two-way dialogue spanning 3+ distinct ISO weeks (India time) |
| Positive business interest | 10 | 2+ distinct days with explicitly positive response or business-related outcome |
| Last two-way contact recency | 5 | Within 10 days = 5; within 15 days = 3; within 30 days = 1; otherwise 0 |
| **Total** | **100** | No credit for message volume alone |

Grades: **A+ 80-100** (also requires 3+ different connected days, 2+ meaningful discussion days, last contact <=10d); **A 60-79** (also requires 2+ different connected days, last contact <=15d); **B 35-59** (at least 1 connected day); **C 0-34 or insufficient genuine evidence**. If a score crosses a threshold but the evidence gate is not met, its grade is capped. These are initial DreamTrawell operational thresholds, not external industry benchmarks. Review after 30-60 days of live capture.

### Definitions and safeguards

- **Connected call**: explicit positive connection status/call result/outcome. A generic `status: completed` without connected evidence is **unknown**, not connected.
- **Logged outbound communication**: WhatsApp Web handoff/open or email send as stored in `engagements`. Not a guarantee of WhatsApp delivery, message reading or reply.
- **Documented reply**: incoming WhatsApp/email record, or user explicitly selecting a reply state in the engagement form. Old records without response evidence are not backfilled or guessed.
- **Meaningful discussion**: genuine two-way business discussion. Unanswered promotion, unconnected call and `not_interested` are not meaningful business discussions.
- **Consistency**: distinct ISO weeks with verified two-way interaction (using India time, UTC+05:30).
- **Business status**: leads and closures, separate from engagement grade. `A+/A without enquiry` is a focus flag, not a change in booking status.
- **DNC/blocked agents**: no automated outreach recommendation if master status is not interested, do not contact, blacklisted, business shut down, duplicate, etc.; their master status is not modified.
- **Entity linking**: uses saved agent IDs, safely supports legacy ID aliases and unambiguous company-name fallbacks; does not guess where multiple agents share a name.
- **Deleted / invalid-number agents**: excluded from the graded population; deleted engagements do not count.
- **Permissions**: report is read-only, under existing Travel Agents admin access and `travel_agents.view`. The executive communication-create/edit role controls from the baseline are preserved.
- **Unavailable lead data**: the screen displays engagement scores, disables “no enquiry” flags and clearly signals the missing lead-read permission rather than incorrectly asserting zero leads.

### Files added/updated

**New**
- `lib/engagementIntelligenceTaxonomy.js`
- `lib/travelAgentEngagementIntelligence.js`
- `app/admin/travel-agents/engagement-intelligence/page.js`
- `tests/engagement-intelligence.test.mjs`
- This release note.

**Updated**
- `app/admin/travel-agents/activity-report/page.js` (link to new report)
- `app/(team)/engagements/travel-agent/[agentId]/page.js` (mini relationship summary)
- `app/(team)/engagements/travel-agent/[agentId]/EngagementForm.js` (purpose + response fields)
- `app/(team)/engagements/travel-agent/[agentId]/SendCommunicationModal.js` (purpose + accurate outbound metadata)
- `components/engagement/SendCommunicationModal.js` (purpose + accurate outbound metadata)
- `lib/meetingService.js` (completed meeting evidence)
- `config/adminSidebar.js` (new report navigation)
- `package.json` (new local test scripts)

### Validation carried out in this environment

- `node --test tests/activation-and-permissions.test.mjs tests/engagement-intelligence.test.mjs` — **15/15 passed**.
- Parsing of all 10 changed/new JavaScript and JSX source files via TypeScript parser — **passed**.
- No live Firestore access, deployed Vercel test, authenticated browser interaction or production push occurred.
- Full `npm ci` / `next build` **not completed** in this offline environment because npm required an uncached package (`zod-validation-error@4.0.2`). Run the normal build before production release.
- Firestore rules are not part of this supplied source archive. Confirm that production rules allow intended role-appropriate reads of `travelAgents`, `engagements`, `leads` (without granting unrelated record access), and that previous Communication Template permissions work as intended. UI access checks alone are not sufficient security enforcement.

### Deployment and acceptance

1. Extract as a new project folder. Keep your existing `.env.local` privately; it is deliberately excluded from the release archive.
2. Run `npm ci`, then `npm run test:crm`, then `npm run build` locally/CI.
3. Confirm Firebase rules and deploy by your existing workflow; no schema migration or backfill is required.
4. Login as Engagement / Relationship Executive and open **Admin > Travel Agents > Engagement Intelligence**.
5. Log a connected call, outgoing WhatsApp/email with no reply, inbound message, and meaningful requirements conversation. Verify score, grade and last connection react correctly.
6. Confirm no-response promotions cannot turn a C into A/A+; a contact on a separate week does contribute to consistency; scheduled meetings don't count as completed.
7. Check A+/A agents with no recorded enquiries, export, filter by Pallavi/Eshaan/Rizwan (or current executive names) and open the agent profile.
8. Review representative historical data. Legacy replies not expressly recorded will remain unverified until the next manual interaction; this is intentional.
