// lib/sendEmailViaBrevo.js
// Authenticated Brevo transport through Firebase Functions.
// This deliberately bypasses the Next.js /api/send-email route so email
// sending does not depend on server-side Firebase credential/token handling.

import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "@/lib/firebase";

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
    .map((item) => {
      if (typeof item === "string") {
        return { email: normalizeEmail(item), name: "" };
      }

      return {
        email: normalizeEmail(item?.email),
        name: clean(item?.name)
      };
    })
    .filter((item) => item.email && EMAIL_RE.test(item.email));
}

function getCallableErrorMessage(error) {
  const detailMessage =
    error?.details?.providerMessage ||
    error?.details?.message ||
    error?.details?.error ||
    "";

  const directMessage = clean(error?.message)
    .replace(/^Firebase:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, "")
    .trim();

  return clean(detailMessage) || directMessage || "Email sending failed";
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

  if (/src\s*=\s*["']data:/i.test(cleanHtml)) {
    throw new Error(
      "Email contains an embedded image. Please use an uploaded/hosted image instead."
    );
  }

  if (!auth?.currentUser || !app) {
    throw new Error(
      "Your login session has expired. Please sign in again before sending email."
    );
  }

  // Force-refresh once so Firebase callable receives a current Auth token.
  await auth.currentUser.getIdToken(true);

  const normalizedReplyTo =
    replyTo?.email && EMAIL_RE.test(normalizeEmail(replyTo.email))
      ? {
          email: normalizeEmail(replyTo.email),
          name: clean(replyTo.name)
        }
      : null;

  const functions = getFunctions(app, "us-central1");
  const sendEmail = httpsCallable(functions, "sendBrevoEmail", {
    timeout: 60_000
  });

  try {
    const response = await sendEmail({
      toEmail: recipientEmail,
      toName: clean(toName),
      subject: cleanSubject,
      html: cleanHtml,
      text: cleanText,
      cc: normalizeRecipientList(cc),
      bcc: normalizeRecipientList(bcc),
      replyTo: normalizedReplyTo,
      tags: Array.isArray(tags) ? tags : [],
      emailType: clean(emailType) || "transactional"
    });

    const data = response?.data || {};
    return {
      ...data,
      messageId: data?.messageId || "",
      provider: data?.provider || "brevo",
      accepted: data?.accepted !== false
    };
  } catch (error) {
    const message = getCallableErrorMessage(error);
    console.warn("Brevo email send failed:", {
      code: error?.code || "",
      message,
      providerStatus: error?.details?.providerStatus || "",
      providerCode: error?.details?.providerCode || ""
    });
    throw new Error(message);
  }
}

export default sendEmailViaBrevo;
