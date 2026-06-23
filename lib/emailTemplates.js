// lib/emailTemplates.js

import {
  escapeHtml,
  getFirstValue
} from "./signatureUtils";

/* =========================
   DREAMTRAWELL EMAIL DESIGN TOKENS
========================= */

export const EMAIL_BRAND = {
  blue: "#1d4e89",
  red: "#9b0112",
  bg: "#dbe5ea",
  card: "#ffffff",
  soft: "#f8fafc",
  text: "#111827",
  muted: "#475569",
  border: "#dbe4ef",
  redSoft: "#fff5f6",
  redBorder: "#f2c8cf"
};

/* =========================
   BRANDING HELPERS
========================= */

function getBrandingMeta(branding = {}) {
  const companyLogoUrl = getFirstValue(
    branding?.companyLogoUrl,
    branding?.emailLogoUrl,
    branding?.headerLogoUrl,
    branding?.signatureLogoUrl,
    branding?.footerLogoUrl,
    branding?.emailSignatureLogoUrl,
    branding?.logoUrl,
    branding?.logo,
    branding?.brandLogo,
    branding?.companyLogo,
    branding?.logoImageUrl,
    branding?.logoDownloadURL,
    branding?.logoDownloadUrl,
    branding?.logoFile?.url,
    branding?.logoFile?.downloadURL,
    branding?.logoFile?.downloadUrl
  );

  return {
    companyName: getFirstValue(
      branding?.companyName,
      branding?.brandName,
      branding?.company,
      branding?.organizationName,
      "DreamTrawell Destination"
    ),

    companyLogoUrl,

    tagline: getFirstValue(
      branding?.tagline,
      "Realize the Experiance"
    )
  };
}
/* =========================
   COMMON BLOCKS
========================= */

export function buildEmailDetailsCard({
  title = "Details",
  rows = []
}) {
  const safeRows = rows.filter(row => row?.label);

  if (!safeRows.length) return "";

  return `
    <div style="background:${EMAIL_BRAND.soft};border:1px solid ${EMAIL_BRAND.border};border-radius:20px;padding:20px;margin:22px 0;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;width:44px;height:4px;background:${EMAIL_BRAND.red};border-radius:999px;margin-bottom:10px;"></div>

        <h3 style="margin:0;color:${EMAIL_BRAND.blue};font-size:20px;line-height:1.3;font-weight:800;">
          ${escapeHtml(title)}
        </h3>
      </div>

      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 10px;">
        ${safeRows
      .map((row, index) => {
        const accent = index === 0
          ? EMAIL_BRAND.red
          : EMAIL_BRAND.blue;

        return `
                <tr>
                  <td style="width:36%;font-size:12px;color:#64748b;padding:13px;background:#ffffff;border-radius:14px 0 0 14px;border-left:4px solid ${accent};">
                    ${escapeHtml(row.label)}
                  </td>

                  <td style="font-size:14px;color:#111827;font-weight:800;padding:13px;background:#ffffff;border-radius:0 14px 14px 0;">
                    ${escapeHtml(row.value || "—")}
                  </td>
                </tr>
              `;
      })
      .join("")
    }
      </table>
    </div>
  `;
}

export function buildEmailHighlightBox({
  title = "",
  text = "",
  tone = "red"
}) {
  if (!title && !text) return "";

  const isBlue = tone === "blue";

  return `
    <div style="background:${isBlue ? EMAIL_BRAND.soft : EMAIL_BRAND.redSoft};border:1px solid ${isBlue ? EMAIL_BRAND.border : EMAIL_BRAND.redBorder};border-radius:18px;padding:18px;margin:20px 0 24px;">
      ${title
      ? `
            <p style="margin:0 0 8px;color:${isBlue ? EMAIL_BRAND.blue : EMAIL_BRAND.red};font-size:14px;font-weight:800;line-height:1.6;">
              ${escapeHtml(title)}
            </p>
          `
      : ""
    }

      ${text
      ? `
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">
              ${escapeHtml(text)}
            </p>
          `
      : ""
    }
    </div>
  `;
}

