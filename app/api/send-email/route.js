//api/send-email/route.js

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "BREVO_API_KEY missing" },
        { status: 500 }
      );
    }

    const payload = {
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME
      },
      to: [
        {
          email: body.toEmail,
          name: body.toName
        }
      ],
      subject: body.subject,
      htmlContent: body.html
    };

    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": apiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Brevo API error:", result);
      return NextResponse.json(
        { error: result },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, result });

  } catch (err) {
    console.error("Send email fatal error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
