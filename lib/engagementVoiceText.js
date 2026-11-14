// Pure helpers for browser speech dictation. No audio or browser globals here.
export const VOICE_LANGUAGES = Object.freeze([
  { value: "en-IN", label: "English voice → English text" },
  { value: "hi-IN", label: "Hindi voice → English text" }
]);

export function appendVoiceNote(current, transcript) {
  const base = String(current ?? "").trimEnd();
  const next = String(transcript ?? "").replace(/[\t ]+/g, " ").trim();
  if (!next) return String(current ?? "");
  return base ? `${base}\n${next}` : next;
}

// SpeechRecognitionResultList is array-like, not guaranteed to have map/forEach.
// Rebuilding from all available results avoids duplicated final text when a
// browser sends interim revisions of the same recognition segment.
export function collectRecognitionText(results) {
  const finalParts = [];
  const interimParts = [];
  for (let index = 0; index < (results?.length || 0); index += 1) {
    const result = results[index];
    const text = String(result?.[0]?.transcript || "").trim();
    if (!text) continue;
    (result.isFinal ? finalParts : interimParts).push(text);
  }
  return {
    finalText: finalParts.join(" ").trim(),
    interimText: interimParts.join(" ").trim()
  };
}

export function getSpeechErrorMessage(code) {
  const messages = {
    "not-allowed": "Microphone permission was denied. Allow microphone access in your browser settings.",
    "service-not-allowed": "Speech recognition is blocked in this browser or by device policy.",
    "audio-capture": "No microphone is available. Connect or enable a microphone.",
    "network": "Speech recognition needs a network connection in this browser. Try again online.",
    "no-speech": "No speech was detected. Try speaking closer to the microphone.",
    "language-not-supported": "This browser cannot recognise the selected language.",
    "aborted": "Dictation was cancelled."
  };
  return messages[code] || "Voice recognition stopped unexpectedly. Please try again or type the note.";
}
