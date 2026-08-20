// lib/sendEmailViaBrevo.js
// Authenticated client helper for Dream Trawell transactional/engagement email.

import { auth } from "@/lib/firebase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value = "") {
  return String(value || "").trim();
}

function normalizeEmail(value = "") {
  return clean(value).toLowerCase();
}

function normalizeRecipientList(list = []) {
  if (!Array.isArray(list)) return [];

  return list
    .map(item => {
      if (typeof item === "string") {
        return { email: normalizeEmail(item), name: "" };
      }

      return {
        email: normalizeEmail(item?.email),
        name: clean(item?.name)
      };
    })
    .filter(item => item.email && EMAIL_RE.test(item.email));
}

export async function sendEmailViaBrevo({
  toEmail,
  toName = "",
  subject,
  html,
  text = "",
  cc = [],
  bcc = [],
  replyTo = null,
  tags = [],
  emailType = "transactional"
}) {
  const recipientEmail = normalizeEmail(toEmail);
  const cleanSubject = clean(subject);
  const cleanHtml = String(html || "").trim();
  const cleanText = String(text || "").trim();

  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    throw new Error("Recipient email is missing or invalid");
  }

  if (!cleanSubject) throw new Error("Email subject is required");
  if (!cleanHtml) throw new Error("Email body is required");

  // Embedded base64 images make transactional emails very large and are
  // frequently filtered. Quotation images must use hosted HTTPS URLs.
  if (/src\s*=\s*["']data:/i.test(cleanHtml)) {
    throw new Error(
      "Email contains an embedded image. Please use an uploaded/hosted image instead."
    );
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("Your login session has expired. Please sign in again before sending email.");
  }

  const idToken = await currentUser.getIdToken();

  const normalizedReplyTo = replyTo?.email && EMAIL_RE.test(normalizeEmail(replyTo.email))
    ? {
        email: normalizeEmail(replyTo.email),
        name: clean(replyTo.name)
      }
    : null;

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      toEmail: recipientEmail,
      toName: clean(toName),
      subject: cleanSubject,
      html: cleanHtml,
      text: cleanText,
      cc: normalizeRecipientList(cc),
      bcc: normalizeRecipientList(bcc),
      replyTo: normalizedReplyTo,
      tags,
      emailType
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Brevo email error:", data);
    throw new Error(
      data?.error?.message ||
      data?.error ||
      "Email sending failed"
    );
  }

  return {
    ...data,
    messageId: data?.messageId || data?.result?.messageId || "",
    provider: data?.provider || "brevo",
    accepted: data?.accepted !== false
  };
}

export default sendEmailViaBrevo;