export function buildEmailHtmlCard({
  title = "",
  html = "",
  emptyText = "",
  tone = "blue"
}) {
  if (!html && !emptyText) return "";

  return `
    <div style="background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-radius:18px;padding:18px;margin:20px 0;">
      ${title
      ? `
            <p style="margin:0 0 8px;color:${tone === "red" ? EMAIL_BRAND.red : EMAIL_BRAND.blue};font-size:14px;font-weight:800;line-height:1.6;">
              ${escapeHtml(title)}
            </p>
          `
      : ""
    }

      ${html
      ? `
            <div style="color:#374151;font-size:14px;line-height:1.8;">
              ${html}
            </div>
          `
      : `
            <p style="margin:0;color:#64748b;font-size:14px;line-height:1.8;">
              ${escapeHtml(emptyText)}
            </p>
          `
    }
    </div>
  `;
}

export function buildEmailAttachmentListHtml({
  title = "Reference Files",
  attachments = []
}) {
  if (!Array.isArray(attachments) || !attachments.length) return "";

  const rows = attachments
    .map((file, index) => {
      const name = getFirstValue(
        file?.name,
        file?.fileName,
        file?.originalName,
        `Reference File ${index + 1}`
      );

      const url = getFirstValue(
        file?.url,
        file?.downloadURL,
        file?.downloadUrl,
        file?.fileUrl
      );

      if (!url) {
        return `
          <li style="margin:0 0 6px;color:#374151;font-size:13px;line-height:1.6;">
            ${escapeHtml(name)}
          </li>
        `;
      }

      return `
        <li style="margin:0 0 6px;color:#374151;font-size:13px;line-height:1.6;">
          <a
            href="${escapeHtml(url)}"
            target="_blank"
            style="color:${EMAIL_BRAND.blue};font-weight:700;text-decoration:none;"
          >
            ${escapeHtml(name)}
          </a>
        </li>
      `;
    })
    .join("");

  return `
    <div style="margin:14px 0 0;">
      <p style="margin:0 0 8px;color:${EMAIL_BRAND.blue};font-size:13px;font-weight:800;">
        ${escapeHtml(title)}
      </p>

      <ul style="margin:0;padding-left:18px;">
        ${rows}
      </ul>
    </div>
  `;
}

/* =========================
   PRIVATE BASE SHELL
========================= */

function buildBaseDreamTrawellShell({
  branding = {},

  title = "",
  subtitle = "",
  introLine = "",

  bodyHtml = "",
  closingLine = "",

  emailSignatureHtml = "",
  footerType = "external"
}) {
  const { companyName, companyLogoUrl, tagline } =
    getBrandingMeta(branding);

  return `
    <div style="margin:0;padding:0;background:${EMAIL_BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_BRAND.text};">
      <div style="max-width:760px;margin:0 auto;padding:34px 14px;">

        <div style="background:${EMAIL_BRAND.card};border-radius:24px;overflow:hidden;border:1px solid ${EMAIL_BRAND.border};box-shadow:0 18px 46px rgba(15,23,42,0.16);">

          <!-- WHITE LOGO HEADER -->
          <div style="background:#ffffff;padding:28px 28px;text-align:center;border-bottom:1px solid #e5e7eb;">
            ${companyLogoUrl
      ? `
                  <img
                    src="${escapeHtml(companyLogoUrl)}"
                    alt="${escapeHtml(companyName)}"
                    style="display:block;margin:0 auto;max-width:230px;max-height:86px;object-fit:contain;border:0;outline:none;text-decoration:none;"
                  />
                `
      : `
                  <strong style="font-size:22px;color:${EMAIL_BRAND.blue};letter-spacing:.02em;">
                    ${escapeHtml(companyName)}
                  </strong>
                `
    }
          </div>

          <!-- HERO -->
          <div style="background:${EMAIL_BRAND.blue};padding:34px 28px;text-align:center;">
            <div style="display:inline-block;width:52px;height:4px;background:${EMAIL_BRAND.red};border-radius:999px;margin-bottom:14px;"></div>

            <h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.3;font-weight:800;">
              ${escapeHtml(title)}
            </h1>

            <p style="margin:10px 0 0;color:#dbeafe;font-size:14px;line-height:1.6;">
              ${escapeHtml(tagline)}
            </p>
          </div>

          ${introLine
      ? `
                <!-- INTRO STRIP -->
                <div style="background:linear-gradient(135deg, ${EMAIL_BRAND.blue}, ${EMAIL_BRAND.red});padding:18px 28px;text-align:center;">
                  <p style="margin:0;color:#ffffff;font-size:15px;line-height:1.6;font-weight:600;">
                    ${escapeHtml(introLine)}
                  </p>
                </div>
              `
      : ""
    }

          <!-- BODY -->
          <div style="padding:32px 30px;">
            ${subtitle
      ? `
                  <div style="text-align:center;margin-bottom:24px;">
                    <h2 style="margin:0;color:${EMAIL_BRAND.blue};font-size:22px;line-height:1.4;font-weight:800;">
                      ${escapeHtml(subtitle)}
                    </h2>
                  </div>
                `
      : ""
    }

            ${bodyHtml}

            ${closingLine
      ? `
                  <p style="margin:22px 0 20px;color:#374151;font-size:14px;line-height:1.8;">
                    ${escapeHtml(closingLine)}
                  </p>
                `
      : ""
    }

            ${emailSignatureHtml}
          </div>
        </div>

        <p style="margin:14px 0 0;text-align:center;color:#64748b;font-size:11px;line-height:1.5;">
          ${footerType === "internal"
      ? `Internal notification from ${escapeHtml(companyName)}.`
      : `This is an automated notification from ${escapeHtml(companyName)}.`
    }
        </p>
      </div>
    </div>
  `;
}

