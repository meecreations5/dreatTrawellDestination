// lib/sendEmailViaBrevo.js

export async function sendEmailViaBrevo({
  toEmail,
  toName = "",
  subject,
  html,
  cc = [],
  bcc = [],
  replyTo = null
}) {
  if (!toEmail) {
    throw new Error("Recipient email is required");
  }

  if (!subject) {
    throw new Error("Email subject is required");
  }

  if (!html) {
    throw new Error("Email body is required");
  }

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      toEmail,
      toName,
      subject,
      html,
      cc,
      bcc,
      replyTo
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Brevo error:", data);
    throw new Error(
      data?.error?.message ||
      data?.error ||
      "Email sending failed"
    );
  }

  return data;
}