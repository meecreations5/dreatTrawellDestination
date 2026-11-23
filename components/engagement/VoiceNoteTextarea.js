"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, RotateCcw, Trash2, Languages } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  VOICE_LANGUAGES,
  getVoiceLanguage,
  getTranslationLanguageName,
  collectRecognitionText,
  getSpeechErrorMessage
} from "@/lib/engagementVoiceText";

/**
 * Optional dictation for an ordinary controlled note, or a rich-text editor.
 * English is inserted directly. Hindi/Marathi use browser recognition followed
 * by authenticated text-only Cloud Translation. Original text stays available
 * for explicit retry / original-language fallback / discard on failure.
 */
export default function VoiceNoteTextarea({
  value = "",
  onChange,
  onAppend,
  onBusyChange,
  placeholder = "Write the conversation summary...",
  minHeight = "110px",
  disabled = false,
  controlsOnly = false
}) {
  const [supported, setSupported] = useState(null);
  const [language, setLanguage] = useState("en-IN");
  const [phase, setPhase] = useState("idle");
  const [interim, setInterim] = useState("");
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [originalSource, setOriginalSource] = useState("");
  const [pendingTranscript, setPendingTranscript] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const listeningRef = useRef(null);
  const activeRef = useRef(true);
  const abortedRef = useRef(false);
  const finalTextRef = useRef("");
  const controllerRef = useRef(null);
  const appendRef = useRef(onAppend);
  const busyRef = useRef(onBusyChange);

  useEffect(() => { appendRef.current = onAppend; }, [onAppend]);
  useEffect(() => { busyRef.current = onBusyChange; }, [onBusyChange]);

  useEffect(() => {
    activeRef.current = true;
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      activeRef.current = false;
      const recognition = listeningRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.abort();
        listeningRef.current = null;
      }
      controllerRef.current?.abort();
      busyRef.current?.(false);
    };
  }, []);

  const translateToEnglish = async (text, source) => {
    if (!activeRef.current) return;
    const sourceName = getTranslationLanguageName(source);
    setPhase("translating");
    setError("");
    setStatus(`Converting ${sourceName} speech into English text...`);
    busyRef.current?.(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in again before translating.");
      if (controller.signal.aborted || !activeRef.current) return;
      const response = await fetch("/api/engagement/translate-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ source, target: "en", text }),
        signal: controller.signal,
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Unable to translate this note.");
      const english = String(body?.translatedText || "").trim();
      if (!english) throw new Error("Translation returned no text.");
      if (!activeRef.current || controller.signal.aborted) return;
      appendRef.current?.(english);
      setPendingTranscript("");
      setStatus("English text added. Please review names, dates and package rates before saving.");
      busyRef.current?.(false);
    } catch (err) {
      if (!activeRef.current || controller.signal.aborted) return;
      setError(err?.message || `${sourceName} translation failed.`);
      setStatus(`${sourceName} transcript saved temporarily in this form. Retry or choose what to do with it.`);
      // Never let Save silently lose a pending, uncommitted voice note.
      busyRef.current?.(true);
    } finally {
      if (activeRef.current && !controller.signal.aborted) setPhase("idle");
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const startListening = () => {
    if (disabled || phase !== "idle" || pendingTranscript) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      setError("Voice input is not supported in this browser. You can still type the note.");
      return;
    }
    const recognition = new SpeechRecognition();
    const selected = getVoiceLanguage(language);
    recognition.lang = selected.value;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    abortedRef.current = false;
    finalTextRef.current = "";
    setInterim("");
    setError("");
    setStatus("Listening. Speak naturally; select Finish when done.");
    listeningRef.current = recognition;
    recognition.onresult = event => {
      if (!activeRef.current || listeningRef.current !== recognition) return;
      const result = collectRecognitionText(event.results);
      finalTextRef.current = result.finalText;
      setInterim(result.interimText || result.finalText);
    };
    recognition.onerror = event => {
      if (!activeRef.current || abortedRef.current) return;
      if (event.error !== "aborted") setError(getSpeechErrorMessage(event.error));
    };
    recognition.onend = () => {
      if (listeningRef.current !== recognition) return;
      listeningRef.current = null;
      if (!activeRef.current) return;
      setInterim("");
      if (abortedRef.current) {
        setPhase("idle");
        busyRef.current?.(false);
        return;
      }
      const transcript = finalTextRef.current.trim();
      if (!transcript) {
        setPhase("idle");
        busyRef.current?.(false);
        setStatus("No completed speech was captured. Try again or type the note.");
        return;
      }
      if (!selected.source) {
        appendRef.current?.(transcript);
        setStatus("English dictation added. Review the note before saving.");
        setPhase("idle");
        busyRef.current?.(false);
      } else {
        setOriginalTranscript(transcript);
        setOriginalSource(selected.source);
        setPendingTranscript(transcript);
        void translateToEnglish(transcript, selected.source);
      }
    };
    try {
      recognition.start();
      setPhase("listening");
      busyRef.current?.(true);
    } catch {
      listeningRef.current = null;
      setPhase("idle");
      busyRef.current?.(false);
      setError("Unable to start the microphone. Check permissions and try again.");
    }
  };

  const finishListening = () => listeningRef.current?.stop();
  const cancelListening = () => {
    abortedRef.current = true;
    listeningRef.current?.abort();
    setPhase("idle");
    setInterim("");
    setStatus("Dictation cancelled.");
    busyRef.current?.(false);
  };
  const clearPending = () => {
    setPendingTranscript("");
    setOriginalTranscript("");
    setOriginalSource("");
    setError("");
    setStatus("Transcript discarded.");
    busyRef.current?.(false);
  };
  const insertOriginal = () => {
    appendRef.current?.(pendingTranscript);
    setPendingTranscript("");
    setError("");
    setStatus(`Original ${getTranslationLanguageName(originalSource)} text added. You can edit it before saving.`);
    busyRef.current?.(false);
  };

  return (
    <div className="space-y-2">
      {!controlsOnly && (
        <textarea
          className="mui-input min-h-[110px] w-full resize-y leading-relaxed focus:border-blue-500"
          style={{ minHeight }}
          value={value}
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 via-cyan-50/50 to-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-blue-800">
            <Languages className="h-4 w-4 shrink-0" />
            <span className="sr-only">Voice input language</span>
            <select
              aria-label="Voice input language"
              value={language}
              onChange={event => setLanguage(event.target.value)}
              disabled={disabled || phase !== "idle" || Boolean(pendingTranscript)}
              className="w-full min-w-0 max-w-[285px] rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
            >
              {VOICE_LANGUAGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          {phase === "listening" ? (
            <div className="flex gap-2">
              <button type="button" onClick={finishListening} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><MicOff className="h-4 w-4" /> Finish</button>
              <button type="button" onClick={cancelListening} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-blue-50">Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startListening}
              disabled={disabled || supported !== true || phase !== "idle" || Boolean(pendingTranscript)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === "translating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              {phase === "translating" ? "Translating..." : "Speak note"}
            </button>
          )}
        </div>
        {supported === false && <p role="note" className="mt-2 text-xs text-amber-800">Microphone dictation is unavailable in this browser. Use Chrome or Edge with microphone permission, or type normally.</p>}
        {phase === "listening" && <p role="status" className="mt-2 text-xs font-semibold text-blue-700">● Listening in {getVoiceLanguage(language).name}... {interim ? <span className="font-normal text-slate-600">{interim}</span> : null}</p>}
        {status && phase !== "listening" && <p role="status" className="mt-2 text-xs text-slate-600">{status}</p>}
        {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
        {originalTranscript && <details className="mt-2 rounded-lg border border-blue-100 bg-white p-2 text-xs text-slate-600" open={Boolean(pendingTranscript)}>
          <summary className="cursor-pointer font-semibold text-blue-700">Original {getTranslationLanguageName(originalSource)} transcript (review)</summary>
          <p className="mt-2 whitespace-pre-wrap break-words">{originalTranscript}</p>
        </details>}
        {pendingTranscript && phase !== "translating" && <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void translateToEnglish(pendingTranscript, originalSource)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><RotateCcw className="h-3.5 w-3.5" /> Retry English</button>
          <button type="button" onClick={insertOriginal} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Use original {getTranslationLanguageName(originalSource)}</button>
          <button type="button" onClick={clearPending} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-white"><Trash2 className="h-3.5 w-3.5" /> Discard</button>
        </div>}
      </div>
      <p className="text-[11px] leading-4 text-slate-500">Voice entry is optional; verify names, dates and rates before saving. Audio may be processed by your browser's speech service. Hindi/Marathi transcripts are sent as text for translation; audio is not saved in the CRM.</p>
    </div>
  );
}