/* =====================================================
   TEMPLATE 1: TRAVEL AGENT / CUSTOMER
===================================================== */

export function buildTravelAgentEmailTemplate({
  branding = {},

  title = "Your Travel Requirement Is Now in Motion",
  subtitle = "The Journey Has Begun",
  introLine = "We are ready to shape a thoughtful travel experience for your traveler.",

  recipientName = "Partner",

  openingHtml = "",
  detailsTitle = "",
  detailsRows = [],

  referenceTitle = "",
  referenceHtml = "",

  actionTitle = "",
  actionText = "",

  closingLine = "",
  emailSignatureHtml = ""
}) {
  const bodyHtml = `
    <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.7;">
      Dear ${escapeHtml(recipientName || "Partner")},
    </p>

    ${openingHtml
      ? `
          <div style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
            ${openingHtml}
          </div>
        `
      : ""
    }

    ${detailsRows?.length
      ? buildEmailDetailsCard({
        title: detailsTitle || "Details",
        rows: detailsRows
      })
      : ""
    }

    ${referenceHtml
      ? buildEmailHtmlCard({
        title: referenceTitle || "Reference Received",
        html: referenceHtml,
        tone: "blue"
      })
      : ""
    }

    ${actionTitle || actionText
      ? buildEmailHighlightBox({
        title: actionTitle,
        text: actionText,
        tone: "red"
      })
      : ""
    }
  `;

  return buildBaseDreamTrawellShell({
    branding,
    title,
    subtitle,
    introLine,
    bodyHtml,
    closingLine,
    emailSignatureHtml,
    footerType: "external"
  });
}

/* =====================================================
   TEMPLATE 2: VENDOR
===================================================== */

function buildVendorBulletList(items = []) {
  const safeItems = Array.isArray(items)
    ? items.map(item => String(item || "").trim()).filter(Boolean)
    : [];

  if (!safeItems.length) return "";

  return `
    <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.75;">
      ${safeItems
      .map(
        item => `
            <li style="margin:0 0 6px;">
              ${escapeHtml(item)}
            </li>
          `
      )
      .join("")}
    </ul>
  `;
}

