// app/api/send-email/route.js
// or src/app/api/send-email/route.js

import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeEmailList(list = []) {
  if (!Array.isArray(list)) return [];

  return list
    .map(item => {
      if (typeof item === "string") {
        return {
          email: item.trim()
        };
      }

      return {
        email: String(item?.email || "").trim(),
        name: item?.name || ""
      };
    })
    .filter(item => item.email);
}

function removeDuplicateRecipients({ toEmail, cc = [], bcc = [] }) {
  const used = new Set();

  if (toEmail) {
    used.add(String(toEmail).trim().toLowerCase());
  }

  const uniqueCc = [];

  cc.forEach(item => {
    const email = String(item.email || "").trim().toLowerCase();

    if (!email || used.has(email)) return;

    used.add(email);
    uniqueCc.push(item);
  });

  const uniqueBcc = [];

  bcc.forEach(item => {
    const email = String(item.email || "").trim().toLowerCase();

    if (!email || used.has(email)) return;

    used.add(email);
    uniqueBcc.push(item);
  });

  return {
    cc: uniqueCc,
    bcc: uniqueBcc
  };
}

export async function POST(req) {
  try {
    const body = await req.json();

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "DreamTrawell";

    if (!apiKey) {
      return NextResponse.json(
        { error: "BREVO_API_KEY missing" },
        { status: 500 }
      );
    }

    if (!senderEmail) {
      return NextResponse.json(
        { error: "BREVO_SENDER_EMAIL missing" },
        { status: 500 }
      );
    }

    const {
      toEmail,
      toName = "",
      subject,
      html,
      cc = [],
      bcc = [],
      replyTo = null
    } = body;

    if (!toEmail || !subject || !html) {
      return NextResponse.json(
        {
          error: "toEmail, subject and html are required"
        },
        { status: 400 }
      );
    }

    const normalizedCc = normalizeEmailList(cc);
    const normalizedBcc = normalizeEmailList(bcc);

    const uniqueRecipients = removeDuplicateRecipients({
      toEmail,
      cc: normalizedCc,
      bcc: normalizedBcc
    });

    const payload = {
      sender: {
        email: senderEmail,
        name: senderName
      },
      to: [
        {
          email: toEmail,
          name: toName || ""
        }
      ],
      subject,
      htmlContent: html
    };

    if (uniqueRecipients.cc.length) {
      payload.cc = uniqueRecipients.cc;
    }

    if (uniqueRecipients.bcc.length) {
      payload.bcc = uniqueRecipients.bcc;
    }

    if (replyTo?.email) {
      payload.replyTo = {
        email: replyTo.email,
        name: replyTo.name || ""
      };
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Brevo API error:", result);

      return NextResponse.json(
        {
          error: result?.message || "Brevo email failed",
          detail: result
        },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result
    });
  } catch (err) {
    console.error("Send email fatal error:", err);

    return NextResponse.json(
      {
        error: err.message || "Email send failed"
      },
      { status: 500 }
    );
  }
}