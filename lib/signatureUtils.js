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

function normalizeBaseUrl(url = "") {
  return String(url || "").replace(/\/$/, "");
}

function getEmailAssetBaseUrl(member) {
  return normalizeBaseUrl(
    getFirstValue(
      member?.emailAssetBaseUrl,
      "https://go.dreamtrawelldestination.com"
    )
  );
}

function resolveEmailImageUrl(member, ...values) {
  const raw = getFirstValue(...values);
  const base = getEmailAssetBaseUrl(member);

  if (!raw) return `${base}/logo.png`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${base}${raw}`;

  // Email clients cannot resolve browser-relative image paths. Treat legacy
  // stored logo filenames/paths as assets hosted by the CRM domain.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return `${base}/${raw.replace(/^\/+/, "")}`;
  }

  return `${base}/logo.png`;
}

function buildIconLink({ label, url, iconSrc }) {
  if (!url || !iconSrc) return "";

  return `
    <a
      href="${escapeHtml(url)}"
      target="_blank"
      style="display:inline-block;margin-right:8px;text-decoration:none;"
    >
      <img
        src="${escapeHtml(iconSrc)}"
        alt="${escapeHtml(label)}"
        width="20"
        height="20"
        style="width:20px;height:20px;border:0;outline:none;text-decoration:none;display:inline-block;"
      />
    </a>
  `;
}

function buildSocialIcons(member) {
  const assetBaseUrl = getEmailAssetBaseUrl(member);

  const websiteUrl = getFirstValue(
    member?.websiteUrl,
    member?.website,
    member?.companyWebsite,
    member?.socialLinks?.website
  );
  const facebookUrl = getFirstValue(
    member?.facebookUrl,
    member?.facebook,
    member?.socialLinks?.facebook
  );
  const instagramUrl = getFirstValue(
    member?.instagramUrl,
    member?.instagram,
    member?.socialLinks?.instagram
  );
  const linkedinUrl = getFirstValue(
    member?.linkedinUrl,
    member?.linkedin,
    member?.socialLinks?.linkedin
  );
  const youtubeUrl = getFirstValue(
    member?.youtubeUrl,
    member?.youtube,
    member?.socialLinks?.youtube
  );

  return [
    buildIconLink({
      label: "Website",
      url: websiteUrl,
      iconSrc: `${assetBaseUrl}/email-icons/website.png`
    }),

    buildIconLink({
      label: "Facebook",
      url: facebookUrl,
      iconSrc: `${assetBaseUrl}/email-icons/facebook.png`
    }),

    buildIconLink({
      label: "Instagram",
      url: instagramUrl,
      iconSrc: `${assetBaseUrl}/email-icons/instagram.png`
    }),

    buildIconLink({
      label: "LinkedIn",
      url: linkedinUrl,
      iconSrc: `${assetBaseUrl}/email-icons/linkedin.png`
    }),

    buildIconLink({
      label: "YouTube",
      url: youtubeUrl,
      iconSrc: `${assetBaseUrl}/email-icons/youtube.png`
    })
  ]
    .filter(Boolean)
    .join("");
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

export function buildEmailSignatureHtml(member, options = {}) {
  const includeLogo = options.includeLogo !== false;
  const includeSocial = options.includeSocial !== false;
  const includeWebsite = options.includeWebsite !== false;
  const email = getMemberEmail(member);
  const mobile = getMemberMobile(member);

  const companyName = getFirstValue(
    member?.companyName,
    member?.brandName,
    member?.company,
    member?.organizationName,
    "DreamTrawell Destination"
  );

  // Keep signature branding compatible with both the current Branding
  // Settings schema and older fields that were used by the quotation emailer.
  // The quotation header already supports these aliases; the signature must
  // resolve the same logo so the two never drift apart.
  const companyLogoUrl = resolveEmailImageUrl(
    member,
    member?.companyLogoUrl,
    member?.emailLogoUrl,
    member?.headerLogoUrl,
    member?.signatureLogoUrl,
    member?.footerLogoUrl,
    member?.emailSignatureLogoUrl,
    member?.logoUrl,
    member?.logo,
    member?.brandLogo,
    member?.companyLogo,
    member?.logoImageUrl,
    member?.logoDownloadURL,
    member?.logoDownloadUrl,
    member?.logoFile?.url,
    member?.logoFile?.downloadURL,
    member?.logoFile?.downloadUrl
  );

  const websiteUrl = getFirstValue(
    member?.websiteUrl,
    member?.website,
    member?.companyWebsite
  );

  const personalSignatureHtml = sanitizeSignatureHtml(
    getFirstValue(
      member?.signatureHtml,
      member?.emailSignatureHtml
    )
  );

  const socialIcons = includeSocial ? buildSocialIcons(member) : "";

  return `
    <table
      cellpadding="0"
      cellspacing="0"
      style="margin-top:24px;border-collapse:collapse;font-family:Arial,sans-serif;color:#111827;"
    >
      <tr>
        ${
          includeLogo && companyLogoUrl
            ? `
              <td style="vertical-align:top;padding-right:14px;">
                <img
                  src="${escapeHtml(companyLogoUrl)}"
                  alt="${escapeHtml(companyName)}"
                  width="86"
                  style="width:86px;max-width:86px;height:auto;border-radius:8px;display:block;border:0;"
                />
              </td>
            `
            : ""
        }

        <td style="vertical-align:top;border-left:3px solid #2563eb;padding-left:14px;">
          ${
            personalSignatureHtml ||
            buildPersonalSignatureContentHtml(member)
          }

          <p style="margin:8px 0 0;font-size:13px;font-weight:700;color:#2563eb;">
            ${escapeHtml(companyName)}
          </p>

          <p style="margin:6px 0 0;font-size:12px;color:#4b5563;line-height:1.5;">
            ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
            ${mobile ? `Mobile: ${escapeHtml(mobile)}<br/>` : ""}
            ${includeWebsite && websiteUrl ? `Website: <a href="${escapeHtml(websiteUrl)}" target="_blank" style="color:#2563eb;text-decoration:underline;">${escapeHtml(websiteUrl)}</a>` : ""}
          </p>

          ${
            socialIcons
              ? `
                <p style="margin:10px 0 0;font-size:12px;line-height:1;">
                  ${socialIcons}
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

  const companyName = getFirstValue(
    member?.companyName,
    "DreamTrawell Destination"
  );

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