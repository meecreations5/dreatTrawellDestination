# DreamTrawell CRM — V2.7.5.12.20
## Marathi → English Voice Notes + Unified Lead/Engagement Dictation

**Based on:** V2.7.5.12.19 (engagement intelligence, matching blue/cyan theme, Hindi/English dictation). This is an additive code change; existing lead, engagement, role and quotation workflows remain in place.

### 1. What changed
- The shared voice language selector now offers three choices: **English voice → English text** (`en-IN`), **Hindi voice → English text** (`hi-IN`), and **Marathi voice → English text** (`mr-IN`).
- Hindi and Marathi voice notes use the same authenticated Next.js endpoint (`/api/engagement/translate-note`). Google Cloud Translation Basic v2 accepts `source=hi` or `source=mr`, `target=en`. No separate Marathi API key, billing account, Firebase collection or migration is required.
- If translation fails or the key is missing, the original-language transcript stays in the current form for **Retry English**, **Use original Hindi/Marathi**, or **Discard**. The containing form's Save is blocked until unresolved dictation is addressed. No audio is uploaded or stored by the CRM (browser speech service may process microphone audio).
- **Engagements → Travel Agent → Smart Engagement Logger:** both Conversation Summary and Internal Note now inherit Marathi as an additional choice from the shared component.
- **Leads → Create Lead:** a small voice control below the existing rich-text **Reference Notes / Client Requirement** editor appends recognised/translated text safely, preserving existing typed notes and formatting.
- **Lead Details → Log Follow-Up:** Conversation Summary supports all three voice modes; the existing `logFollowUp` operation and automatic travel-agent engagement timeline sync are untouched (no duplicate sync).
- **Lead Executive → Manual Operations Activity:** the Additional Note field supports the same modes; saving remains blocked during unresolved voice input.
- The controls use the established blue / slate / white CRM palette; no broad theme changes or new role privileges were introduced.

### 2. Localhost configuration
Add this **server-only** line in the project root `.env.local` (alongside `package.json`):

```
GOOGLE_CLOUD_TRANSLATION_API_KEY=<your existing Cloud Translation API key>
```

Do not include the `<>` or commit real secrets. The Cloud Translation API must be enabled for the Google Cloud project linked to the key. The key should be restricted to **Cloud Translation API**. Restart the localhost dev server after changes:

```
npm ci
npm run dev
```

The browser must allow microphone access. Test `http://localhost:3000` (or the actual port shown by Next.js). Browser speech recognition varies; use up-to-date Chrome/Edge. If `mr-IN` is unsupported by your browser's speech service, manual entry remains available; Google Cloud Translation **does** support Marathi (`mr`).

### 3. Test cases
1. Open Engagement Summary, choose Marathi, speak: **"एजंटशी बोलणं झालं. दुबईचे दर पाठवले आहेत."** Finish, review the editable English text, and Save.
2. Repeat with Hindi and English to ensure existing language modes are unaffected.
3. Repeat in Engagement Internal Note.
4. Open Leads → Create Lead → Reference Notes / Client Requirement. Type a sentence, use Marathi voice, and check that its English text is **appended**, not replacing the typed content. Save a lead and check the note in its reference.
5. Open any Lead → Log Follow-Up. Dictate the summary in Marathi, Save, confirm it appears once in the lead timeline and once in the linked travel agent engagement feed (existing sync only).
6. Open the Lead Executive Operations Activity modal. Dictate the Additional Note and Save.
7. Temporarily remove the key on a local test instance, restart dev server, and verify the Marathi transcript remains available, Save is disabled, and the user can retry / use original / discard without losing the earlier typed note.
8. Verify input is usable on a narrow screen and language switching is disabled while recognition/translation is active.

### 4. Verification already completed in this build
- **21/21 automated CRM unit tests pass** (`npm run test:crm`), including the existing relationship and grading tests plus voice language, mapping, collection and fallback tests.
- TypeScript parser reported **zero syntax errors** in all seven modified JavaScript/MJS files.
- **NOT verified:** full Next.js production build, actual Chrome microphone support for `mr-IN`, live Google Cloud Translation response, Firebase access with your credentials, and successful browser save. The source bundle intentionally does not contain credentials or `node_modules`.

### 5. Changed paths
- `lib/engagementVoiceText.js`
- `components/engagement/VoiceNoteTextarea.js`
- `app/api/engagement/translate-note/route.js`
- `app/(team)/leads/create/page.js`
- `components/leads/AddFollowUpModal.js`
- `components/leads/LeadOperationsActivityPanel.js`
- `tests/engagement-voice.test.mjs`
- `V2_7_5_12_20_MARATHI_VOICE_AND_LEADS.md`

### 6. Cloud Translation source
Google Cloud official documentation lists Marathi (`mr`) and Hindi (`hi`) among supported Cloud Translation languages: https://docs.cloud.google.com/translate/docs/languages . Speech-recognition support for `mr-IN` depends on the browser/device speech provider; Google Translation support alone does not guarantee microphone recognition support.
