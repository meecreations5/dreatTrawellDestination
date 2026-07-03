"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import {
  AlertCircle,
  ArrowLeft,
  Archive,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  RefreshCcw,
  Save,
  Sparkles,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { getBrandingSettings } from "@/lib/brandingSettings";
import AssetPickerModal from "@/components/documents/AssetPickerModal";

/* =========================
   OPTIONS
========================= */

const TEMPLATE_TYPES = [
  {
    value: "message",
    label: "Message",
    description: "General email or WhatsApp communication."
  },
  {
    value: "promotion",
    label: "Promotion",
    description: "Campaign, offer, seasonal push or destination promotion."
  },
  {
    value: "package",
    label: "Package",
    description: "Land package, hotel option, inclusions, exclusions and commercial package details."
  },
  {
    value: "itinerary",
    label: "Itinerary",
    description: "Day-wise travel plan, routing, experiences and service schedule."
  },
  {
    value: "document",
    label: "Document",
    description: "Visa, voucher, invoice, ticket, hotel confirmation or document communication."
  },
  {
    value: "vendor",
    label: "Vendor",
    description: "Vendor partner rate request, follow-up or confirmation communication."
  },
  {
    value: "internal",
    label: "Internal",
    description: "Internal team update, handover or operational communication."
  }
];

const PACKAGE_PURPOSES = [
  {
    value: "default",
    label: "Default Package",
    description: "Standard package used repeatedly for a destination."
  },
  {
    value: "regular",
    label: "Regular Package",
    description: "Normal package for common enquiries and follow-ups."
  },
  {
    value: "predefined",
    label: "Predefined Package",
    description: "Ready-to-send package with fixed inclusions and notes."
  }
];

const EMPTY_PACKAGE_CONFIG = {
  packagePurpose: "regular",
  packageTitle: "",
  destinationName: "",
  duration: "",
  hotelCategory: "",
  mealPlan: "",
  transferType: "",
  startingPrice: "",
  currency: "INR",
  validity: "",

  highlights: "",
  inclusions: "",
  exclusions: "",
  itinerary: "",
  tentativePricing: "",
  terms: "",
  notes: ""
};

const COMMON_INTENTS = [
  "new_agent_intro",
  "ask_requirement",
  "send_destination_package",
  "send_promotion",
  "quote_follow_up",
  "no_response_follow_up",
  "hot_lead_follow_up",
  "payment_reminder",
  "revision_confirmation",
  "meeting_follow_up",
  "lost_lead_reconnect",
  "thank_you_relationship"
];

const COMMON_OUTCOMES = [
  "intro_done",
  "profile_shared",
  "call_not_picked",
  "no_response",
  "followup_required",
  "future_follow_up",
  "requirement_pending",
  "requirement_received",
  "quote_needed",
  "quote_shared",
  "revision_needed",
  "payment_pending",
  "not_interested",
  "meeting_scheduled",
  "general_update"
];

const EMPTY_FORM = {
  name: "",
  slug: "",
  templateType: "message",
  categoryCode: "general",
  categoryName: "General",

  intentCodes: "",
  outcomeCodes: "",

  emailEnabled: true,
  whatsappEnabled: true,

  emailDesignHtml: "",
  emailSubject: "",
  emailHtml: "",
  whatsappText: "",

  active: true,

  destinationIds: [],
  primaryDestination: "",

  defaultAssetIds: [],

  packageConfig: EMPTY_PACKAGE_CONFIG

};

/* =========================
   HELPERS
========================= */


function getDefaultDreamTrawellEmailDesign() {
  return `
<div style="margin:0;padding:0;background:#eaf2f7;font-family:Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:36px 16px;">
    <div style="overflow:hidden;border-radius:28px;background:#ffffff;">
      <div style="padding:34px 24px;text-align:center;background:#ffffff;">
        {{companyLogoHtml}}
      </div>

      <div style="background:#1d4e89;padding:34px 28px;text-align:center;color:#ffffff;">
        <div style="width:52px;height:4px;background:#9b0112;margin:0 auto 20px;border-radius:99px;"></div>
        <div style="font-size:30px;line-height:1.18;font-weight:900;">
          {{emailHeaderTitle}}
        </div>
        <div style="margin-top:12px;font-size:14px;color:#dbeafe;">
          {{tagline}}
        </div>
      </div>

      <div style="background:linear-gradient(90deg,#1d4e89,#9b0112);padding:20px 28px;text-align:center;color:#ffffff;">
        <div style="font-size:16px;line-height:1.6;font-weight:800;">
          {{emailHeaderSubtitle}}
        </div>
      </div>

      <div style="padding:34px 30px;color:#1f2937;font-size:14px;line-height:1.7;">
        <h2 style="margin:0 0 22px;color:#1d4e89;font-size:26px;line-height:1.25;text-align:center;">
          {{emailBodyTitle}}
        </h2>

        <p style="margin:0 0 18px;">Dear {{spocName}},</p>

        <p style="margin:0 0 20px;">
          Please find below the package details for your client.
        </p>

        {{packageContentHtml}}

        {{assetLinksHtml}}

        {{signature}}
      </div>
    </div>
  </div>
</div>
`;
}

function isPlainPackageShell(html = "") {
  const rawHtml = String(html || "");
  const text = normalize(stripHtml(rawHtml));

  const hasPackageStructure =
    text.includes("package details") &&
    text.includes("inclusions") &&
    text.includes("exclusions");

  const hasBrandShell =
    text.includes("thank you for connecting") ||
    text.includes("dreamtrawell details") ||
    rawHtml.includes("{{emailHeaderTitle}}") ||
    rawHtml.includes("{{companyLogoHtml}}");

  return hasPackageStructure && !hasBrandShell;
}

function resolveEmailDesignHtml({
  savedDesignHtml = "",
  fallbackHtml = ""
}) {
  const saved = String(savedDesignHtml || "").trim();

  if (saved && !isPlainPackageShell(saved)) {
    return saved;
  }

  const fallback = removeGeneratedPackageBlock(fallbackHtml || "").trim();

  if (fallback && !isPlainPackageShell(fallback)) {
    return fallback;
  }

  return getDefaultDreamTrawellEmailDesign();
}

function buildEmailDesignWithBranding(designHtml = "", vars = {}) {
  const logoHtml = vars.companyLogoUrl
    ? `<img src="${escapeHtml(vars.companyLogoUrl)}" alt="${escapeHtml(
      vars.companyName || "DreamTrawell Destination"
    )}" style="max-width:120px;height:auto;display:block;margin:0 auto;" />`
    : "";

  return String(designHtml || "")
    .replaceAll("{{companyLogoHtml}}", logoHtml)
    .replaceAll(
      "{{emailHeaderTitle}}",
      vars.emailHeaderTitle || "Thank You for Connecting"
    )
    .replaceAll(
      "{{emailHeaderSubtitle}}",
      vars.emailHeaderSubtitle ||
      "We are happy to support your upcoming travel requirements with clarity and confidence."
    )
    .replaceAll(
      "{{emailBodyTitle}}",
      vars.emailBodyTitle || "DreamTrawell Details for Your Reference"
    );
}

function buildPackageEmailFromDesign({
  form = {},
  branding = null
}) {
  const packageConfig = cleanPackageConfig(form.packageConfig || {});

  const packageContentHtml = buildPackageContentHtml(packageConfig);
  const itineraryHtml = buildItineraryHtml(packageConfig.itinerary);
  const tentativePricingHtml = buildTentativePricingHtml(
    packageConfig.tentativePricing,
    packageConfig.currency
  );

  const emailDesignHtml = resolveEmailDesignHtml({
    savedDesignHtml: form.emailDesignHtml,
    fallbackHtml: form.emailHtml
  });

  const brandedDesign = buildEmailDesignWithBranding(emailDesignHtml, {
    companyName: branding?.companyName || "DreamTrawell Destination",
    companyLogoUrl:
      branding?.companyLogoUrl ||
      branding?.emailLogoUrl ||
      branding?.headerLogoUrl ||
      branding?.signatureLogoUrl ||
      branding?.logoUrl ||
      branding?.logo ||
      "",
    tagline: branding?.tagline || "Realize the Experiance",
    emailHeaderTitle: "Thank You for Connecting",
    emailHeaderSubtitle:
      "We are happy to support your upcoming travel requirements with clarity and confidence.",
    emailBodyTitle: `${packageConfig.destinationName || "{{destination}}"
      } Package Details`
  });

  return injectPackageBlocksIntoEmailerDesign({
    emailDesignHtml: brandedDesign,
    packageContentHtml: `
      ${packageContentHtml || ""}
      ${itineraryHtml || ""}
      ${tentativePricingHtml || ""}
    `,
    itineraryHtml: "",
    tentativePricingHtml: ""
  });
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function cleanString(value = "") {
  return String(value || "").trim();
}

function parseCsv(value = "") {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function toCsv(list = []) {
  return Array.isArray(list) ? list.filter(Boolean).join(", ") : "";
}

function cleanSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAssetId(asset = {}) {
  return asset?.assetId || asset?.id || asset?.documentId || "";
}

function compileTemplate(template = "", vars = {}) {
  return String(template || "").replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_, key) => vars[key] ?? ""
  );
}

function getFirstValue(...values) {
  return (
    values.find(value => typeof value === "string" && value.trim())?.trim() ||
    ""
  );
}

function getUserName(user = {}) {
  return (
    user?.displayName ||
    user?.name ||
    user?.fullName ||
    user?.email ||
    "Team Member"
  );
}

function getTemplateTypeMeta(type = "") {
  const value = normalize(type) || "message";
  return TEMPLATE_TYPES.find(item => item.value === value) || TEMPLATE_TYPES[0];
}

function getTemplateTypeLabel(type = "") {
  return getTemplateTypeMeta(type).label;
}

function getTemplateTypeDescription(type = "") {
  return getTemplateTypeMeta(type).description;
}

function getStatusLabel(form = {}) {
  if (form.active === false) return "Inactive";
  return "Active";
}

function getStatusClass(form = {}) {
  if (form.active === false) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-emerald-100 bg-emerald-50 text-emerald-700";
}

