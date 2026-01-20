//lib/sendEmailViaBrevo

export async function sendEmailViaBrevo({
  toEmail,
  toName,
  subject,
  html
}) {
  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      toEmail,
      toName,
      subject,
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Brevo error:", err);
    throw new Error("Email sending failed");
  }
}
