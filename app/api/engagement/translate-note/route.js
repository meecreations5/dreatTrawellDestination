// Hindi/Marathi transcript -> English note. The browser performs speech recognition;
// this authenticated endpoint ONLY translates plain text (never audio).
import { NextResponse } from "next/server";
import { verifyFirebaseBearerToken } from "@/lib/firebaseAdminServer";
import { TRANSLATABLE_SOURCES, getTranslationLanguageName } from "@/lib/engagementVoiceText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const MAX_TEXT_LENGTH = 3500;
const MAX_PER_MINUTE = 12; // Best-effort per-instance limit; also configure Cloud quotas.
const RATE_WINDOW = 60_000;
const recentRequests = new Map();
const responseHeaders = { "Cache-Control": "no-store" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

function permitted(uid) {
  const now = Date.now();
  const recent = (recentRequests.get(uid) || []).filter(time => now - time < RATE_WINDOW);
  if (recent.length >= MAX_PER_MINUTE) {
    recentRequests.set(uid, recent);
    return false;
  }
  recent.push(now);
  recentRequests.set(uid, recent);
  // Prune occasionally to bound memory in long-running server instances.
  if (recentRequests.size > 3000) {
    for (const [key, times] of recentRequests) {
      if (!times.length || now - times[times.length - 1] > RATE_WINDOW) recentRequests.delete(key);
    }
  }
  return true;
}

// Cloud Translation Basic can HTML-escape ampersands and quotes in its JSON text.
function decodeTranslation(value) {
  const input = String(value || "");
  return input.replace(/&(?:amp|lt|gt|quot|apos|#39|#x([0-9a-f]+)|#(\d+));/gi, (token, hex, decimal) => {
    if (hex || decimal) {
      const point = parseInt(hex || decimal, hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : token;
    }
    const table = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'" };
    return table[token.toLowerCase()] || token;
  }).trim();
}

export async function POST(request) {
  let identity;
  try {
    identity = await verifyFirebaseBearerToken(request);
  } catch (error) {
    return json({ error: error?.message || "Please sign in again." }, error?.status || 401);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "A valid JSON request is required." }, 400); }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const source = body?.source;
  if (!TRANSLATABLE_SOURCES.includes(source) || body?.target !== "en") {
    return json({ error: "Only Hindi/Marathi-to-English translation is supported." }, 400);
  }
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return json({ error: `${getTranslationLanguageName(source)} transcript must contain 1 to ${MAX_TEXT_LENGTH} characters.` }, 400);
  }

  const apiKey = String(process.env.GOOGLE_CLOUD_TRANSLATION_API_KEY || "").trim();
  if (!apiKey) {
    return json({
      error: `${getTranslationLanguageName(source)}-to-English translation has not been configured. Ask your administrator to enable Google Cloud Translation. Your transcript is still available for review.`
    }, 503);
  }
  if (!permitted(identity.uid)) {
    return json({ error: "Too many translations. Please try again in a minute." }, 429);
  }

  try {
    const url = new URL(TRANSLATE_URL);
    url.searchParams.set("key", apiKey);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
      body: JSON.stringify({ q: text, source, target: "en", format: "text" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      console.error("Engagement translation service error", { status: response.status });
      return json({ error: response.status === 429
        ? "Translation quota was reached. Please try again later."
        : `English translation is temporarily unavailable. Your ${getTranslationLanguageName(source)} transcript has been preserved in the form.` },
      response.status === 429 ? 429 : 502);
    }
    const data = await response.json();
    const translatedText = decodeTranslation(data?.data?.translations?.[0]?.translatedText);
    if (!translatedText) return json({ error: "No English translation was returned. Please try again." }, 502);
    return json({ translatedText, source, target: "en" });
  } catch (error) {
    console.error("Engagement translation request failed", { name: error?.name });
    return json({ error: `Translation connection failed. Review your ${getTranslationLanguageName(source)} transcript and retry.` }, 503);
  }
}