function getAssetTitle(asset = {}) {
  return getFirstValue(
    asset?.title,
    asset?.name,
    asset?.fileName,
    asset?.currentFileName,
    "Asset"
  );
}

function getAssetUrl(asset = {}) {
  return getFirstValue(
    asset?.url,
    asset?.currentUrl,
    asset?.currentFileUrl,
    asset?.externalUrl,
    asset?.downloadUrl,
    asset?.downloadURL,
    asset?.fileUrl,
    asset?.fileDownloadUrl,
    asset?.assetUrl,
    asset?.publicUrl,
    asset?.previewUrl,
    asset?.mediaUrl,
    asset?.storageUrl
  );
}

function normalizeAsset(asset = {}) {
  return {
    assetId: asset?.assetId || asset?.id || asset?.documentId || "",
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),
    categoryId: asset?.categoryId || "",
    categoryName: asset?.categoryName || "",
    assetType: asset?.assetType || asset?.documentType || "document",
    fileName: asset?.fileName || asset?.currentFileName || "",
    destinationId: asset?.destinationId || "",
    destinationName: asset?.destinationName || "",
    currentVersion: asset?.currentVersion || asset?.version || 1
  };
}

function buildAssetLinksHtml(assets = []) {
  if (!assets.length) return "";

  const items = assets
    .map(asset => {
      const title = escapeHtml(asset.title || "Asset");
      const url = escapeHtml(asset.url || "");

      if (!url) return "";

      return `
        <li style="margin:0 0 8px;color:#334155;font-size:13px;line-height:1.6;">
          <a href="${url}" target="_blank" style="color:#1d4e89;font-weight:700;text-decoration:none;">
            ${title}
          </a>
        </li>
      `;
    })
    .join("");

  return `
    <div style="margin:18px 0;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
      <div style="font-size:14px;font-weight:800;color:#1d4e89;margin-bottom:8px;">
        Shared Assets
      </div>
      <ul style="margin:0;padding-left:18px;">
        ${items}
      </ul>
    </div>
  `;
}

function buildAssetLinksText(assets = []) {
  if (!assets.length) return "";

  return [
    "Shared Assets:",
    ...assets.map((asset, index) => {
      return `${index + 1}. ${asset.title || "Asset"}\n${asset.url || ""}`;
    })
  ].join("\n");
}

function buildPackageContentHtml(config = {}) {
  const packageConfig = cleanPackageConfig(config);

  const destination =
    packageConfig.destinationName || "{{destination}}";

  const title =
    packageConfig.packageTitle || `${destination} Package Details`;

  return `
<div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;margin:0 0 16px;">
  <div style="font-size:16px;font-weight:800;color:#1d4e89;margin-bottom:10px;">
    ${escapeHtml(title)}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#334155;">
    <tr>
      <td style="padding:6px 0;font-weight:700;width:36%;">Destination</td>
      <td style="padding:6px 0;">${escapeHtml(destination)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-weight:700;">Duration</td>
      <td style="padding:6px 0;">${escapeHtml(packageConfig.duration || "As per requirement")}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-weight:700;">Hotel Category</td>
      <td style="padding:6px 0;">${escapeHtml(packageConfig.hotelCategory || "As per preference")}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-weight:700;">Meal Plan</td>
      <td style="padding:6px 0;">${escapeHtml(packageConfig.mealPlan || "As per package")}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-weight:700;">Transfers</td>
      <td style="padding:6px 0;">${escapeHtml(packageConfig.transferType || "As per package")}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-weight:700;">Validity</td>
      <td style="padding:6px 0;">${escapeHtml(packageConfig.validity || "Subject to availability")}</td>
    </tr>
  </table>
</div>

<div style="padding:14px;border:1px solid #dcfce7;border-radius:14px;background:#f0fdf4;margin:0 0 16px;">
  <div style="font-size:14px;font-weight:800;color:#047857;margin-bottom:8px;">Inclusions</div>
  <ul style="margin:0;padding-left:18px;">
    ${buildHtmlList(packageConfig.inclusions, [
    "Hotel accommodation",
    "Airport transfers",
    "Sightseeing as per plan"
  ])}
  </ul>
</div>

<div style="padding:14px;border:1px solid #fee2e2;border-radius:14px;background:#fff7f7;margin:0 0 16px;">
  <div style="font-size:14px;font-weight:800;color:#b91c1c;margin-bottom:8px;">Exclusions</div>
  <ul style="margin:0;padding-left:18px;">
    ${buildHtmlList(packageConfig.exclusions, [
    "Flights",
    "Visa / TCS unless mentioned",
    "Personal expenses"
  ])}
  </ul>
</div>
`;
}

function buildItineraryHtml(value = "") {
  const lines = parseLines(value);

  if (!lines.length) return "";

  return `
<div style="padding:14px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff;margin:0 0 16px;">
  <div style="font-size:14px;font-weight:800;color:#1d4e89;margin-bottom:8px;">Tentative Itinerary</div>
  <ul style="margin:0;padding-left:18px;">
    ${lines
      .map(
        item => `
        <li style="margin:0 0 6px;color:#334155;font-size:13px;line-height:1.6;">
          ${escapeHtml(item)}
        </li>`
      )
      .join("")}
  </ul>
</div>
`;
}

function buildTentativePricingHtml(value = "", currency = "INR") {
  const lines = parseLines(value);

  if (!lines.length) return "";

  return `
<div style="padding:14px;border:1px solid #fef3c7;border-radius:14px;background:#fffbeb;margin:0 0 16px;">
  <div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:8px;">Tentative Pricing</div>
  <ul style="margin:0;padding-left:18px;">
    ${lines
      .map(
        item => `
        <li style="margin:0 0 6px;color:#334155;font-size:13px;line-height:1.6;">
          ${escapeHtml(item)}
        </li>`
      )
      .join("")}
  </ul>
  <div style="margin-top:8px;font-size:12px;color:#92400e;">
    Pricing is tentative and subject to availability at the time of confirmation.
  </div>
</div>
`;
}

function getTemplateSubject(template = {}) {
  return getFirstValue(
    template.emailSubject,
    template.subject,
    template.packageSubject,
    template.itinerarySubject,
    template.title,
    template.name,
    "Communication"
  );
}

function getTemplateEmailContent(template = {}) {
  return getFirstValue(
    template.emailHtml,
    template.emailBodyHtml,
    template.bodyHtml,
    template.contentHtml,
    template.packageHtml,
    template.itineraryHtml,
    template.descriptionHtml,
    template.html,
    template.emailText,
    template.body,
    template.message
  );
}

function getTemplateWhatsappContent(template = {}) {
  return getFirstValue(
    template.whatsappText,
    template.whatsappMessage,
    template.messageText,
    template.packageText,
    template.itineraryText,
    template.contentText,
    template.bodyText,
    template.text
  );
}

