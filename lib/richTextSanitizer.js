// lib/richTextSanitizer.js
// Removes Microsoft Word / Outlook clipboard metadata while preserving useful rich text.

const OFFICE_TEXT_PREFIX = /^\s*(?:MicrosoftInternetExplorer4\s*)?(?:Normal\s+0\s+false\s+false(?:\s+false){0,3}\s+[A-Za-z]{2}(?:-[A-Za-z]{2})?\s+X-NONE\s+X-NONE)\s*/i;

const OFFICE_HTML_TEXT_PREFIX = /^\s*(?:MicrosoftInternetExplorer4(?:\s|&nbsp;|&#160;)*)?Normal(?:\s|&nbsp;|&#160;)+0(?:\s|&nbsp;|&#160;)+false(?:\s|&nbsp;|&#160;)+false(?:(?:\s|&nbsp;|&#160;)+false){0,3}(?:\s|&nbsp;|&#160;)+[A-Za-z]{2}(?:-[A-Za-z]{2})?(?:\s|&nbsp;|&#160;)+X-NONE(?:\s|&nbsp;|&#160;)+X-NONE(?:\s|&nbsp;|&#160;)*/i;

function decodeBasicEntities(value = "") {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'");
}

export function cleanOfficeClipboardText(value = "") {
  let text = decodeBasicEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .trim();

  // Word/Outlook occasionally exposes its language/style metadata as visible
  // text when copied into contentEditable fields. Keep this anchored to the
  // beginning so normal user content is never removed from the middle.
  for (let index = 0; index < 3; index += 1) {
    const next = text.replace(OFFICE_TEXT_PREFIX, "");
    if (next === text) break;
    text = next.trim();
  }

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripOfficePrefixFromTextNodes(html = "") {
  const tokens = String(html || "").split(/(<[^>]+>)/g);
  let scanningStart = true;

  return tokens
    .map(token => {
      if (!scanningStart || !token || token.startsWith("<")) return token;

      const decoded = decodeBasicEntities(token).replace(/\u00a0/g, " ");
      if (!decoded.trim()) return token;

      const cleanedToken = token.replace(OFFICE_HTML_TEXT_PREFIX, "");

      if (cleanedToken !== token) {
        if (decodeBasicEntities(cleanedToken).trim()) {
          scanningStart = false;
        }
        return cleanedToken;
      }

      scanningStart = false;
      return token;
    })
    .join("");
}

export function sanitizeRichTextHtml(html = "") {
  let value = String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<xml[\s\S]*?>[\s\S]*?<\/xml>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<\/?(?:o|w|v|m):[^>]*>/gi, "")
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/\sclass=(['"]?)Mso[^\s>"']*\1/gi, "")
    .trim();

  value = stripOfficePrefixFromTextNodes(value);

  return value.trim();
}

export function richTextHtmlToText(html = "") {
  const text = sanitizeRichTextHtml(html)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return cleanOfficeClipboardText(text);
}

export function sanitizeClientReference(reference = {}) {
  const notesHtml = sanitizeRichTextHtml(reference?.notesHtml || "");
  const notes = cleanOfficeClipboardText(
    reference?.notes || richTextHtmlToText(notesHtml) || ""
  );

  return {
    ...reference,
    notes,
    notesHtml
  };
}
