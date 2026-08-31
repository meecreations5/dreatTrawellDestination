// app/api/send-email/route.js
// Authenticated Brevo transport for CRM email.

import { NextResponse } from "next/server";
import { verifyFirebaseBearerToken } from "@/lib/firebaseAdminServer";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_LENGTH = 180;
const MAX_HTML_BYTES = 1_500_000;
const MAX_TEXT_BYTES = 500_000;
const MAX_COPY_RECIPIENTS = 12;

function clean(value = "") {
  return String(value || "").trim();
}

function normalizeEmail(value = "") {
  return clean(value).toLowerCase();
}

function isValidEmail(value = "") {
  return EMAIL_RE.test(normalizeEmail(value));
}

function normalizeEmailList(list = []) {
  if (!Array.isArray(list)) return [];

  return list
    .map(item => {
      if (typeof item === "string") {
        return { email: normalizeEmail(item), name: "" };
      }

      return {
        email: normalizeEmail(item?.email),
        name: clean(item?.name).slice(0, 120)
      };
    })
    .filter(item => item.email && isValidEmail(item.email));
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];

  return Array.from(
    new Set(
      tags
        .map(tag => clean(tag))
        .filter(Boolean)
        .map(tag => tag.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64))
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function htmlToPlainText(html = "") {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function removeDuplicateRecipients({ toEmail, cc = [], bcc = [] }) {
  const used = new Set([normalizeEmail(toEmail)].filter(Boolean));
  const uniqueCc = [];
  const uniqueBcc = [];

  cc.forEach(item => {
    const email = normalizeEmail(item.email);
    if (!email || used.has(email)) return;
    used.add(email);
    uniqueCc.push({ ...item, email });
  });

  bcc.forEach(item => {
    const email = normalizeEmail(item.email);
    if (!email || used.has(email)) return;
    used.add(email);
    uniqueBcc.push({ ...item, email });
  });

  return { cc: uniqueCc, bcc: uniqueBcc };
}

function normalizeEmailType(value = "") {
  return clean(value).toLowerCase() === "engagement"
    ? "engagement"
    : "transactional";
}

function getSender(emailType) {
  if (emailType === "engagement") {
    return {
      email: normalizeEmail(
        process.env.BREVO_ENGAGEMENT_SENDER_EMAIL ||
        process.env.BREVO_SENDER_EMAIL
      ),
      name: clean(
        process.env.BREVO_ENGAGEMENT_SENDER_NAME ||
        process.env.BREVO_SENDER_NAME ||
        "DreamTrawell"
      )
    };
  }

  return {
    email: normalizeEmail(
      process.env.BREVO_TRANSACTIONAL_SENDER_EMAIL ||
      process.env.BREVO_SENDER_EMAIL
    ),
    name: clean(
      process.env.BREVO_TRANSACTIONAL_SENDER_NAME ||
      process.env.BREVO_SENDER_NAME ||
      "DreamTrawell"
    )
  };
}

function getByteSize(value = "") {
  return Buffer.byteLength(String(value || ""), "utf8");
}

export async function POST(req) {
  try {
    const authenticatedUser = await verifyFirebaseBearerToken(req);
    const body = await req.json();

    const apiKey = clean(process.env.BREVO_API_KEY);
    const emailType = normalizeEmailType(body?.emailType);
    const sender = getSender(emailType);

    if (!apiKey) {
      return NextResponse.json({ error: "BREVO_API_KEY missing" }, { status: 500 });
    }

    if (!sender.email || !isValidEmail(sender.email)) {
      return NextResponse.json(
        { error: `${emailType === "engagement" ? "Engagement" : "Transactional"} sender email is missing or invalid` },
        { status: 500 }
      );
    }

    const toEmail = normalizeEmail(body?.toEmail);
    const toName = clean(body?.toName).slice(0, 120);
    const subject = clean(body?.subject);
    const html = String(body?.html || "").trim();
    const text = String(body?.text || "").trim();

    if (!toEmail || !isValidEmail(toEmail)) {
      return NextResponse.json({ error: "Recipient email is missing or invalid" }, { status: 400 });
    }

    if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json(
        { error: `Subject is required and must be ${MAX_SUBJECT_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    if (!html) {
      return NextResponse.json({ error: "Email body is required" }, { status: 400 });
    }

    if (getByteSize(html) > MAX_HTML_BYTES || getByteSize(text) > MAX_TEXT_BYTES) {
      return NextResponse.json(
        { error: "Email body is too large. Use hosted links for large images/files." },
        { status: 413 }
      );
    }

    // Prevent oversized base64 image payloads that commonly trigger filtering.
    if (/src\s*=\s*["']data:/i.test(html)) {
      return NextResponse.json(
        { error: "Embedded base64 images are not allowed in CRM email. Use hosted HTTPS images." },
        { status: 400 }
      );
    }

    const normalizedCc = normalizeEmailList(body?.cc);
    const normalizedBcc = normalizeEmailList(body?.bcc);
    const uniqueRecipients = removeDuplicateRecipients({
      toEmail,
      cc: normalizedCc,
      bcc: normalizedBcc
    });

    if (uniqueRecipients.cc.length + uniqueRecipients.bcc.length > MAX_COPY_RECIPIENTS) {
      return NextResponse.json(
        { error: `Too many CC/BCC recipients. Maximum ${MAX_COPY_RECIPIENTS}.` },
        { status: 400 }
      );
    }

    const normalizedTags = normalizeTags([
      ...(Array.isArray(body?.tags) ? body.tags : []),
      `emailtype_${emailType}`
    ]);

    const replyToEmail = normalizeEmail(body?.replyTo?.email);
    const payload = {
      sender,
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent: html,
      textContent: text || htmlToPlainText(html),
      tags: normalizedTags
    };

    if (uniqueRecipients.cc.length) payload.cc = uniqueRecipients.cc;
    if (uniqueRecipients.bcc.length) payload.bcc = uniqueRecipients.bcc;

    if (replyToEmail && isValidEmail(replyToEmail)) {
      payload.replyTo = {
        email: replyToEmail,
        name: clean(body?.replyTo?.name).slice(0, 120)
      };
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Brevo API error:", {
        status: response.status,
        result,
        toEmail,
        subject,
        emailType,
        requestedByUid: authenticatedUser.uid,
        tags: normalizedTags
      });

      return NextResponse.json(
        {
          error: result?.message || "Brevo email submission failed",
          providerStatus: response.status,
          detail: result
        },
        { status: response.status || 500 }
      );
    }

    const messageId = clean(result?.messageId);

    console.info("Brevo email accepted", {
      messageId,
      toEmail,
      emailType,
      requestedByUid: authenticatedUser.uid,
      tags: normalizedTags
    });

    return NextResponse.json({
      success: true,
      accepted: true,
      deliveryStatus: "accepted",
      provider: "brevo",
      messageId,
      emailType,
      senderDomain: sender.email.split("@")[1] || ""
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    console.error("Send email fatal error:", {
      status,
      message: err?.message || String(err)
    });

    return NextResponse.json(
      { error: status === 401 ? "Your login session is invalid or expired" : (err?.message || "Email send failed") },
      { status }
    );
  }
}
