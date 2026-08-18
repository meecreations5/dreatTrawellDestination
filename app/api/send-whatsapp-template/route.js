import { NextResponse } from "next/server";

function clean(value = "") {
  return String(value || "").trim();
}

function normalizePhone(value = "") {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const to = normalizePhone(body?.to);
    const parameters = Array.isArray(body?.parameters)
      ? body.parameters.map(value => clean(value))
      : [];

    if (!to) {
      return NextResponse.json({ error: "Recipient WhatsApp number is required." }, { status: 400 });
    }

    const token = clean(process.env.WHATSAPP_ACCESS_TOKEN);
    const phoneNumberId = clean(process.env.WHATSAPP_PHONE_NUMBER_ID);
    const apiVersion = clean(process.env.WHATSAPP_GRAPH_API_VERSION);
    const templateName = clean(process.env.WHATSAPP_MEETING_TEMPLATE_NAME);
    const languageCode = clean(process.env.WHATSAPP_MEETING_TEMPLATE_LANGUAGE || "en_US");

    const missing = [];
    if (!token) missing.push("WHATSAPP_ACCESS_TOKEN");
    if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!apiVersion) missing.push("WHATSAPP_GRAPH_API_VERSION");
    if (!templateName) missing.push("WHATSAPP_MEETING_TEMPLATE_NAME");

    if (missing.length) {
      return NextResponse.json(
        {
          error: "WhatsApp Business API is not configured.",
          code: "whatsapp_not_configured",
          missing
        },
        { status: 503 }
      );
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: parameters.map(text => ({ type: "text", text }))
          }
        ]
      }
    };

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.error?.message || "WhatsApp notification failed.",
          code: data?.error?.code || "whatsapp_send_failed",
          details: data
        },
        { status: response.status || 502 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.messages?.[0]?.id || "",
      waId: data?.contacts?.[0]?.wa_id || ""
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to send WhatsApp notification." },
      { status: 500 }
    );
  }
}