function getStarterContent(type = "message") {
  const value = normalize(type) || "message";

  const starters = {
    message: {
      title: "Message Writing Block",
      description: "Use this for simple relationship, follow-up or update communication.",
      subject: "Update from {{companyName}}",
      emailHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear {{spocName}},<br/><br/>
  Hope you are doing well.<br/><br/>
  We wanted to quickly connect with you regarding {{destination}}.<br/><br/>
  Please let us know how we can support you with your upcoming travel requirements.<br/><br/>
  {{assetLinksHtml}}
  {{signature}}
</div>`,
      whatsappText: `Hi {{spocName}},

Hope you are doing well.

We wanted to quickly connect with you regarding {{destination}}.

Please let us know how we can support you with your upcoming travel requirements.

{{assetLinks}}

{{signature}}`,
      checklist: [
        "Keep the message short and relationship-focused.",
        "Mention destination or business context clearly.",
        "End with a clear next action."
      ]
    },

    promotion: {
      title: "Promotion Writing Block",
      description: "Use this for campaign, offer, destination push or seasonal communication.",
      subject: "{{destination}} Promotion for Your Upcoming Queries",
      emailHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear {{spocName}},<br/><br/>
  We are sharing a curated {{destination}} promotion that can help you pitch fresh travel options to your clients.<br/><br/>

  <div style="padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
    <strong style="color:#1d4e89;">Promotion Highlights</strong><br/>
    - Destination: {{destination}}<br/>
    - Best suited for: Families / Honeymooners / Groups<br/>
    - Key experience: Add highlight here<br/>
    - Validity: Add validity here<br/>
  </div><br/>

  Please connect with us for package details, costing and customization support.<br/><br/>
  {{assetLinksHtml}}
  {{signature}}
</div>`,
      whatsappText: `Hi {{spocName}},

Sharing a curated {{destination}} promotion for your upcoming client queries.

Promotion Highlights:
- Destination: {{destination}}
- Best suited for: Families / Honeymooners / Groups
- Key experience: Add highlight here
- Validity: Add validity here

Please connect with us for package details and customization support.

{{assetLinks}}

{{signature}}`,
      checklist: [
        "Mention the campaign hook in the first line.",
        "Add validity and ideal customer segment.",
        "Keep WhatsApp version compact."
      ]
    },

    package: {
      title: "Package Writing Block",
      description: "Use this for land package, hotel options, inclusions, exclusions and quote-support communication.",
      subject: "Package Details for {{destination}}",
      emailHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear {{spocName}},<br/><br/>
  Please find below the package details for <strong>{{destination}}</strong>. We have planned this keeping comfort, smooth arrangements and memorable travel moments in mind.<br/><br/>

  <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
    <div style="font-size:15px;font-weight:800;color:#1d4e89;margin-bottom:8px;">Package Snapshot</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#334155;">
      <tr>
        <td style="padding:6px 0;font-weight:700;">Destination</td>
        <td style="padding:6px 0;">{{destination}}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Duration</td>
        <td style="padding:6px 0;">Add duration here</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Hotel Category</td>
        <td style="padding:6px 0;">Add hotel category here</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Inclusions</td>
        <td style="padding:6px 0;">Hotel, transfers, sightseeing, meals as per plan</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Exclusions</td>
        <td style="padding:6px 0;">Flights, visa, TCS, personal expenses unless mentioned</td>
      </tr>
    </table>
  </div><br/>

  <strong>Important Notes:</strong><br/>
  - Rates are subject to availability at the time of booking.<br/>
  - Final confirmation will be shared after payment and supplier confirmation.<br/>
  - Package can be customized as per client preference.<br/><br/>

  {{assetLinksHtml}}
  {{signature}}
</div>`,
      whatsappText: `Hi {{spocName}},

Sharing package details for {{destination}}.

Package Snapshot:
- Destination: {{destination}}
- Duration: Add duration here
- Hotel Category: Add hotel category here
- Inclusions: Hotel, transfers, sightseeing, meals as per plan
- Exclusions: Flights, visa, TCS, personal expenses unless mentioned

Important Notes:
- Rates are subject to availability.
- Final confirmation after payment and supplier confirmation.
- Package can be customized as per client preference.

{{assetLinks}}

{{signature}}`,
      checklist: [
        "Mention duration, hotel category and inclusions.",
        "Clearly separate inclusions and exclusions.",
        "Add availability and confirmation notes."
      ]
    },

    itinerary: {
      title: "Itinerary Writing Block",
      description: "Use this for day-wise travel plan, routing, activities and experience flow.",
      subject: "Day-wise Itinerary for {{destination}}",
      emailHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear {{spocName}},<br/><br/>
  Please find below the suggested day-wise itinerary for <strong>{{destination}}</strong>. The flow is planned to keep the travel experience smooth, comfortable and memorable.<br/><br/>

  <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
    <div style="font-size:15px;font-weight:800;color:#1d4e89;margin-bottom:10px;">Itinerary Overview</div>

    <div style="margin-bottom:10px;">
      <strong>Day 1:</strong> Arrival, transfers and hotel check-in<br/>
      <span style="color:#64748b;">Add arrival experience, evening plan or leisure note here.</span>
    </div>

    <div style="margin-bottom:10px;">
      <strong>Day 2:</strong> Sightseeing / activity plan<br/>
      <span style="color:#64748b;">Add sightseeing details, pickup note and experience highlights here.</span>
    </div>

    <div style="margin-bottom:10px;">
      <strong>Day 3:</strong> Leisure / optional experience<br/>
      <span style="color:#64748b;">Add optional tour, shopping, beach, cruise or activity details here.</span>
    </div>

    <div>
      <strong>Final Day:</strong> Checkout and departure transfer<br/>
      <span style="color:#64748b;">Add departure timing and transfer note here.</span>
    </div>
  </div><br/>

  This itinerary can be customized based on client interest, flight timing and budget preference.<br/><br/>

  {{assetLinksHtml}}
  {{signature}}
</div>`,
      whatsappText: `Hi {{spocName}},

Sharing suggested day-wise itinerary for {{destination}}.

Itinerary Overview:

Day 1:
Arrival, transfers and hotel check-in.
Add arrival experience or evening leisure note here.

Day 2:
Sightseeing / activity plan.
Add sightseeing details and experience highlights here.

Day 3:
Leisure / optional experience.
Add optional tour, shopping, beach, cruise or activity details here.

Final Day:
Checkout and departure transfer.

This itinerary can be customized based on client interest, flight timing and budget preference.

{{assetLinks}}

{{signature}}`,
      checklist: [
        "Keep day-wise flow clear.",
        "Mention activities and transfer notes.",
        "Add customization note for travel agent confidence."
      ]
    },

    document: {
      title: "Document Writing Block",
      description: "Use this when sharing visa, voucher, invoice, ticket or confirmation documents.",
      subject: "Document Shared for {{destination}}",
      emailHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear {{spocName}},<br/><br/>
  Please find the required document details attached/shared below for {{destination}}.<br/><br/>

  Kindly review the details and let us know if any correction or clarification is required.<br/><br/>

  {{assetLinksHtml}}
  {{signature}}
</div>`,
      whatsappText: `Hi {{spocName}},

Please find the required document details shared below for {{destination}}.

Kindly review and let us know if any correction or clarification is required.

{{assetLinks}}

{{signature}}`,
      checklist: [
        "Mention what document is being shared.",
        "Ask partner to review details.",
        "Attach/select correct asset."
      ]
    },

    vendor: {
      title: "Vendor Writing Block",
      description: "Use this for vendor rate requests, follow-up and operational communication.",
      subject: "Rate Request for {{destination}}",
      emailHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear Partner,<br/><br/>
  We request your best rates and availability for {{destination}}.<br/><br/>

  Requirement Details:<br/>
  - Destination: {{destination}}<br/>
  - Travel Date: Add date here<br/>
  - Pax: Add pax here<br/>
  - Hotel Category: Add hotel category here<br/>
  - Meal Plan: Add meal plan here<br/><br/>

  Kindly share the best possible costing with inclusions, exclusions and cancellation terms.<br/><br/>
  {{signature}}
</div>`,
      whatsappText: `Dear Partner,

Please share best rates and availability for {{destination}}.

Requirement Details:
- Destination: {{destination}}
- Travel Date: Add date here
- Pax: Add pax here
- Hotel Category: Add hotel category here
- Meal Plan: Add meal plan here

Kindly share costing with inclusions, exclusions and cancellation terms.

{{signature}}`,
      checklist: [
        "Mask travel agent/client sensitive details where needed.",
        "Ask for inclusions, exclusions and cancellation terms.",
        "Mention deadline if urgent."
      ]
    },

    internal: {
      title: "Internal Writing Block",
      description: "Use this for internal team updates and handover communication.",
      subject: "Internal Update - {{destination}}",
      emailHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Team,<br/><br/>
  Internal update for {{destination}}:<br/><br/>

  - Current Status: Add status here<br/>
  - Pending From: Add owner here<br/>
  - Next Action: Add next action here<br/>
  - Priority: Add priority here<br/><br/>

  Please take action accordingly.<br/><br/>
  {{signature}}
</div>`,
      whatsappText: `Team,

Internal update for {{destination}}:

- Current Status: Add status here
- Pending From: Add owner here
- Next Action: Add next action here
- Priority: Add priority here

Please take action accordingly.

{{signature}}`,
      checklist: [
        "Mention status clearly.",
        "Add owner and next action.",
        "Keep it operational and direct."
      ]
    }
  };

  return starters[value] || starters.message;
}


function parseLines(value = "") {
  return String(value || "")
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function buildHtmlList(value = "", fallback = []) {
  const items = parseLines(value);

  const finalItems = items.length ? items : fallback;

  if (!finalItems.length) return "";

  return finalItems
    .map(
      item => `
        <li style="margin:0 0 6px;color:#334155;font-size:13px;line-height:1.6;">
          ${escapeHtml(item)}
        </li>
      `
    )
    .join("");
}

function buildTextList(value = "", fallback = []) {
  const items = parseLines(value);
  const finalItems = items.length ? items : fallback;

  if (!finalItems.length) return "";

  return finalItems.map(item => `- ${item}`).join("\n");
}
function removeGeneratedPackageBlock(html = "") {
  return String(html || "").replace(
    /<!-- PACKAGE_BUILDER_START -->[\s\S]*?<!-- PACKAGE_BUILDER_END -->/gi,
    ""
  );
}

function injectPackageBlocksIntoEmailerDesign({
  emailDesignHtml = "",
  packageContentHtml = "",
  itineraryHtml = "",
  tentativePricingHtml = ""
}) {
  const generatedBlock = `
<!-- PACKAGE_BUILDER_START -->
${packageContentHtml || ""}
${itineraryHtml || ""}
${tentativePricingHtml || ""}
<!-- PACKAGE_BUILDER_END -->
`;

  let design = removeGeneratedPackageBlock(emailDesignHtml);

  if (!design.trim()) {
    design = `
<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear {{spocName}},<br/><br/>

  Please find below the package details for your client.<br/><br/>

  {{packageContentHtml}}

  {{assetLinksHtml}}

  {{signature}}
</div>
`;
  }

  const hasPackagePlaceholder =
    design.includes("{{packageContentHtml}}") ||
    design.includes("{{ packageContentHtml }}");

  const hasItineraryPlaceholder =
    design.includes("{{itineraryHtml}}") ||
    design.includes("{{ itineraryHtml }}");

  const hasPricingPlaceholder =
    design.includes("{{tentativePricingHtml}}") ||
    design.includes("{{ tentativePricingHtml }}");

  if (hasPackagePlaceholder) {
    return design
      .replaceAll("{{packageContentHtml}}", generatedBlock)
      .replaceAll("{{ packageContentHtml }}", generatedBlock)
      .replaceAll("{{itineraryHtml}}", "")
      .replaceAll("{{ itineraryHtml }}", "")
      .replaceAll("{{tentativePricingHtml}}", "")
      .replaceAll("{{ tentativePricingHtml }}", "");
  }

  if (hasItineraryPlaceholder) {
    return design
      .replaceAll("{{itineraryHtml}}", generatedBlock)
      .replaceAll("{{ itineraryHtml }}", generatedBlock)
      .replaceAll("{{packageContentHtml}}", "")
      .replaceAll("{{ packageContentHtml }}", "")
      .replaceAll("{{tentativePricingHtml}}", "")
      .replaceAll("{{ tentativePricingHtml }}", "");
  }

  if (hasPricingPlaceholder) {
    return design
      .replaceAll("{{tentativePricingHtml}}", generatedBlock)
      .replaceAll("{{ tentativePricingHtml }}", generatedBlock)
      .replaceAll("{{packageContentHtml}}", "")
      .replaceAll("{{ packageContentHtml }}", "")
      .replaceAll("{{itineraryHtml}}", "")
      .replaceAll("{{ itineraryHtml }}", "");
  }

  if (design.includes("{{body}}")) {
    return design.replace("{{body}}", generatedBlock);
  }

  if (design.includes("{{ body }}")) {
    return design.replace("{{ body }}", generatedBlock);
  }

  if (design.includes("{{assetLinksHtml}}")) {
    return design.replace(
      "{{assetLinksHtml}}",
      `${generatedBlock}{{assetLinksHtml}}`
    );
  }

  if (design.includes("{{ assetLinksHtml }}")) {
    return design.replace(
      "{{ assetLinksHtml }}",
      `${generatedBlock}{{ assetLinksHtml }}`
    );
  }

  if (design.includes("{{signature}}")) {
    return design.replace("{{signature}}", `${generatedBlock}{{signature}}`);
  }

  if (design.includes("{{ signature }}")) {
    return design.replace("{{ signature }}", `${generatedBlock}{{ signature }}`);
  }

  return `${design}${generatedBlock}`;
}

function cleanPackageConfig(config = {}) {
  return {
    ...EMPTY_PACKAGE_CONFIG,
    ...(config || {}),

    packagePurpose:
      config.packagePurpose ||
      EMPTY_PACKAGE_CONFIG.packagePurpose,

    packageTitle: cleanString(config.packageTitle),
    destinationName: cleanString(config.destinationName),
    duration: cleanString(config.duration),
    hotelCategory: cleanString(config.hotelCategory),
    mealPlan: cleanString(config.mealPlan),
    transferType: cleanString(config.transferType),
    startingPrice: cleanString(config.startingPrice),
    currency: cleanString(config.currency) || "INR",
    validity: cleanString(config.validity),

    highlights: String(config.highlights || "").trim(),
    inclusions: String(config.inclusions || "").trim(),
    exclusions: String(config.exclusions || "").trim(),

    itinerary: String(config.itinerary || "").trim(),
    tentativePricing: String(config.tentativePricing || "").trim(),

    terms: String(config.terms || "").trim(),
    notes: String(config.notes || "").trim()
  };
}

function getPackagePurposeLabel(value = "") {
  return (
    PACKAGE_PURPOSES.find(item => item.value === value)?.label ||
    "Regular Package"
  );
}

function buildPackageEmailHtml(config = {}) {
  const packageConfig = cleanPackageConfig(config);

  const destination =
    packageConfig.destinationName ||
    "{{destination}}";

  const title =
    packageConfig.packageTitle ||
    `${destination} Package Details`;

  const priceText =
    packageConfig.startingPrice
      ? `${packageConfig.currency || "INR"} ${packageConfig.startingPrice}`
      : "As per final availability";

  const highlightsHtml = buildHtmlList(packageConfig.highlights, [
    "Comfortable stay options",
    "Smooth transfers and sightseeing support",
    "Customizable as per client preference"
  ]);

  const inclusionsHtml = buildHtmlList(packageConfig.inclusions, [
    "Hotel accommodation",
    "Airport transfers",
    "Sightseeing as per plan"
  ]);

  const exclusionsHtml = buildHtmlList(packageConfig.exclusions, [
    "Flights",
    "Visa / TCS unless mentioned",
    "Personal expenses"
  ]);

  const termsHtml = buildHtmlList(packageConfig.terms, [
    "Rates are subject to availability at the time of confirmation.",
    "Final confirmation will be shared after payment and supplier confirmation.",
    "Package can be customized as per client requirement."
  ]);

  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
  Dear {{spocName}},<br/><br/>

  Please find below the <strong>${escapeHtml(title)}</strong>. We have planned this package keeping comfort, smooth arrangements and memorable travel moments in mind.<br/><br/>

  <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
    <div style="font-size:16px;font-weight:800;color:#1d4e89;margin-bottom:10px;">
      ${escapeHtml(title)}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#334155;">
      <tr>
        <td style="padding:6px 0;font-weight:700;width:36%;">Package Type</td>
        <td style="padding:6px 0;">${escapeHtml(getPackagePurposeLabel(packageConfig.packagePurpose))}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Destination</td>
        <td style="padding:6px 0;">${escapeHtml(destination)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Duration</td>
        <td style="padding:6px 0;">${escapeHtml(packageConfig.duration || "As per requirement")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Hotel Category</td>
        <td style="padding:6px 0;">${escapeHtml(packageConfig.hotelCategory || "As per preference")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Meal Plan</td>
        <td style="padding:6px 0;">${escapeHtml(packageConfig.mealPlan || "As per package")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Transfers</td>
        <td style="padding:6px 0;">${escapeHtml(packageConfig.transferType || "As per package")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Starting Price</td>
        <td style="padding:6px 0;">${escapeHtml(priceText)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;">Validity</td>
        <td style="padding:6px 0;">${escapeHtml(packageConfig.validity || "Subject to availability")}</td>
      </tr>
    </table>
  </div><br/>

  <div style="padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;">
    <div style="font-size:14px;font-weight:800;color:#1d4e89;margin-bottom:8px;">Package Highlights</div>
    <ul style="margin:0;padding-left:18px;">${highlightsHtml}</ul>
  </div><br/>

  <div style="padding:14px;border:1px solid #dcfce7;border-radius:14px;background:#f0fdf4;">
    <div style="font-size:14px;font-weight:800;color:#047857;margin-bottom:8px;">Inclusions</div>
    <ul style="margin:0;padding-left:18px;">${inclusionsHtml}</ul>
  </div><br/>

  <div style="padding:14px;border:1px solid #fee2e2;border-radius:14px;background:#fff7f7;">
    <div style="font-size:14px;font-weight:800;color:#b91c1c;margin-bottom:8px;">Exclusions</div>
    <ul style="margin:0;padding-left:18px;">${exclusionsHtml}</ul>
  </div><br/>

  ${packageConfig.notes
      ? `<div style="padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
        <div style="font-size:14px;font-weight:800;color:#334155;margin-bottom:6px;">Additional Notes</div>
        <div>${escapeHtml(packageConfig.notes).replaceAll("\n", "<br/>")}</div>
      </div><br/>`
      : ""}

  <strong>Important Terms:</strong><br/>
  <ul style="margin:8px 0 0;padding-left:18px;">${termsHtml}</ul><br/>

  Please let us know if we should check live availability and final costing for your client.<br/><br/>

  {{assetLinksHtml}}
  {{signature}}
</div>`;
}

function buildPackageWhatsappText(config = {}) {
  const packageConfig = cleanPackageConfig(config);

  const destination =
    packageConfig.destinationName ||
    "{{destination}}";

  const title =
    packageConfig.packageTitle ||
    `${destination} Package Details`;

  const priceText =
    packageConfig.startingPrice
      ? `${packageConfig.currency || "INR"} ${packageConfig.startingPrice}`
      : "As per final availability";

  const highlightsText = buildTextList(packageConfig.highlights, [
    "Comfortable stay options",
    "Smooth transfers and sightseeing support",
    "Customizable as per client preference"
  ]);

  const inclusionsText = buildTextList(packageConfig.inclusions, [
    "Hotel accommodation",
    "Airport transfers",
    "Sightseeing as per plan"
  ]);

  const exclusionsText = buildTextList(packageConfig.exclusions, [
    "Flights",
    "Visa / TCS unless mentioned",
    "Personal expenses"
  ]);

  const itineraryText = buildTextList(packageConfig.itinerary);

  const tentativePricingText = buildTextList(
    packageConfig.tentativePricing
  );

  const termsText = buildTextList(packageConfig.terms, [
    "Rates are subject to availability.",
    "Final confirmation after payment and supplier confirmation.",
    "Package can be customized as per client requirement."
  ]);

  return `Hi {{spocName}},

Sharing ${title}.

Package Snapshot:
- Package Type: ${getPackagePurposeLabel(packageConfig.packagePurpose)}
- Destination: ${destination}
- Duration: ${packageConfig.duration || "As per requirement"}
- Hotel Category: ${packageConfig.hotelCategory || "As per preference"}
- Meal Plan: ${packageConfig.mealPlan || "As per package"}
- Transfers: ${packageConfig.transferType || "As per package"}
- Starting Price: ${priceText}
- Validity: ${packageConfig.validity || "Subject to availability"}

Package Highlights:
${highlightsText}

Inclusions:
${inclusionsText}

Exclusions:
${exclusionsText}

${itineraryText ? `Tentative Itinerary:\n${itineraryText}\n\n` : ""}${tentativePricingText ? `Tentative Pricing:\n${tentativePricingText}\n\n` : ""}${packageConfig.notes ? `Additional Notes:\n${packageConfig.notes}\n\n` : ""}Important Terms:
${termsText}

Please let us know if we should check live availability and final costing for your client.

{{assetLinks}}

{{signature}}`;
}

/* =========================
   PAGE
========================= */

export default function CommunicationTemplateEditPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();

  const templateId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [destinations, setDestinations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [branding, setBranding] = useState(null);

  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState("email");
  const [copied, setCopied] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  useEffect(() => {
    if (!templateId) return;

    const unsub = onSnapshot(
      doc(db, "communicationTemplates", templateId),
      snapshot => {
        if (!snapshot.exists()) {
          setTemplate(null);
          setLoading(false);
          return;
        }

        const data = {
          id: snapshot.id,
          ...snapshot.data()
        };

        const rawWhatsappContent = getTemplateWhatsappContent(data);
        const rawEmailContent = getTemplateEmailContent(data);

        const emailEnabled =
          data?.channels?.email === true ||
          Boolean(rawEmailContent || data?.emailSubject || data?.subject);

        const whatsappEnabled =
          data?.channels?.whatsapp === true ||
          Boolean(rawWhatsappContent);

        setTemplate(data);
        setForm({
          name: data.name || "",
          slug: data.slug || snapshot.id || "",
          templateType:
            data.templateType ||
            data.type ||
            data.templateKind ||
            "message",
          categoryCode: data.categoryCode || data.category || "general",
          categoryName: data.categoryName || data.category || "General",

          intentCodes: toCsv(data.intentCodes),
          outcomeCodes: toCsv(data.outcomeCodes),

          emailEnabled,
          whatsappEnabled,

          emailSubject: getTemplateSubject(data),

          emailDesignHtml:
            data.emailDesignHtml ||
            data.emailerDesignHtml ||
            data.designHtml ||
            removeGeneratedPackageBlock(rawEmailContent || ""),

          emailHtml: rawEmailContent || "",

          whatsappText: rawWhatsappContent || "",

          active: data.active !== false,

          destinationIds: Array.isArray(data.destinationIds)
            ? data.destinationIds
            : [],
          primaryDestination: data.primaryDestination || "",

          defaultAssetIds: Array.isArray(data.defaultAssetIds)
            ? data.defaultAssetIds
            : Array.isArray(data.defaultAssets)
              ? data.defaultAssets
                .map(asset => asset.assetId || asset.id)
                .filter(Boolean)
              : [],

          packageConfig: cleanPackageConfig({
            ...(data.packageConfig || {}),

            packagePurpose:
              data.packagePurpose ||
              data.packageConfig?.packagePurpose ||
              "regular",

            packageTitle:
              data.packageTitle ||
              data.packageConfig?.packageTitle ||
              "",

            destinationName:
              data.packageDestinationName ||
              data.packageConfig?.destinationName ||
              data.primaryDestination ||
              "",

            duration:
              data.packageDuration ||
              data.duration ||
              data.packageConfig?.duration ||
              "",

            hotelCategory:
              data.packageHotelCategory ||
              data.hotelCategory ||
              data.packageConfig?.hotelCategory ||
              "",

            mealPlan:
              data.packageMealPlan ||
              data.mealPlan ||
              data.packageConfig?.mealPlan ||
              "",

            transferType:
              data.packageTransferType ||
              data.transferType ||
              data.packageConfig?.transferType ||
              "",

            startingPrice:
              data.packageStartingPrice ||
              data.startingPrice ||
              data.packageConfig?.startingPrice ||
              "",

            currency:
              data.packageCurrency ||
              data.currency ||
              data.packageConfig?.currency ||
              "INR",

            validity:
              data.packageValidity ||
              data.validity ||
              data.packageConfig?.validity ||
              "",

            highlights:
              data.packageHighlights ||
              data.highlights ||
              data.packageConfig?.highlights ||
              "",

            itinerary:
              data.packageItinerary ||
              data.itinerary ||
              data.packageConfig?.itinerary ||
              "",

            tentativePricing:
              data.packageTentativePricing ||
              data.tentativePricing ||
              data.packageConfig?.tentativePricing ||
              "",

            inclusions:
              data.packageInclusions ||
              data.inclusions ||
              data.packageConfig?.inclusions ||
              "",

            exclusions:
              data.packageExclusions ||
              data.exclusions ||
              data.packageConfig?.exclusions ||
              "",

            terms:
              data.packageTerms ||
              data.terms ||
              data.packageConfig?.terms ||
              "",

            notes:
              data.packageNotes ||
              data.notes ||
              data.packageConfig?.notes ||
              ""
          })
        });

        setLoading(false);
      },
      error => {
        console.error("Failed to load template:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [templateId]);

  useEffect(() => {
    let mounted = true;

    async function loadMeta() {
      try {
        setMetaLoading(true);

        const [destinationSnap, assetSnap, brandingData] = await Promise.all([
          getDocs(collection(db, "destinations")),
          getDocs(collection(db, "documents")),
          getBrandingSettings()
        ]);

        if (!mounted) return;

        setBranding(brandingData || null);

        setDestinations(
          destinationSnap.docs
            .map(document => ({
              id: document.id,
              ...document.data()
            }))
            .filter(item => {
              if (item.deleted === true || item.isDeleted === true) return false;
              if (item.archived === true) return false;
              if (item.active === false) return false;
              return true;
            })
            .sort((a, b) =>
              String(a.name || "").localeCompare(String(b.name || ""))
            )
        );

        setAssets(
          assetSnap.docs
            .map(document => ({
              id: document.id,
              ...document.data()
            }))
            .filter(item => {
              if (item.deleted === true || item.isDeleted === true) return false;
              if (item.archived === true) return false;
              if (item.active === false) return false;
              if (item.status && item.status !== "active") return false;
              if (!getAssetUrl(item)) return false;
              return true;
            })
            .sort((a, b) =>
              String(getAssetTitle(a)).localeCompare(String(getAssetTitle(b)))
            )
        );
      } catch (error) {
        console.error("Failed to load meta:", error);
      } finally {
        if (mounted) setMetaLoading(false);
      }
    }

    loadMeta();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedDestinations = useMemo(() => {
    return destinations.filter(destination =>
      form.destinationIds.includes(destination.id)
    );
  }, [destinations, form.destinationIds]);

  const selectedDestinationNames = useMemo(() => {
    return selectedDestinations.map(item => item.name).filter(Boolean);
  }, [selectedDestinations]);

  const selectedAssets = useMemo(() => {
    return assets
      .filter(asset => {
        const id = getAssetId(asset);

        return (
          form.defaultAssetIds.includes(id) ||
          form.defaultAssetIds.includes(asset.id)
        );
      })
      .map(normalizeAsset);
  }, [assets, form.defaultAssetIds]);


  const starterContent = useMemo(() => {
    return getStarterContent(form.templateType);
  }, [form.templateType]);

  const previewVars = useMemo(() => {
    return {
      spocName: "Travel Partner",
      agencyName: "Sample Travel Agency",
      agentName: "Sample Travel Agency",
      agentCode: "DT-TA-0001",

      destination:
        selectedDestinationNames.join(", ") ||
        form.primaryDestination ||
        "Dubai",

      destinationName:
        selectedDestinationNames.join(", ") ||
        form.primaryDestination ||
        "Dubai",

      teamMemberName: getUserName(user),
      senderName: getUserName(user),

      companyName:
        branding?.companyName ||
        branding?.brandName ||
        "DreamTrawell Destination",

      companyEmail:
        branding?.companyEmail ||
        branding?.supportEmail ||
        "outbound@dreamtrawelldestination.com",

      companyPhone:
        branding?.companyPhone ||
        branding?.supportMobile ||
        "",

      companyLogoUrl:
        branding?.companyLogoUrl ||
        branding?.emailLogoUrl ||
        branding?.headerLogoUrl ||
        branding?.signatureLogoUrl ||
        branding?.logoUrl ||
        branding?.logo ||
        "",

      websiteUrl:
        branding?.websiteUrl ||
        "https://dreamtrawelldestination.com/",

      tagline:
        branding?.tagline ||
        "Realize the Experiance",

      assetLinks: buildAssetLinksText(selectedAssets),
      assetLinksHtml: buildAssetLinksHtml(selectedAssets),

      signature:
        previewMode === "email"
          ? `
            <div style="margin-top:18px;border-top:1px solid #e2e8f0;padding-top:14px;">
              <div style="font-weight:800;color:#1d4e89;">${escapeHtml(getUserName(user))}</div>
              <div style="font-size:13px;color:#64748b;margin-top:2px;">DreamTrawell Destination</div>
            </div>
          `
          : `Regards,\n${getUserName(user)}\nDreamTrawell Destination`
    };
  }, [
    user,
    branding,
    previewMode,
    selectedAssets,
    selectedDestinationNames,
    form.primaryDestination
  ]);

  const emailPreviewSubject = useMemo(() => {
    return compileTemplate(
      form.emailSubject || starterContent.subject || "Communication from {{companyName}}",
      previewVars
    );
  }, [form.emailSubject, previewVars, starterContent.subject]);

  const emailPreviewHtml = useMemo(() => {
    const html =
      normalize(form.templateType) === "package"
        ? buildPackageEmailFromDesign({
          form,
          branding
        })
        : form.emailHtml ||
        starterContent.emailHtml ||
        `
          <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#334155;">
            Dear {{spocName}},<br/><br/>
            Your email template preview will appear here.<br/><br/>
            Destination: {{destination}}<br/><br/>
            {{assetLinksHtml}}
            {{signature}}
          </div>
        `;

    return compileTemplate(html, previewVars);
  }, [
    form,
    branding,
    previewVars,
    starterContent.emailHtml
  ]);

  const whatsappPreview = useMemo(() => {
    const text =
      form.whatsappText ||
      starterContent.whatsappText ||
      `Hi {{spocName}},

Your WhatsApp template preview will appear here.

Destination: {{destination}}

{{assetLinks}}

{{signature}}`;

    return compileTemplate(text, {
      ...previewVars,
      signature: `Regards,\n${getUserName(user)}\nDreamTrawell Destination`
    });
  }, [form.whatsappText, previewVars, user, starterContent.whatsappText]);

  const hasChanges = Boolean(template);

  const canSave =
    hasChanges &&
    cleanString(form.name) &&
    cleanString(form.templateType) &&
    (form.emailEnabled || form.whatsappEnabled);

  function toggleDestination(destinationId) {
    setForm(prev => ({
      ...prev,
      destinationIds: prev.destinationIds.includes(destinationId)
        ? prev.destinationIds.filter(id => id !== destinationId)
        : [...prev.destinationIds, destinationId]
    }));
  }

  function toggleAsset(assetId) {
    setForm(prev => ({
      ...prev,
      defaultAssetIds: prev.defaultAssetIds.includes(assetId)
        ? prev.defaultAssetIds.filter(id => id !== assetId)
        : [...prev.defaultAssetIds, assetId]
    }));
  }

  function applyStarterEmail() {
    setForm(prev => ({
      ...prev,
      emailEnabled: true,
      emailSubject: starterContent.subject,
      emailHtml: starterContent.emailHtml
    }));
    setPreviewMode("email");
  }

  function applyStarterWhatsapp() {
    setForm(prev => ({
      ...prev,
      whatsappEnabled: true,
      whatsappText: starterContent.whatsappText
    }));
    setPreviewMode("whatsapp");
  }

  function applyStarterBoth() {
    setForm(prev => ({
      ...prev,
      emailEnabled: true,
      whatsappEnabled: true,
      emailSubject: starterContent.subject,
      emailHtml: starterContent.emailHtml,
      whatsappText: starterContent.whatsappText
    }));
    setPreviewMode("email");
  }

  function updatePackageConfig(patch = {}) {
    setForm(prev => ({
      ...prev,
      packageConfig: {
        ...EMPTY_PACKAGE_CONFIG,
        ...(prev.packageConfig || {}),
        ...patch
      }
    }));
  }

  function applySelectedDestinationToPackage() {
    const destinationName =
      selectedDestinationNames.join(", ") ||
      form.primaryDestination ||
      "";

    updatePackageConfig({
      destinationName
    });
  }

  function generatePackageEmail() {
    const packageConfig = cleanPackageConfig(form.packageConfig);

    const emailDesignHtml = resolveEmailDesignHtml({
      savedDesignHtml: form.emailDesignHtml,
      fallbackHtml: form.emailHtml
    });

    const emailHtml = buildPackageEmailFromDesign({
      form: {
        ...form,
        emailDesignHtml
      },
      branding
    });

    setForm(prev => ({
      ...prev,
      emailEnabled: true,
      emailSubject:
        prev.emailSubject ||
        `${packageConfig.destinationName || "{{destination}}"} Package`,
      emailDesignHtml,
      emailHtml
    }));

    setPreviewMode("email");
  }

  function generatePackageWhatsapp() {
    const whatsappText = buildPackageWhatsappText(form.packageConfig);

    setForm(prev => ({
      ...prev,
      whatsappEnabled: true,
      whatsappText
    }));

    setPreviewMode("whatsapp");
  }

  function generatePackageBoth() {
    const packageConfig = cleanPackageConfig(form.packageConfig);

    const emailDesignHtml = resolveEmailDesignHtml({
      savedDesignHtml: form.emailDesignHtml,
      fallbackHtml: form.emailHtml
    });

    const emailHtml = buildPackageEmailFromDesign({
      form: {
        ...form,
        emailDesignHtml
      },
      branding
    });

    const whatsappText = buildPackageWhatsappText(packageConfig);

    setForm(prev => ({
      ...prev,
      emailEnabled: true,
      whatsappEnabled: true,
      emailSubject:
        prev.emailSubject ||
        `${packageConfig.destinationName || "{{destination}}"} Package`,
      emailDesignHtml,
      emailHtml,
      whatsappText
    }));

    setPreviewMode("email");
  }

  async function copyPreview() {
    const value =
      previewMode === "email"
        ? stripHtml(emailPreviewHtml)
        : whatsappPreview;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  async function saveTemplate() {
    if (!canSave) {
      alert("Template name, template type and at least one channel are required.");
      return;
    }

    try {
      setSaving(true);

      const selectedDestinationNamesForSave = selectedDestinations
        .map(item => item.name)
        .filter(Boolean);

      const defaultAssets = selectedAssets.map(asset => ({
        assetId: asset.assetId,
        title: asset.title,
        url: asset.url,
        categoryId: asset.categoryId,
        categoryName: asset.categoryName,
        assetType: asset.assetType,
        currentVersion: asset.currentVersion
      }));

      const templateType = form.templateType || "message";
      const emailHtml = form.emailEnabled ? form.emailHtml || "" : "";
      const whatsappText = form.whatsappEnabled ? form.whatsappText || "" : "";
      const packageConfig = cleanPackageConfig(form.packageConfig || {});

      const emailDesignHtml = resolveEmailDesignHtml({
        savedDesignHtml: form.emailDesignHtml,
        fallbackHtml: emailHtml
      });

      await updateDoc(doc(db, "communicationTemplates", templateId), {
        name: cleanString(form.name),
        slug: cleanSlug(form.slug || form.name),

        templateType,
        type: templateType,
        templateKind: templateType,

        categoryCode: cleanString(form.categoryCode) || "general",
        categoryName:
          cleanString(form.categoryName) ||
          cleanString(form.categoryCode) ||
          "General",

        intentCodes: parseCsv(form.intentCodes),
        outcomeCodes: parseCsv(form.outcomeCodes),

        channels: {
          email: Boolean(form.emailEnabled),
          whatsapp: Boolean(form.whatsappEnabled)
        },

        emailSubject: form.emailEnabled ? form.emailSubject || "" : "",
        subject: form.emailEnabled ? form.emailSubject || "" : "",

        // emailDesignHtml:
        //   form.emailDesignHtml ||
        //   removeGeneratedPackageBlock(emailHtml),

        emailDesignHtml,
        emailerDesignHtml: emailDesignHtml,

        emailHtml,
        whatsappText,

        contentHtml: emailHtml,
        contentText: whatsappText,

        packageConfig: templateType === "package" ? packageConfig : null,

        packagePurpose:
          templateType === "package" ? packageConfig.packagePurpose : "",

        packageTitle:
          templateType === "package" ? packageConfig.packageTitle : "",

        packageDestinationName:
          templateType === "package" ? packageConfig.destinationName : "",

        packageDuration:
          templateType === "package" ? packageConfig.duration : "",

        packageHotelCategory:
          templateType === "package" ? packageConfig.hotelCategory : "",

        packageMealPlan:
          templateType === "package" ? packageConfig.mealPlan : "",

        packageTransferType:
          templateType === "package" ? packageConfig.transferType : "",

        packageStartingPrice:
          templateType === "package" ? packageConfig.startingPrice : "",

        packageCurrency:
          templateType === "package" ? packageConfig.currency : "",

        packageValidity:
          templateType === "package" ? packageConfig.validity : "",

        packageHighlights:
          templateType === "package" ? packageConfig.highlights : "",

        packageInclusions:
          templateType === "package" ? packageConfig.inclusions : "",

        packageExclusions:
          templateType === "package" ? packageConfig.exclusions : "",

        packageTerms:
          templateType === "package" ? packageConfig.terms : "",

        packageNotes:
          templateType === "package" ? packageConfig.notes : "",

        packageItinerary:
          templateType === "package" ? packageConfig.itinerary : "",

        packageTentativePricing:
          templateType === "package" ? packageConfig.tentativePricing : "",

        packageHtml: templateType === "package" ? emailHtml : "",
        packageText: templateType === "package" ? whatsappText : "",
        packageSubject: templateType === "package" ? form.emailSubject || "" : "",

        itineraryHtml: templateType === "itinerary" ? emailHtml : "",
        itineraryText: templateType === "itinerary" ? whatsappText : "",
        itinerarySubject: templateType === "itinerary" ? form.emailSubject || "" : "",

        destinationIds: form.destinationIds || [],
        destinationNames: selectedDestinationNamesForSave,
        primaryDestination:
          form.primaryDestination ||
          selectedDestinationNamesForSave[0] ||
          "",

        defaultAssets,
        defaultAssetIds: defaultAssets
          .map(asset => asset.assetId)
          .filter(Boolean),
        defaultAssetTitles: defaultAssets
          .map(asset => asset.title)
          .filter(Boolean),

        active: Boolean(form.active),
        status: form.active ? "active" : "draft",

        editable: template?.editable !== false,
        deleted: false,
        isDeleted: false,
        archived: false,

        updatedByUid: user?.uid || "",
        updatedByName: getUserName(user),
        updatedByEmail: user?.email || "",
        updatedAt: serverTimestamp()
      });

      alert("Template updated successfully");
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  if (loading || metaLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading template...
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-3 text-lg font-bold text-slate-950">
            Template not found
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            This communication template does not exist or has been removed.
          </p>

          <Link
            href="/admin/communication-templates"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Templates
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        {/* PAGE HEADER */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="bg-gradient-to-r from-[#1d4e89] via-[#285f9f] to-[#9b0112] px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link
                  href="/admin/communication-templates"
                  className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Templates
                </Link>

                <h1 className="mt-3 text-2xl font-bold">
                  Edit Communication Template
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">
                  Update content, smart mapping, channel settings, destination
                  mapping, package / itinerary writing and default assets.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold ${getStatusClass(form)}`}>
                  {getStatusLabel(form)}
                </span>

                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={!canSave || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#1d4e89] hover:bg-blue-50 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white p-4 md:grid-cols-5">
            <StatCard
              label="Type"
              value={getTemplateTypeLabel(form.templateType)}
              icon={<FileText className="h-5 w-5" />}
            />
            <StatCard
              label="Usage"
              value={Number(template.usageCount || 0)}
              icon={<Eye className="h-5 w-5" />}
            />
            <StatCard
              label="Last Used"
              value={formatDate(template.lastUsedAt)}
              icon={<Archive className="h-5 w-5" />}
            />
            <StatCard
              label="Created"
              value={formatDate(template.createdAt)}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              label="Updated"
              value={formatDate(template.updatedAt)}
              icon={<RefreshCcw className="h-5 w-5" />}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
          {/* LEFT FORM */}
          <div className="space-y-5">
            <FormSection
              icon={<FileText className="h-4 w-4" />}
              title="Basic Details"
              description="Update template identity, type and category."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Template Name" required>
                  <input
                    value={form.name}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        name: event.target.value
                      }))
                    }
                    className="form-input"
                    placeholder="Template name"
                  />
                </Field>

                <Field label="Slug">
                  <input
                    value={form.slug}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        slug: event.target.value
                      }))
                    }
                    className="form-input"
                    placeholder="template-slug"
                  />
                </Field>

                <Field
                  label="Template Type"
                  hint={getTemplateTypeDescription(form.templateType)}
                  required
                >
                  <select
                    value={form.templateType}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        templateType: event.target.value
                      }))
                    }
                    className="form-input"
                  >
                    {TEMPLATE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Category Name">
                  <input
                    value={form.categoryName}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        categoryName: event.target.value
                      }))
                    }
                    className="form-input"
                    placeholder="Follow Up"
                  />
                </Field>

                <Field label="Category Code">
                  <input
                    value={form.categoryCode}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        categoryCode: event.target.value
                      }))
                    }
                    className="form-input"
                    placeholder="follow_up"
                  />
                </Field>

                <Field label="Primary Destination">
                  <input
                    value={form.primaryDestination}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        primaryDestination: event.target.value
                      }))
                    }
                    className="form-input"
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </FormSection>

            <TemplateWritingBlock
              type={form.templateType}
              starter={starterContent}
              emailEnabled={form.emailEnabled}
              whatsappEnabled={form.whatsappEnabled}
              onApplyEmail={applyStarterEmail}
              onApplyWhatsapp={applyStarterWhatsapp}
              onApplyBoth={applyStarterBoth}
            />

            {normalize(form.templateType) === "package" && (
              <PackageBuilderBlock
                config={form.packageConfig}
                selectedDestinationName={
                  selectedDestinationNames.join(", ") ||
                  form.primaryDestination ||
                  ""
                }
                onChange={updatePackageConfig}
                onUseSelectedDestination={applySelectedDestinationToPackage}
                onGenerateEmail={generatePackageEmail}
                onGenerateWhatsapp={generatePackageWhatsapp}
                onGenerateBoth={generatePackageBoth}
              />
            )}

            <FormSection
              icon={<Sparkles className="h-4 w-4" />}
              title="Smart Mapping"
              description="Map intent and outcome codes so Send Communication can prioritize this template."
              tone="blue"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <CodePicker
                  label="Intent Codes"
                  hint="Used for direct template recommendation."
                  fieldName="intentCodes"
                  value={form.intentCodes}
                  options={COMMON_INTENTS}
                  tone="blue"
                  placeholder="Select intent"
                  setForm={setForm}
                />

                <CodePicker
                  label="Outcome Codes"
                  hint="Used as fallback when intent is missing."
                  fieldName="outcomeCodes"
                  value={form.outcomeCodes}
                  options={COMMON_OUTCOMES}
                  tone="purple"
                  placeholder="Select outcome"
                  setForm={setForm}
                />
              </div>
            </FormSection>

            <FormSection
              icon={<MapPin className="h-4 w-4" />}
              title="Destination Mapping"
              description="Leave empty to make this template available for all destinations."
              tone="slate"
            >
              {destinations.length ? (
                <div className="flex flex-wrap gap-2">
                  {destinations.map(destination => {
                    const active = form.destinationIds.includes(destination.id);

                    return (
                      <button
                        key={destination.id}
                        type="button"
                        onClick={() => toggleDestination(destination.id)}
                        className={`rounded-full border px-3 py-2 text-xs font-bold transition ${active
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        {destination.name || destination.destinationName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  No active destinations found.
                </p>
              )}
            </FormSection>



            <FormSection
              icon={<Mail className="h-4 w-4" />}
              title={`${getTemplateTypeLabel(form.templateType)} Email Content`}
              description="Enable email channel and edit the email subject / HTML."
              tone="blue"
            >
              <ToggleInline
                active={form.emailEnabled}
                title="Email Enabled"
                description="Show this template while sending email."
                onClick={() =>
                  setForm(prev => ({
                    ...prev,
                    emailEnabled: !prev.emailEnabled
                  }))
                }
              />

              {form.emailEnabled && (
                <div className="mt-4 space-y-4">
                  <Field label="Email Subject">
                    <input
                      value={form.emailSubject}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          emailSubject: event.target.value
                        }))
                      }
                      className="form-input"
                      placeholder={starterContent.subject || "Follow-up from {{companyName}}"}
                    />
                  </Field>

                  <Field
                    label="Emailer Design HTML"
                    hint="Keep your branded emailer design here. Add {{packageContentHtml}} where package details should appear."
                  >
                    <textarea
                      value={form.emailDesignHtml}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          emailDesignHtml: event.target.value
                        }))
                      }
                      rows={10}
                      className="form-input font-mono text-xs leading-6"
                      placeholder={`Paste branded emailer design here...

Use:
{{packageContentHtml}}
{{assetLinksHtml}}
{{signature}}`}
                    />
                  </Field>

                  <Field
                    label="Email HTML"
                    hint="Use variables like {{spocName}}, {{destination}}, {{companyLogoUrl}}, {{signature}}, {{assetLinksHtml}}"
                  >
                    <textarea
                      value={form.emailHtml}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          emailHtml: event.target.value
                        }))
                      }
                      rows={14}
                      className="form-input font-mono text-xs leading-6"
                      placeholder={starterContent.emailHtml || "<div>Dear {{spocName}},...</div>"}
                    />
                  </Field>
                </div>
              )}
            </FormSection>

            <FormSection
              icon={<MessageCircle className="h-4 w-4" />}
              title={`${getTemplateTypeLabel(form.templateType)} WhatsApp Content`}
              description="Enable WhatsApp channel and edit plain text content."
              tone="green"
            >
              <ToggleInline
                active={form.whatsappEnabled}
                title="WhatsApp Enabled"
                description="Show this template while sending WhatsApp."
                onClick={() =>
                  setForm(prev => ({
                    ...prev,
                    whatsappEnabled: !prev.whatsappEnabled
                  }))
                }
              />

              {form.whatsappEnabled && (
                <div className="mt-4">
                  <Field
                    label="WhatsApp Text"
                    hint="Plain text only. Assets are shared as links."
                  >
                    <textarea
                      value={form.whatsappText}
                      onChange={event =>
                        setForm(prev => ({
                          ...prev,
                          whatsappText: event.target.value
                        }))
                      }
                      rows={12}
                      className="form-input leading-6"
                      placeholder={starterContent.whatsappText || `Hi {{spocName}},

Message here...

{{signature}}`}
                    />
                  </Field>
                </div>
              )}
            </FormSection>

            <FormSection
              icon={<Package className="h-4 w-4" />}
              title="Default Assets"
              description="Optional. These assets can be recommended with this template while sending communication."
              tone="slate"
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Recommended Assets
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      These assets will be suggested when this template is selected.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAssetPickerOpen(true)}
                    className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <Package className="h-4 w-4" />
                    Select Assets
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Selected Assets
                    </p>

                    <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                      {selectedAssets.length} selected
                    </span>
                  </div>

                  {selectedAssets.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                      No assets selected yet. Click “Select Assets” to attach recommended assets.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedAssets.map(asset => (
                        <div
                          key={asset.assetId || asset.url}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {asset.title || "Asset"}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                              {asset.categoryName || asset.assetType || "Asset"}
                              {asset.destinationName ? ` · ${asset.destinationName}` : ""}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {asset.url && (
                              <a
                                href={asset.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-blue-600 hover:underline"
                              >
                                View
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => toggleAsset(asset.assetId)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                            >
                              <X className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </FormSection>
          </div>

          {/* RIGHT SETTINGS + PREVIEW */}
          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Archive className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Template Settings
                  </h3>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Manage active status and template source details.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <ToggleCard
                  active={form.active}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="Active Template"
                  description="Inactive templates will not appear while sending."
                  tone="slate"
                  onClick={() =>
                    setForm(prev => ({
                      ...prev,
                      active: !prev.active
                    }))
                  }
                />

                {template.systemTemplate && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 text-blue-700" />

                      <div>
                        <p className="text-sm font-bold text-blue-800">
                          System Template
                        </p>

                        <p className="mt-1 text-xs leading-5 text-blue-700">
                          This template was imported from DreamTrawell defaults.
                          You can edit it, but Sync Defaults may update system
                          template content again.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <InfoBlock label="Template Type" value={getTemplateTypeLabel(form.templateType)} />
                <InfoBlock label="Source" value={template.source || "manual"} />
                <InfoBlock label="Created By" value={template.createdByName || "—"} />
                <InfoBlock label="Created At" value={formatDateTime(template.createdAt)} />
                <InfoBlock label="Updated At" value={formatDateTime(template.updatedAt)} />
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-[#1d4e89] px-5 py-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">
                      Live Preview
                    </h2>
                    <p className="mt-0.5 text-xs text-blue-100">
                      Sample variables are used for preview only.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={copyPreview}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#1d4e89] hover:bg-blue-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="border-b border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("email")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${previewMode === "email"
                      ? "bg-white text-blue-700"
                      : "text-slate-500 hover:bg-white"
                      }`}
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewMode("whatsapp")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${previewMode === "whatsapp"
                      ? "bg-white text-emerald-700"
                      : "text-slate-500 hover:bg-white"
                      }`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </button>
                </div>
              </div>

              <div className="p-4">
                {previewMode === "email" ? (
                  <div>
                    <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                      <p className="text-[11px] font-bold text-blue-700">
                        Subject
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-slate-950">
                        {emailPreviewSubject}
                      </p>
                    </div>

                    {!previewVars.companyLogoUrl && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Logo is missing. Please check Branding Settings companyLogoUrl / emailLogoUrl / logoUrl.
                      </div>
                    )}

                    <div
                      className="min-h-[420px] overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-sm"
                      dangerouslySetInnerHTML={{
                        __html: emailPreviewHtml
                      }}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#e5ddd5] p-4">
                    <div className="ml-auto max-w-[92%] rounded-xl bg-white px-4 py-3 text-sm">
                      <pre className="whitespace-pre-wrap font-sans leading-6 text-slate-800">
                        {whatsappPreview}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        {/* FOOTER SAVE BAR */}
        <div className="sticky bottom-4 z-20 mt-6 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-950">
                Ready to save changes?
              </p>
              <p className="text-xs text-slate-500">
                Changes will reflect immediately in Send Communication.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => router.push("/admin/communication-templates")}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveTemplate}
                disabled={!canSave || saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <AssetPickerModal
          open={assetPickerOpen}
          onClose={() => setAssetPickerOpen(false)}
          selectedAssets={selectedAssets}
          title="Select Default Assets"
          channel="template"
          destinationId={selectedDestinations[0]?.id || ""}
          onConfirm={pickedAssets => {
            const ids = (pickedAssets || [])
              .map(asset => getAssetId(asset))
              .filter(Boolean);

            setForm(prev => ({
              ...prev,
              defaultAssetIds: [...new Set(ids)]
            }));

            setAssetPickerOpen(false);
          }}
        />
      </div>
    </div>
  );
}

/* =========================
   UI COMPONENTS
========================= */

function PackageBuilderBlock({
  config,
  selectedDestinationName = "",
  onChange,
  onUseSelectedDestination,
  onGenerateEmail,
  onGenerateWhatsapp,
  onGenerateBoth
}) {
  const finalConfig = cleanPackageConfig(config);

  return (
    <FormSection
      icon={<Package className="h-4 w-4" />}
      title="Package Builder"
      description="Create destination-based default, regular or predefined packages that can be sent through Email and WhatsApp."
      tone="orange"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-orange-900">
                Destination Package Setup
              </p>
              <p className="mt-0.5 text-xs leading-5 text-orange-700">
                Fill package details once, then generate Email and WhatsApp package content automatically.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGenerateEmail}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                <Mail className="h-3.5 w-3.5" />
                Build Email
              </button>

              <button
                type="button"
                onClick={onGenerateWhatsapp}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Build WhatsApp
              </button>

              <button
                type="button"
                onClick={onGenerateBoth}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Build Both
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Package Purpose">
            <select
              value={finalConfig.packagePurpose}
              onChange={event =>
                onChange({
                  packagePurpose: event.target.value
                })
              }
              className="form-input"
            >
              {PACKAGE_PURPOSES.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              {
                PACKAGE_PURPOSES.find(
                  item => item.value === finalConfig.packagePurpose
                )?.description
              }
            </p>
          </Field>

          <Field label="Package Title">
            <input
              value={finalConfig.packageTitle}
              onChange={event =>
                onChange({
                  packageTitle: event.target.value
                })
              }
              className="form-input"
              placeholder="Dubai 4N / 5D Family Package"
            />
          </Field>

          <Field label="Destination">
            <div className="flex gap-2">
              <input
                value={finalConfig.destinationName}
                onChange={event =>
                  onChange({
                    destinationName: event.target.value
                  })
                }
                className="form-input"
                placeholder="{{destination}}"
              />

              {selectedDestinationName && (
                <button
                  type="button"
                  onClick={onUseSelectedDestination}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Use
                </button>
              )}
            </div>

            {selectedDestinationName && (
              <p className="mt-1.5 text-xs text-slate-500">
                Selected: {selectedDestinationName}
              </p>
            )}
          </Field>

          <Field label="Duration">
            <input
              value={finalConfig.duration}
              onChange={event =>
                onChange({
                  duration: event.target.value
                })
              }
              className="form-input"
              placeholder="4 Nights / 5 Days"
            />
          </Field>

          <Field label="Hotel Category">
            <input
              value={finalConfig.hotelCategory}
              onChange={event =>
                onChange({
                  hotelCategory: event.target.value
                })
              }
              className="form-input"
              placeholder="3 Star / 4 Star / 5 Star"
            />
          </Field>

          <Field label="Meal Plan">
            <input
              value={finalConfig.mealPlan}
              onChange={event =>
                onChange({
                  mealPlan: event.target.value
                })
              }
              className="form-input"
              placeholder="Breakfast / MAP / CP"
            />
          </Field>

          <Field label="Transfer Type">
            <input
              value={finalConfig.transferType}
              onChange={event =>
                onChange({
                  transferType: event.target.value
                })
              }
              className="form-input"
              placeholder="Private / SIC / Mixed"
            />
          </Field>

          <Field label="Currency">
            <select
              value={finalConfig.currency}
              onChange={event =>
                onChange({
                  currency: event.target.value
                })
              }
              className="form-input"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
              <option value="SGD">SGD</option>
              <option value="THB">THB</option>
              <option value="MYR">MYR</option>
              <option value="VND">VND</option>
              <option value="IDR">IDR</option>
            </select>
          </Field>

          <Field label="Starting Price">
            <input
              value={finalConfig.startingPrice}
              onChange={event =>
                onChange({
                  startingPrice: event.target.value
                })
              }
              className="form-input"
              placeholder="45000 per person"
            />
          </Field>

          <Field label="Validity">
            <input
              value={finalConfig.validity}
              onChange={event =>
                onChange({
                  validity: event.target.value
                })
              }
              className="form-input"
              placeholder="Valid till 31 Aug 2026"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Package Highlights" hint="Add one point per line.">
            <textarea
              value={finalConfig.highlights}
              onChange={event =>
                onChange({
                  highlights: event.target.value
                })
              }
              rows={6}
              className="form-input leading-6"
              placeholder={`Comfortable stay options
Smooth airport transfers
Popular sightseeing included
Customizable for family / honeymoon / group`}
            />
          </Field>

          <Field label="Inclusions" hint="Add one inclusion per line.">
            <textarea
              value={finalConfig.inclusions}
              onChange={event =>
                onChange({
                  inclusions: event.target.value
                })
              }
              rows={6}
              className="form-input leading-6"
              placeholder={`Hotel accommodation
Airport transfers
Sightseeing as per itinerary
Meals as per selected plan`}
            />
          </Field>

          <Field label="Exclusions" hint="Add one exclusion per line.">
            <textarea
              value={finalConfig.exclusions}
              onChange={event =>
                onChange({
                  exclusions: event.target.value
                })
              }
              rows={6}
              className="form-input leading-6"
              placeholder={`Flights
Visa / TCS unless mentioned
Personal expenses
Anything not mentioned in inclusions`}
            />
          </Field>

          <Field label="Tentative Itinerary" hint="Add one day or itinerary point per line.">
            <textarea
              value={finalConfig.itinerary || ""}
              onChange={event =>
                onChange({
                  itinerary: event.target.value
                })
              }
              rows={6}
              className="form-input leading-6"
              placeholder={`Day 1: Arrival, transfers and hotel check-in
Day 2: City tour and major sightseeing
Day 3: Leisure / optional activity
Day 4: Checkout and departure transfer`}
            />
          </Field>

          <Field label="Tentative Pricing" hint="Add one pricing line per row. Example: 4 Star Package - INR 45,000 PP">
            <textarea
              value={finalConfig.tentativePricing || ""}
              onChange={event =>
                onChange({
                  tentativePricing: event.target.value
                })
              }
              rows={6}
              className="form-input leading-6"
              placeholder={`3 Star Package - INR 38,000 per person
4 Star Package - INR 45,000 per person
5 Star Package - INR 62,000 per person
Child policy / extra bed as per hotel`}
            />
          </Field>

          <Field label="Terms & Notes" hint="Add one term per line.">
            <textarea
              value={finalConfig.terms}
              onChange={event =>
                onChange({
                  terms: event.target.value
                })
              }
              rows={6}
              className="form-input leading-6"
              placeholder={`Rates are subject to availability
Final confirmation after payment and supplier confirmation
Package can be customized as per client requirement`}
            />
          </Field>
        </div>

        <Field label="Additional Notes">
          <textarea
            value={finalConfig.notes}
            onChange={event =>
              onChange({
                notes: event.target.value
              })
            }
            rows={4}
            className="form-input leading-6"
            placeholder="Any special selling note, hotel note, routing note or operational remark..."
          />
        </Field>
      </div>
    </FormSection>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 truncate text-base font-bold text-slate-950">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
  tone = "slate"
}) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700"
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClass[tone] || toneClass.slate
            }`}
        >
          {icon}
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-950">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function TemplateWritingBlock({
  type,
  starter,
  emailEnabled,
  whatsappEnabled,
  onApplyEmail,
  onApplyWhatsapp,
  onApplyBoth
}) {
  const isPackage = normalize(type) === "package";
  const isItinerary = normalize(type) === "itinerary";
  const tone = isPackage ? "orange" : isItinerary ? "green" : "purple";

  return (
    <FormSection
      icon={isPackage ? <Package className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      title={starter.title}
      description={starter.description}
      tone={tone}
    >
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Recommended Writing Structure
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {starter.checklist.map(item => (
            <div
              key={item}
              className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApplyEmail}
            disabled={!emailEnabled}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" />
            Use Email Starter
          </button>

          <button
            type="button"
            onClick={onApplyWhatsapp}
            disabled={!whatsappEnabled}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Use WhatsApp Starter
          </button>

          <button
            type="button"
            onClick={onApplyBoth}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Use Both
          </button>
        </div>
      </div>
    </FormSection>
  );
}

function Field({
  label,
  hint = "",
  required = false,
  children
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function CodePicker({
  label,
  hint = "",
  fieldName,
  value,
  options = [],
  tone = "blue",
  placeholder = "Select",
  setForm
}) {
  const selectedCodes = parseCsv(value);
  const [selectedOption, setSelectedOption] = useState("");

  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
    purple: "border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100"
  };

  function addCode(code) {
    if (!code) return;

    setForm(prev => {
      const current = parseCsv(prev[fieldName]);
      if (current.includes(code)) return prev;

      return {
        ...prev,
        [fieldName]: [...current, code].join(", ")
      };
    });

    setSelectedOption("");
  }

  function removeCode(code) {
    setForm(prev => {
      const current = parseCsv(prev[fieldName]).filter(item => item !== code);

      return {
        ...prev,
        [fieldName]: current.join(", ")
      };
    });
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <select
          value={selectedOption}
          onChange={event => setSelectedOption(event.target.value)}
          className="form-input"
        >
          <option value="">{placeholder}</option>
          {options.map(code => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => addCode(selectedOption)}
          disabled={!selectedOption}
          className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {selectedCodes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectedCodes.map(code => (
            <button
              key={code}
              type="button"
              onClick={() => removeCode(code)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass[tone] || toneClass.blue
                }`}
              title="Click to remove"
            >
              {code}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
          No code selected yet.
        </p>
      )}
    </Field>
  );
}

function ToggleInline({
  active,
  title,
  description,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${active
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
        }`}
    >
      <div>
        <p className="text-sm font-bold">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-5 opacity-80">
            {description}
          </p>
        )}
      </div>

      <span
        className={`h-5 w-9 rounded-full p-0.5 transition ${active ? "bg-current/20" : "bg-slate-200"
          }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white transition ${active ? "translate-x-4" : "translate-x-0"
            }`}
        />
      </span>
    </button>
  );
}

function ToggleCard({
  active,
  icon,
  title,
  description,
  tone = "blue",
  onClick
}) {
  const activeClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-300 bg-slate-50 text-slate-800"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${active
        ? activeClass[tone] || activeClass.blue
        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
        }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/80" : "bg-slate-100"
            }`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold">
            {title}
          </p>

          {description && (
            <p className="mt-0.5 text-xs leading-5 opacity-80">
              {description}
            </p>
          )}
        </div>

        <span
          className={`ml-auto mt-1 h-5 w-9 rounded-full p-0.5 transition ${active ? "bg-current/20" : "bg-slate-200"
            }`}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white transition ${active ? "translate-x-4" : "translate-x-0"
              }`}
          />
        </span>
      </div>
    </button>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}