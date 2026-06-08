// lib/signatureUtils.js

export function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sanitizeSignatureHtml(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function getMemberUid(member) {
  return getFirstValue(
    member?.uid,
    member?.id,
    member?.userId,
    member?.email
  );
}

export function getMemberName(member) {
  return getFirstValue(
    member?.displayName,
    member?.name,
    member?.fullName,
    member?.email
  );
}

export function getMemberEmail(member) {
  return getFirstValue(member?.email, member?.workEmail);
}

export function getMemberMobile(member) {
  return getFirstValue(
    member?.mobile,
    member?.phone,
    member?.contactNumber
  );
}

export function getMemberRole(member) {
  return getFirstValue(
    member?.designation,
    member?.roleTitle,
    member?.role
  );
}

export function buildEmailSignatureHtml(member) {
  const customSignature = getFirstValue(
    member?.signatureHtml,
    member?.emailSignatureHtml
  );

  if (customSignature) {
    return sanitizeSignatureHtml(customSignature);
  }

  const name = getMemberName(member);
  const role = getMemberRole(member);
  const email = getMemberEmail(member);
  const mobile = getMemberMobile(member);

  return `
    <div style="margin-top:24px;font-family:Arial,sans-serif;color:#111827;line-height:1.45;">
      <p style="margin:0 0 8px;">Regards,</p>
      <p style="margin:0;font-weight:700;">${escapeHtml(name || "DreamTrawell Team")}</p>
      ${role ? `<p style="margin:2px 0;color:#4b5563;">${escapeHtml(role)}</p>` : ""}
      <p style="margin:8px 0 0;color:#4b5563;">
        DreamTrawell
        ${email ? `<br/>Email: ${escapeHtml(email)}` : ""}
        ${mobile ? `<br/>Mobile: ${escapeHtml(mobile)}` : ""}
      </p>
    </div>
  `;
}

export function buildWhatsAppSignatureText(member) {
  const customSignature = getFirstValue(
    member?.whatsappSignature,
    member?.signatureText
  );

  if (customSignature) return customSignature;

  const name = getMemberName(member);
  const role = getMemberRole(member);
  const email = getMemberEmail(member);
  const mobile = getMemberMobile(member);

  return [
    "Regards,",
    name || "DreamTrawell Team",
    role || "",
    "DreamTrawell",
    email ? `Email: ${email}` : "",
    mobile ? `Mobile: ${mobile}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}