function buildVendorTatBlock({
  expectedTatLabel = "",
  expectedReplyByText = ""
}) {
  if (!expectedTatLabel && !expectedReplyByText) return "";

  return `
    <div style="background:${EMAIL_BRAND.redSoft};border:1px solid ${EMAIL_BRAND.redBorder};border-radius:16px;padding:15px;margin:18px 0;">
      <p style="margin:0 0 5px;color:${EMAIL_BRAND.red};font-size:12px;line-height:1.4;font-weight:900;text-transform:uppercase;letter-spacing:.04em;">
        Response Timeline
      </p>

      <p style="margin:0;color:#374151;font-size:14px;line-height:1.75;">
        ${expectedReplyByText
      ? `Reply Required By: <strong style="color:#111827;">${escapeHtml(expectedReplyByText)}</strong>`
      : ""
    }

        ${expectedReplyByText && expectedTatLabel
      ? `<br />`
      : ""
    }

        ${expectedTatLabel
      ? `Expected TAT: <strong style="color:#111827;">${escapeHtml(expectedTatLabel)}</strong>`
      : ""
    }
      </p>
    </div>
  `;
}

function buildVendorTravelDetailsTable({
  leadCode = "",
  destinationName = "",
  travelDates = "",
  paxText = "",
  requirementType = ""
}) {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="4" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Travel Requirement Details
        </td>
      </tr>

      <tr>
        <td style="width:25%;padding:12px;border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">Vendor Ref</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(leadCode || "—")}
          </p>
        </td>

        <td style="width:25%;padding:12px;border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">Destination</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(destinationName || "—")}
          </p>
        </td>

        <td style="width:25%;padding:12px;border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">Travel Dates</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(travelDates || "—")}
          </p>
        </td>

        <td style="width:25%;padding:12px;border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">Pax</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(paxText || "—")}
          </p>
        </td>
      </tr>

      <tr>
        <td colspan="4" style="padding:13px 14px;background:#f8fafc;border-left:4px solid ${EMAIL_BRAND.red};">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">
            Requirement Type
          </p>

          <p style="margin:0;color:#111827;font-size:14px;line-height:1.5;font-weight:800;">
            ${escapeHtml(requirementType || "Travel Query")}
          </p>
        </td>
      </tr>
    </table>
  `;
}

function buildVendorServicesBlock({
  servicesRequired = [],
  requirementHtml = "",
  requirementTitle = "Services Required"
}) {
  const serviceListHtml = buildVendorBulletList(servicesRequired);

  if (!serviceListHtml && !requirementHtml) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          ${escapeHtml(requirementTitle || "Services Required")}
        </td>
      </tr>

      <tr>
        <td style="padding:14px 16px;background:#ffffff;">
          ${serviceListHtml ||
    `
              <div style="color:#374151;font-size:13px;line-height:1.75;">
                ${requirementHtml}
              </div>
            `
    }
        </td>
      </tr>
    </table>
  `;
}

function buildVendorReferenceBlock({
  referenceContent = "",
  referenceHtml = "",
  specialNotes = ""
}) {
  const safeReferenceContent = String(referenceContent || "").trim();
  const safeSpecialNotes = String(specialNotes || "").trim();

  if (!safeReferenceContent && !referenceHtml && !safeSpecialNotes) {
    return "";
  }

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td style="background:${EMAIL_BRAND.blue};padding:11px 14px;text-align:center;color:#ffffff;font-size:14px;font-weight:900;">
          Reference / Special Notes
        </td>
      </tr>

      <tr>
        <td style="padding:14px 16px;background:#ffffff;">
          ${referenceHtml
      ? `
                <div style="color:#374151;font-size:13px;line-height:1.75;">
                  ${referenceHtml}
                </div>
              `
      : safeReferenceContent
        ? `
                  <p style="margin:0;color:#374151;font-size:13px;line-height:1.75;white-space:pre-line;">
                    ${escapeHtml(safeReferenceContent)}
                  </p>
                `
        : `
                  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.75;">
                    No additional reference content was provided.
                  </p>
                `
    }

          ${safeSpecialNotes
      ? `
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:12px 14px;margin:14px 0 0;">
                  <p style="margin:0;color:#111827;font-size:13px;line-height:1.6;font-weight:800;white-space:pre-line;">
                    ${escapeHtml(safeSpecialNotes)}
                  </p>
                </div>
              `
      : ""
    }
        </td>
      </tr>
    </table>
  `;
}

function buildVendorRequestedDetailsBlock() {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0;">
      <tr>
        <td style="background:${EMAIL_BRAND.blue};padding:11px 14px;text-align:center;color:#ffffff;font-size:14px;font-weight:900;">
          Details Requested from Vendor
        </td>
      </tr>

      <tr>
        <td style="padding:14px 16px;background:#ffffff;">
          <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.75;">
            <li style="margin:0 0 6px;">Best net rates</li>
            <li style="margin:0 0 6px;">Availability status</li>
            <li style="margin:0 0 6px;">Hotel / service options, wherever applicable</li>
            <li style="margin:0 0 6px;">Inclusions and exclusions</li>
            <li style="margin:0 0 6px;">Tax details</li>
            <li style="margin:0 0 6px;">Cancellation policy</li>
            <li style="margin:0 0 6px;">Payment terms</li>
            <li style="margin:0 0 6px;">Rate validity</li>
            <li style="margin:0;">Blackout dates, peak surcharges, gala dinner charges, or operational restrictions, if applicable</li>
          </ul>
        </td>
      </tr>
    </table>
  `;
}

