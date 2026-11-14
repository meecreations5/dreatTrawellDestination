# DreamTrawell CRM — V2.7.5.12.19
## Engagement UI Color Alignment & Voice-to-Text Notes

**Baseline:** V2.7.5.12.18 (Agent Engagement Intelligence, Relationship Activation, Communication role permissions).

### 1) Design alignment
- Updated **Admin > Travel Agents > Engagement Intelligence** to match the established CRM/engagement styling: white/slate surfaces, primary blue buttons and progress bars, subtle blue-to-cyan header, restrained blue/cyan grade badges and neutral lower grades.
- Updated the **travel agent profile relationship grade badge** to use the same visual system. No change to scores, qualification gates, calculations, filters, CSV, Firestore collections or user permissions.

### 2) Voice note entry
In **Engagements > [Travel Agent] > Smart Engagement Logger > What was discussed?** and the optional **Internal Note** field:

- Select `English voice → English text`: browser speech recognition runs with `en-IN`; recognised English transcript appends to the editable text field.
- Select `Hindi voice → English text`: browser speech recognition runs with `hi-IN`; the Hindi transcript is sent to an authenticated Next.js endpoint for Google Cloud Translation (`hi` → `en`); returned English text appends to the editable field.
- Start with `Speak note`, then `Finish` or `Cancel`. Transcribed notes can be reviewed or edited **before** the existing engagement Save action.
- If Hindi translation fails, the original transcript stays visible; users may **Retry English**, **Use original Hindi** (explicit fallback), or **Discard**. Saving is blocked while speech transcription/translation remains unresolved so unsaved dictated words aren't silently dropped.
- Notes can still be typed normally. No recording upload or stored audio was added to DreamTrawell. The standard Firestore `engagements.message` and `engagements.customRemark` fields are reused; no migration needed.

### 3) Required setup for Hindi-to-English
Set the **server-only** environment variable in `.env.local` (local development) and Vercel Project > Settings > Environment Variables (production):

```
GOOGLE_CLOUD_TRANSLATION_API_KEY=<your server-only Google Cloud Translation Basic API key>
```

Use a Google Cloud project with **Cloud Translation API enabled and billing configured**. Restrict the key to the Cloud Translation API and configure Google Cloud API quotas/budget alerts. **Do not** name this variable `NEXT_PUBLIC_*`, put it in client code, or commit the secret. Redeploy after adding it. English-to-English dictation works without this key.

If the key is absent, Hindi dictation still captures the Hindi transcript but presents a clear configuration error; English translation is **not** claimed to work without its provider. The backend uses `POST https://translation.googleapis.com/language/translate/v2`, `source=hi`, `target=en`, `format=text`.

The translation endpoint authenticates a signed-in team user via the project's existing Firebase Bearer-token verifier, caps transcripts at 3,500 characters, applies a per-process short-window request limit, and does not log note content. In Vercel's distributed/serverless environment, the limit is best-effort only; configure Cloud API quota limits as the reliable billing control.

### 4) Browser, language and privacy requirements
- Browser speech recognition is best tested in current Chrome/Edge, on **HTTPS or localhost**, with microphone permission granted. Support varies by browser/platform; the form detects missing recognition support and leaves manual typing available.
- Some browsers send microphone audio to their speech-recognition provider; browser speech recognition isn't guaranteed to work offline. The app does not call-record, store, or upload microphone audio to Firestore.
- In Hindi mode, **text only** is sent from the authenticated CRM server to Google Cloud Translation. Check organisation policy before dictating confidential personal or payment details.
- Hindi-English translation may mistranscribe travel-agent names, destinations, prices, dates or proper nouns. Team should confirm the displayed English note before saving.

### 5) Files
**New**
- `lib/engagementVoiceText.js`
- `components/engagement/VoiceNoteTextarea.js`
- `app/api/engagement/translate-note/route.js`
- `tests/engagement-voice.test.mjs`
- This release note.

**Updated**
- `app/(team)/engagements/travel-agent/[agentId]/EngagementForm.js`
- `app/(team)/engagements/travel-agent/[agentId]/page.js`
- `app/admin/travel-agents/engagement-intelligence/page.js`
- `package.json` (`test:crm` includes voice tests)

### 6) Validation and release conditions
- **19/19 automated tests passed** (`node --test ...`). This includes the 15 existing activation/intelligence tests and 4 new voice-helper tests.
- TypeScript's JSX/JavaScript syntax parser found **no syntax errors** in the 7 changed/new script files.
- Full production build was **not** run: `npm ci --offline` cannot find `zod-validation-error@4.0.2` in this environment. Run `npm ci`, `npm run test:crm`, `npm run build` in your online build environment.
- Browser microphone tests, Hindi transcription, Cloud translation with a real Google API key, Firebase role permission acceptance and Vercel deployment **must be performed live**; they were not available here.

### 7) Acceptance checklist
1. Verify blue/cyan theme in Engagement Intelligence and agent profile, with all existing report data and filters retained.
2. In Chrome on HTTPS, permit microphone and say: "Spoke to the agent about Singapore rates" using English mode. Finish and verify editable English text appears.
3. With Cloud Translation configured, select Hindi and say: "एजेंट से बात हुई, उन्हें सिंगापुर का नया रेट चाहिए।" Verify English appears in the summary and original Hindi is available for review.
4. With no key or provider outage, verify the original Hindi transcript is retained for retry, manual insertion or discard; save cannot silently lose an unresolved transcript.
5. Start dictation then cancel; no text should be added. Edit typed text, dictate more and verify it appends without replacing earlier notes.
6. Save a test engagement and verify notes persist in the existing Firestore fields; verify no audio object is stored.
7. Repeat as Engagement / Relationship Executive and inspect browser permission errors and mobile layout.
