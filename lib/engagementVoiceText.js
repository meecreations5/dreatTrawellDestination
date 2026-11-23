// Shared, dependency-free helpers for Engagement and Lead voice dictation.
// Speech recognition runs in the browser. Only transcribed text is translated.
export const VOICE_LANGUAGES = Object.freeze([
  { value: "en-IN", label: "English voice → English text", name: "English", source: null },
  { value: "hi-IN", label: "Hindi voice → English text", name: "Hindi", source: "hi" },
  { value: "mr-IN", label: "Marathi voice → English text", name: "Marathi", source: "mr" }
]);

export const TRANSLATABLE_SOURCES = Object.freeze(["hi", "mr"]);

export function getVoiceLanguage(language) {
  return VOICE_LANGUAGES.find(item => item.value === language) || VOICE_LANGUAGES[0];
}

export function getTranslationLanguageName(source) {
  return VOICE_LANGUAGES.find(item => item.source === source)?.name || "Source language";
}

export function appendVoiceNote(current, transcript) {
  const base = String(current ?? "").trimEnd();
  const next = String(transcript ?? "").replace(/[\t ]+/g, " ").trim();
  if (!next) return String(current ?? "");
  return base ? `${base}\n${next}` : next;
}

// SpeechRecognitionResultList is array-like, not guaranteed to have map/forEach.
// Rebuilding all results avoids duplicated words from changing interim segments.
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
    "language-not-supported": "This browser cannot recognise the selected language. Try another browser or type the note.",
    "aborted": "Dictation was cancelled."
  };
  return messages[code] || "Voice recognition stopped unexpectedly. Please try again or type the note.";
}