export function buildVendorRateRequestSubject({
  destinationName = "",
  leadCode = ""
} = {}) {
  const destination = destinationName || "Travel Query";
  const ref = leadCode ? ` - ${leadCode}` : "";

  return `Rate & Availability Request - ${destination}${ref}`;
}

export function buildVendorEmailTemplate({
  branding = {},

  title = "Rate & Availability Request",
  subtitle = "Vendor Requirement Brief",
  introLine = "Kindly share your best net rates and availability for the below requirement.",

  vendorName = "Vendor Partner",
  senderName = "",

  leadCode = "",
  destinationName = "",
  travelDates = "",
  paxText = "",
  requirementType = "",

  expectedTat = "",
  expectedTatLabel = "",
  expectedReplyByText = "",

  servicesRequired = [],
  referenceContent = "",
  specialNotes = "",
  replyDeadline = "",

  openingHtml = "",
  detailsTitle = "",
  detailsRows = [],

  requirementTitle = "",
  requirementHtml = "",

  referenceHtml = "",

  actionTitle = "",
  actionText = "",

  closingLine = "",
  emailSignatureHtml = ""
}) {
  const { companyName, tagline } = getBrandingMeta(branding);

  const fallbackSignatureHtml = `
    <div style="margin:22px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#111827;font-size:14px;line-height:1.7;font-weight:800;">Best Regards,</p>

      ${senderName
      ? `
            <p style="margin:4px 0 0;color:${EMAIL_BRAND.blue};font-size:14px;line-height:1.7;font-weight:900;">
              ${escapeHtml(senderName)}
            </p>
          `
      : ""
    }

      <p style="margin:2px 0 0;color:${EMAIL_BRAND.blue};font-size:14px;line-height:1.7;font-weight:900;">
        ${escapeHtml(companyName)}
      </p>

      <p style="margin:2px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
        ${escapeHtml(tagline)}
      </p>
    </div>
  `;

  const structuredDetailsHtml = buildVendorTravelDetailsTable({
    leadCode,
    destinationName,
    travelDates,
    paxText,
    requirementType
  });

  const customDetailsHtml = detailsRows?.length
    ? buildEmailDetailsCard({
      title: detailsTitle || "Request Details",
      rows: detailsRows
    })
    : "";

  const servicesHtml = buildVendorServicesBlock({
    servicesRequired,
    requirementHtml,
    requirementTitle: requirementTitle || "Services Required"
  });

  const referenceBlockHtml = buildVendorReferenceBlock({
    referenceContent,
    referenceHtml,
    specialNotes
  });

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.7;">
      Dear ${escapeHtml(vendorName || "Vendor Partner")},
    </p>

    ${openingHtml
      ? `
          <div style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
            ${openingHtml}
          </div>
        `
      : `
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.75;">
            We have received a travel query for ${escapeHtml(destinationName || "the requested destination")} and request you to share your best net rates, availability, inclusions, exclusions, cancellation policy, and important operational notes.
          </p>
        `
    }

    ${buildVendorTatBlock({
      expectedTatLabel: expectedTatLabel || expectedTat,
      expectedReplyByText: expectedReplyByText || replyDeadline
    })}

    <div style="background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-radius:18px;padding:18px;margin:18px 0;">
      <p style="margin:0 0 14px;color:${EMAIL_BRAND.blue};font-size:15px;font-weight:800;line-height:1.5;">
        Query Requirement Details
      </p>

      ${customDetailsHtml || structuredDetailsHtml}

      ${servicesHtml}

      ${referenceBlockHtml}

      ${buildVendorRequestedDetailsBlock()}
    </div>

    ${actionTitle || actionText
      ? buildEmailHighlightBox({
        title: actionTitle || "Request",
        text:
          actionText ||
          "Please share your best quote with inclusions, exclusions, validity, cancellation terms, and important operational notes.",
        tone: "red"
      })
      : ""
    }

    <p style="margin:18px 0 20px;color:#374151;font-size:14px;line-height:1.75;">
      Kindly revert within the mentioned TAT so we can proceed with the quotation on time.
    </p>
  `;

  return buildBaseDreamTrawellShell({
    branding,
    title,
    subtitle,
    introLine,
    bodyHtml,
    closingLine,
    emailSignatureHtml: emailSignatureHtml || fallbackSignatureHtml,
    footerType: "external"
  });
}

export function buildVendorRateRequestEmailTemplate(args = {}) {
  return buildVendorEmailTemplate(args);
}

/* =====================================================
   TEMPLATE 3: INTERNAL
===================================================== */

export function buildInternalEmailTemplate({
  branding = {},

  title = "Internal Notification",
  subtitle = "Review the Requirement and Shape the Next Step",
  introLine = "A clear brief helps us create a thoughtful travel experience.",

  recipientName = "Team Member",

  openingHtml = "",
  detailsTitle = "",
  detailsRows = [],

  referenceTitle = "",
  referenceHtml = "",
  showReference = false,
  emptyReferenceText = "No additional reference content was provided.",

  actionTitle = "",
  actionText = "",

  closingLine = "",
  emailSignatureHtml = ""
}) {
  const bodyHtml = `
    <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.7;">
      Dear ${escapeHtml(recipientName || "Team Member")},
    </p>

    ${openingHtml
      ? `
          <div style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
            ${openingHtml}
          </div>
        `
      : ""
    }

    ${detailsRows?.length
      ? buildEmailDetailsCard({
        title: detailsTitle || "Internal Details",
        rows: detailsRows
      })
      : ""
    }

    ${showReference || referenceHtml
      ? buildEmailHtmlCard({
        title: referenceTitle || "Reference",
        html: referenceHtml,
        emptyText: emptyReferenceText,
        tone: "blue"
      })
      : ""
    }

    ${actionTitle || actionText
      ? buildEmailHighlightBox({
        title: actionTitle || "Suggested Next Action",
        text: actionText,
        tone: "blue"
      })
      : ""
    }
  `;

  return buildBaseDreamTrawellShell({
    branding,
    title,
    subtitle,
    introLine,
    bodyHtml,
    closingLine,
    emailSignatureHtml,
    footerType: "internal"
  });
}



export function buildTravelAgentQuotationEmailTemplate({
  branding = {},

  recipientName = "Guest",
  leadCode = "",
  revision = "",
  destinationName = "your travel enquiry",

  itineraryHtml = "",
  quotationClosingLine = "",

  emailSignatureHtml = "",
  itineraryAlreadyHasGreeting = false
}) {
  const { companyName, companyLogoUrl, tagline } =
    getBrandingMeta(branding);

  const quotationRef = [
    leadCode,
    revision ? `Rev ${revision}` : ""
  ]
    .filter(Boolean)
    .join(" / ");

  const safeItineraryHtml =
    itineraryHtml || "<p>No quotation content added yet.</p>";

  return `
    <div style="margin:0;padding:0;background:${EMAIL_BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_BRAND.text};">
      <div style="max-width:760px;margin:0 auto;padding:22px 12px;">

        <div style="background:${EMAIL_BRAND.card};border-radius:22px;overflow:hidden;border:1px solid ${EMAIL_BRAND.border};box-shadow:0 14px 36px rgba(15,23,42,0.14);">

          <!-- COMPACT LOGO HEADER -->
          <div style="background:#ffffff;padding:18px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
            ${companyLogoUrl
      ? `
                  <img
                    src="${escapeHtml(companyLogoUrl)}"
                    alt="${escapeHtml(companyName)}"
                    style="display:block;margin:0 auto;max-width:205px;max-height:70px;object-fit:contain;border:0;outline:none;text-decoration:none;"
                  />
                `
      : `
                  <strong style="font-size:20px;color:${EMAIL_BRAND.blue};letter-spacing:.02em;">
                    ${escapeHtml(companyName)}
                  </strong>
                `
    }
          </div>

          <!-- COMPACT HERO -->
          <div style="background:${EMAIL_BRAND.blue};padding:22px 24px;text-align:center;">
            <div style="display:inline-block;width:46px;height:4px;background:${EMAIL_BRAND.red};border-radius:999px;margin-bottom:10px;"></div>

            <h1 style="margin:0;color:#ffffff;font-size:23px;line-height:1.3;font-weight:800;">
              Your Travel Quotation Is Ready
            </h1>

            <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;line-height:1.5;">
              ${escapeHtml(tagline)}
            </p>
          </div>

          <!-- BODY -->
          <div style="padding:24px 26px;">

            ${itineraryAlreadyHasGreeting
      ? ""
      : `
                  <p style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.7;">
                    Dear ${escapeHtml(recipientName || "Guest")},
                  </p>

                  <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.75;">
                    Thank you for giving us the opportunity to curate this travel experience for your client.
                  </p>

                  <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.75;">
                    Please find below the quotation and itinerary details for the ${escapeHtml(destinationName)} package. This proposal has been thoughtfully planned to ensure comfort, seamless arrangements, and memorable travel moments throughout the journey.
                  </p>
                `
    }

            <!-- COMPACT META ROW -->
            ${quotationRef || destinationName
      ? `
                  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:16px 0 18px;">
                    <tr>
                      <td style="width:50%;background:#f8fafc;border:1px solid #dbe4ef;border-right:0;border-radius:16px 0 0 16px;padding:13px 14px;vertical-align:top;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:11px;line-height:1.4;">
                          Quotation Ref
                        </p>
                        <p style="margin:0;color:#111827;font-size:14px;line-height:1.5;font-weight:800;">
                          ${escapeHtml(quotationRef || "—")}
                        </p>
                      </td>

                      <td style="width:50%;background:#f8fafc;border:1px solid #dbe4ef;border-left:4px solid ${EMAIL_BRAND.red};border-radius:0 16px 16px 0;padding:13px 14px;vertical-align:top;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:11px;line-height:1.4;">
                          Destination
                        </p>
                        <p style="margin:0;color:#111827;font-size:14px;line-height:1.5;font-weight:800;">
                          ${escapeHtml(destinationName || "—")}
                        </p>
                      </td>
                    </tr>
                  </table>
                `
      : ""
    }

            <!-- QUOTATION DETAILS DIRECTLY VISIBLE -->
            <div style="background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-radius:18px;padding:18px;margin:18px 0;">
              <p style="margin:0 0 12px;color:${EMAIL_BRAND.blue};font-size:15px;font-weight:800;line-height:1.5;">
                Quotation Details
              </p>

              <div style="color:#374151;font-size:14px;line-height:1.75;">
                ${safeItineraryHtml}
              </div>
            </div>

            ${quotationClosingLine
      ? `
                  <div style="background:${EMAIL_BRAND.redSoft};border:1px solid ${EMAIL_BRAND.redBorder};border-radius:16px;padding:15px;margin:18px 0;">
                    <p style="margin:0;color:#374151;font-size:14px;line-height:1.75;">
                      ${escapeHtml(quotationClosingLine)}
                    </p>
                  </div>
                `
      : ""
    }

            <p style="margin:18px 0 20px;color:#374151;font-size:14px;line-height:1.75;">
              Please review the quotation and let us know if you would like any changes or refinements.
            </p>

            ${emailSignatureHtml}
          </div>
        </div>

        <p style="margin:12px 0 0;text-align:center;color:#64748b;font-size:11px;line-height:1.5;">
          This is an automated notification from ${escapeHtml(companyName)}.
        </p>
      </div>
    </div>
  `;
}