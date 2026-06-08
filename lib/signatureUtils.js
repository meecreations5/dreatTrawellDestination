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

function buildSocialLink(label, url) {
  if (!url) return "";

  return `
    <a href="${escapeHtml(url)}" target="_blank" style="color:#2563eb;text-decoration:none;margin-right:10px;">
      ${escapeHtml(label)}
    </a>
  `;
}

export function buildPersonalSignatureContentHtml(member) {
  const name = getMemberName(member);
  const role = getMemberRole(member);

  return `
    <p style="margin:0 0 8px;">Regards,</p>
    <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">
      ${escapeHtml(name || "DreamTrawell Team")}
    </p>
    ${
      role
        ? `
          <p style="margin:2px 0 6px;font-size:13px;color:#4b5563;">
            ${escapeHtml(role)}
          </p>
        `
        : ""
    }
  `;
}

export function buildEmailSignatureHtml(member) {
  const name = getMemberName(member);
  const email = getMemberEmail(member);
  const mobile = getMemberMobile(member);

  const companyName = getFirstValue(
    member?.companyName,
    "DreamTrawell"
  );

  const companyLogoUrl = getFirstValue(
    member?.companyLogoUrl,
    member?.logoUrl
  );

  const websiteUrl = getFirstValue(member?.websiteUrl);
  const facebookUrl = getFirstValue(member?.facebookUrl);
  const instagramUrl = getFirstValue(member?.instagramUrl);
  const linkedinUrl = getFirstValue(member?.linkedinUrl);
  const youtubeUrl = getFirstValue(member?.youtubeUrl);

  const personalSignatureHtml = sanitizeSignatureHtml(
    getFirstValue(
      member?.signatureHtml,
      member?.emailSignatureHtml
    )
  );

  const socialLinks = [
    buildSocialLink("Website", websiteUrl),
    buildSocialLink("Facebook", facebookUrl),
    buildSocialLink("Instagram", instagramUrl),
    buildSocialLink("LinkedIn", linkedinUrl),
    buildSocialLink("YouTube", youtubeUrl)
  ].join("");

  return `
    <table cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;font-family:Arial,sans-serif;color:#111827;">
      <tr>
        ${
          companyLogoUrl
            ? `
              <td style="vertical-align:top;padding-right:14px;">
                <img
                  src="${escapeHtml(companyLogoUrl)}"
                  alt="${escapeHtml(companyName)}"
                  style="width:86px;max-width:86px;height:auto;border-radius:8px;display:block;"
                />
              </td>
            `
            : ""
        }

        <td style="vertical-align:top;border-left:3px solid #2563eb;padding-left:14px;">
          ${
            personalSignatureHtml ||
            buildPersonalSignatureContentHtml({
              ...member,
              name
            })
          }

          <p style="margin:8px 0 0;font-size:13px;font-weight:700;color:#2563eb;">
            ${escapeHtml(companyName)}
          </p>

          <p style="margin:6px 0 0;font-size:12px;color:#4b5563;line-height:1.5;">
            ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
            ${mobile ? `Mobile: ${escapeHtml(mobile)}<br/>` : ""}
            ${websiteUrl ? `Website: ${escapeHtml(websiteUrl)}` : ""}
          </p>

          ${
            socialLinks
              ? `
                <p style="margin:8px 0 0;font-size:12px;">
                  ${socialLinks}
                </p>
              `
              : ""
          }
        </td>
      </tr>
    </table>
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
  const companyName = getFirstValue(member?.companyName, "DreamTrawell");
  const websiteUrl = getFirstValue(member?.websiteUrl);

  return [
    "Regards,",
    name || "DreamTrawell Team",
    role || "",
    companyName,
    email ? `Email: ${email}` : "",
    mobile ? `Mobile: ${mobile}` : "",
    websiteUrl ? `Website: ${websiteUrl}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}