// components/leads/QuotationEditor.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useLeadTravelAgent } from "@/hooks/useLeadTravelAgent";
import { canAccess, canAccessRecord } from "@/lib/rolePermissions";
import { buildLeadWithLiveTravelAgent, getLeadAssignee } from "@/lib/leadOwnership";
import { buildLeadTravelPayloadFromQuotationData } from "@/lib/leadTravelDates";

import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import {
  resolveQuotationInternalRecipient,
  sendQuotationInternalCopy
} from "@/lib/quotationInternalCopy";
import { sendWhatsAppWeb } from "@/lib/whatsapp";
import { createQuotationRevision } from "@/lib/createQuotationRevision";
import { recordDailyActivity } from "@/lib/workTaskService";
import { saveQuotationDraft } from "@/lib/saveQuotationDraft";
import { deleteQuotationDraft } from "@/lib/deleteQuotationDraft";

import { getCommunicationSettings } from "@/lib/communicationSettings";
import { getBrandingSettings } from "@/lib/brandingSettings";
import { getUserProfileByUid } from "@/lib/userProfileRef";
import { buildTravelAgentQuotationEmailTemplate } from "@/lib/emailTemplates";
import { Download, Eye, Package, Trash2 } from "lucide-react";
import AssetPickerModal from "@/components/documents/AssetPickerModal";
import { generateQuotationPdf, preloadQuotationPdfLibrary } from "@/lib/quotationPdf";
import { createShareableQuotationPdf } from "@/lib/quotationPdfShare";

import {
  buildStructuredQuotationHtml
} from "@/lib/quotationEmailBlocks";

import {
  getDestinationQuotationTemplate,
  getDefaultSelectedAutoSections,
  buildDestinationTemplateSnapshot,
  QUOTATION_AUTO_SECTION_KEYS,
  QUOTATION_SECTION_LABELS
} from "@/lib/quotationTemplateService";

import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "@/lib/logLeadAction";

import SelectableChip from "@/components/ui/SelectableChip";
import QuotationVendorPricingSelector from "@/components/leads/QuotationVendorPricingSelector";

import {
  buildEmailSignatureHtml,
  buildWhatsAppSignatureText,
  escapeHtml,
  getFirstValue,
  getMemberEmail,
  getMemberMobile,
  getMemberName,
  getMemberRole,
  getMemberUid
} from "@/lib/signatureUtils";

const inputClass = `
    w-full border border-gray-200 rounded-lg
    px-3 py-2 text-sm bg-white
    focus:outline-none focus:ring-2 focus:ring-blue-100
  `;

const textareaClass = `
    w-full border border-gray-200 rounded-lg
    px-3 py-2 text-sm bg-white resize-none
    focus:outline-none focus:ring-2 focus:ring-blue-100
  `;


const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "MYR", label: "MYR - Malaysian Ringgit" },
  { value: "THB", label: "THB - Thai Baht" },
  { value: "IDR", label: "IDR - Indonesian Rupiah" },
  { value: "VND", label: "VND - Vietnamese Dong" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" }
];


const QUOTATION_TYPES = [
  { value: "package", label: "Package Quotation" },
  { value: "hotel_only", label: "Hotel Only" },
  { value: "land_only", label: "Land Only" },
  { value: "visa_only", label: "Visa Only" },
  { value: "flight_only", label: "Flight / Air Ticket Only" },
  { value: "custom", label: "Custom Service" }
];

const PACKAGE_COMPONENT_OPTIONS = [
  { key: "hotel", label: "Hotel" },
  { key: "land", label: "Land Part / Transfers" },
  { key: "visa", label: "Visa" },
  { key: "flight", label: "Flight" },
  { key: "insurance", label: "Insurance" },
  { key: "activity", label: "Activity / Sightseeing" },
  { key: "other", label: "Other" }
];

const DEFAULT_PACKAGE_SCOPE = {
  hotel: true,
  land: true,
  visa: false,
  flight: false,
  insurance: false,
  activity: false,
  other: false
};

function createEmptyHotelOption(currency = "USD") {
  return {
    optionLabel: "",
    recommended: false,

    // NEW: use this checkbox when hotel option price should be visible to client
    optionalForClient: false,

    nights: "",
    hotelName: "",
    roomCategory: "",
    mealPlan: "Breakfast",
    location: "",

    currency: currency || "USD",
    adultCost: "",
    childCost: "",
    unit: "Per Person",
    basis: "on DBL/Twin Sharing",
    remarks: ""
  };
}



/* =========================
  BASIC HELPERS
========================= */

function getAssetTitle(asset) {
  return getFirstValue(
    asset?.title,
    asset?.name,
    asset?.fileName,
    asset?.currentFileName,
    "Asset"
  );
}

function getAssetUrl(asset) {
  return getFirstValue(
    asset?.url,
    asset?.currentUrl,
    asset?.externalUrl,
    asset?.downloadUrl,
    asset?.fileUrl
  );
}

function normalizeQuotationAsset(asset) {
  return {
    assetId: asset?.assetId || asset?.id || asset?.documentId || "",
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryId: asset?.categoryId || "",
    categoryName: asset?.categoryName || "",
    categorySlug: asset?.categorySlug || "",

    assetType: asset?.assetType || asset?.documentType || "document",
    usageType: asset?.usageType || "",
    visibility: asset?.visibility || "team",

    currentVersion: asset?.currentVersion || asset?.version || 1,

    fileName: asset?.fileName || asset?.currentFileName || "",
    fileSize: asset?.fileSize || asset?.currentFileSize || null,
    fileType: asset?.fileType || asset?.currentFileType || "",
    fileExtension:
      asset?.fileExtension || asset?.currentFileExtension || "",

    destinationId: asset?.destinationId || "",
    destinationName: asset?.destinationName || "",

    sharedAs: asset?.sharedAs || "file_link",
    selectedAt: asset?.selectedAt || new Date().toISOString()
  };
}

function normalizeQuotationAssets(assets = []) {
  if (!Array.isArray(assets)) return [];

  const map = new Map();

  assets.forEach(asset => {
    const normalized = normalizeQuotationAsset(asset);

    if (!normalized.assetId && !normalized.url) return;

    const key = normalized.assetId || normalized.url;
    map.set(key, normalized);
  });

  return Array.from(map.values());
}

function buildQuotationAssetLinksText(assets = []) {
  const usableAssets = normalizeQuotationAssets(assets).filter(asset =>
    getAssetUrl(asset)
  );

  if (!usableAssets.length) return "";

  return [
    "Shared Assets:",
    ...usableAssets.map((asset, index) => {
      return `${index + 1}. ${getAssetTitle(asset)}\n${getAssetUrl(asset)}`;
    })
  ].join("\n");
}

function buildQuotationAssetLinksHtml(assets = []) {
  const usableAssets = normalizeQuotationAssets(assets).filter(asset =>
    getAssetUrl(asset)
  );

  if (!usableAssets.length) return "";

  const rows = usableAssets
    .map(asset => {
      const title = escapeHtml(getAssetTitle(asset));
      const category = escapeHtml(
        getFirstValue(asset?.categoryName, asset?.assetType, "Asset")
      );
      const url = escapeHtml(getAssetUrl(asset));

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:14px;font-weight:600;color:#111827;">
              ${title}
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">
              ${category}
            </div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
            <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1d4e89;text-decoration:underline;font-size:12px;font-weight:600;">
              Open reference
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="margin:18px 0;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
      <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px;">
        Shared Assets
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}

function isDateInputValue(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanString(value));
}

function getMonthFromDateInput(value = "") {
  const clean = cleanString(value);
  return isDateInputValue(clean) ? clean.slice(0, 7) : "";
}

function addDaysToDateInput(dateInput = "", days = 0) {
  if (!isDateInputValue(dateInput)) return "";

  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days || 0));

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getNightCount(checkIn = "", checkOut = "") {
  if (!isDateInputValue(checkIn) || !isDateInputValue(checkOut)) return "";

  const [inYear, inMonth, inDay] = checkIn.split("-").map(Number);
  const [outYear, outMonth, outDay] = checkOut.split("-").map(Number);

  const inDate = new Date(inYear, inMonth - 1, inDay);
  const outDate = new Date(outYear, outMonth - 1, outDay);

  const diff = Math.round(
    (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return diff > 0 ? String(diff) : "";
}


function buildItineraryRowsForNightCount(nightsValue, existingRows = []) {
  const nights = Number(nightsValue || 0);
  const dayCount = nights > 0 ? nights + 1 : 1;

  const rows = safeArray(existingRows);
  const nextRows = [...rows];

  while (nextRows.length < dayCount) {
    nextRows.push({
      day: nextRows.length + 1,
      title: "",
      description: "",
      meals: "",
      meetingPoint: "",
      timing: "",
      includes: ""
    });
  }

  const normalizedRows = nextRows.map((row, index) => ({
    ...row,
    day: index + 1
  }));

  if (normalizedRows.length <= dayCount) {
    return normalizedRows;
  }

  return normalizedRows.filter((row, index) => {
    if (index < dayCount) return true;
    return hasItineraryContent(row);
  });
}

function cleanString(value = "") {
  return String(value || "").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value = "") {
  return EMAIL_RE.test(cleanString(value).toLowerCase());
}

function getQuotationDestinationName(lead = {}, quotationData = null) {
  return cleanString(
    quotationData?.travelDetails?.destinationName ||
    quotationData?.destinationName ||
    lead?.destinationName ||
    lead?.destination?.name ||
    lead?.destination ||
    lead?.travelDetails?.destinationName
  );
}

function buildQuotationEmailSubject({ lead = {}, quotationData = null, revision = "" }) {
  return [
    "Quotation",
    getQuotationDestinationName(lead, quotationData),
    cleanString(lead?.leadCode),
    revision ? `Rev ${revision}` : ""
  ].filter(Boolean).join(" | ").slice(0, 180);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasPriceValue(value) {
  return Boolean(cleanString(value));
}

function hasAdultChildOrAmount(row = {}) {
  return Boolean(
    hasPriceValue(row?.adultCost) ||
    hasPriceValue(row?.childCost) ||
    hasPriceValue(row?.amount)
  );
}

function hasLandModePricing(mode = {}) {
  return Boolean(
    hasPriceValue(mode?.adultCost) ||
    hasPriceValue(mode?.childCost)
  );
}

function hasServicePricingContent(row = {}) {
  return Boolean(
    cleanString(row?.amount) ||
    cleanString(row?.description) ||
    cleanString(row?.remarks)
  );
}

function hasHotelListingContent(row = {}) {
  return Boolean(
    cleanString(row?.nights) ||
    cleanString(row?.hotelName) ||
    cleanString(row?.roomCategory) ||
    cleanString(row?.mealPlan) ||
    cleanString(row?.location) ||
    cleanString(row?.remarks)
  );
}

function hasItineraryContent(row = {}) {
  return Boolean(
    cleanString(row?.title) ||
    cleanString(row?.description) ||
    cleanString(row?.meals) ||
    cleanString(row?.meetingPoint) ||
    cleanString(row?.timing) ||
    cleanString(row?.includes)
  );
}

function hasFlightContent(row = {}) {
  return Boolean(
    cleanString(row?.airline) ||
    cleanString(row?.route) ||
    cleanString(row?.departureDate) ||
    cleanString(row?.returnDate) ||
    cleanString(row?.baggage) ||
    cleanString(row?.fare) ||
    cleanString(row?.remarks)
  );
}

function formatDisplayDate(value = "") {
  const clean = cleanString(value);

  if (!clean) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [year, month, day] = clean.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  return clean;
}

function formatDisplayMonth(value = "") {
  const clean = cleanString(value);

  if (!clean) return "";

  if (/^\d{4}-\d{2}$/.test(clean)) {
    const [year, month] = clean.split("-").map(Number);
    const date = new Date(year, month - 1, 1);

    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  }

  return clean;
}

function toDateInputValue(value) {
  if (!value) return "";

  let date = null;

  if (value?.toDate) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const clean = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }

    const parsed = new Date(clean);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  if (!date || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMonthInputValue(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const clean = value.trim();

    if (/^\d{4}-\d{2}$/.test(clean)) {
      return clean;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean.slice(0, 7);
    }

    const parsed = new Date(clean);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    }
  }

  const date = value?.toDate
    ? value.toDate()
    : value instanceof Date
      ? value
      : null;

  if (!date || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function buildQuotationTravelAgentEmailHtml({
  recipient,
  lead,
  revision,
  itineraryHtml,
  branding,
  emailSignatureHtml,
  itineraryAlreadyHasGreeting,
  pdfUrl = ""
}) {
  const destinationName = getFirstValue(
    lead?.destinationName,
    lead?.destination,
    "your travel enquiry"
  );

  return buildTravelAgentQuotationEmailTemplate({
    branding,

    recipientName: recipient?.name || "Guest",
    leadCode: lead?.leadCode || "",
    revision,
    destinationName,

    itineraryHtml,
    quotationClosingLine: branding?.quotationClosingLine || "",
    pdfUrl,

    emailSignatureHtml,
    itineraryAlreadyHasGreeting
  });
}

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '\"')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) return "₹0";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatQuotationPrice(value, currency = "INR") {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) return "";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${currency || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

function buildQuotationWhatsAppMessage({
  recipientName,
  recipientEmail,
  lead,
  revision,
  quotationData,
  customerQuotedAmount,
  customerQuoteCurrency,
  whatsappSignatureText,
  isFinalQuotation,
  emailAlsoSent = false,
  pdfUrl = ""
}) {
  const travelDetails = quotationData?.travelDetails || {};

  const destinationName = getFirstValue(
    travelDetails.destinationName,
    lead?.destinationName,
    lead?.destination,
    "your travel enquiry"
  );

  const travelMonth = formatDisplayMonth(travelDetails.travelMonth);
  const checkIn = formatDisplayDate(travelDetails.checkIn);
  const checkOut = formatDisplayDate(travelDetails.checkOut);

  const paxText = getFirstValue(
    travelDetails.paxText,
    lead?.paxText,
    lead?.noOfPax,
    lead?.pax,
    lead?.totalPax
  );

  const quotationRef = [
    lead?.leadCode || "",
    revision ? `Rev ${revision}` : ""
  ]
    .filter(Boolean)
    .join(" / ");

  const packagePrice = formatQuotationPrice(
    customerQuotedAmount,
    customerQuoteCurrency || "INR"
  );

  const travelRows = [
    `Destination: ${destinationName}`,
    travelMonth ? `Travel Month: ${travelMonth}` : "",
    checkIn ? `Check-in: ${checkIn}` : "",
    checkOut ? `Check-out: ${checkOut}` : "",
    paxText ? `Guests: ${paxText}` : "",
    quotationRef ? `Quotation Ref: ${quotationRef}` : "",
    packagePrice ? `Package Price: ${packagePrice}` : "",
    isFinalQuotation ? "Status: Final Quotation" : ""
  ].filter(Boolean);

  return [
    `Hello ${recipientName || "Partner"},`,
    "",
    "Thank you for giving us the opportunity to design this travel experience for your client.",
    "",
    "We have thoughtfully prepared the quotation and itinerary, keeping comfort, seamless arrangements, and memorable travel moments at the centre of the plan.",
    "",
    "*Quotation Snapshot*",
    travelRows.join("\n"),
    "",
    pdfUrl ? `*Quotation PDF*\n${pdfUrl}` : "",
    emailAlsoSent && recipientEmail
      ? `A copy of the quotation has also been sent to ${recipientEmail}.`
      : emailAlsoSent
        ? "A copy of the quotation has also been sent by email."
        : !pdfUrl && recipientEmail
          ? `Please check the detailed quotation with itinerary on ${recipientEmail}.`
          : "",
    "",
    "*Recommended Next Step*",
    "Kindly review the package details and share your feedback. If required, we can refine the hotel options, itinerary flow, inclusions, travel dates, or budget alignment.",
    "",
    "We will be happy to shape the plan further as per your client’s expectations.",
    "",
    whatsappSignatureText
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function htmlContainsGreeting(html = "") {
  const text = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return (
    text.includes("dear ") ||
    text.includes("greetings from") ||
    text.includes("thank you for choosing") ||
    text.includes("thank you for giving us") ||
    text.includes("thank you for giving") ||
    text.includes("kindly check the above quotation") ||
    text.includes("looking forward to your confirmation")
  );
}

function mergeSignatureUserWithProfile(signatureUser, profileData) {
  return {
    ...signatureUser,
    ...(profileData || {}),

    uid:
      signatureUser?.uid ||
      profileData?.uid ||
      signatureUser?.id ||
      profileData?.id,

    id:
      signatureUser?.id ||
      profileData?.id ||
      signatureUser?.uid ||
      profileData?.uid
  };
}

function getSignaturePriority(member) {
  let score = 0;

  if (member?.signatureHtml || member?.emailSignatureHtml) score += 20;
  if (member?.whatsappSignature || member?.signatureText) score += 20;
  if (member?.profileUpdatedAt) score += 10;
  if (member?.designation) score += 5;
  if (member?.mobile) score += 5;
  if (member?.email) score += 5;
  if (member?.name || member?.displayName) score += 5;
  if (member?.signatureEnabled === false) score -= 20;

  return score;
}

function isInternalUser(member) {
  const role = String(member?.role || "").toLowerCase();

  const inactive =
    member?.disabled ||
    member?.isDisabled ||
    member?.deleted ||
    member?.isDeleted ||
    member?.status === "inactive" ||
    member?.active === false;

  const excludedRoles = [
    "customer",
    "client",
    "vendor",
    "travel_agent",
    "travel-agent"
  ];

  return !inactive && !excludedRoles.includes(role);
}

function getInitialPricingSnapshot(initialQuotation, lead) {
  const snapshot =
    initialQuotation?.pricingSnapshot ||
    initialQuotation?.metadata?.pricingSnapshot ||
    {};

  const selectedVendorCost =
    snapshot.selectedVendorCost ??
    snapshot.totalSelectedVendorCost ??
    initialQuotation?.selectedVendorCost ??
    initialQuotation?.vendorCost ??
    initialQuotation?.totalSelectedVendorCost ??
    initialQuotation?.metadata?.vendorCost ??
    initialQuotation?.metadata?.totalSelectedVendorCost ??
    lead?.selectedVendorCost ??
    lead?.finalVendorCost ??
    lead?.latestTotalSelectedVendorCost ??
    "";

  const selectedVendorCurrency =
    snapshot.selectedVendorCurrency ||
    initialQuotation?.selectedVendorCurrency ||
    lead?.selectedVendorCurrency ||
    lead?.finalVendorCurrency ||
    "INR";

  const selectedVendorName =
    snapshot.selectedVendorName ||
    initialQuotation?.selectedVendorName ||
    lead?.selectedVendorName ||
    lead?.finalVendorName ||
    "";

  const selectedVendorQuoteId =
    snapshot.selectedVendorQuoteId ||
    initialQuotation?.selectedVendorQuoteId ||
    lead?.selectedVendorQuoteId ||
    lead?.finalVendorQuoteId ||
    "";

  const selectedVendorRequestId =
    snapshot.selectedVendorRequestId ||
    initialQuotation?.selectedVendorRequestId ||
    lead?.selectedVendorRequestId ||
    lead?.finalVendorRequestId ||
    "";

  const customerQuoteAmount =
    snapshot.customerQuoteAmount ??
    initialQuotation?.customerQuoteAmount ??
    initialQuotation?.customerQuotedAmount ??
    initialQuotation?.totalAmount ??
    initialQuotation?.totalPrice ??
    initialQuotation?.metadata?.customerQuotedAmount ??
    "";

  const quotationPricingMode =
    snapshot.quotationPricingMode ||
    initialQuotation?.quotationPricingMode ||
    initialQuotation?.metadata?.quotationPricingMode ||
    "direct";

  const vendorQuoteFinalized =
    snapshot.vendorQuoteFinalized ??
    initialQuotation?.vendorQuoteFinalized ??
    initialQuotation?.metadata?.vendorQuoteFinalized ??
    false;

  const vendorCostingMode =
    snapshot.vendorCostingMode ||
    initialQuotation?.vendorCostingMode ||
    initialQuotation?.metadata?.vendorCostingMode ||
    lead?.latestVendorCostingMode ||
    lead?.finalVendorCostingMode ||
    "single_vendor";

  const selectedVendorQuotes =
    snapshot.selectedVendorQuotes ||
    initialQuotation?.selectedVendorQuotes ||
    initialQuotation?.metadata?.selectedVendorQuotes ||
    lead?.latestSelectedVendorQuotes ||
    lead?.finalSelectedVendorQuotes ||
    [];

  const selectedVendorQuoteIds =
    snapshot.selectedVendorQuoteIds ||
    initialQuotation?.selectedVendorQuoteIds ||
    initialQuotation?.metadata?.selectedVendorQuoteIds ||
    lead?.latestSelectedVendorQuoteIds ||
    lead?.finalSelectedVendorQuoteIds ||
    [];

  const totalSelectedVendorCost =
    snapshot.totalSelectedVendorCost ??
    initialQuotation?.totalSelectedVendorCost ??
    initialQuotation?.metadata?.totalSelectedVendorCost ??
    lead?.latestTotalSelectedVendorCost ??
    lead?.finalTotalSelectedVendorCost ??
    "";

  return {
    quotationPricingMode,

    vendorCostingMode,
    vendorQuoteFinalized,
    selectedVendorQuotes,
    selectedVendorQuoteIds,
    totalSelectedVendorCost,

    selectedVendorCost,
    selectedVendorCurrency,
    selectedVendorName,
    selectedVendorQuoteId,
    selectedVendorRequestId,
    customerQuoteAmount
  };
}

function normalizeEditorPricingMode(value = "") {
  const mode = cleanString(value);
  if (["vendor_quote", "vendor_final", "vendor_draft"].includes(mode)) {
    return "vendor_quote";
  }
  if (mode === "multi_vendor") return "multi_vendor";
  if (mode === "manual_cost") return "manual_cost";
  return "direct";
}

function normalizePricingQuoteIds(value = []) {
  return (Array.isArray(value) ? value : [])
    .map(item => cleanString(item))
    .filter(Boolean)
    .sort();
}

function buildPricingFingerprint(pricing = {}) {
  return JSON.stringify({
    mode: cleanString(pricing.quotationPricingMode || "direct"),
    vendorCostingMode:
      cleanString(pricing.vendorCostingMode) === "multi_vendor"
        ? "multi_vendor"
        : "single_vendor",
    selectedVendorQuoteId: cleanString(pricing.selectedVendorQuoteId),
    selectedVendorRequestId: cleanString(pricing.selectedVendorRequestId),
    selectedVendorQuoteIds: normalizePricingQuoteIds(
      pricing.selectedVendorQuoteIds
    ),
    selectedVendorCost:
      pricing.selectedVendorCost === null ||
      pricing.selectedVendorCost === undefined ||
      pricing.selectedVendorCost === ""
        ? null
        : Number(pricing.selectedVendorCost),
    totalSelectedVendorCost:
      pricing.totalSelectedVendorCost === null ||
      pricing.totalSelectedVendorCost === undefined ||
      pricing.totalSelectedVendorCost === ""
        ? null
        : Number(pricing.totalSelectedVendorCost),
    selectedVendorCurrency: cleanString(
      pricing.selectedVendorCurrency || "INR"
    ),
    selectedVendorName: cleanString(pricing.selectedVendorName)
  });
}

/* =========================
  STRUCTURED QUOTATION HELPERS
========================= */

function getLeadTravelDefaults(lead = {}) {
  return {
    destinationName: getFirstValue(
      lead?.destinationName,
      lead?.destination,
      lead?.destinationTitle
    ),

    travelMonth: getFirstValue(
      toMonthInputValue(lead?.travelMonth),
      toMonthInputValue(lead?.month),
      toMonthInputValue(lead?.travelDate),
      toMonthInputValue(lead?.travelPeriod),
      toMonthInputValue(lead?.travelStartDate),
      toMonthInputValue(lead?.startDate)
    ),

    checkIn: getFirstValue(
      toDateInputValue(lead?.checkIn),
      toDateInputValue(lead?.checkInDate),
      toDateInputValue(lead?.travelStartDate),
      toDateInputValue(lead?.startDate)
    ),

    checkOut: getFirstValue(
      toDateInputValue(lead?.checkOut),
      toDateInputValue(lead?.checkOutDate),
      toDateInputValue(lead?.travelEndDate),
      toDateInputValue(lead?.endDate)
    ),

    paxText: getFirstValue(
      lead?.paxText,
      lead?.noOfPax,
      lead?.pax,
      lead?.totalPax
    )
  };
}

function createDefaultPackagePricing(currency = "USD") {
  return {
    currency: currency || "USD",
    adultCost: "",
    childCost: "",
    unit: "Per Person",
    basis: "Complete Package Price"
  };
}

function createDefaultLandPricing(currency = "USD") {
  return {
    pvtEnabled: false,
    sicEnabled: false,

    pvt: {
      currency: currency || "USD",
      adultCost: "",
      childCost: "",
      unit: "Per Person",
      basis: "Private Basis",
      remarks: ""
    },

    sic: {
      currency: currency || "USD",
      adultCost: "",
      childCost: "",
      unit: "Per Person",
      basis: "Seat-in-Coach Basis",
      remarks: ""
    }
  };
}

function cleanPackagePrice(value = {}) {
  return {
    currency: cleanString(value?.currency) || "USD",
    adultCost: cleanString(value?.adultCost),
    childCost: cleanString(value?.childCost),
    unit: cleanString(value?.unit) || "Per Person",
    basis: cleanString(value?.basis)
  };
}

function cleanPackagePart(value = {}) {
  return {
    enabled: Boolean(value?.enabled),
    amount: cleanString(value?.amount), // old backup field
    adultCost: cleanString(value?.adultCost),
    childCost: cleanString(value?.childCost),
    unit: cleanString(value?.unit),
    basis: cleanString(value?.basis)
  };
}

function cleanLandPricing(value = {}) {
  return {
    pvtEnabled: Boolean(value?.pvtEnabled),
    sicEnabled: Boolean(value?.sicEnabled),

    pvt: {
      currency: cleanString(value?.pvt?.currency) || "USD",
      adultCost: cleanString(value?.pvt?.adultCost),
      childCost: cleanString(value?.pvt?.childCost),
      unit: cleanString(value?.pvt?.unit) || "Per Person",
      basis: cleanString(value?.pvt?.basis) || "Private Basis",
      remarks: cleanString(value?.pvt?.remarks)
    },

    sic: {
      currency: cleanString(value?.sic?.currency) || "USD",
      adultCost: cleanString(value?.sic?.adultCost),
      childCost: cleanString(value?.sic?.childCost),
      unit: cleanString(value?.sic?.unit) || "Per Person",
      basis: cleanString(value?.sic?.basis) || "Seat-in-Coach Basis",
      remarks: cleanString(value?.sic?.remarks)
    }
  };
}

function createDefaultQuotationData(lead = {}, currency = "USD") {
  const travelDefaults = getLeadTravelDefaults(lead);

  return {
    leadCode: lead?.leadCode || "",

    quotationType: "package",

    travelDetails: {
      destinationName: travelDefaults.destinationName,
      travelMonth: travelDefaults.travelMonth,
      checkIn: travelDefaults.checkIn,
      checkOut: travelDefaults.checkOut,
      noOfNights: "",
      paxText: travelDefaults.paxText
    },

    packageDetails: {
      currency: currency || "USD",

      pricingDisplayMode: "final_only",

      packageScope: {
        ...DEFAULT_PACKAGE_SCOPE
      },

      unit: "Per Person",
      basis: "on DBL/Twin Sharing",

      packagePricing: createDefaultPackagePricing(currency || "USD"),

      hotelPart: {
        enabled: true,
        amount: "",
        adultCost: "",
        childCost: "",
        unit: "Per Person",
        basis: "on DBL/Twin Sharing"
      },

      landPart: {
        enabled: true,
        amount: "",
        adultCost: "",
        childCost: "",
        unit: "Per Person",
        basis: "Land Package Basis"
      },

      landPricing: createDefaultLandPricing(currency || "USD")
    },

    // hotelInclusions: [
    //   {
    //     nights: "",
    //     hotelName: "",
    //     roomCategory: "",
    //     mealPlan: "Breakfast",
    //     location: ""
    //   }
    // ],

    hotelInclusions: [
      createEmptyHotelOption(currency || "USD")
    ],

    transferInclusions: [
      "Meet & Greet assistance at the airport.",
      "Return airport and inter-hotel transfer by private basis.",
      "Transfers with air-conditioned vehicle and English-speaking driver."
    ],

    itineraryDays: [
      {
        day: 1,
        title: "",
        description: "",
        meals: "",
        meetingPoint: "",
        timing: "",
        includes: ""
      }
    ],

    serviceItems: [
      {
        serviceType: "visa",
        title: "",
        description: "",
        currency: "INR",
        amount: "",
        remarks: ""
      }
    ],

    flightDetails: [
      {
        airline: "",
        route: "",
        departureDate: "",
        returnDate: "",
        baggage: "",
        currency: "INR",
        fare: "",
        remarks: ""
      }
    ],

    selectedAutoSections: {},
    destinationTemplateId: "",
    destinationTemplateSnapshot: null
  };
}

function mergeQuotationDataWithDefaults(lead, savedData, currency = "USD") {
  const defaults = createDefaultQuotationData(lead, currency);
  const saved = savedData || {};

  return {
    ...defaults,
    ...saved,

    quotationType: saved.quotationType || defaults.quotationType,

    travelDetails: {
      ...defaults.travelDetails,
      ...(saved.travelDetails || {})
    },

    packageDetails: {
      ...defaults.packageDetails,
      ...(saved.packageDetails || {}),

      pricingDisplayMode:
        saved.packageDetails?.pricingDisplayMode === "component_wise"
          ? "component_wise"
          : saved.packageDetails?.pricingDisplayMode || "final_only",

      packageScope: {
        ...defaults.packageDetails.packageScope,
        ...(saved.packageDetails?.packageScope || {})
      },

      unit:
        saved.packageDetails?.unit ||
        defaults.packageDetails.unit,

      basis:
        saved.packageDetails?.basis ||
        defaults.packageDetails.basis,

      packagePricing: {
        ...defaults.packageDetails.packagePricing,
        ...(saved.packageDetails?.packagePricing || {})
      },

      hotelPart: {
        ...defaults.packageDetails.hotelPart,
        ...(saved.packageDetails?.hotelPart || {})
      },

      landPart: {
        ...defaults.packageDetails.landPart,
        ...(saved.packageDetails?.landPart || {})
      },

      landPricing: {
        ...defaults.packageDetails.landPricing,
        ...(saved.packageDetails?.landPricing || {}),

        pvt: {
          ...defaults.packageDetails.landPricing.pvt,
          ...(saved.packageDetails?.landPricing?.pvt || {})
        },

        sic: {
          ...defaults.packageDetails.landPricing.sic,
          ...(saved.packageDetails?.landPricing?.sic || {})
        }
      }
    },

    hotelInclusions:
      Array.isArray(saved.hotelInclusions) && saved.hotelInclusions.length
        ? saved.hotelInclusions
        : defaults.hotelInclusions,

    transferInclusions:
      Array.isArray(saved.transferInclusions) && saved.transferInclusions.length
        ? saved.transferInclusions
        : defaults.transferInclusions,

    itineraryDays:
      Array.isArray(saved.itineraryDays) && saved.itineraryDays.length
        ? saved.itineraryDays
        : defaults.itineraryDays,

    serviceItems:
      Array.isArray(saved.serviceItems) && saved.serviceItems.length
        ? saved.serviceItems
        : defaults.serviceItems,

    flightDetails:
      Array.isArray(saved.flightDetails) && saved.flightDetails.length
        ? saved.flightDetails
        : defaults.flightDetails,

    selectedAutoSections: saved.selectedAutoSections || {},
    destinationTemplateSnapshot: saved.destinationTemplateSnapshot || null
  };
}

function cleanHotelRows(rows = []) {
  return safeArray(rows)
    .map((row, index) => ({
      optionLabel:
        cleanString(row?.optionLabel) || `Option ${index + 1}`,

      recommended: Boolean(row?.recommended),
      optionalForClient: Boolean(row?.optionalForClient),

      nights: cleanString(row?.nights),
      hotelName: cleanString(row?.hotelName),
      roomCategory: cleanString(row?.roomCategory),
      mealPlan: cleanString(row?.mealPlan),
      location: cleanString(row?.location),

      currency: cleanString(row?.currency) || "USD",
      adultCost: cleanString(row?.adultCost),
      childCost: cleanString(row?.childCost),
      unit: cleanString(row?.unit) || "Per Person",
      basis: cleanString(row?.basis),
      remarks: cleanString(row?.remarks)
    }))
    .filter(row =>
      row.hotelName ||
      row.roomCategory ||
      row.location ||
      row.nights ||
      row.mealPlan ||
      row.remarks ||
      row.adultCost ||
      row.childCost
    );
}
function cleanItineraryRows(rows = []) {
  return safeArray(rows)
    .map((row, index) => ({
      day: cleanString(row?.day) || String(index + 1),
      title: cleanString(row?.title),
      description: cleanString(row?.description),
      meals: cleanString(row?.meals),
      meetingPoint: cleanString(row?.meetingPoint),
      timing: cleanString(row?.timing),
      includes: cleanString(row?.includes)
    }))
    .filter(
      row =>
        row.title ||
        row.description ||
        row.meals ||
        row.meetingPoint ||
        row.timing ||
        row.includes
    );
}

function cleanServiceItems(rows = []) {
  return safeArray(rows)
    .map(row => ({
      serviceType: cleanString(row?.serviceType),
      title: cleanString(row?.title),
      description: cleanString(row?.description),
      currency: cleanString(row?.currency) || "INR",
      amount: cleanString(row?.amount),
      remarks: cleanString(row?.remarks)
    }))
    .filter(hasServicePricingContent);
}

function cleanFlightDetails(rows = []) {
  return safeArray(rows)
    .map(row => ({
      airline: cleanString(row?.airline),
      route: cleanString(row?.route),
      departureDate: cleanString(row?.departureDate),
      returnDate: cleanString(row?.returnDate),
      baggage: cleanString(row?.baggage),
      currency: cleanString(row?.currency) || "INR",
      fare: cleanString(row?.fare),
      remarks: cleanString(row?.remarks)
    }))
    .filter(
      row =>
        row.airline ||
        row.route ||
        row.departureDate ||
        row.returnDate ||
        row.baggage ||
        row.fare ||
        row.remarks
    );
}

function cleanTransferRows(rows = []) {
  return safeArray(rows)
    .map(item => cleanString(item))
    .filter(Boolean);
}

function cleanPackageScope(scope = {}) {
  return {
    hotel: Boolean(scope?.hotel),
    land: Boolean(scope?.land),
    visa: Boolean(scope?.visa),
    flight: Boolean(scope?.flight),
    insurance: Boolean(scope?.insurance),
    activity: Boolean(scope?.activity),
    other: Boolean(scope?.other)
  };
}


function buildCleanQuotationData({
  lead,
  quotationData,
  destinationTemplate
}) {
  const source = quotationData || createDefaultQuotationData(lead);

  const templateSnapshot =
    source.destinationTemplateSnapshot ||
    (destinationTemplate
      ? buildDestinationTemplateSnapshot(destinationTemplate)
      : null);

  const packageCurrency =
    cleanString(source.packageDetails?.currency) ||
    cleanString(source.packageDetails?.packagePricing?.currency) ||
    "USD";



  return {
    leadCode: source.leadCode || lead?.leadCode || "",

    quotationType: source.quotationType || "package",

    travelDetails: {
      destinationName: cleanString(source.travelDetails?.destinationName),
      travelMonth: cleanString(source.travelDetails?.travelMonth),
      checkIn: cleanString(source.travelDetails?.checkIn),
      checkOut: cleanString(source.travelDetails?.checkOut),
      noOfNights: cleanString(source.travelDetails?.noOfNights),
      paxText: cleanString(source.travelDetails?.paxText)
    },

    packageDetails: {
      currency: packageCurrency,

      pricingDisplayMode:
        source.packageDetails?.pricingDisplayMode === "component_wise"
          ? "component_wise"
          : "final_only",

      packageScope: cleanPackageScope(
        source.packageDetails?.packageScope || DEFAULT_PACKAGE_SCOPE
      ),

      unit: cleanString(source.packageDetails?.unit) || "Per Person",

      basis:
        cleanString(source.packageDetails?.basis) ||
        "on DBL/Twin Sharing",

      packagePricing: {
        ...cleanPackagePrice(
          source.packageDetails?.packagePricing ||
          createDefaultPackagePricing(packageCurrency)
        ),
        currency: packageCurrency
      },

      hotelPart: cleanPackagePart(source.packageDetails?.hotelPart),

      landPart: cleanPackagePart(source.packageDetails?.landPart),

      landPricing: cleanLandPricing(source.packageDetails?.landPricing)
    },

    hotelInclusions: cleanHotelRows(source.hotelInclusions),
    transferInclusions: cleanTransferRows(source.transferInclusions),
    itineraryDays: cleanItineraryRows(source.itineraryDays),

    serviceItems: cleanServiceItems(source.serviceItems),
    flightDetails: cleanFlightDetails(source.flightDetails),

    selectedAutoSections: source.selectedAutoSections || {},
    destinationTemplateId:
      templateSnapshot?.templateId ||
      templateSnapshot?.destinationId ||
      source.destinationTemplateId ||
      "",

    destinationTemplateSnapshot: templateSnapshot
  };
}

/* =========================
  TIMELINE HELPERS
========================= */

async function updateQuotationSentStatus({
  leadId,
  quotationId,
  channel,
  user,
  providerMessageId = "",
  recipientEmail = "",
  subject = ""
}) {
  if (!leadId || !quotationId || !channel) return;

  try {
    const payload = {
      sentVia: arrayUnion(channel),
      updatedAt: serverTimestamp()
    };

    if (channel === "email") {
      payload.emailSentAt = serverTimestamp();
      payload.emailAcceptedAt = serverTimestamp();
      payload.emailSentByUid = user?.uid || "";
      payload.emailSentByName =
        user?.displayName || user?.name || user?.email || "";
      payload.emailStatus = "accepted";
      payload.emailDeliveryStatus = "accepted";
      payload.emailLastEvent = "accepted";
      payload.emailLastEventAt = serverTimestamp();
      payload.emailProvider = "brevo";
      payload.emailRecipient = recipientEmail || "";
      payload.emailSubject = subject || "";
      payload.emailError = "";
      payload.emailDeliveryReason = "";

      if (providerMessageId) {
        payload.emailProviderMessageId = providerMessageId;
        payload.emailProviderMessageIds = arrayUnion(providerMessageId);
      }
    }

    if (channel === "whatsapp") {
      payload.whatsappSentAt = serverTimestamp();
      payload.whatsappSentByUid = user?.uid || "";
      payload.whatsappSentByName =
        user?.displayName || user?.name || user?.email || "";
    }

    await updateDoc(
      doc(db, "leads", leadId, "quotations", quotationId),
      payload
    );
  } catch (error) {
    console.warn("Quotation sent status update skipped:", error);
  }
}

async function markQuotationSuperseded({
  leadId,
  quotationId,
  replacementQuotationId = "",
  replacementRevision = null,
  user
}) {
  if (!leadId || !quotationId || quotationId === replacementQuotationId) return;

  try {
    await updateDoc(
      doc(db, "leads", leadId, "quotations", quotationId),
      {
        status: "superseded",
        isDraft: false,
        isFinalQuotation: false,
        supersededAt: serverTimestamp(),
        supersededByQuotationId: replacementQuotationId || "",
        supersededByRevision:
          replacementRevision === null || replacementRevision === undefined
            ? null
            : Number(replacementRevision),
        supersededByUid: user?.uid || "",
        supersededByName:
          user?.displayName || user?.name || user?.email || "",
        updatedAt: serverTimestamp()
      }
    );
  } catch (error) {
    console.warn("Previous quotation draft could not be marked superseded:", error);
  }
}

async function clearOtherFinalQuotations({
  leadId,
  quotationId,
  user
}) {
  if (!leadId || !quotationId) return;

  try {
    const snap = await getDocs(collection(db, "leads", leadId, "quotations"));
    const updates = snap.docs
      .filter(item => {
        if (item.id === quotationId) return false;
        const data = item.data() || {};
        return data.isFinalQuotation === true || data.status === "final";
      })
      .map(item => {
        const data = item.data() || {};
        const wasSent = Boolean(
          data.sentAt ||
            (Array.isArray(data.sentVia) && data.sentVia.length) ||
            (Array.isArray(data.sendVia) && data.sendVia.length)
        );

        return updateDoc(item.ref, {
          isFinalQuotation: false,
          status: wasSent ? "sent" : "superseded",
          previousFinalSupersededAt: serverTimestamp(),
          previousFinalSupersededByQuotationId: quotationId,
          previousFinalSupersededByUid: user?.uid || "",
          previousFinalSupersededByName:
            user?.displayName || user?.name || user?.email || "",
          updatedAt: serverTimestamp()
        });
      });

    if (updates.length) await Promise.all(updates);
  } catch (error) {
    console.warn("Older final quotation flags could not be cleared:", error);
  }
}

async function finalizeQuotationDispatch({
  leadId,
  quotationId,
  channels = [],
  user,
  isFinalQuotation = false
}) {
  const completedChannels = Array.from(
    new Set((Array.isArray(channels) ? channels : []).filter(Boolean))
  );

  if (!leadId || !quotationId || !completedChannels.length) return false;

  try {
    await Promise.all([
      updateDoc(
        doc(db, "leads", leadId, "quotations", quotationId),
        {
          status: isFinalQuotation ? "final" : "sent",
          isDraft: false,
          isFinalQuotation: Boolean(isFinalQuotation),
          sentVia: arrayUnion(...completedChannels),
          sentAt: serverTimestamp(),
          sentByUid: user?.uid || "",
          sentByName: user?.displayName || user?.name || user?.email || "",
          sentByEmail: user?.email || "",
          updatedAt: serverTimestamp()
        }
      ),
      updateDoc(doc(db, "leads", leadId), {
        latestQuotationStatus: isFinalQuotation ? "final" : "sent",
        latestQuotationSentAt: serverTimestamp(),
        latestQuotationSentByUid: user?.uid || "",
        latestQuotationSentByName:
          user?.displayName || user?.name || user?.email || "",
        stage: "quote_sent",
        stageLabel: "Quote sent",
        lastActivityAt: serverTimestamp(),
        lastActivityType: "quotation_dispatched",
        updatedAt: serverTimestamp()
      })
    ]);

    if (isFinalQuotation) {
      await clearOtherFinalQuotations({
        leadId,
        quotationId,
        user
      });
    }

    return true;
  } catch (error) {
    // The provider may already have accepted the email. Do not throw and
    // encourage a duplicate resend merely because CRM status persistence failed.
    console.error("Quotation dispatch was accepted but CRM final status sync failed:", error);
    return false;
  }
}

async function updateQuotationEmailFailure({
  leadId,
  quotationId,
  recipientEmail = "",
  subject = "",
  error,
  isFinalQuotation = false,
  previousLeadStage = "",
  previousLeadStageLabel = ""
}) {
  if (!leadId || !quotationId) return;

  try {
    const failureMessage =
      error?.message || "Brevo did not accept this email.";

    await updateDoc(
      doc(db, "leads", leadId, "quotations", quotationId),
      {
        ...(isFinalQuotation ? {} : { status: "send_failed" }),
        emailStatus: "submission_failed",
        emailDeliveryStatus: "submission_failed",
        emailLastEvent: "submission_failed",
        emailLastEventAt: serverTimestamp(),
        emailProvider: "brevo",
        emailRecipient: recipientEmail || "",
        emailSubject: subject || "",
        emailError: failureMessage,
        emailDeliveryReason: failureMessage,
        sentVia: [],
        sentAt: null,
        sentByUid: "",
        sentByName: "",
        sendFailedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    const leadUpdate = {
      latestQuotationStatus: isFinalQuotation ? "final" : "send_failed",
      lastActivityAt: serverTimestamp(),
      lastActivityType: "quotation_email_send_failed",
      lastActivitySummary: `Quotation email failed: ${failureMessage}`,
      lastQuotationEmailDeliveryStatus: "submission_failed",
      lastQuotationEmailDeliveryReason: failureMessage,
      latestQuotationSentAt: null,
      latestQuotationSentByUid: "",
      latestQuotationSentByName: "",
      updatedAt: serverTimestamp()
    };

    if (previousLeadStage) {
      leadUpdate.stage = previousLeadStage;
      if (previousLeadStageLabel) {
        leadUpdate.stageLabel = previousLeadStageLabel;
      }
    }

    await updateDoc(doc(db, "leads", leadId), leadUpdate);
  } catch (statusError) {
    console.warn("Quotation email failure status update skipped:", statusError);
  }
}

async function logQuotationCommunication({
  leadId,
  channel,
  quotationId,
  revision,
  recipient,
  signatureUser,
  user,

  customerAmountNumber,
  vendorCost,
  vendorCostNumber,
  grossProfit,
  marginPercent,
  itineraryHtml,
  quotationData,
  isFinalQuotation,
  quotationPricingMode,
  vendorQuoteFinalized,

  vendorCostingMode,
  selectedVendorQuotes,
  selectedVendorQuoteIds,
  totalSelectedVendorCost,

  selectedVendorName,
  selectedVendorQuoteId,
  selectedVendorRequestId,
  selectedVendorCurrency,

  selectedQuotationAssets = [],
  quotationAssetLinksText = "",
  quotationAssetLinksHtml = "",
  quotationPdfUrl = ""
}) {
  if (!leadId || !channel) return;

  const hasVendorCost =
    vendorCost !== "" &&
    vendorCost !== null &&
    vendorCost !== undefined;

  const isBoth = channel === "email_whatsapp";

  const title = isBoth
    ? "Quotation sent via Email & WhatsApp"
    : channel === "email"
      ? "Quotation sent via Email"
      : "Quotation sent via WhatsApp";

  const action = isBoth
    ? "quotation_sent_email_whatsapp"
    : channel === "email"
      ? "quotation_sent_email"
      : "quotation_sent_whatsapp";

  const sentVia = isBoth ? ["email", "whatsapp"] : [channel];

  try {
    await logLeadAction({
      leadId,
      type: LEAD_TIMELINE_TYPES.QUOTATION,
      title,
      description: isBoth
        ? `Quotation Rev ${revision || ""} sent via Email & WhatsApp`
        : channel === "email"
          ? `Quotation Rev ${revision || ""} sent to ${recipient?.email || ""}`
          : `Quotation Rev ${revision || ""} shared on WhatsApp`,
      metadata: {
        action,
        channel,
        sentVia,
        status: isFinalQuotation ? "final" : "sent",

        leadId,
        quotationId: quotationId || "",

        sharedAssets: selectedQuotationAssets,
        sharedAssetIds: selectedQuotationAssets
          .map(asset => asset.assetId)
          .filter(Boolean),
        sharedAssetTitles: selectedQuotationAssets
          .map(asset => asset.title)
          .filter(Boolean),
        assetShareCount: selectedQuotationAssets.length,
        hasSharedAssets: selectedQuotationAssets.length > 0,
        assetLinksText: quotationAssetLinksText || "",
        assetLinksHtml: quotationAssetLinksHtml || "",
        quotationPdfUrl: quotationPdfUrl || "",

        revision: revision || "",

        itineraryHtml: itineraryHtml || "",
        quotationData: quotationData || null,

        quotationPricingMode,
        vendorQuoteFinalized,

        vendorCostingMode,
        selectedVendorQuotes,
        selectedVendorQuoteIds,
        totalSelectedVendorCost,

        totalAmount: customerAmountNumber,
        customerQuotedAmount: customerAmountNumber,
        customerQuoteAmount: customerAmountNumber,
        customerQuoteCurrency: "INR",

        vendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCurrency: selectedVendorCurrency || "INR",
        selectedVendorName: selectedVendorName || "",
        selectedVendorQuoteId: selectedVendorQuoteId || "",
        selectedVendorRequestId: selectedVendorRequestId || "",

        grossProfit,
        marginPercent:
          marginPercent === null || marginPercent === undefined
            ? null
            : Number(marginPercent.toFixed(2)),

        pricingVisibleToCustomer: false,
        isFinalQuotation: Boolean(isFinalQuotation),

        toEmail: recipient?.email || "",
        mobile: recipient?.mobile || "",

        signatureUser: {
          uid: getMemberUid(signatureUser),
          name: getMemberName(signatureUser),
          email: getMemberEmail(signatureUser),
          mobile: getMemberMobile(signatureUser),
          role: getMemberRole(signatureUser)
        }
      },
      user
    });
  } catch (error) {
    console.warn("Timeline log skipped:", error);
  }
}

/* =========================
  SMALL UI HELPERS
========================= */

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }`}
    >
      {children}
    </button>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-all">
        {value || "—"}
      </p>
    </div>
  );
}

function FormSection({ title, description, children, right }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>

        {right}
      </div>

      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
    >
      {children}
    </button>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
    >
      Remove
    </button>
  );
}

function ConfirmSendModal({
  open,
  onClose,
  onConfirm,
  saving,
  recipient,
  sendEmail,
  sendWhatsApp,
  selectedSignatureName,
  isFinalQuotation,
  customerAmount,
  vendorCost,
  grossProfit,
  marginPercent,
  isDraftSend,
  vendorCostingMode = "single_vendor",
  canViewVendorCost = false,
  canViewRevenueGp = false
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
        <div className="p-5 border-b">
          <h3 className="text-base font-semibold text-gray-900">
            {isDraftSend ? "Confirm Send Draft" : "Confirm Send Quotation"}
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Please verify the recipient, channels and internal commercial
            details before sending.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Recipient" value={recipient?.name} />
            <InfoRow label="Signature" value={selectedSignatureName} />
            <InfoRow
              label="Email"
              value={sendEmail ? recipient?.email : "Off"}
            />
            <InfoRow
              label="WhatsApp"
              value={sendWhatsApp ? recipient?.mobile : "Off"}
            />
            <InfoRow
              label="Final Quotation"
              value={isFinalQuotation ? "Yes" : "No"}
            />
            <InfoRow label="Pricing Visibility" value="Internal only" />

            <InfoRow
              label="Costing Mode"
              value={vendorCostingMode === "multi_vendor" ? "Multi Vendor" : "Single Vendor"}
            />
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-orange-700 mb-2">
              Internal Commercials
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Quote</span>
                <p className="font-semibold text-gray-900">{customerAmount}</p>
              </div>

              {canViewVendorCost && (
                <div>
                  <span className="text-gray-500">Vendor Cost</span>
                  <p className="font-semibold text-gray-900">{vendorCost}</p>
                </div>
              )}

              {canViewRevenueGp && (
                <>
                  <div>
                    <span className="text-gray-500">Gross Profit</span>
                    <p className="font-semibold text-gray-900">{grossProfit}</p>
                  </div>

                  <div>
                    <span className="text-gray-500">Margin</span>
                    <p className="font-semibold text-gray-900">{marginPercent}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm disabled:opacity-60"
          >
            Back
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {saving ? "Sending..." : "Confirm & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
  COMPONENT
========================= */

export default function QuotationEditor({
  lead,
  onClose,
  initialQuotation = null
}) {
  const { user } = useAuth();
  const linkedTravelAgent = useLeadTravelAgent(lead);
  const communicationLead = useMemo(
    () => buildLeadWithLiveTravelAgent(lead || {}, linkedTravelAgent || {}),
    [lead, linkedTravelAgent]
  );

  const canSendQuotation = Boolean(
    user && lead && canAccessRecord(user, "quotations.send", lead, "lead")
  );
  const canViewVendorCost = Boolean(user && canAccess(user, "payments.view_vendor_cost"));
  const canViewRevenueGp = Boolean(user && canAccess(user, "payments.view_revenue_gp"));

  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedSignatureUid, setSelectedSignatureUid] = useState("");

  const [quotationData, setQuotationData] = useState(() =>
    createDefaultQuotationData(lead)
  );

  const [legacyHtml, setLegacyHtml] = useState("");

  const [destinationTemplate, setDestinationTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");

  const [customerQuotedAmount, setCustomerQuotedAmount] = useState("");
  const [vendorCost, setVendorCost] = useState("");
  const [note, setNote] = useState("");
  const [isFinalQuotation, setIsFinalQuotation] = useState(false);

  const [activeTab, setActiveTab] = useState("edit");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewSignatureUser, setPreviewSignatureUser] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [draftQuotationId, setDraftQuotationId] = useState("");
  const [draftRevision, setDraftRevision] = useState(null);

  const autoSaveTimerRef = useRef(null);
  const lastAutoSaveSnapshotRef = useRef("");
  const autoSaveSkipFirstRunRef = useRef(true);
  const hydratedQuotationSessionRef = useRef("");
  const autoSavingRef = useRef(false);
  const productivityStartLoggedRef = useRef("");

  const [autoSaving, setAutoSaving] = useState(false);

  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [sharedAssets, setSharedAssets] = useState(
    normalizeQuotationAssets(
      initialQuotation?.sharedAssets ||
      initialQuotation?.quotationAssets ||
      initialQuotation?.metadata?.sharedAssets ||
      initialQuotation?.metadata?.quotationAssets ||
      initialQuotation?.latestQuotationSharedAssets ||
      initialQuotation?.finalQuotationSharedAssets ||
      []
    )
  );

  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);

  const initialPricingSnapshot = useMemo(() => {
    return getInitialPricingSnapshot(initialQuotation, lead);
  }, [initialQuotation, lead]);

  const [quotationPricingMode, setQuotationPricingMode] = useState(
    normalizeEditorPricingMode(initialPricingSnapshot.quotationPricingMode)
  );
  const [vendorQuoteFinalized, setVendorQuoteFinalized] = useState(
    Boolean(initialPricingSnapshot.vendorQuoteFinalized)
  );
  const [vendorCostingMode, setVendorCostingMode] = useState(
    initialPricingSnapshot.vendorCostingMode || "single_vendor"
  );
  const [selectedVendorQuotes, setSelectedVendorQuotes] = useState(() =>
    Array.isArray(initialPricingSnapshot.selectedVendorQuotes)
      ? initialPricingSnapshot.selectedVendorQuotes
      : []
  );
  const [selectedVendorQuoteIds, setSelectedVendorQuoteIds] = useState(() =>
    Array.isArray(initialPricingSnapshot.selectedVendorQuoteIds)
      ? initialPricingSnapshot.selectedVendorQuoteIds
      : []
  );
  const [totalSelectedVendorCost, setTotalSelectedVendorCost] = useState(() => {
    const value = initialPricingSnapshot.totalSelectedVendorCost;
    return value === null || value === undefined || value === ""
      ? null
      : Number(value);
  });
  const [selectedVendorName, setSelectedVendorName] = useState(
    initialPricingSnapshot.selectedVendorName || ""
  );
  const [selectedVendorQuoteId, setSelectedVendorQuoteId] = useState(
    initialPricingSnapshot.selectedVendorQuoteId || ""
  );
  const [selectedVendorRequestId, setSelectedVendorRequestId] = useState(
    initialPricingSnapshot.selectedVendorRequestId || ""
  );
  const [selectedVendorCurrency, setSelectedVendorCurrency] = useState(
    initialPricingSnapshot.selectedVendorCurrency || "INR"
  );
  const [pricingBaseline, setPricingBaseline] = useState(() =>
    buildPricingFingerprint(initialPricingSnapshot)
  );

  useEffect(() => {
    const leadId = lead?.id || lead?.leadId || "";
    if (!user?.uid || !leadId) return;

    const existingRevision = Number(initialQuotation?.revision || 0);
    const latestRevision = Number(
      lead?.latestQuotationRevision ||
      lead?.quotationRevision ||
      lead?.latestDraftQuotationRevision ||
      0
    );
    const targetRevision = existingRevision > 0
      ? existingRevision
      : Math.max(latestRevision + 1, 1);
    const activityType = targetRevision > 1 ? "requote_follow_up" : "quote_creation";
    const activityLabel = targetRevision > 1 ? "Re-Quote" : "Quote Creation";
    const sessionKey = `${activityType}:${leadId}:${targetRevision}`;

    if (productivityStartLoggedRef.current === sessionKey) return;
    productivityStartLoggedRef.current = sessionKey;

    recordDailyActivity({
      activityType,
      activityTypeLabel: activityLabel,
      activityGroup: "lead",
      title: `${activityLabel} started - Rev ${targetRevision}`,
      lead,
      eventType: targetRevision > 1 ? "requote_started" : "quote_creation_started",
      note: `${activityLabel} work opened in quotation editor.`,
      status: "in_progress",
      user,
      extra: {
        revision: targetRevision,
        quotationId: initialQuotation?.quotationId || initialQuotation?.id || "",
        sourceQuotationId: initialQuotation?.sourceQuotationId || "",
        workUnitKey: `${activityType}:${leadId}:${targetRevision}`,
        activityKind: "quotation_work"
      }
    }).catch(error => {
      console.warn(`${activityLabel} opened, but productivity activity tracking failed:`, error);
    });
  }, [user?.uid, lead?.id, lead?.leadId]);

  const customerQuoteCurrency =
    quotationData?.packageDetails?.currency ||
    selectedVendorCurrency ||
    "INR";

  const internalQuoteCurrency = "INR";

  const vendorCostLocked = quotationPricingMode !== "manual_cost";

  const currentPricingFingerprint = useMemo(
    () =>
      buildPricingFingerprint({
        quotationPricingMode,
        vendorCostingMode,
        vendorQuoteFinalized,
        selectedVendorQuotes,
        selectedVendorQuoteIds,
        totalSelectedVendorCost,
        selectedVendorCost: vendorCost,
        selectedVendorCurrency,
        selectedVendorName,
        selectedVendorQuoteId,
        selectedVendorRequestId
      }),
    [
      quotationPricingMode,
      vendorCostingMode,
      vendorQuoteFinalized,
      selectedVendorQuotes,
      selectedVendorQuoteIds,
      totalSelectedVendorCost,
      vendorCost,
      selectedVendorCurrency,
      selectedVendorName,
      selectedVendorQuoteId,
      selectedVendorRequestId
    ]
  );

  const vendorPricingChangedFromDraft = Boolean(
    draftQuotationId &&
      pricingBaseline &&
      currentPricingFingerprint !== pricingBaseline
  );

  const selectedQuotationAssets = useMemo(() => {
    return normalizeQuotationAssets(sharedAssets);
  }, [sharedAssets]);

  const quotationAssetLinksText = useMemo(() => {
    return buildQuotationAssetLinksText(selectedQuotationAssets);
  }, [selectedQuotationAssets]);

  const quotationAssetLinksHtml = useMemo(() => {
    return buildQuotationAssetLinksHtml(selectedQuotationAssets);
  }, [selectedQuotationAssets]);

  const recipient = useMemo(() => {
    const name = getFirstValue(
      communicationLead?.spoc?.name,
      communicationLead?.customerName,
      communicationLead?.travellerName,
      communicationLead?.guestName,
      communicationLead?.contactName,
      communicationLead?.customer?.name
    );

    const email = getFirstValue(
      communicationLead?.spoc?.email,
      communicationLead?.email,
      communicationLead?.customerEmail,
      communicationLead?.customer?.email
    );

    const mobile = getFirstValue(
      communicationLead?.spoc?.mobile,
      communicationLead?.mobile,
      communicationLead?.phone,
      communicationLead?.contactNumber,
      communicationLead?.customerMobile,
      communicationLead?.customer?.mobile
    );

    return { name, email, mobile };
  }, [communicationLead]);

  const [sendEmail, setSendEmail] = useState(Boolean(recipient.email));
  const [sendWhatsApp, setSendWhatsApp] = useState(Boolean(recipient.mobile));

  useEffect(() => {
    // Quotation communication defaults to every available direct channel.
    // Email + WhatsApp therefore stay ON together when both details exist.
    setSendEmail(Boolean(recipient.email));
    setSendWhatsApp(Boolean(recipient.mobile));
  }, [recipient.email, recipient.mobile]);

  const isLegacyQuotation = Boolean(
    initialQuotation &&
    !initialQuotation?.quotationData &&
    cleanString(legacyHtml)
  );

  const activeDestinationTemplate = useMemo(() => {
    return quotationData?.destinationTemplateSnapshot || destinationTemplate;
  }, [quotationData?.destinationTemplateSnapshot, destinationTemplate]);

  const cleanPreviewQuotationData = useMemo(() => {
    return buildCleanQuotationData({
      lead,
      quotationData,
      destinationTemplate: activeDestinationTemplate
    });
  }, [lead, quotationData, activeDestinationTemplate]);

  const previewItineraryHtml = useMemo(() => {
    if (isLegacyQuotation) {
      return legacyHtml || "<p>No quotation content added yet.</p>";
    }

    return buildStructuredQuotationHtml({
      lead,
      quotationData: cleanPreviewQuotationData,
      destinationTemplate: activeDestinationTemplate
    });
  }, [
    isLegacyQuotation,
    legacyHtml,
    lead,
    cleanPreviewQuotationData,
    activeDestinationTemplate
  ]);

  /* =========================
    LOAD TEAM MEMBERS
  ========================== */

  useEffect(() => {
    let mounted = true;

    async function loadTeamMembers() {
      if (!user) return;

      try {
        const snap = await getDocs(collection(db, "users"));

        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            uid: docSnap.data()?.uid || docSnap.id,
            ...docSnap.data()
          }))
          .filter(isInternalUser);

        if (mounted) {
          setTeamMembers(rows);
        }
      } catch (error) {
        console.error("Failed to load team signatures:", error);
      }
    }

    loadTeamMembers();

    return () => {
      mounted = false;
    };
  }, [user]);

  const currentUserOption = useMemo(() => {
    const uid = user?.uid || user?.id || user?.email;

    const savedProfile = teamMembers.find(
      member => getMemberUid(member) === uid
    );

    if (savedProfile) return savedProfile;

    return {
      id: uid,
      uid,
      displayName: user?.displayName || user?.name || user?.email,
      name: user?.name || user?.displayName || user?.email,
      email: user?.email,
      mobile: user?.mobile || user?.phone,
      role: user?.role,
      designation: user?.designation,
      signatureHtml: user?.signatureHtml,
      emailSignatureHtml: user?.emailSignatureHtml,
      whatsappSignature: user?.whatsappSignature,
      signatureText: user?.signatureText,
      signatureEnabled: user?.signatureEnabled
    };
  }, [user, teamMembers]);

  const signatureOptions = useMemo(() => {
    const map = new Map();

    [...teamMembers, currentUserOption].forEach(member => {
      const uid = getMemberUid(member);
      if (!uid) return;

      const existing = map.get(uid);

      if (!existing) {
        map.set(uid, member);
        return;
      }

      if (getSignaturePriority(member) > getSignaturePriority(existing)) {
        map.set(uid, member);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      getMemberName(a).localeCompare(getMemberName(b))
    );
  }, [teamMembers, currentUserOption]);

  useEffect(() => {
    if (!user || !signatureOptions.length || selectedSignatureUid) return;

    const currentAssignee = getLeadAssignee(lead || {});
    const assignedUid = getFirstValue(
      currentAssignee.uid,
      currentAssignee.email,
      lead?.teamLeadUid
    );

    const assignedMember = signatureOptions.find(
      member => getMemberUid(member) === assignedUid
    );

    if (assignedMember) {
      setSelectedSignatureUid(getMemberUid(assignedMember));
      return;
    }

    const currentUid = user.uid || user.id || user.email || "";
    const currentMember = signatureOptions.find(
      member => getMemberUid(member) === currentUid
    );

    if (currentMember) {
      setSelectedSignatureUid(getMemberUid(currentMember));
    }
  }, [user, lead, signatureOptions, selectedSignatureUid]);

  const selectedSignatureUser = useMemo(() => {
    if (!selectedSignatureUid) return null;

    return (
      signatureOptions.find(
        member => getMemberUid(member) === selectedSignatureUid
      ) || null
    );
  }, [signatureOptions, selectedSignatureUid]);

  useEffect(() => {
    let mounted = true;

    async function loadPreviewSignature() {
      const baseUser = selectedSignatureUser || currentUserOption;
      const uid = getMemberUid(baseUser);

      if (!uid) {
        setPreviewSignatureUser(baseUser || null);
        return;
      }

      try {
        let profileData = {};
        let brandingData = {};

        try {
          const profile = await getUserProfileByUid(uid);
          profileData = profile?.data || {};
        } catch (error) {
          console.warn("Preview profile load skipped:", error);
        }

        try {
          brandingData = await getBrandingSettings();
        } catch (error) {
          console.warn("Preview branding load skipped:", error);
        }

        const mergedUser = {
          ...mergeSignatureUserWithProfile(baseUser, profileData),
          ...brandingData
        };

        if (mounted) {
          setPreviewSignatureUser(mergedUser);
        }
      } catch (error) {
        console.warn("Signature preview load skipped:", error);
        if (mounted) setPreviewSignatureUser(baseUser || null);
      }
    }

    loadPreviewSignature();

    return () => {
      mounted = false;
    };
  }, [selectedSignatureUser, currentUserOption]);

  /* =========================
  HYDRATE QUOTATION
  Important:
  Do not depend on full lead / initialQuotation object.
  Auto-save updates Firestore and causes new object references.
========================== */

  useEffect(() => {
    if (!lead?.id) return;

    const incomingQuotationId =
      initialQuotation?.id ||
      initialQuotation?.quotationId ||
      initialQuotation?.metadata?.quotationId ||
      "new";

    const sessionKey = `${lead.id}:${incomingQuotationId}`;

    /*
      Prevent auto-save Firestore updates from rehydrating the editor.
      This stops the quotation modal from refreshing/resetting while typing.
    */
    if (hydratedQuotationSessionRef.current) {
      const [hydratedLeadId] = hydratedQuotationSessionRef.current.split(":");

      if (hydratedLeadId === String(lead.id)) {
        return;
      }
    }

    hydratedQuotationSessionRef.current = sessionKey;

    const pricing = getInitialPricingSnapshot(initialQuotation, lead);

    setQuotationPricingMode(
      normalizeEditorPricingMode(pricing.quotationPricingMode)
    );
    setVendorQuoteFinalized(Boolean(pricing.vendorQuoteFinalized));
    setVendorCostingMode(
      pricing.vendorCostingMode === "multi_vendor"
        ? "multi_vendor"
        : "single_vendor"
    );
    setSelectedVendorQuotes(
      Array.isArray(pricing.selectedVendorQuotes)
        ? pricing.selectedVendorQuotes
        : []
    );
    setSelectedVendorQuoteIds(
      Array.isArray(pricing.selectedVendorQuoteIds)
        ? pricing.selectedVendorQuoteIds
        : []
    );
    setTotalSelectedVendorCost(
      pricing.totalSelectedVendorCost === null ||
        pricing.totalSelectedVendorCost === undefined ||
        pricing.totalSelectedVendorCost === ""
        ? null
        : Number(pricing.totalSelectedVendorCost)
    );
    setSelectedVendorName(pricing.selectedVendorName || "");
    setSelectedVendorQuoteId(pricing.selectedVendorQuoteId || "");
    setSelectedVendorRequestId(pricing.selectedVendorRequestId || "");
    setSelectedVendorCurrency(pricing.selectedVendorCurrency || "INR");
    setPricingBaseline(buildPricingFingerprint(pricing));

    if (!initialQuotation) {
      setQuotationData(
        createDefaultQuotationData(
          lead,
          pricing.selectedVendorCurrency || "USD"
        )
      );

      setLegacyHtml("");
      setDraftQuotationId("");
      setDraftRevision(null);
      setNote("");
      setIsFinalQuotation(false);

      setCustomerQuotedAmount(
        pricing.customerQuoteAmount === null ||
          pricing.customerQuoteAmount === undefined
          ? ""
          : String(pricing.customerQuoteAmount)
      );

      setVendorCost(
        pricing.selectedVendorCost === null ||
          pricing.selectedVendorCost === undefined
          ? ""
          : String(pricing.selectedVendorCost)
      );
      setSharedAssets([]);
      setActiveTab("edit");
      return;
    }

    const savedQuotationData =
      initialQuotation.quotationData ||
      initialQuotation.metadata?.quotationData ||
      null;

    if (savedQuotationData) {
      setQuotationData(
        mergeQuotationDataWithDefaults(
          lead,
          savedQuotationData,
          pricing.selectedVendorCurrency || "USD"
        )
      );

      setLegacyHtml("");
    } else {
      setQuotationData(
        createDefaultQuotationData(
          lead,
          pricing.selectedVendorCurrency || "USD"
        )
      );

      setLegacyHtml(
        initialQuotation.itineraryHtml ||
        initialQuotation.html ||
        initialQuotation.contentHtml ||
        initialQuotation.metadata?.itineraryHtml ||
        ""
      );
    }

    setCustomerQuotedAmount(
      pricing.customerQuoteAmount === null ||
        pricing.customerQuoteAmount === undefined
        ? ""
        : String(pricing.customerQuoteAmount)
    );

    setVendorCost(
      pricing.selectedVendorCost === null ||
        pricing.selectedVendorCost === undefined
        ? ""
        : String(pricing.selectedVendorCost)
    );

    setNote(initialQuotation.note || initialQuotation.metadata?.note || "");
    setIsFinalQuotation(Boolean(initialQuotation.isFinalQuotation));

    setDraftQuotationId(
      initialQuotation.id ||
      initialQuotation.quotationId ||
      initialQuotation.metadata?.quotationId ||
      ""
    );

    setDraftRevision(
      initialQuotation.revision ||
      initialQuotation.metadata?.revision ||
      null
    );

    const signatureUid =
      initialQuotation.signatureUser?.uid ||
      initialQuotation.signatureUser?.id ||
      initialQuotation.metadata?.signatureUser?.uid ||
      initialQuotation.metadata?.signatureUser?.id ||
      "";

    if (signatureUid) {
      setSelectedSignatureUid(signatureUid);
    }

    setSharedAssets(
      normalizeQuotationAssets(
        initialQuotation?.sharedAssets ||
        initialQuotation?.quotationAssets ||
        initialQuotation?.metadata?.sharedAssets ||
        initialQuotation?.metadata?.quotationAssets ||
        initialQuotation?.latestQuotationSharedAssets ||
        initialQuotation?.finalQuotationSharedAssets ||
        []
      )
    );

    setActiveTab("edit");
  }, [
    lead?.id,
    initialQuotation?.id,
    initialQuotation?.quotationId,
    initialQuotation?.metadata?.quotationId
  ]);
  /* =========================
    LOAD DESTINATION TEMPLATE
  ========================== */

  const selectedDestinationName =
    quotationData?.travelDetails?.destinationName || "";

  useEffect(() => {
    let mounted = true;

    async function loadTemplate() {
      const destinationName = cleanString(selectedDestinationName);

      if (!destinationName || isLegacyQuotation) {
        setDestinationTemplate(null);
        return;
      }

      const existingSnapshot = quotationData?.destinationTemplateSnapshot;

      if (
        existingSnapshot?.destinationName &&
        existingSnapshot.destinationName === destinationName
      ) {
        setDestinationTemplate(existingSnapshot);
        return;
      }

      setTemplateLoading(true);
      setTemplateError("");

      try {
        const template =
          await getDestinationQuotationTemplate(destinationName);

        if (!mounted) return;

        setDestinationTemplate(template);

        if (template) {
          const snapshot = buildDestinationTemplateSnapshot(template);

          setQuotationData(prev => ({
            ...prev,
            destinationTemplateId:
              snapshot.templateId || snapshot.destinationId || "",
            destinationTemplateSnapshot: snapshot,
            selectedAutoSections:
              Object.keys(prev.selectedAutoSections || {}).length
                ? prev.selectedAutoSections
                : getDefaultSelectedAutoSections(snapshot)
          }));
        } else {
          setQuotationData(prev => ({
            ...prev,
            destinationTemplateId: "",
            destinationTemplateSnapshot: null,
            selectedAutoSections: {}
          }));
        }
      } catch (error) {
        if (mounted) {
          setTemplateError(
            error?.message || "Failed to load destination template."
          );
        }
      } finally {
        if (mounted) setTemplateLoading(false);
      }
    }

    loadTemplate();

    return () => {
      mounted = false;
    };
  }, [selectedDestinationName, isLegacyQuotation]);


  const hasEmail = isValidEmail(recipient.email);
  const hasWhatsApp = Boolean(recipient.mobile);

  const customerAmountNumber = Number(customerQuotedAmount || 0);
  const vendorCostNumber = Number(vendorCost || 0);
  const hasVendorCost = vendorCost !== "";

  const grossProfit =
    hasVendorCost && Number.isFinite(vendorCostNumber)
      ? customerAmountNumber - vendorCostNumber
      : null;

  const marginPercent =
    customerAmountNumber > 0 && grossProfit !== null
      ? (grossProfit / customerAmountNumber) * 100
      : null;

  const normalizeSelectedVendorQuoteForQuotation = quote => ({
    vendorId: cleanString(quote?.vendorId),
    vendorName: cleanString(quote?.vendorName),
    vendorCode: cleanString(quote?.vendorCode),
    vendorRequestId: cleanString(quote?.vendorRequestId),
    vendorQuoteId: cleanString(quote?.vendorQuoteId || quote?.id),
    serviceType: cleanString(quote?.serviceType || quote?.vendorType || "other"),
    serviceLabel: cleanString(
      quote?.serviceLabel ||
        quote?.vendorTypeLabel ||
        quote?.vendorType ||
        "Vendor Cost"
    ),
    currency: cleanString(quote?.currency || "INR") || "INR",
    amount:
      quote?.amount === null || quote?.amount === undefined || quote?.amount === ""
        ? Number(quote?.vendorCost || quote?.price || 0)
        : Number(quote.amount),
    revision: Number(quote?.revision || 1),
    referenceText: cleanString(quote?.referenceText),
    referenceFileUrl: cleanString(quote?.referenceFileUrl),
    referenceFileName: cleanString(quote?.referenceFileName)
  });

  const applyDirectPricing = () => {
    setQuotationPricingMode("direct");
    setVendorCostingMode("single_vendor");
    setVendorQuoteFinalized(false);
    setSelectedVendorQuotes([]);
    setSelectedVendorQuoteIds([]);
    setTotalSelectedVendorCost(null);
    setSelectedVendorName("");
    setSelectedVendorQuoteId("");
    setSelectedVendorRequestId("");
    setSelectedVendorCurrency("INR");
    setVendorCost("");
  };

  const applyManualPricing = () => {
    setQuotationPricingMode("manual_cost");
    setVendorCostingMode("single_vendor");
    setVendorQuoteFinalized(false);
    setSelectedVendorQuotes([]);
    setSelectedVendorQuoteIds([]);
    setTotalSelectedVendorCost(null);
    setSelectedVendorName("Manual Cost");
    setSelectedVendorQuoteId("");
    setSelectedVendorRequestId("");
  };

  const applySingleVendorPrice = quote => {
    const amount = Number(
      quote?.amount ?? quote?.vendorCost ?? quote?.price ?? 0
    );
    const currency = cleanString(quote?.currency || "INR") || "INR";

    setQuotationPricingMode("vendor_quote");
    setVendorCostingMode("single_vendor");
    setVendorQuoteFinalized(Boolean(quote?.vendorQuoteFinalized || quote?.isFinal || quote?.selected));
    setSelectedVendorQuotes([]);
    setSelectedVendorQuoteIds([]);
    setTotalSelectedVendorCost(null);
    setSelectedVendorName(cleanString(quote?.vendorName || "Vendor"));
    setSelectedVendorQuoteId(cleanString(quote?.vendorQuoteId || quote?.id));
    setSelectedVendorRequestId(cleanString(quote?.vendorRequestId));
    setSelectedVendorCurrency(currency);
    setVendorCost(Number.isFinite(amount) ? String(amount) : "");
  };

  const applyMultiVendorPrices = quotes => {
    const normalized = (Array.isArray(quotes) ? quotes : [])
      .map(normalizeSelectedVendorQuoteForQuotation)
      .filter(item => item.vendorQuoteId && Number.isFinite(item.amount));

    const total = normalized.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const currency = normalized[0]?.currency || "INR";

    setQuotationPricingMode("multi_vendor");
    setVendorCostingMode("multi_vendor");
    setVendorQuoteFinalized(false);
    setSelectedVendorQuotes(normalized);
    setSelectedVendorQuoteIds(normalized.map(item => item.vendorQuoteId));
    setTotalSelectedVendorCost(normalized.length ? total : null);
    setSelectedVendorName(normalized.length ? "Multiple Vendors" : "");
    setSelectedVendorQuoteId("");
    setSelectedVendorRequestId("");
    setSelectedVendorCurrency(currency);
    setVendorCost(normalized.length ? String(total) : "");
  };

  const handlePricingModeChange = mode => {
    if (mode === "direct") {
      applyDirectPricing();
      return;
    }

    if (mode === "manual_cost") {
      applyManualPricing();
      return;
    }

    if (mode === "multi_vendor") {
      setQuotationPricingMode("multi_vendor");
      setVendorCostingMode("multi_vendor");
      setVendorQuoteFinalized(false);
      setSelectedVendorName(selectedVendorQuotes.length ? "Multiple Vendors" : "");
      setSelectedVendorQuoteId("");
      setSelectedVendorRequestId("");
      if (selectedVendorQuotes.length) {
        const total = selectedVendorQuotes.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );
        setTotalSelectedVendorCost(total);
        setVendorCost(String(total));
      } else {
        setTotalSelectedVendorCost(null);
        setVendorCost("");
      }
      return;
    }

    if (quotationPricingMode !== "vendor_quote") {
      setVendorQuoteFinalized(false);
      setSelectedVendorQuotes([]);
      setSelectedVendorQuoteIds([]);
      setTotalSelectedVendorCost(null);
      setSelectedVendorName("");
      setSelectedVendorQuoteId("");
      setSelectedVendorRequestId("");
      setVendorCost("");
    }

    setQuotationPricingMode("vendor_quote");
    setVendorCostingMode("single_vendor");
  };


  function shouldShowPackageDetails(type) {
    return ["package", "hotel_only", "custom"].includes(type);
  }

  function shouldShowHotelSection(type) {
    return ["package", "hotel_only", "custom"].includes(type);
  }

  function shouldShowTransferSection(type) {
    return ["package", "land_only", "custom"].includes(type);
  }

  function shouldShowItinerarySection(type) {
    return ["package", "land_only", "custom"].includes(type);
  }

  function shouldShowServiceSection(type) {
    return ["visa_only", "custom"].includes(type);
  }

  function shouldShowFlightSection(type) {
    return ["flight_only", "custom"].includes(type);
  }


  const updateQuotationType = value => {
    setQuotationData(prev => {
      const next = {
        ...prev,
        quotationType: value,
        packageDetails: {
          ...(prev.packageDetails || {}),
          hotelPart: {
            ...(prev.packageDetails?.hotelPart || {}),
            enabled:
              value === "package" ||
              value === "hotel_only" ||
              value === "custom"
          },
          landPart: {
            ...(prev.packageDetails?.landPart || {}),
            enabled:
              value === "package" ||
              value === "land_only" ||
              value === "custom"
          }
        }
      };

      return next;
    });
  };


  const addServiceItem = () => {
    setQuotationData(prev => ({
      ...prev,
      serviceItems: [
        ...safeArray(prev.serviceItems),
        {
          serviceType: "visa",
          title: "",
          description: "",
          currency: "INR",
          amount: "",
          remarks: ""
        }
      ]
    }));
  };

  const updateServiceItem = (index, key, value) => {
    setQuotationData(prev => ({
      ...prev,
      serviceItems: safeArray(prev.serviceItems).map((row, rowIndex) =>
        rowIndex === index
          ? {
            ...row,
            [key]: value
          }
          : row
      )
    }));
  };

  const removeServiceItem = index => {
    setQuotationData(prev => ({
      ...prev,
      serviceItems: safeArray(prev.serviceItems).filter(
        (_, rowIndex) => rowIndex !== index
      )
    }));
  };

  /* =========================
    STRUCTURED FIELD UPDATERS
  ========================== */

  const updateTravelDetail = (key, value) => {
    setQuotationData(prev => {
      const previousTravelDetails = prev.travelDetails || {};

      const nextTravelDetails = {
        ...previousTravelDetails,
        [key]: value
      };

      let nextItineraryDays = prev.itineraryDays;

      if (key === "checkIn") {
        const monthFromCheckIn = getMonthFromDateInput(value);

        if (monthFromCheckIn) {
          nextTravelDetails.travelMonth = monthFromCheckIn;
        }

        if (nextTravelDetails.checkOut) {
          const nights = getNightCount(value, nextTravelDetails.checkOut);

          if (nights) {
            nextTravelDetails.noOfNights = nights;
            nextItineraryDays = buildItineraryRowsForNightCount(
              nights,
              prev.itineraryDays
            );
          }
        } else if (nextTravelDetails.noOfNights) {
          nextTravelDetails.checkOut = addDaysToDateInput(
            value,
            Number(nextTravelDetails.noOfNights)
          );

          nextItineraryDays = buildItineraryRowsForNightCount(
            nextTravelDetails.noOfNights,
            prev.itineraryDays
          );
        }
      }

      if (key === "checkOut") {
        const baseCheckIn = nextTravelDetails.checkIn;

        if (!nextTravelDetails.travelMonth) {
          const monthFromCheckOut = getMonthFromDateInput(value);
          if (monthFromCheckOut) {
            nextTravelDetails.travelMonth = monthFromCheckOut;
          }
        }

        if (baseCheckIn) {
          const nights = getNightCount(baseCheckIn, value);

          if (nights) {
            nextTravelDetails.noOfNights = nights;
            nextItineraryDays = buildItineraryRowsForNightCount(
              nights,
              prev.itineraryDays
            );
          }
        }
      }

      if (key === "noOfNights") {
        const nights = Number(value || 0);

        if (nights > 0) {
          if (nextTravelDetails.checkIn) {
            nextTravelDetails.checkOut = addDaysToDateInput(
              nextTravelDetails.checkIn,
              nights
            );
          }

          nextItineraryDays = buildItineraryRowsForNightCount(
            nights,
            prev.itineraryDays
          );
        }
      }

      if (key === "travelMonth") {
        if (!nextTravelDetails.checkIn && /^\d{4}-\d{2}$/.test(value)) {
          nextTravelDetails.checkIn = `${value}-01`;

          if (nextTravelDetails.noOfNights) {
            nextTravelDetails.checkOut = addDaysToDateInput(
              nextTravelDetails.checkIn,
              Number(nextTravelDetails.noOfNights)
            );

            nextItineraryDays = buildItineraryRowsForNightCount(
              nextTravelDetails.noOfNights,
              prev.itineraryDays
            );
          }
        }
      }

      return {
        ...prev,
        travelDetails: nextTravelDetails,
        itineraryDays: nextItineraryDays,

        ...(key === "destinationName"
          ? {
            destinationTemplateId: "",
            destinationTemplateSnapshot: null,
            selectedAutoSections: {}
          }
          : {})
      };
    });
  };

  // Currency selections must never silently relabel a numeric customer price.
  // INR costing and GP stay separate and are not changed by this conversion.
  const updatePackageCurrency = value => {
    const previousCurrency = quotationData.packageDetails?.currency || "USD";
    if (value === previousCurrency) return;
    const details = quotationData.packageDetails || {};
    const packagePrice = details.packagePricing || {};
    const affected = [packagePrice, details.landPricing?.pvt, details.landPricing?.sic,
      ...safeArray(quotationData.hotelInclusions).filter(row => !row.currency || row.currency === previousCurrency)]
      .filter(Boolean)
      .some(item => ["adultCost", "childCost", "amount", "price", "cost"].some(key =>
        item[key] !== null && item[key] !== undefined && String(item[key]).trim() !== ""));
    let factor = 1;
    if (affected) {
      const answer = window.prompt(
        `Convert customer-facing amounts from ${previousCurrency} to ${value}.\nEnter how many ${previousCurrency} equal 1 ${value} (e.g. if 1 SGD = 70 INR, enter 70).\nCancel to keep existing currency and prices unchanged.`
      );
      if (answer === null) return;
      const rate = Number(answer);
      if (!Number.isFinite(rate) || rate <= 0) {
        window.alert("Enter a valid positive exchange rate. Currency was not changed.");
        return;
      }
      factor = 1 / rate;
    }
    const convertPrices = item => {
      if (!item) return item;
      const updated = { ...item };
      for (const key of ["adultCost", "childCost", "amount", "price", "cost"]) {
        if (updated[key] === null || updated[key] === undefined || String(updated[key]).trim() === "") continue;
        const number = Number(String(updated[key]).replace(/,/g, ""));
        if (Number.isFinite(number)) updated[key] = String(Math.round(number * factor * 100) / 100);
      }
      return updated;
    };
    setQuotationData(prev => {
      const previousCurrency =
        prev.packageDetails?.currency ||
        prev.packageDetails?.packagePricing?.currency ||
        "USD";

      return {
        ...prev,

        packageDetails: {
          ...(prev.packageDetails || {}),
          currency: value,

          packagePricing: {
            ...convertPrices(prev.packageDetails?.packagePricing || {}),
            currency: value
          },

          hotelPart: {
            ...(prev.packageDetails?.hotelPart || {})
          },

          landPart: {
            ...(prev.packageDetails?.landPart || {})
          },

          landPricing: {
            ...(prev.packageDetails?.landPricing || createDefaultLandPricing(value)),

            pvt: {
              ...(!prev.packageDetails?.landPricing?.pvt?.currency || prev.packageDetails.landPricing.pvt.currency === previousCurrency
                ? convertPrices(prev.packageDetails?.landPricing?.pvt || {}) : (prev.packageDetails?.landPricing?.pvt || {})),
              currency:
                !prev.packageDetails?.landPricing?.pvt?.currency ||
                  prev.packageDetails?.landPricing?.pvt?.currency === previousCurrency
                  ? value
                  : prev.packageDetails?.landPricing?.pvt?.currency
            },

            sic: {
              ...(!prev.packageDetails?.landPricing?.sic?.currency || prev.packageDetails.landPricing.sic.currency === previousCurrency
                ? convertPrices(prev.packageDetails?.landPricing?.sic || {}) : (prev.packageDetails?.landPricing?.sic || {})),
              currency:
                !prev.packageDetails?.landPricing?.sic?.currency ||
                  prev.packageDetails?.landPricing?.sic?.currency === previousCurrency
                  ? value
                  : prev.packageDetails?.landPricing?.sic?.currency
            }
          }
        },

        hotelInclusions: safeArray(prev.hotelInclusions).map(row => ({
          ...(!row.currency || row.currency === previousCurrency ? convertPrices(row) : row),
          currency:
            !row.currency || row.currency === previousCurrency
              ? value
              : row.currency
        }))
      };
    });
  };

  const togglePackagePart = partKey => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        [partKey]: {
          ...(prev.packageDetails?.[partKey] || {}),
          enabled: !prev.packageDetails?.[partKey]?.enabled
        }
      }
    }));
  };

  const updatePackagePart = (partKey, key, value) => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        [partKey]: {
          ...(prev.packageDetails?.[partKey] || {}),
          [key]: value
        }
      }
    }));
  };

  const updatePackagePricing = (key, value) => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        packagePricing: {
          ...(prev.packageDetails?.packagePricing || {}),
          [key]: value
        }
      }
    }));
  };

  const updatePricingDisplayMode = value => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        pricingDisplayMode: value
      }
    }));
  };

  const addHotelRow = () => {
    setQuotationData(prev => ({
      ...prev,
      hotelInclusions: [
        ...safeArray(prev.hotelInclusions),
        createEmptyHotelOption(prev.packageDetails?.currency || "USD")
      ]
    }));
  };

  const togglePackageScope = key => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        packageScope: {
          ...(prev.packageDetails?.packageScope || DEFAULT_PACKAGE_SCOPE),
          [key]: !prev.packageDetails?.packageScope?.[key]
        }
      }
    }));
  };

  const updatePackageDetail = (key, value) => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        [key]: value
      }
    }));
  };

  const toggleLandPricingMode = key => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        landPricing: {
          ...(prev.packageDetails?.landPricing || createDefaultLandPricing()),
          [key]: !prev.packageDetails?.landPricing?.[key]
        }
      }
    }));
  };

  const updateLandPricing = (mode, key, value) => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        landPricing: {
          ...(prev.packageDetails?.landPricing || createDefaultLandPricing()),
          [mode]: {
            ...(prev.packageDetails?.landPricing?.[mode] || {}),
            [key]: value
          }
        }
      }
    }));
  };

  const updateHotelRow = (index, key, value) => {
    setQuotationData(prev => ({
      ...prev,
      hotelInclusions: safeArray(prev.hotelInclusions).map((row, rowIndex) =>
        rowIndex === index
          ? {
            ...row,
            [key]: value
          }
          : row
      )
    }));
  };

  const removeHotelRow = index => {
    setQuotationData(prev => ({
      ...prev,
      hotelInclusions: safeArray(prev.hotelInclusions).filter(
        (_, rowIndex) => rowIndex !== index
      )
    }));
  };

  const addTransferRow = () => {
    setQuotationData(prev => ({
      ...prev,
      transferInclusions: [...safeArray(prev.transferInclusions), ""]
    }));
  };

  const updateTransferRow = (index, value) => {
    setQuotationData(prev => ({
      ...prev,
      transferInclusions: safeArray(prev.transferInclusions).map(
        (row, rowIndex) => (rowIndex === index ? value : row)
      )
    }));
  };

  const removeTransferRow = index => {
    setQuotationData(prev => ({
      ...prev,
      transferInclusions: safeArray(prev.transferInclusions).filter(
        (_, rowIndex) => rowIndex !== index
      )
    }));
  };

  const addItineraryDay = () => {
    setQuotationData(prev => {
      const rows = safeArray(prev.itineraryDays);

      return {
        ...prev,
        itineraryDays: [
          ...rows,
          {
            day: rows.length + 1,
            title: "",
            description: "",
            meals: "",
            meetingPoint: "",
            timing: "",
            includes: ""
          }
        ]
      };
    });
  };

  const updateItineraryDay = (index, key, value) => {
    setQuotationData(prev => ({
      ...prev,
      itineraryDays: safeArray(prev.itineraryDays).map((row, rowIndex) =>
        rowIndex === index
          ? {
            ...row,
            [key]: value
          }
          : row
      )
    }));
  };

  const removeItineraryDay = index => {
    setQuotationData(prev => ({
      ...prev,
      itineraryDays: safeArray(prev.itineraryDays).filter(
        (_, rowIndex) => rowIndex !== index
      )
    }));
  };

  const toggleAutoSection = key => {
    setQuotationData(prev => ({
      ...prev,
      selectedAutoSections: {
        ...(prev.selectedAutoSections || {}),
        [key]: !prev.selectedAutoSections?.[key]
      }
    }));
  };



  const addFlightRow = () => {
    setQuotationData(prev => ({
      ...prev,
      flightDetails: [
        ...safeArray(prev.flightDetails),
        {
          airline: "",
          route: "",
          departureDate: "",
          returnDate: "",
          baggage: "",
          currency: "INR",
          fare: "",
          remarks: ""
        }
      ]
    }));
  };

  const updateFlightRow = (index, key, value) => {
    setQuotationData(prev => ({
      ...prev,
      flightDetails: safeArray(prev.flightDetails).map((row, rowIndex) =>
        rowIndex === index
          ? {
            ...row,
            [key]: value
          }
          : row
      )
    }));
  };

  const removeFlightRow = index => {
    setQuotationData(prev => ({
      ...prev,
      flightDetails: safeArray(prev.flightDetails).filter(
        (_, rowIndex) => rowIndex !== index
      )
    }));
  };

  /* =========================
    VALIDATION
  ========================== */

  const validateStructuredQuotation = () => {
    if (isLegacyQuotation) {
      if (!stripHtml(legacyHtml)) {
        alert("Quotation content is required");
        return false;
      }

      return true;
    }

    const cleanData = cleanPreviewQuotationData;
    const destinationName = cleanData.travelDetails?.destinationName;

    if (!destinationName) {
      alert("Destination is required");
      return false;
    }

    const quotationType = cleanData.quotationType || "package";

    const packageDetails = cleanData.packageDetails || {};
    const hotelPart = packageDetails.hotelPart || {};
    const landPart = packageDetails.landPart || {};
    const packagePricing = packageDetails.packagePricing || {};
    const landPricing = packageDetails.landPricing || {};
    const packageScope = packageDetails.packageScope || DEFAULT_PACKAGE_SCOPE;

    const pricingDisplayMode =
      packageDetails.pricingDisplayMode === "component_wise"
        ? "component_wise"
        : "final_only";

    const isComponentWisePackage =
      quotationType === "package" && pricingDisplayMode === "component_wise";

    const isFinalOnlyPackage =
      quotationType === "package" && pricingDisplayMode !== "component_wise";

    const hasHotelRows = safeArray(cleanData.hotelInclusions).some(
      hasHotelListingContent
    );

    const hasItineraryRows = safeArray(cleanData.itineraryDays).some(
      hasItineraryContent
    );

    const hasTransferRows = safeArray(cleanData.transferInclusions).some(
      item => cleanString(item)
    );

    const hasServiceRows = safeArray(cleanData.serviceItems).some(
      hasServicePricingContent
    );

    const hasFlightRows = safeArray(cleanData.flightDetails).some(
      hasFlightContent
    );

    const hasHotelPartPrice = hasAdultChildOrAmount(hotelPart);
    const hasLandPartPrice = hasAdultChildOrAmount(landPart);
    const hasPackagePrice = hasAdultChildOrAmount(packagePricing);

    const hasPvtPricing = hasLandModePricing(landPricing?.pvt);
    const hasSicPricing = hasLandModePricing(landPricing?.sic);

    if (quotationType === "package") {
      const hasSelectedComponent = Object.values(packageScope).some(Boolean);

      if (!hasSelectedComponent) {
        alert("Select at least one package component");
        return false;
      }

      if (isFinalOnlyPackage && !hasPackagePrice) {
        alert("Package adult or child price is required");
        return false;
      }

      if (isComponentWisePackage) {
        const hasAnyComponentPricing =
          hasHotelPartPrice ||
          hasLandPartPrice ||
          hasPvtPricing ||
          hasSicPricing ||
          hasServiceRows ||
          hasFlightRows;

        if (!hasAnyComponentPricing) {
          alert("Enter at least one pricing/detail section for Show All Pricing Separately");
          return false;
        }
      }

      if (!hasItineraryRows) {
        alert("At least one itinerary day is required");
        return false;
      }
    }

    if (quotationType === "hotel_only") {
      if (!hasHotelPartPrice && !hasHotelRows) {
        alert("Add hotel pricing or at least one hotel option");
        return false;
      }
    }

    if (quotationType === "land_only") {
      if (!hasPvtPricing && !hasSicPricing) {
        alert("Enter PVT or SIC adult/child pricing for land quotation");
        return false;
      }

      if (!hasItineraryRows) {
        alert("At least one itinerary day is required");
        return false;
      }
    }

    if (quotationType === "visa_only" && !hasServiceRows) {
      alert("At least one service amount, description or remark is required");
      return false;
    }

    if (quotationType === "flight_only" && !hasFlightRows) {
      alert("At least one flight detail is required");
      return false;
    }

    if (quotationType === "custom") {
      const hasAnyCustomContent =
        hasHotelRows ||
        hasHotelPartPrice ||
        hasLandPartPrice ||
        hasPvtPricing ||
        hasSicPricing ||
        hasTransferRows ||
        hasItineraryRows ||
        hasServiceRows ||
        hasFlightRows;

      if (!hasAnyCustomContent) {
        alert("Please add at least one custom quotation detail");
        return false;
      }
    }

    return true;
  };


  const validateBeforeSend = () => {
    if (!validateStructuredQuotation()) return false;

    if (
      !customerQuotedAmount ||
      !Number.isFinite(customerAmountNumber) ||
      customerAmountNumber <= 0
    ) {
      alert("Valid internal quotation amount is required");
      return false;
    }

    if (
      hasVendorCost &&
      (!Number.isFinite(vendorCostNumber) || vendorCostNumber < 0)
    ) {
      alert("Valid vendor cost is required");
      return false;
    }

    if (
      hasVendorCost &&
      Number.isFinite(vendorCostNumber) &&
      customerAmountNumber < vendorCostNumber
    ) {
      alert("Customer quotation amount cannot be lower than vendor cost.");
      return false;
    }

    if (!sendEmail && !sendWhatsApp) {
      alert("Select at least one channel");
      return false;
    }

    if (sendEmail && !hasEmail) {
      alert("Email address is not available");
      return false;
    }

    if (sendWhatsApp && !hasWhatsApp) {
      alert("WhatsApp number is not available");
      return false;
    }

    if (!selectedSignatureUid) {
      alert("Please select team member signature");
      return false;
    }

    return true;
  };

  const getFinalQuotationDataAndHtml = () => {
    if (isLegacyQuotation) {
      return {
        finalQuotationData: null,
        finalItineraryHtml: legacyHtml || ""
      };
    }

    const finalQuotationData = buildCleanQuotationData({
      lead,
      quotationData,
      destinationTemplate: activeDestinationTemplate
    });

    const finalItineraryHtml = buildStructuredQuotationHtml({
      lead,
      quotationData: finalQuotationData,
      destinationTemplate: activeDestinationTemplate
    });

    return {
      finalQuotationData,
      finalItineraryHtml
    };
  };


  const silentAutoSaveDraft = async () => {
    if (saving || savingDraft || autoSaving || autoSavingRef.current) return;
    if (!lead?.id || isLegacyQuotation) return;

    /*
      When vendor pricing changes on an existing draft, preserve that draft.
      The explicit Save Draft / Send action will create the next revision.
    */
    if (vendorPricingChangedFromDraft) return;

    const selectedSignatureBaseUser =
      selectedSignatureUser || currentUserOption;

    if (!selectedSignatureBaseUser) return;

    const selectedUid = getMemberUid(selectedSignatureBaseUser);

    const safeSelectedQuotationAssets = Array.isArray(selectedQuotationAssets)
      ? selectedQuotationAssets
      : [];

    const safeSharedAssetIds = safeSelectedQuotationAssets
      .map(asset => asset.assetId)
      .filter(Boolean);

    const safeSharedAssetTitles = safeSelectedQuotationAssets
      .map(asset => asset.title)
      .filter(Boolean);

    const safeQuotationAssetLinksText = quotationAssetLinksText || "";
    const safeQuotationAssetLinksHtml = quotationAssetLinksHtml || "";

    autoSavingRef.current = true;
    setAutoSaving(true);

    try {
      let profileSignatureData = {};

      try {
        if (selectedUid) {
          const profile = await getUserProfileByUid(selectedUid);
          profileSignatureData = profile?.data || {};
        }
      } catch (error) {
        console.warn("Auto-save profile load skipped:", error);
      }

      let branding = {};

      try {
        branding = await getBrandingSettings();
      } catch (error) {
        console.warn("Auto-save branding load skipped:", error);
      }

      const signatureUser = mergeSignatureUserWithProfile(
        selectedSignatureBaseUser,
        profileSignatureData
      );

      const signatureUserWithBranding = {
        ...signatureUser,
        ...branding
      };

      const { finalQuotationData, finalItineraryHtml } =
        getFinalQuotationDataAndHtml();

      const emailSignatureHtml =
        buildEmailSignatureHtml(signatureUserWithBranding);

      const whatsappSignatureText =
        buildWhatsAppSignatureText(signatureUserWithBranding);

      const result = await saveQuotationDraft({
        leadId: lead.id,

        quotationId: draftQuotationId,
        revision: draftRevision,

        skipTimelineLog: true,
        isAutoSave: true,
        source: "auto_save",

        itineraryHtml: finalItineraryHtml,
        quotationData: finalQuotationData,

        customerQuotedAmount: customerAmountNumber || 0,
        customerQuoteAmount: customerAmountNumber || 0,
        customerQuoteCurrency: internalQuoteCurrency,

        vendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCurrency,
        selectedVendorName,
        selectedVendorQuoteId,
        selectedVendorRequestId,

        quotationPricingMode,
        vendorQuoteFinalized,

        vendorCostingMode,
        selectedVendorQuotes,
        selectedVendorQuoteIds,
        totalSelectedVendorCost,

        grossProfit,
        marginPercent:
          marginPercent === null || marginPercent === undefined
            ? null
            : Number(marginPercent.toFixed(2)),

        pricingVisibleToCustomer: false,

        note,

        sharedAssets: safeSelectedQuotationAssets,
        sharedAssetIds: safeSharedAssetIds,
        sharedAssetTitles: safeSharedAssetTitles,
        assetShareCount: safeSelectedQuotationAssets.length,
        hasSharedAssets: safeSelectedQuotationAssets.length > 0,
        assetLinksText: safeQuotationAssetLinksText,
        assetLinksHtml: safeQuotationAssetLinksHtml,

        signatureUser: {
          uid: getMemberUid(signatureUser),
          name: getMemberName(signatureUser),
          email: getMemberEmail(signatureUser),
          mobile: getMemberMobile(signatureUser),
          role: getMemberRole(signatureUser),

          companyName: branding.companyName || "",
          companyLogoUrl: branding.companyLogoUrl || "",
          websiteUrl: branding.websiteUrl || "",
          emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
          facebookUrl: branding.facebookUrl || "",
          instagramUrl: branding.instagramUrl || "",
          linkedinUrl: branding.linkedinUrl || "",
          youtubeUrl: branding.youtubeUrl || "",
          supportEmail: branding.supportEmail || "",
          supportMobile: branding.supportMobile || "",
          emailFooterLine: branding.emailFooterLine || "",
          quotationClosingLine: branding.quotationClosingLine || "",
          emailDisclaimer: branding.emailDisclaimer || "",
          whatsappFooterLine: branding.whatsappFooterLine || "",

          signatureHtml: emailSignatureHtml,
          signatureText: whatsappSignatureText
        },

        user
      });

      if (result?.quotationId) {
        setDraftQuotationId(result.quotationId);
      }

      if (result?.revision) {
        setDraftRevision(result.revision);
      }

      setLastAutoSavedAt(new Date());
    } catch (error) {
      console.warn("Silent quotation auto-save skipped:", error);
    } finally {
      autoSavingRef.current = false;
      setAutoSaving(false);
    }
  };
  /* =========================
    SAVE DRAFT
  ========================== */

  const saveDraft = async () => {
    if (saving || savingDraft) return;
    if (!validateStructuredQuotation()) return;

    const selectedSignatureBaseUser =
      selectedSignatureUser || currentUserOption;

    const selectedUid = getMemberUid(selectedSignatureBaseUser);

    const safeSelectedQuotationAssets = Array.isArray(selectedQuotationAssets)
      ? selectedQuotationAssets
      : [];

    const safeSharedAssetIds = safeSelectedQuotationAssets
      .map(asset => asset.assetId)
      .filter(Boolean);

    const safeSharedAssetTitles = safeSelectedQuotationAssets
      .map(asset => asset.title)
      .filter(Boolean);

    const safeQuotationAssetLinksText = quotationAssetLinksText || "";
    const safeQuotationAssetLinksHtml = quotationAssetLinksHtml || "";

    setSavingDraft(true);

    try {
      let profileSignatureData = {};

      try {
        if (selectedUid) {
          const profile = await getUserProfileByUid(selectedUid);
          profileSignatureData = profile?.data || {};
        }
      } catch (error) {
        console.warn("Could not load selected signature profile:", error);
      }

      let branding = {};

      try {
        branding = await getBrandingSettings();
      } catch (error) {
        console.warn("Branding settings not found:", error);
      }

      const signatureUser = mergeSignatureUserWithProfile(
        selectedSignatureBaseUser,
        profileSignatureData
      );

      const signatureUserWithBranding = {
        ...signatureUser,
        ...branding
      };

      const { finalQuotationData, finalItineraryHtml } =
        getFinalQuotationDataAndHtml();

      const emailSignatureHtml =
        buildEmailSignatureHtml(signatureUserWithBranding);

      const whatsappSignatureText =
        buildWhatsAppSignatureText(signatureUserWithBranding);

      const signaturePayload = {
        uid: getMemberUid(signatureUser),
        name: getMemberName(signatureUser),
        email: getMemberEmail(signatureUser),
        mobile: getMemberMobile(signatureUser),
        role: getMemberRole(signatureUser),

        companyName: branding.companyName || "",
        companyLogoUrl: branding.companyLogoUrl || "",
        websiteUrl: branding.websiteUrl || "",
        emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
        facebookUrl: branding.facebookUrl || "",
        instagramUrl: branding.instagramUrl || "",
        linkedinUrl: branding.linkedinUrl || "",
        youtubeUrl: branding.youtubeUrl || "",
        supportEmail: branding.supportEmail || "",
        supportMobile: branding.supportMobile || "",
        emailFooterLine: branding.emailFooterLine || "",
        quotationClosingLine: branding.quotationClosingLine || "",
        emailDisclaimer: branding.emailDisclaimer || "",
        whatsappFooterLine: branding.whatsappFooterLine || "",

        signatureHtml: emailSignatureHtml,
        signatureText: whatsappSignatureText
      };

      const commonDraftPayload = {
        leadId: lead.id,
        itineraryHtml: finalItineraryHtml,
        quotationData: finalQuotationData,

        customerQuotedAmount: customerAmountNumber || 0,
        customerQuoteAmount: customerAmountNumber || 0,
        customerQuoteCurrency: internalQuoteCurrency,

        vendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCurrency,
        selectedVendorName,
        selectedVendorQuoteId,
        selectedVendorRequestId,

        quotationPricingMode,
        vendorQuoteFinalized,
        vendorCostingMode,
        selectedVendorQuotes,
        selectedVendorQuoteIds,
        totalSelectedVendorCost,

        grossProfit,
        marginPercent:
          marginPercent === null || marginPercent === undefined
            ? null
            : Number(marginPercent.toFixed(2)),
        pricingVisibleToCustomer: false,
        note,

        sharedAssets: safeSelectedQuotationAssets,
        quotationAssets: safeSelectedQuotationAssets,
        sharedAssetIds: safeSharedAssetIds,
        sharedAssetTitles: safeSharedAssetTitles,
        assetShareCount: safeSelectedQuotationAssets.length,
        hasSharedAssets: safeSelectedQuotationAssets.length > 0,
        assetLinksText: safeQuotationAssetLinksText,
        assetLinksHtml: safeQuotationAssetLinksHtml,

        signatureUser: signaturePayload,
        user
      };

      const sourceDraftQuotationId = vendorPricingChangedFromDraft
        ? draftQuotationId
        : "";

      const result = sourceDraftQuotationId
        ? await createQuotationRevision({
            ...commonDraftPayload,
            sourceQuotationId: sourceDraftQuotationId,
            sendVia: [],
            isFinalQuotation: false
          })
        : await saveQuotationDraft({
            ...commonDraftPayload,
            quotationId: draftQuotationId,
            revision: draftRevision
          });

      if (sourceDraftQuotationId && result?.quotationId) {
        await markQuotationSuperseded({
          leadId: lead.id,
          quotationId: sourceDraftQuotationId,
          replacementQuotationId: result.quotationId,
          replacementRevision: result.revision,
          user
        });
      }

      setDraftQuotationId(result.quotationId || "");
      setDraftRevision(result.revision || null);
      setPricingBaseline(currentPricingFingerprint);

      alert(
        result.revision
          ? sourceDraftQuotationId
            ? `Vendor pricing changed. New draft revision created - Rev ${result.revision}`
            : `Draft saved successfully - Rev ${result.revision}`
          : "Draft saved successfully"
      );
    } catch (error) {
      console.error("Draft save failed:", error);
      alert(error?.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  /* =========================
    UPDATE EXISTING DRAFT AS SENT
  ========================== */

  const updateExistingDraftAsSent = async ({
    quotationId,
    revision,
    itineraryHtml,
    quotationData,
    sendVia,
    signatureUser,
    emailSignatureHtml,
    whatsappSignatureText,
    branding
  }) => {
    if (!quotationId) {
      throw new Error("Draft quotation ID missing");
    }

    const safeRevision =
      revision || draftRevision || initialQuotation?.revision || "";

    const finalStatus = isFinalQuotation ? "final" : "sending";

    const safeVendorCost = hasVendorCost ? vendorCostNumber : null;

    const safeMarginPercent =
      marginPercent === null
        ? null
        : Number(marginPercent.toFixed(2));

    const safeVendorCostingMode =
      vendorCostingMode === "multi_vendor"
        ? "multi_vendor"
        : "single_vendor";

    const safeSelectedVendorQuotes = Array.isArray(selectedVendorQuotes)
      ? selectedVendorQuotes
      : [];

    const safeSelectedVendorQuoteIds = Array.isArray(selectedVendorQuoteIds)
      ? selectedVendorQuoteIds
      : [];

    const safeTotalSelectedVendorCost =
      safeVendorCostingMode === "multi_vendor"
        ? totalSelectedVendorCost ?? safeVendorCost
        : null;

    /* =========================
       QUOTATION ASSETS
    ========================= */

    const safeSelectedQuotationAssets = Array.isArray(selectedQuotationAssets)
      ? selectedQuotationAssets
      : [];

    const safeSharedAssetIds = safeSelectedQuotationAssets
      .map(asset => asset.assetId)
      .filter(Boolean);

    const safeSharedAssetTitles = safeSelectedQuotationAssets
      .map(asset => asset.title)
      .filter(Boolean);

    const safeQuotationAssetLinksText = quotationAssetLinksText || "";
    const safeQuotationAssetLinksHtml = quotationAssetLinksHtml || "";

    const leadTravelPayload = buildLeadTravelPayloadFromQuotationData(quotationData || {});

    const signaturePayload = {
      uid: getMemberUid(signatureUser),
      name: getMemberName(signatureUser),
      email: getMemberEmail(signatureUser),
      mobile: getMemberMobile(signatureUser),
      role: getMemberRole(signatureUser),

      companyName: branding.companyName || "",
      companyLogoUrl: branding.companyLogoUrl || "",
      websiteUrl: branding.websiteUrl || "",
      emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
      facebookUrl: branding.facebookUrl || "",
      instagramUrl: branding.instagramUrl || "",
      linkedinUrl: branding.linkedinUrl || "",
      youtubeUrl: branding.youtubeUrl || "",
      supportEmail: branding.supportEmail || "",
      supportMobile: branding.supportMobile || "",
      emailFooterLine: branding.emailFooterLine || "",
      quotationClosingLine: branding.quotationClosingLine || "",
      emailDisclaimer: branding.emailDisclaimer || "",
      whatsappFooterLine: branding.whatsappFooterLine || "",

      signatureHtml: emailSignatureHtml,
      signatureText: whatsappSignatureText
    };

    await updateDoc(
      doc(db, "leads", lead.id, "quotations", quotationId),
      {
        status: finalStatus,
        isDraft: false,
        isFinalQuotation: Boolean(isFinalQuotation),

        itineraryHtml,
        quotationData: quotationData || null,

        totalPrice: customerAmountNumber,
        totalAmount: customerAmountNumber,
        customerQuotedAmount: customerAmountNumber,
        customerQuoteAmount: customerAmountNumber,
        customerQuoteCurrency: internalQuoteCurrency,

        vendorCost: safeVendorCost,
        selectedVendorCost: safeVendorCost,
        selectedVendorCurrency,
        selectedVendorName,
        selectedVendorQuoteId,
        selectedVendorRequestId,

        quotationPricingMode,
        vendorQuoteFinalized,

        vendorCostingMode: safeVendorCostingMode,
        selectedVendorQuotes: safeSelectedVendorQuotes,
        selectedVendorQuoteIds: safeSelectedVendorQuoteIds,
        totalSelectedVendorCost: safeTotalSelectedVendorCost,

        latestVendorCostingMode: safeVendorCostingMode,
        latestSelectedVendorQuotes: safeSelectedVendorQuotes,
        latestSelectedVendorQuoteIds: safeSelectedVendorQuoteIds,
        latestTotalSelectedVendorCost: safeTotalSelectedVendorCost,

        finalVendorCostingMode: safeVendorCostingMode,
        finalSelectedVendorQuotes: safeSelectedVendorQuotes,
        finalSelectedVendorQuoteIds: safeSelectedVendorQuoteIds,
        finalTotalSelectedVendorCost: safeTotalSelectedVendorCost,

        sharedAssets: safeSelectedQuotationAssets,
        sharedAssetIds: safeSharedAssetIds,
        sharedAssetTitles: safeSharedAssetTitles,
        assetShareCount: safeSelectedQuotationAssets.length,
        hasSharedAssets: safeSelectedQuotationAssets.length > 0,
        assetLinksText: safeQuotationAssetLinksText,
        assetLinksHtml: safeQuotationAssetLinksHtml,

        grossProfit,
        marginPercent: safeMarginPercent,
        pricingVisibleToCustomer: false,

        note,
        sendVia,
        requestedVia: sendVia,
        sentVia: [],

        signatureUser: signaturePayload,

        sendRequestedAt: serverTimestamp(),
        sendRequestedByUid: user?.uid || "",
        sendRequestedByName: user?.displayName || user?.name || user?.email || "",

        updatedAt: serverTimestamp()
      }
    );

    await updateDoc(doc(db, "leads", lead.id), {
      latestQuotationId: quotationId,
      latestQuotationRevision: safeRevision,
      latestQuotationStatus: finalStatus,

      latestQuotationAmount: customerAmountNumber,
      latestCustomerQuoteAmount: customerAmountNumber,
      latestCustomerQuoteCurrency: internalQuoteCurrency,

      latestQuotationSharedAssets: safeSelectedQuotationAssets,
      latestQuotationSharedAssetIds: safeSharedAssetIds,
      latestQuotationSharedAssetTitles: safeSharedAssetTitles,
      latestQuotationAssetShareCount: safeSelectedQuotationAssets.length,
      latestQuotationHasSharedAssets: safeSelectedQuotationAssets.length > 0,
      latestQuotationAssetLinksText: safeQuotationAssetLinksText,
      latestQuotationAssetLinksHtml: safeQuotationAssetLinksHtml,

      latestVendorCost: safeVendorCost,
      latestSelectedVendorCost: safeVendorCost,
      latestSelectedVendorCurrency: selectedVendorCurrency,
      latestSelectedVendorName: selectedVendorName,
      latestSelectedVendorQuoteId: selectedVendorQuoteId,
      latestSelectedVendorRequestId: selectedVendorRequestId,

      latestVendorCostingMode: safeVendorCostingMode,
      latestSelectedVendorQuotes: safeSelectedVendorQuotes,
      latestSelectedVendorQuoteIds: safeSelectedVendorQuoteIds,
      latestTotalSelectedVendorCost: safeTotalSelectedVendorCost,

      quotationPricingMode,
      vendorQuoteFinalized,

      latestGrossProfit: grossProfit,
      latestMarginPercent: safeMarginPercent,

      latestQuotationSendRequestedAt: serverTimestamp(),
      latestQuotationSendRequestedByUid: user?.uid || "",
      latestQuotationSendRequestedByName:
        user?.displayName || user?.name || user?.email || "",

      ...leadTravelPayload,

      updatedAt: serverTimestamp(),

      ...(isFinalQuotation
        ? {
          finalQuotationId: quotationId,
          finalQuotationRevision: safeRevision,
          finalQuotationAmount: customerAmountNumber,
          finalCustomerQuoteAmount: customerAmountNumber,
          finalCustomerQuoteCurrency: internalQuoteCurrency,

          finalQuotationSharedAssets: safeSelectedQuotationAssets,
          finalQuotationSharedAssetIds: safeSharedAssetIds,
          finalQuotationSharedAssetTitles: safeSharedAssetTitles,
          finalQuotationAssetShareCount: safeSelectedQuotationAssets.length,
          finalQuotationHasSharedAssets:
            safeSelectedQuotationAssets.length > 0,
          finalQuotationAssetLinksText: safeQuotationAssetLinksText,
          finalQuotationAssetLinksHtml: safeQuotationAssetLinksHtml,

          finalVendorCost: safeVendorCost,
          finalSelectedVendorCost: safeVendorCost,
          finalSelectedVendorCurrency: selectedVendorCurrency,
          finalSelectedVendorName: selectedVendorName,
          finalSelectedVendorQuoteId: selectedVendorQuoteId,
          finalSelectedVendorRequestId: selectedVendorRequestId,

          finalVendorCostingMode: safeVendorCostingMode,
          finalSelectedVendorQuotes: safeSelectedVendorQuotes,
          finalSelectedVendorQuoteIds: safeSelectedVendorQuoteIds,
          finalTotalSelectedVendorCost: safeTotalSelectedVendorCost,

          finalGrossProfit: grossProfit,
          finalMarginPercent: safeMarginPercent,
          finalQuotationAt: serverTimestamp(),
          finalQuotationByUid: user?.uid || "",
          finalQuotationByName:
            user?.displayName || user?.name || user?.email || ""
        }
        : {})
    });

    return {
      quotationId,
      revision: safeRevision
    };
  };

  const handleDeleteCurrentDraft = async () => {
    if (!draftQuotationId || !lead?.id || deletingDraft) return;

    const confirmed = window.confirm(
      `Delete Draft${draftRevision ? ` Rev ${draftRevision}` : ""}? This removes only the unsent draft and keeps the lead and previous quotations intact.`
    );
    if (!confirmed) return;

    try {
      setDeletingDraft(true);
      await deleteQuotationDraft({
        leadId: lead.id,
        quotationId: draftQuotationId,
        user
      });
      setDraftQuotationId("");
      setDraftRevision(null);
      onClose?.();
    } catch (error) {
      console.error("Delete draft failed:", error);
      alert(error?.message || "Failed to delete draft quotation");
    } finally {
      setDeletingDraft(false);
    }
  };

  const openSendConfirmation = () => {
    if (saving || savingDraft) return;
    if (!canSendQuotation) {
      alert("You do not have permission to send this quotation.");
      return;
    }
    if (!validateBeforeSend()) return;

    // Warm the relatively large PDF renderer while the user reviews the send
    // confirmation. This removes its dynamic-import cost from the actual Send
    // button wait without generating or uploading anything prematurely.
    void preloadQuotationPdfLibrary().catch(error => {
      console.warn("Quotation PDF pre-load skipped:", error);
    });

    setConfirmOpen(true);
  };

  /* =========================
    SEND QUOTATION
  ========================== */

  const submit = async () => {
    if (saving) return;
    if (!canSendQuotation) {
      alert("You do not have permission to send this quotation.");
      return;
    }
    if (!validateBeforeSend()) return;

    const selectedSignatureBaseUser =
      selectedSignatureUser || currentUserOption;

    const selectedUid = getMemberUid(selectedSignatureBaseUser);

    if (!selectedUid) {
      alert("Please select team member signature");
      return;
    }

    let whatsappWindow = null;
    if (sendWhatsApp && hasWhatsApp && typeof window !== "undefined") {
      // Open synchronously from the user's click so browsers do not block the
      // WhatsApp tab after PDF/email async work finishes.
      whatsappWindow = window.open("about:blank", "_blank");
    }

    setSaving(true);

    try {
      setConfirmOpen(false);

      let profileSignatureData = {};
      let branding = {};
      let communicationSettings = {
        quotationManagementBcc: [],
        quotationCcSelectedTeamMember: false,
        quotationBccManagement: false
      };

      // These three reads are independent. Loading them together avoids three
      // back-to-back Firestore round-trips before quotation generation starts.
      const [profileResult, brandingResult, communicationResult] =
        await Promise.allSettled([
          getUserProfileByUid(selectedUid),
          getBrandingSettings(),
          sendEmail ? getCommunicationSettings() : Promise.resolve(null)
        ]);

      if (profileResult.status === "fulfilled") {
        profileSignatureData = profileResult.value?.data || {};
      } else {
        console.warn("Could not load selected signature profile:", profileResult.reason);
      }

      if (brandingResult.status === "fulfilled") {
        branding = brandingResult.value || {};
      } else {
        console.warn("Branding settings not found:", brandingResult.reason);
      }

      if (communicationResult.status === "fulfilled" && communicationResult.value) {
        communicationSettings = {
          ...communicationSettings,
          ...communicationResult.value
        };
      } else if (communicationResult.status === "rejected") {
        console.warn("Communication settings not found:", communicationResult.reason);
      }

      const signatureUser = mergeSignatureUserWithProfile(
        selectedSignatureBaseUser,
        profileSignatureData
      );

      const signatureUserWithBranding = {
        ...signatureUser,
        ...branding
      };

      if (signatureUserWithBranding?.signatureEnabled === false) {
        alert("Selected team member signature is inactive");
        setSaving(false);
        return;
      }

      const { finalQuotationData, finalItineraryHtml } =
        getFinalQuotationDataAndHtml();

      const emailSignatureHtml =
        buildEmailSignatureHtml(signatureUserWithBranding);

      const whatsappSignatureText =
        buildWhatsAppSignatureText(signatureUserWithBranding);

      const sendVia = [
        sendEmail ? "email" : null,
        sendWhatsApp ? "whatsapp" : null
      ].filter(Boolean);

      let quotationResult;
      const sourceDraftQuotationId = vendorPricingChangedFromDraft
        ? draftQuotationId
        : "";

      if (draftQuotationId && !sourceDraftQuotationId) {
        quotationResult = await updateExistingDraftAsSent({
          quotationId: draftQuotationId,
          revision: draftRevision,
          itineraryHtml: finalItineraryHtml,
          quotationData: finalQuotationData,
          sendVia,
          signatureUser,
          emailSignatureHtml,
          whatsappSignatureText,
          branding
        });
      } else {
        quotationResult = await createQuotationRevision({
          leadId: lead.id,
          itineraryHtml: finalItineraryHtml,
          quotationData: finalQuotationData,

          totalPrice: customerAmountNumber,
          totalAmount: customerAmountNumber,
          customerQuotedAmount: customerAmountNumber,
          customerQuoteAmount: customerAmountNumber,
          customerQuoteCurrency,
          quotationPricingMode,
          vendorQuoteFinalized,

          vendorCostingMode,
          selectedVendorQuotes,
          selectedVendorQuoteIds,
          totalSelectedVendorCost,

          vendorCost: hasVendorCost ? vendorCostNumber : null,
          selectedVendorCost: hasVendorCost ? vendorCostNumber : null,
          selectedVendorCurrency,
          selectedVendorName,
          selectedVendorQuoteId,
          selectedVendorRequestId,

          grossProfit,
          marginPercent:
            marginPercent === null
              ? null
              : Number(marginPercent.toFixed(2)),
          pricingVisibleToCustomer: false,

          note,
          sendVia,
          isFinalQuotation,
          deferSentStatus: true,
          sourceQuotationId:
            sourceDraftQuotationId ||
            initialQuotation?.sourceQuotationId ||
            initialQuotation?.id ||
            initialQuotation?.quotationId ||
            "",

          sharedAssets: selectedQuotationAssets,
          quotationAssets: selectedQuotationAssets,
          sharedAssetIds: selectedQuotationAssets
            .map(asset => asset.assetId)
            .filter(Boolean),
          sharedAssetTitles: selectedQuotationAssets
            .map(asset => asset.title)
            .filter(Boolean),
          assetShareCount: selectedQuotationAssets.length,
          hasSharedAssets: selectedQuotationAssets.length > 0,
          assetLinksText: quotationAssetLinksText,
          assetLinksHtml: quotationAssetLinksHtml,

          signatureUser: {
            uid: getMemberUid(signatureUser),
            name: getMemberName(signatureUser),
            email: getMemberEmail(signatureUser),
            mobile: getMemberMobile(signatureUser),
            role: getMemberRole(signatureUser),

            companyName: branding.companyName || "",
            companyLogoUrl: branding.companyLogoUrl || "",
            websiteUrl: branding.websiteUrl || "",
            emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
            facebookUrl: branding.facebookUrl || "",
            instagramUrl: branding.instagramUrl || "",
            linkedinUrl: branding.linkedinUrl || "",
            youtubeUrl: branding.youtubeUrl || "",
            supportEmail: branding.supportEmail || "",
            supportMobile: branding.supportMobile || "",
            emailFooterLine: branding.emailFooterLine || "",
            quotationClosingLine: branding.quotationClosingLine || "",
            emailDisclaimer: branding.emailDisclaimer || "",
            whatsappFooterLine: branding.whatsappFooterLine || "",

            signatureHtml: emailSignatureHtml,
            signatureText: whatsappSignatureText
          },

          skipTimelineLog: true,

          user
        });
      }

      if (sourceDraftQuotationId && quotationResult?.quotationId) {
        await markQuotationSuperseded({
          leadId: lead.id,
          quotationId: sourceDraftQuotationId,
          replacementQuotationId: quotationResult.quotationId,
          replacementRevision: quotationResult.revision,
          user
        });
        setDraftQuotationId(quotationResult.quotationId);
        setDraftRevision(quotationResult.revision || null);
        setPricingBaseline(currentPricingFingerprint);
      }

      const revision =
        typeof quotationResult === "object"
          ? quotationResult?.revision
          : quotationResult;

      const quotationId =
        typeof quotationResult === "object"
          ? quotationResult?.quotationId || quotationResult?.id || ""
          : "";

      if (!quotationId) {
        throw new Error("Quotation was saved but no quotation ID was returned.");
      }

      if (isFinalQuotation) {
        await clearOtherFinalQuotations({
          leadId: lead.id,
          quotationId,
          user
        });
      }

      const finalItineraryHtmlWithAssets = [
        finalItineraryHtml,
        quotationAssetLinksHtml
      ].filter(Boolean).join("");

      // Generate and upload one customer-safe PDF before dispatch so the same
      // link is used in Email and WhatsApp. If PDF creation fails, nothing is
      // sent and the quotation is returned to Draft for a safe retry.
      let quotationPdfUrl = "";
      let quotationPdfStoragePath = "";
      try {
        const pdfShare = await createShareableQuotationPdf({
          leadId: lead.id,
          quotationId,
          revision,
          branding,
          quotation: {
            leadCode: lead?.leadCode || "",
            revision,
            itineraryHtml: finalItineraryHtmlWithAssets,
            quotationData: finalQuotationData,
            customerQuoteAmount: customerAmountNumber,
            customerQuoteCurrency: customerQuoteCurrency || "INR",
            createdAt: new Date(),
            createdByName: user?.displayName || user?.name || user?.email || "",
            signatureUser: {
              ...signatureUser,
              ...branding,
              signatureHtml: emailSignatureHtml,
              quotationClosingLine: branding?.quotationClosingLine || ""
            }
          },
          lead: communicationLead
        });

        quotationPdfUrl = pdfShare?.url || "";
        quotationPdfStoragePath = pdfShare?.storagePath || "";

        if (!quotationPdfUrl) {
          throw new Error("Quotation PDF link was not created.");
        }

        await Promise.all([
          updateDoc(
            doc(db, "leads", lead.id, "quotations", quotationId),
            {
              pdfUrl: quotationPdfUrl,
              quotationPdfUrl,
              pdfStoragePath: quotationPdfStoragePath,
              pdfStatus: "ready",
              pdfGeneratedAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }
          ),
          updateDoc(doc(db, "leads", lead.id), {
            latestQuotationPdfUrl: quotationPdfUrl,
            updatedAt: serverTimestamp()
          })
        ]);
      } catch (pdfError) {
        const pdfMessage = pdfError?.message || "Could not create quotation PDF link.";
        console.error("Quotation PDF share link failed:", pdfError);
        try {
          await updateDoc(
            doc(db, "leads", lead.id, "quotations", quotationId),
            {
              status: "draft",
              isDraft: true,
              pdfStatus: "failed",
              pdfError: pdfMessage,
              updatedAt: serverTimestamp()
            }
          );
        } catch (statusError) {
          console.warn("Quotation PDF failure status update skipped:", statusError);
        }
        throw new Error(`${pdfMessage} Quotation saved as draft; Email/WhatsApp was not sent.`);
      }

      const subject = buildQuotationEmailSubject({
        lead: communicationLead,
        quotationData: finalQuotationData,
        revision
      });

      const itineraryAlreadyHasGreeting =
        htmlContainsGreeting(finalItineraryHtml);

      const emailHtml = buildQuotationTravelAgentEmailHtml({
        recipient,
        lead: communicationLead,
        revision,
        itineraryHtml: finalItineraryHtmlWithAssets,
        branding,
        emailSignatureHtml,
        itineraryAlreadyHasGreeting,
        pdfUrl: quotationPdfUrl
      });

      const selectedTeamEmail = getMemberEmail(signatureUser);
      const selectedTeamName = getMemberName(signatureUser);
      const quotationEmailText = [
        stripHtml(emailHtml),
        quotationPdfUrl ? `Quotation PDF: ${quotationPdfUrl}` : ""
      ].filter(Boolean).join("\n\n");

      // V2.7.5.11.6: the concerned team member receives a separate internal
      // copy after the customer message is accepted. Do not CC them on the
      // customer message: keeping the messages separate prevents internal
      // recipient webhook events from overwriting customer delivery status.
      const cc = [];
      const internalCopyRecipient = resolveQuotationInternalRecipient({
        signatureUser,
        user,
        customerEmail: recipient.email
      });

      const bcc =
        sendEmail && communicationSettings.quotationBccManagement
          ? (communicationSettings.quotationManagementBcc || []).map(email => ({
            email
          }))
          : [];

      let emailSent = false;
      let whatsappSent = false;
      let emailFailure = "";
      let whatsappFailure = "";
      let teamCopyFailure = "";
      let teamCopyPromise = null;

      if (sendEmail && hasEmail) {
        try {
          const emailResponse = await sendEmailViaBrevo({
            toEmail: recipient.email,
            toName: recipient.name || "Guest",
            subject,
            html: emailHtml,
            text: quotationEmailText,
            cc,
            bcc,
            tags: [
              "dreamtrawell_crm",
              "quotation",
              `lead_${lead.id}`,
              `quotation_${quotationId}`
            ],
            replyTo: selectedTeamEmail
              ? {
                email: selectedTeamEmail,
                name: selectedTeamName
              }
              : null,
            emailType: "transactional"
          });

          emailSent = true;

          if (internalCopyRecipient.email) {
            // Start immediately after Brevo accepts the customer message, but
            // let it run alongside WhatsApp/Firestore work so it adds little
            // or no extra wait to the quotation send flow.
            teamCopyPromise = sendQuotationInternalCopy({
              leadId: lead.id,
              quotationId,
              toEmail: internalCopyRecipient.email,
              toName: internalCopyRecipient.name || selectedTeamName,
              subject,
              html: emailHtml,
              text: quotationEmailText,
              sentByUser: user
            });
          } else if (internalCopyRecipient.reason === "missing") {
            teamCopyFailure = "Concerned team member email is not available.";
          }

          await updateQuotationSentStatus({
            leadId: lead.id,
            quotationId,
            channel: "email",
            user,
            providerMessageId:
              emailResponse?.messageId || emailResponse?.result?.messageId || "",
            recipientEmail: recipient.email,
            subject
          });
        } catch (emailError) {
          emailFailure = emailError?.message || "Quotation email failed";
          await updateQuotationEmailFailure({
            leadId: lead.id,
            quotationId,
            recipientEmail: recipient.email,
            subject,
            error: emailError,
            isFinalQuotation,
            previousLeadStage: lead?.stage || "",
            previousLeadStageLabel: lead?.stageLabel || ""
          });
          console.warn("Quotation email failed; WhatsApp will still be attempted:", emailFailure);
        }
      }

      if (sendWhatsApp && hasWhatsApp) {
        const baseWhatsappMessage = buildQuotationWhatsAppMessage({
          recipientName: recipient.name || "Partner",
          recipientEmail: recipient.email || "",
          lead: communicationLead,
          revision,
          quotationData: finalQuotationData || cleanPreviewQuotationData,
          customerQuotedAmount: customerAmountNumber,
          customerQuoteCurrency,
          whatsappSignatureText,
          isFinalQuotation,
          emailAlsoSent: emailSent,
          pdfUrl: quotationPdfUrl
        });

        const whatsappMessage = [
          baseWhatsappMessage,
          quotationAssetLinksText
        ].filter(Boolean).join("\n\n");


        const whatsappOpened = sendWhatsAppWeb({
          mobile: recipient.mobile,
          message: whatsappMessage,
          targetWindow: whatsappWindow
        });

        if (whatsappOpened) {
          whatsappSent = true;
          await updateQuotationSentStatus({
            leadId: lead.id,
            quotationId,
            channel: "whatsapp",
            user
          });
        } else {
          whatsappFailure = "WhatsApp could not be opened. Please allow pop-ups and try again.";
          console.warn(whatsappFailure);
        }
      }

      if (emailSent || whatsappSent) {
        const completedChannels = [
          emailSent ? "email" : null,
          whatsappSent ? "whatsapp" : null
        ].filter(Boolean);

        const sentChannel =
          emailSent && whatsappSent
            ? "email_whatsapp"
            : emailSent
              ? "email"
              : "whatsapp";

        console.log("Quotation asset send debug", {
          selectedQuotationAssets,
          quotationAssetLinksText,
          quotationAssetLinksHtml,
          quotationId,
          revision
        });

        // Final CRM status and timeline logging are independent. Persist them
        // together so the UI does not wait for two serial Firestore writes.
        await Promise.all([
          finalizeQuotationDispatch({
            leadId: lead.id,
            quotationId,
            channels: completedChannels,
            user,
            isFinalQuotation
          }),
          logQuotationCommunication({
            leadId: lead.id,
            channel: sentChannel,
            quotationId,
            revision,
            recipient,
            signatureUser,
            user,

            customerAmountNumber,
            vendorCost,
            vendorCostNumber,
            grossProfit,
            marginPercent,
            itineraryHtml: finalItineraryHtml,
            quotationData: finalQuotationData,
            isFinalQuotation,
            quotationPricingMode,
            vendorQuoteFinalized,

            vendorCostingMode,
            selectedVendorQuotes,
            selectedVendorQuoteIds,
            totalSelectedVendorCost,

            selectedVendorName,
            selectedVendorQuoteId,
            selectedVendorRequestId,
            selectedVendorCurrency,

            selectedQuotationAssets,
            quotationAssetLinksText,
            quotationAssetLinksHtml,
            quotationPdfUrl
          })
        ]);
      }

      if (teamCopyPromise) {
        const teamCopyResult = await teamCopyPromise;
        if (!teamCopyResult?.sent && !teamCopyResult?.skipped) {
          teamCopyFailure = teamCopyResult?.error || "Internal quotation copy failed.";
        }
      }

      if (!emailSent && !whatsappSent) {
        if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
        throw new Error(
          [emailFailure, whatsappFailure].filter(Boolean).join(" | ") ||
          "Quotation was saved, but no communication channel could be completed."
        );
      }

      const partialFailures = [
        emailFailure ? `Email: ${emailFailure}` : "",
        whatsappFailure ? `WhatsApp: ${whatsappFailure}` : "",
        teamCopyFailure ? `Team copy: ${teamCopyFailure}` : ""
      ].filter(Boolean);

      if (partialFailures.length) {
        alert(`Quotation created with a partial notification issue.\n\n${partialFailures.join("\n")}`);
      }

      onClose();
    } catch (error) {
      if (whatsappWindow && !whatsappWindow.closed) {
        try {
          if (String(whatsappWindow.location?.href || "").includes("about:blank")) {
            whatsappWindow.close();
          }
        } catch {
          // Ignore cross-origin access after WhatsApp has opened.
        }
      }
      console.error("Quotation send failed:", error);
      alert(error?.message || "Failed to create quotation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
    PREVIEW VALUES
  ========================== */

  const previewSignature =
    previewSignatureUser || selectedSignatureUser || currentUserOption;

  const previewEmailSignatureHtml = previewSignature
    ? buildEmailSignatureHtml(previewSignature)
    : "";

  const previewWhatsappSignatureText = previewSignature
    ? buildWhatsAppSignatureText(previewSignature)
    : "";

  const previewAlreadyHasGreeting =
    htmlContainsGreeting(previewItineraryHtml);

  const previewEmailHtml = buildQuotationTravelAgentEmailHtml({
    recipient,
    lead: communicationLead,
    revision: draftRevision,
    itineraryHtml: [
      previewItineraryHtml || "<p>No quotation content added yet.</p>",
      quotationAssetLinksHtml
    ].filter(Boolean).join(""),
    branding: previewSignature || {},
    emailSignatureHtml: previewEmailSignatureHtml,
    itineraryAlreadyHasGreeting: previewAlreadyHasGreeting,
    pdfUrl: initialQuotation?.pdfUrl || initialQuotation?.quotationPdfUrl || ""
  });

  const basePreviewWhatsappMessage = buildQuotationWhatsAppMessage({
    recipientName: recipient.name || "Partner",
    recipientEmail: recipient.email || "",
    lead: communicationLead,
    revision: draftRevision,
    quotationData: cleanPreviewQuotationData,
    customerQuotedAmount: customerAmountNumber,
    customerQuoteCurrency,
    whatsappSignatureText: previewWhatsappSignatureText,
    isFinalQuotation,
    emailAlsoSent: sendEmail && hasEmail,
    pdfUrl: initialQuotation?.pdfUrl || initialQuotation?.quotationPdfUrl || ""
  });

  const previewWhatsappMessage = [
    basePreviewWhatsappMessage,
    quotationAssetLinksText
  ].filter(Boolean).join("\n\n");

  const handleGenerateCurrentPdf = async () => {
    const result = await generateQuotationPdf({
      quotation: {
        leadCode: lead?.leadCode || "",
        revision: draftRevision || initialQuotation?.revision || "",
        itineraryHtml: isLegacyQuotation ? (legacyHtml || "") : previewItineraryHtml,
        quotationData: isLegacyQuotation ? (initialQuotation?.quotationData || null) : cleanPreviewQuotationData,
        customerQuoteAmount: customerAmountNumber,
        customerQuoteCurrency: customerQuoteCurrency || "INR",
        createdAt: initialQuotation?.createdAt || new Date(),
        signatureUser: previewSignature || {}
      },
      lead: communicationLead
    });

    if (!result?.ok && result?.reason === "popup_blocked") {
      alert("Please allow pop-ups for this CRM to generate the quotation PDF.");
    }
  };

  const autoSaveSnapshot = useMemo(() => {
    if (isLegacyQuotation) return "";

    return JSON.stringify({
      quotationData: cleanPreviewQuotationData,
      customerQuotedAmount,
      vendorCost,
      note,
      isFinalQuotation,
      selectedSignatureUid,

      selectedQuotationAssets,
      quotationAssetLinksText,
      quotationAssetLinksHtml,

      quotationPricingMode,
      vendorQuoteFinalized,
      vendorCostingMode,
      selectedVendorQuotes,
      selectedVendorQuoteIds,
      totalSelectedVendorCost,
      selectedVendorName,
      selectedVendorQuoteId,
      selectedVendorRequestId,
      selectedVendorCurrency
    });
  }, [
    isLegacyQuotation,
    cleanPreviewQuotationData,
    customerQuotedAmount,
    vendorCost,
    note,
    isFinalQuotation,
    selectedSignatureUid,

    selectedQuotationAssets,
    quotationAssetLinksText,
    quotationAssetLinksHtml,

    quotationPricingMode,
    vendorQuoteFinalized,
    vendorCostingMode,
    selectedVendorQuotes,
    selectedVendorQuoteIds,
    totalSelectedVendorCost,
    selectedVendorName,
    selectedVendorQuoteId,
    selectedVendorRequestId,
    selectedVendorCurrency
  ]);

  useEffect(() => {
    if (!user || !lead?.id || isLegacyQuotation) return;
    if (!autoSaveSnapshot) return;

    if (autoSaveSkipFirstRunRef.current) {
      autoSaveSkipFirstRunRef.current = false;
      lastAutoSaveSnapshotRef.current = autoSaveSnapshot;
      return;
    }

    if (lastAutoSaveSnapshotRef.current === autoSaveSnapshot) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      lastAutoSaveSnapshotRef.current = autoSaveSnapshot;
      await silentAutoSaveDraft();
    }, 2500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    user,
    lead?.id,
    isLegacyQuotation,
    autoSaveSnapshot
  ]);

  const selectedSignatureName =
    getMemberName(previewSignature) ||
    getMemberName(selectedSignatureUser) ||
    "Not selected";

  const templateSections =
    activeDestinationTemplate?.sections || {};

  const currentQuotationType = quotationData.quotationType || "package";

  const packageScope =
    quotationData.packageDetails?.packageScope || DEFAULT_PACKAGE_SCOPE;

  const isPackageQuotation = currentQuotationType === "package";

  const packagePricingDisplayMode =
    quotationData.packageDetails?.pricingDisplayMode === "component_wise"
      ? "component_wise"
      : "final_only";

  const isComponentWisePackage =
    isPackageQuotation && packagePricingDisplayMode === "component_wise";

  const hasTransferInclusionRows = safeArray(
    quotationData.transferInclusions
  ).some(item => cleanString(item));

  const showPackageDetails =
    shouldShowPackageDetails(currentQuotationType);

  const showHotelSection =
    isPackageQuotation ||
    currentQuotationType === "hotel_only" ||
    (
      currentQuotationType === "custom" &&
      quotationData.packageDetails?.hotelPart?.enabled
    );

  /*
    IMPORTANT:
    Land pricing and transfer inclusions are different sections.
  
    showLandPricingSection:
    - Shows PVT / SIC pricing input cards.
    - For Package quotation, show only in component-wise mode when Land is selected.
  */
  const showLandPricingSection =
    currentQuotationType === "land_only" ||
    (
      currentQuotationType === "custom" &&
      quotationData.packageDetails?.landPart?.enabled
    ) ||
    (
      isComponentWisePackage &&
      packageScope.land
    );

  /*
    showTransferInclusionsSection:
    - Shows transfer/service inclusion text rows.
    - This is not pricing.
  */
  const showTransferInclusionsSection =
    (
      isPackageQuotation &&
      (packageScope.land || hasTransferInclusionRows)
    ) ||
    currentQuotationType === "land_only" ||
    (
      currentQuotationType === "custom" &&
      (
        quotationData.packageDetails?.landPart?.enabled ||
        hasTransferInclusionRows
      )
    );

  const showItinerarySection =
    shouldShowItinerarySection(currentQuotationType);

  const showServiceSection =
    shouldShowServiceSection(currentQuotationType) ||
    (
      isPackageQuotation &&
      (
        packageScope.visa ||
        packageScope.insurance ||
        packageScope.activity ||
        packageScope.other
      )
    );

  const showFlightSection =
    shouldShowFlightSection(currentQuotationType) ||
    (
      isPackageQuotation &&
      packageScope.flight
    );


  useEffect(() => {
    hydratedQuotationSessionRef.current = "";
    autoSaveSkipFirstRunRef.current = true;
    lastAutoSaveSnapshotRef.current = "";
    setLastAutoSavedAt(null);

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, [lead?.id]);

  /* =========================
    RENDER GUARD
  ========================= */

  if (!user || !lead) return null;

  /* =========================
    RENDER
  ========================= */

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white max-w-7xl w-full rounded-xl flex flex-col max-h-[92vh] shadow-xl">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {draftQuotationId ? "Edit Draft Quotation" : "Create Quotation"}
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                {lead.leadCode || "Lead"}{" "}
                {lead.destinationName ? `• ${lead.destinationName}` : ""}
                {draftRevision ? ` • Draft Rev ${draftRevision}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleGenerateCurrentPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <Download size={14} />
                Generate PDF
              </button>

              <span className="hidden md:inline-flex bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-full">
                Structured quotation
              </span>

              <span className="hidden md:inline-flex bg-orange-50 text-orange-700 border border-orange-100 px-2 py-1 rounded-full">
                Internal pricing hidden
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto flex-1">
            <div className="lg:col-span-8 p-5 space-y-4 border-r border-gray-100">
              <div className="flex flex-wrap gap-2">
                <TabButton
                  active={activeTab === "edit"}
                  onClick={() => setActiveTab("edit")}
                >
                  Build Quotation
                </TabButton>

                <TabButton
                  active={activeTab === "auto"}
                  onClick={() => setActiveTab("auto")}
                >
                  Auto Notes
                </TabButton>

                <TabButton
                  active={activeTab === "email"}
                  onClick={() => setActiveTab("email")}
                >
                  Email Preview
                </TabButton>

                <TabButton
                  active={activeTab === "whatsapp"}
                  onClick={() => setActiveTab("whatsapp")}
                >
                  WhatsApp Preview
                </TabButton>
              </div>

              {previewAlreadyHasGreeting && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  Greeting detected in quotation body. System greeting will not
                  be added again in email preview.
                </div>
              )}

              {isLegacyQuotation && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                  This is an older quotation without structured data. You can
                  edit the saved HTML content below, or create a new quotation
                  to use the structured builder.
                </div>
              )}

              {activeTab === "edit" && (
                <>
                  {isLegacyQuotation ? (
                    <FormSection
                      title="Legacy Quotation HTML"
                      description="Existing old quotation content. This keeps previous drafts usable."
                    >
                      <textarea
                        className={textareaClass}
                        rows={18}
                        value={legacyHtml}
                        onChange={e => setLegacyHtml(e.target.value)}
                      />
                    </FormSection>
                  ) : (
                    <>
                      <FormSection
                        title="Travel Details"
                        description="These details appear at the top of the quotation."
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500">
                              Quotation Type
                            </label>

                            <select
                              className={inputClass}
                              value={quotationData.quotationType || "package"}
                              onChange={e => updateQuotationType(e.target.value)}
                            >
                              {QUOTATION_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">
                              Destination
                            </label>
                            <input
                              className={inputClass}
                              value={
                                quotationData.travelDetails?.destinationName ||
                                ""
                              }
                              onChange={e =>
                                updateTravelDetail(
                                  "destinationName",
                                  e.target.value
                                )
                              }
                              placeholder="Bali, Indonesia"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-500">
                              Travel Month
                            </label>
                            <input
                              type="month"
                              className={inputClass}
                              value={quotationData.travelDetails?.travelMonth || ""}
                              onChange={e =>
                                updateTravelDetail(
                                  "travelMonth",
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-500">
                              Check-in
                            </label>
                            <input
                              type="date"
                              className={inputClass}
                              value={quotationData.travelDetails?.checkIn || ""}
                              onChange={e =>
                                updateTravelDetail("checkIn", e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-500">
                              Check-out
                            </label>
                            <input
                              type="date"
                              className={inputClass}
                              value={quotationData.travelDetails?.checkOut || ""}
                              onChange={e =>
                                updateTravelDetail("checkOut", e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-500">
                              No. of Nights
                            </label>

                            <input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              className={inputClass}
                              value={quotationData.travelDetails?.noOfNights || ""}
                              onChange={e =>
                                updateTravelDetail("noOfNights", e.target.value)
                              }
                              placeholder="4"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-500">
                              No. of Pax
                            </label>
                            <input
                              className={inputClass}
                              value={quotationData.travelDetails?.paxText || ""}
                              onChange={e =>
                                updateTravelDetail("paxText", e.target.value)
                              }
                              placeholder="4 Adults"
                            />
                          </div>
                        </div>
                      </FormSection>
                      {showPackageDetails && (
                        <FormSection
                          title={
                            isPackageQuotation
                              ? "Package Components & Pricing"
                              : "Package Details"
                          }
                          description={
                            isPackageQuotation
                              ? "Select what this package includes. Hotel and land pricing sections will open based on your selection."
                              : "Select Hotel Part, Land Part or both."
                          }
                        >
                          {isPackageQuotation ? (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">
                                    Selling Currency
                                  </label>

                                  <select
                                    className={inputClass}
                                    value={quotationData.packageDetails?.currency || "USD"}
                                    onChange={e => updatePackageCurrency(e.target.value)}
                                  >
                                    {CURRENCY_OPTIONS.map(currency => (
                                      <option key={currency.value} value={currency.value}>
                                        {currency.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Unit
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={quotationData.packageDetails?.unit || ""}
                                    onChange={e =>
                                      updatePackageDetail("unit", e.target.value)
                                    }
                                    placeholder="Per Person"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Basis
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={quotationData.packageDetails?.basis || ""}
                                    onChange={e =>
                                      updatePackageDetail("basis", e.target.value)
                                    }
                                    placeholder="on DBL/Twin Sharing"
                                  />
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                  Package Includes
                                </p>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {PACKAGE_COMPONENT_OPTIONS.map(component => {
                                    const selected = Boolean(
                                      quotationData.packageDetails?.packageScope?.[
                                      component.key
                                      ]
                                    );

                                    return (
                                      <button
                                        key={component.key}
                                        type="button"
                                        onClick={() => togglePackageScope(component.key)}
                                        className={`rounded-xl border px-3 py-2 text-xs font-semibold text-left transition ${selected
                                          ? "border-blue-200 bg-blue-50 text-blue-700"
                                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                          }`}
                                      >
                                        {selected ? "✓ " : ""}
                                        {component.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-700">
                                Hotel pricing, land PVT/SIC pricing, visa/service and flight
                                sections will appear below based on the selected package
                                components.
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">
                                    Currency
                                  </label>

                                  <select
                                    className={inputClass}
                                    value={quotationData.packageDetails?.currency || "USD"}
                                    onChange={e => updatePackageCurrency(e.target.value)}
                                  >
                                    {CURRENCY_OPTIONS.map(currency => (
                                      <option key={currency.value} value={currency.value}>
                                        {currency.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {[
                                  ["hotelPart", "Hotel Part"],
                                  ["landPart", "Land Part"]
                                ].map(([partKey, label]) => {
                                  const part =
                                    quotationData.packageDetails?.[partKey] || {};

                                  return (
                                    <div
                                      key={partKey}
                                      className={`rounded-2xl border p-4 space-y-3 ${part.enabled
                                        ? "border-blue-200 bg-blue-50/40"
                                        : "border-gray-200 bg-gray-50"
                                        }`}
                                    >
                                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(part.enabled)}
                                          onChange={() => togglePackagePart(partKey)}
                                          className="rounded border-gray-300"
                                        />
                                        {label}
                                      </label>

                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                          <label className="text-xs text-gray-500">
                                            Adult Cost
                                          </label>

                                          <input
                                            className={inputClass}
                                            value={part.adultCost || ""}
                                            disabled={!part.enabled}
                                            onChange={e =>
                                              updatePackagePart(
                                                partKey,
                                                "adultCost",
                                                e.target.value
                                              )
                                            }
                                            placeholder="256"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs text-gray-500">
                                            Child Cost
                                          </label>

                                          <input
                                            className={inputClass}
                                            value={part.childCost || ""}
                                            disabled={!part.enabled}
                                            onChange={e =>
                                              updatePackagePart(
                                                partKey,
                                                "childCost",
                                                e.target.value
                                              )
                                            }
                                            placeholder="180"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs text-gray-500">
                                            Unit
                                          </label>

                                          <input
                                            className={inputClass}
                                            value={part.unit || ""}
                                            disabled={!part.enabled}
                                            onChange={e =>
                                              updatePackagePart(
                                                partKey,
                                                "unit",
                                                e.target.value
                                              )
                                            }
                                            placeholder="Per Person"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs text-gray-500">
                                            Basis
                                          </label>

                                          <input
                                            className={inputClass}
                                            value={part.basis || ""}
                                            disabled={!part.enabled}
                                            onChange={e =>
                                              updatePackagePart(
                                                partKey,
                                                "basis",
                                                e.target.value
                                              )
                                            }
                                            placeholder={
                                              partKey === "hotelPart"
                                                ? "DBL/Twin Sharing"
                                                : "Land Package Basis"
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </FormSection>
                      )}

                      {currentQuotationType === "package" && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              Package Pricing Display
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Choose how pricing should appear in the customer quotation.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => updatePricingDisplayMode("final_only")}
                              className={`rounded-xl border p-3 text-left transition ${(quotationData.packageDetails?.pricingDisplayMode || "final_only") ===
                                "final_only"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                              <p className="text-sm font-semibold">
                                Final Package Price Only
                              </p>
                              <p className="text-xs mt-1">
                                Show only final adult and child package price.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => updatePricingDisplayMode("component_wise")}
                              className={`rounded-xl border p-3 text-left transition ${quotationData.packageDetails?.pricingDisplayMode === "component_wise"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                              <p className="text-sm font-semibold">
                                Show All Pricing Separately
                              </p>
                              <p className="text-xs mt-1">
                                Show hotel, land, visa/service pricing separately.
                              </p>
                            </button>
                          </div>
                        </div>
                      )}

                      {currentQuotationType === "package" &&
                        quotationData.packageDetails?.pricingDisplayMode === "component_wise" && (
                          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                Component-wise Package Pricing
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Enter separate selling price for each selected package component.
                                These prices will appear inside Package Details.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              {packageScope.hotel && (
                                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                                  <p className="text-sm font-semibold text-blue-800">
                                    Hotel Pricing
                                  </p>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Adult Cost
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.hotelPart?.adultCost || ""}
                                        onChange={e =>
                                          updatePackagePart("hotelPart", "adultCost", e.target.value)
                                        }
                                        placeholder="236"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Child Cost
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.hotelPart?.childCost || ""}
                                        onChange={e =>
                                          updatePackagePart("hotelPart", "childCost", e.target.value)
                                        }
                                        placeholder="189"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Unit
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.hotelPart?.unit || ""}
                                        onChange={e =>
                                          updatePackagePart("hotelPart", "unit", e.target.value)
                                        }
                                        placeholder="Per Person"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Basis
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.hotelPart?.basis || ""}
                                        onChange={e =>
                                          updatePackagePart("hotelPart", "basis", e.target.value)
                                        }
                                        placeholder="on DBL/Twin Sharing"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {packageScope.land && (
                                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 space-y-3">
                                  <p className="text-sm font-semibold text-red-700">
                                    Land Part Pricing
                                  </p>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Adult Cost
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.landPart?.adultCost || ""}
                                        onChange={e =>
                                          updatePackagePart("landPart", "adultCost", e.target.value)
                                        }
                                        placeholder="236"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Child Cost
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.landPart?.childCost || ""}
                                        onChange={e =>
                                          updatePackagePart("landPart", "childCost", e.target.value)
                                        }
                                        placeholder="189"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Unit
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.landPart?.unit || ""}
                                        onChange={e =>
                                          updatePackagePart("landPart", "unit", e.target.value)
                                        }
                                        placeholder="Per Person"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Basis
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={quotationData.packageDetails?.landPart?.basis || ""}
                                        onChange={e =>
                                          updatePackagePart("landPart", "basis", e.target.value)
                                        }
                                        placeholder="Land Package Basis"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {currentQuotationType === "package" &&
                        (quotationData.packageDetails?.pricingDisplayMode || "final_only") ===
                        "final_only" && (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                Final Package Price
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                This is the final customer-facing package price for the complete package.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div>
                                <label className="text-xs text-gray-500">
                                  Adult Package Cost
                                </label>

                                <input
                                  className={inputClass}
                                  value={
                                    quotationData.packageDetails?.packagePricing?.adultCost || ""
                                  }
                                  onChange={e =>
                                    updatePackagePricing("adultCost", e.target.value)
                                  }
                                  placeholder="468"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-500">
                                  Child Package Cost
                                </label>

                                <input
                                  className={inputClass}
                                  value={
                                    quotationData.packageDetails?.packagePricing?.childCost || ""
                                  }
                                  onChange={e =>
                                    updatePackagePricing("childCost", e.target.value)
                                  }
                                  placeholder="350"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-500">
                                  Unit
                                </label>

                                <input
                                  className={inputClass}
                                  value={
                                    quotationData.packageDetails?.packagePricing?.unit || ""
                                  }
                                  onChange={e =>
                                    updatePackagePricing("unit", e.target.value)
                                  }
                                  placeholder="Per Person"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-500">
                                  Basis
                                </label>

                                <input
                                  className={inputClass}
                                  value={
                                    quotationData.packageDetails?.packagePricing?.basis || ""
                                  }
                                  onChange={e =>
                                    updatePackagePricing("basis", e.target.value)
                                  }
                                  placeholder="Complete Package Price"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                      {showHotelSection && (
                        <FormSection
                          title="Hotel Inclusions"
                          description="Add hotel-wise stay details. Optional hotel prices will appear in a separate table below."
                          right={<AddButton onClick={addHotelRow}>+ Add Hotel</AddButton>}
                        >
                          {/* HOTEL LISTING ONLY */}
                          {safeArray(quotationData.hotelInclusions).map((row, index) => (
                            <div
                              key={index}
                              className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-gray-500">
                                  Hotel {index + 1}
                                </p>

                                <RemoveButton onClick={() => removeHotelRow(index)} />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">
                                    Nights
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.nights || ""}
                                    onChange={e =>
                                      updateHotelRow(index, "nights", e.target.value)
                                    }
                                    placeholder="03 Nights"
                                  />
                                </div>

                                <div className="md:col-span-2">
                                  <label className="text-xs text-gray-500">
                                    Hotel Name
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.hotelName || ""}
                                    onChange={e =>
                                      updateHotelRow(index, "hotelName", e.target.value)
                                    }
                                    placeholder="Risata Bali Resort & Spa"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Room
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.roomCategory || ""}
                                    onChange={e =>
                                      updateHotelRow(index, "roomCategory", e.target.value)
                                    }
                                    placeholder="Superior Room"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Meal
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.mealPlan || ""}
                                    onChange={e =>
                                      updateHotelRow(index, "mealPlan", e.target.value)
                                    }
                                    placeholder="Breakfast"
                                  />
                                </div>

                                <div className="md:col-span-2">
                                  <label className="text-xs text-gray-500">
                                    Location
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.location || ""}
                                    onChange={e =>
                                      updateHotelRow(index, "location", e.target.value)
                                    }
                                    placeholder="Bali / Gili / Ubud"
                                  />
                                </div>

                                <div className="md:col-span-3">
                                  <label className="text-xs text-gray-500">
                                    Remarks
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.remarks || ""}
                                    onChange={e =>
                                      updateHotelRow(index, "remarks", e.target.value)
                                    }
                                    placeholder="Subject to availability"
                                  />
                                </div>

                                <div className="md:col-span-2 flex items-center pt-5">
                                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(row.recommended)}
                                      onChange={e =>
                                        updateHotelRow(index, "recommended", e.target.checked)
                                      }
                                      className="rounded border-gray-300"
                                    />
                                    Recommended option
                                  </label>
                                </div>

                                <div className="md:col-span-5">
                                  <label className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(row.optionalForClient)}
                                      onChange={e =>
                                        updateHotelRow(index, "optionalForClient", e.target.checked)
                                      }
                                      className="rounded border-gray-300"
                                    />
                                    Add this hotel to optional pricing table
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))}

                          {!safeArray(quotationData.hotelInclusions).length && (
                            <p className="text-sm text-gray-400">
                              No hotel rows added.
                            </p>
                          )}

                          {/* SEPARATE OPTIONAL HOTEL PRICING TABLE */}
                          {safeArray(quotationData.hotelInclusions).some(
                            row => row.optionalForClient
                          ) && (
                              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 overflow-hidden">
                                <div className="px-4 py-3 border-b border-blue-100 bg-blue-50">
                                  <p className="text-sm font-semibold text-blue-800">
                                    Optional Hotel Pricing
                                  </p>

                                  <p className="text-xs text-blue-700 mt-1">
                                    Only selected optional hotels appear here. This table will show separately in quotation preview/email.
                                  </p>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="min-w-[1100px] w-full text-sm">
                                    <thead>
                                      <tr className="bg-white border-b border-blue-100">
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Option
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Hotel
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Room / Meal
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Nights
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Currency
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Adult Price
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Child Price
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Unit
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Basis
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                          Action
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody className="divide-y divide-blue-100 bg-white">
                                      {safeArray(quotationData.hotelInclusions)
                                        .map((row, originalIndex) => ({
                                          ...row,
                                          originalIndex
                                        }))
                                        .filter(row => row.optionalForClient)
                                        .map(row => (
                                          <tr key={row.originalIndex}>
                                            <td className="px-3 py-3 align-top">
                                              <div className="font-semibold text-gray-900">
                                                {row.optionLabel || `Option ${row.originalIndex + 1}`}
                                              </div>

                                              {row.recommended && (
                                                <span className="inline-flex mt-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 border border-green-100">
                                                  Recommended
                                                </span>
                                              )}
                                            </td>

                                            <td className="px-3 py-3 align-top">
                                              <p className="font-medium text-gray-900">
                                                {row.hotelName || "—"}
                                              </p>

                                              {row.location && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                  {row.location}
                                                </p>
                                              )}
                                            </td>

                                            <td className="px-3 py-3 align-top text-gray-700">
                                              <p>{row.roomCategory || "—"}</p>
                                              {row.mealPlan && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                  {row.mealPlan}
                                                </p>
                                              )}
                                            </td>

                                            <td className="px-3 py-3 align-top text-gray-700">
                                              {row.nights || "—"}
                                            </td>

                                            <td className="px-3 py-3 align-top">
                                              <select
                                                className={inputClass}
                                                value={
                                                  row.currency ||
                                                  quotationData.packageDetails?.currency ||
                                                  "USD"
                                                }
                                                onChange={e =>
                                                  updateHotelRow(
                                                    row.originalIndex,
                                                    "currency",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                {CURRENCY_OPTIONS.map(currency => (
                                                  <option key={currency.value} value={currency.value}>
                                                    {currency.value}
                                                  </option>
                                                ))}
                                              </select>
                                            </td>

                                            <td className="px-3 py-3 align-top">
                                              <input
                                                className={inputClass}
                                                value={row.adultCost || ""}
                                                onChange={e =>
                                                  updateHotelRow(
                                                    row.originalIndex,
                                                    "adultCost",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="210"
                                              />
                                            </td>

                                            <td className="px-3 py-3 align-top">
                                              <input
                                                className={inputClass}
                                                value={row.childCost || ""}
                                                onChange={e =>
                                                  updateHotelRow(
                                                    row.originalIndex,
                                                    "childCost",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="160"
                                              />
                                            </td>

                                            <td className="px-3 py-3 align-top">
                                              <input
                                                className={inputClass}
                                                value={row.unit || ""}
                                                onChange={e =>
                                                  updateHotelRow(
                                                    row.originalIndex,
                                                    "unit",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Per Person"
                                              />
                                            </td>

                                            <td className="px-3 py-3 align-top">
                                              <input
                                                className={inputClass}
                                                value={row.basis || ""}
                                                onChange={e =>
                                                  updateHotelRow(
                                                    row.originalIndex,
                                                    "basis",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="on DBL/Twin Sharing"
                                              />
                                            </td>

                                            <td className="px-3 py-3 align-top">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateHotelRow(
                                                    row.originalIndex,
                                                    "optionalForClient",
                                                    false
                                                  )
                                                }
                                                className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                                              >
                                                Remove
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                        </FormSection>
                      )}

                      {showLandPricingSection && (
                        <FormSection
                          title="Land Part Pricing"
                          description="Add PVT and/or SIC pricing for transfers, sightseeing and land arrangements."
                        >
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {/* PVT BASIS */}
                            <div
                              className={`rounded-2xl border p-4 space-y-3 ${quotationData.packageDetails?.landPricing?.pvtEnabled
                                ? "border-blue-200 bg-blue-50/40"
                                : "border-gray-200 bg-gray-50"
                                }`}
                            >
                              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    quotationData.packageDetails?.landPricing?.pvtEnabled
                                  )}
                                  onChange={() => toggleLandPricingMode("pvtEnabled")}
                                  className="rounded border-gray-300"
                                />
                                PVT Basis
                              </label>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">
                                    Currency
                                  </label>

                                  <select
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.pvt?.currency ||
                                      quotationData.packageDetails?.currency ||
                                      "USD"
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.pvtEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("pvt", "currency", e.target.value)
                                    }
                                  >
                                    {CURRENCY_OPTIONS.map(currency => (
                                      <option key={currency.value} value={currency.value}>
                                        {currency.value}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Unit
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.pvt?.unit || ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.pvtEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("pvt", "unit", e.target.value)
                                    }
                                    placeholder="Per Person"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Adult Cost
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.pvt?.adultCost ||
                                      ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.pvtEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("pvt", "adultCost", e.target.value)
                                    }
                                    placeholder="320"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Child Cost
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.pvt?.childCost ||
                                      ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.pvtEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("pvt", "childCost", e.target.value)
                                    }
                                    placeholder="250"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Basis
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.pvt?.basis || ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.pvtEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("pvt", "basis", e.target.value)
                                    }
                                    placeholder="Private Basis"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Remarks
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.pvt?.remarks || ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.pvtEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("pvt", "remarks", e.target.value)
                                    }
                                    placeholder="Vehicle, guide, timing or route notes"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* SIC BASIS */}
                            <div
                              className={`rounded-2xl border p-4 space-y-3 ${quotationData.packageDetails?.landPricing?.sicEnabled
                                ? "border-blue-200 bg-blue-50/40"
                                : "border-gray-200 bg-gray-50"
                                }`}
                            >
                              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    quotationData.packageDetails?.landPricing?.sicEnabled
                                  )}
                                  onChange={() => toggleLandPricingMode("sicEnabled")}
                                  className="rounded border-gray-300"
                                />
                                SIC Basis
                              </label>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">
                                    Currency
                                  </label>

                                  <select
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.sic?.currency ||
                                      quotationData.packageDetails?.currency ||
                                      "USD"
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.sicEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("sic", "currency", e.target.value)
                                    }
                                  >
                                    {CURRENCY_OPTIONS.map(currency => (
                                      <option key={currency.value} value={currency.value}>
                                        {currency.value}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Unit
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.sic?.unit || ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.sicEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("sic", "unit", e.target.value)
                                    }
                                    placeholder="Per Person"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Adult Cost
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.sic?.adultCost ||
                                      ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.sicEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("sic", "adultCost", e.target.value)
                                    }
                                    placeholder="95"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Child Cost
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.sic?.childCost ||
                                      ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.sicEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("sic", "childCost", e.target.value)
                                    }
                                    placeholder="70"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Basis
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.sic?.basis || ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.sicEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("sic", "basis", e.target.value)
                                    }
                                    placeholder="Seat-in-Coach Basis"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Remarks
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={
                                      quotationData.packageDetails?.landPricing?.sic?.remarks || ""
                                    }
                                    disabled={
                                      !quotationData.packageDetails?.landPricing?.sicEnabled
                                    }
                                    onChange={e =>
                                      updateLandPricing("sic", "remarks", e.target.value)
                                    }
                                    placeholder="Schedule or sharing basis notes"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </FormSection>
                      )}

                      {showServiceSection && (
                        <FormSection
                          title="Service Details"
                          description="Use this for visa assistance, insurance, documentation or any custom service quotation."
                          right={
                            <AddButton onClick={addServiceItem}>
                              + Add Service
                            </AddButton>
                          }
                        >
                          {safeArray(quotationData.serviceItems).map((row, index) => (
                            <div
                              key={index}
                              className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-gray-500">
                                  Service {index + 1}
                                </p>

                                <RemoveButton onClick={() => removeServiceItem(index)} />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">Type</label>

                                  <select
                                    className={inputClass}
                                    value={row.serviceType || "visa"}
                                    onChange={e =>
                                      updateServiceItem(index, "serviceType", e.target.value)
                                    }
                                  >
                                    <option value="visa">Visa</option>
                                    <option value="insurance">Insurance</option>
                                    <option value="documentation">Documentation</option>
                                    <option value="ticketing">Ticketing</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>

                                <div className="md:col-span-3">
                                  <label className="text-xs text-gray-500">
                                    Service Title
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.title || ""}
                                    onChange={e =>
                                      updateServiceItem(index, "title", e.target.value)
                                    }
                                    placeholder="Indonesia Visa Assistance"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Currency
                                  </label>

                                  <select
                                    className={inputClass}
                                    value={row.currency || "INR"}
                                    onChange={e =>
                                      updateServiceItem(index, "currency", e.target.value)
                                    }
                                  >
                                    {CURRENCY_OPTIONS.map(currency => (
                                      <option key={currency.value} value={currency.value}>
                                        {currency.value}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Amount
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.amount || ""}
                                    onChange={e =>
                                      updateServiceItem(index, "amount", e.target.value)
                                    }
                                    placeholder="2500"
                                  />
                                </div>

                                <div className="md:col-span-6">
                                  <label className="text-xs text-gray-500">
                                    Description
                                  </label>

                                  <textarea
                                    className={textareaClass}
                                    rows={3}
                                    value={row.description || ""}
                                    onChange={e =>
                                      updateServiceItem(index, "description", e.target.value)
                                    }
                                    placeholder="Visa documentation and assistance service."
                                  />
                                </div>

                                <div className="md:col-span-6">
                                  <label className="text-xs text-gray-500">
                                    Remarks
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.remarks || ""}
                                    onChange={e =>
                                      updateServiceItem(index, "remarks", e.target.value)
                                    }
                                    placeholder="Subject to embassy / immigration approval."
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </FormSection>
                      )}

                      {showFlightSection && (
                        <FormSection
                          title="Flight / Air Ticket Details"
                          description="Use this for flight-only or custom ticket quotation."
                          right={
                            <AddButton onClick={addFlightRow}>
                              + Add Flight
                            </AddButton>
                          }
                        >
                          {safeArray(quotationData.flightDetails).map((row, index) => (
                            <div
                              key={index}
                              className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-gray-500">
                                  Flight {index + 1}
                                </p>

                                <RemoveButton onClick={() => removeFlightRow(index)} />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                <div className="md:col-span-2">
                                  <label className="text-xs text-gray-500">
                                    Airline
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.airline || ""}
                                    onChange={e =>
                                      updateFlightRow(index, "airline", e.target.value)
                                    }
                                    placeholder="IndiGo / Air India / Singapore Airlines"
                                  />
                                </div>

                                <div className="md:col-span-4">
                                  <label className="text-xs text-gray-500">
                                    Route
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.route || ""}
                                    onChange={e =>
                                      updateFlightRow(index, "route", e.target.value)
                                    }
                                    placeholder="Mumbai - Singapore - Bali"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Departure Date
                                  </label>

                                  <input
                                    type="date"
                                    className={inputClass}
                                    value={row.departureDate || ""}
                                    onChange={e =>
                                      updateFlightRow(index, "departureDate", e.target.value)
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Return Date
                                  </label>

                                  <input
                                    type="date"
                                    className={inputClass}
                                    value={row.returnDate || ""}
                                    onChange={e =>
                                      updateFlightRow(index, "returnDate", e.target.value)
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Baggage
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.baggage || ""}
                                    onChange={e =>
                                      updateFlightRow(index, "baggage", e.target.value)
                                    }
                                    placeholder="15 KG check-in + 7 KG cabin"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Currency
                                  </label>

                                  <select
                                    className={inputClass}
                                    value={row.currency || "INR"}
                                    onChange={e =>
                                      updateFlightRow(index, "currency", e.target.value)
                                    }
                                  >
                                    {CURRENCY_OPTIONS.map(currency => (
                                      <option key={currency.value} value={currency.value}>
                                        {currency.value}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500">
                                    Fare
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.fare || ""}
                                    onChange={e =>
                                      updateFlightRow(index, "fare", e.target.value)
                                    }
                                    placeholder="42500"
                                  />
                                </div>

                                <div className="md:col-span-6">
                                  <label className="text-xs text-gray-500">
                                    Remarks
                                  </label>

                                  <input
                                    className={inputClass}
                                    value={row.remarks || ""}
                                    onChange={e =>
                                      updateFlightRow(index, "remarks", e.target.value)
                                    }
                                    placeholder="Fare subject to availability at the time of booking."
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </FormSection>
                      )}

                      {showTransferInclusionsSection && (
                        <FormSection
                          title="Transfer & Service Inclusions"
                          description="Add services that should be visible to the travel agent."
                          right={
                            <AddButton onClick={addTransferRow}>
                              + Add Inclusion
                            </AddButton>
                          }
                        >
                          {safeArray(quotationData.transferInclusions).map(
                            (item, index) => (
                              <div
                                key={index}
                                className="flex gap-2 items-start"
                              >
                                <textarea
                                  className={textareaClass}
                                  rows={2}
                                  value={item || ""}
                                  onChange={e =>
                                    updateTransferRow(index, e.target.value)
                                  }
                                  placeholder="Return airport and inter-hotel transfer by private basis."
                                />

                                <RemoveButton
                                  onClick={() => removeTransferRow(index)}
                                />
                              </div>
                            )
                          )}
                        </FormSection>
                      )}
                      {showItinerarySection && (
                        <FormSection
                          title="Itinerary"
                          description="Add day-wise itinerary details."
                          right={<AddButton onClick={addItineraryDay}>+ Add Day</AddButton>}
                        >
                          {safeArray(quotationData.itineraryDays).map(
                            (day, index) => (
                              <div
                                key={index}
                                className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold text-gray-500">
                                    Day {day.day || index + 1}
                                  </p>

                                  <RemoveButton
                                    onClick={() => removeItineraryDay(index)}
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                  <div>
                                    <label className="text-xs text-gray-500">
                                      Day
                                    </label>
                                    <input
                                      className={inputClass}
                                      value={day.day || ""}
                                      onChange={e =>
                                        updateItineraryDay(
                                          index,
                                          "day",
                                          e.target.value
                                        )
                                      }
                                      placeholder="1"
                                    />
                                  </div>

                                  <div className="md:col-span-5">
                                    <label className="text-xs text-gray-500">
                                      Title
                                    </label>
                                    <input
                                      className={inputClass}
                                      value={day.title || ""}
                                      onChange={e =>
                                        updateItineraryDay(
                                          index,
                                          "title",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Arrival in Bali"
                                    />
                                  </div>

                                  <div className="md:col-span-6">
                                    <label className="text-xs text-gray-500">
                                      Description
                                    </label>
                                    <textarea
                                      className={textareaClass}
                                      rows={3}
                                      value={day.description || ""}
                                      onChange={e =>
                                        updateItineraryDay(
                                          index,
                                          "description",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Arrival at airport followed by transfer to hotel."
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <label className="text-xs text-gray-500">
                                      Meals / Lunch
                                    </label>
                                    <input
                                      className={inputClass}
                                      value={day.meals || ""}
                                      onChange={e =>
                                        updateItineraryDay(
                                          index,
                                          "meals",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Indian menu lunch..."
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <label className="text-xs text-gray-500">
                                      Meeting Point
                                    </label>
                                    <input
                                      className={inputClass}
                                      value={day.meetingPoint || ""}
                                      onChange={e =>
                                        updateItineraryDay(
                                          index,
                                          "meetingPoint",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Pelabuhan Sanur"
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <label className="text-xs text-gray-500">
                                      Timing
                                    </label>
                                    <input
                                      className={inputClass}
                                      value={day.timing || ""}
                                      onChange={e =>
                                        updateItineraryDay(
                                          index,
                                          "timing",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Boat starts at 08:00 AM..."
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <label className="text-xs text-gray-500">
                                      Includes
                                    </label>
                                    <input
                                      className={inputClass}
                                      value={day.includes || ""}
                                      onChange={e =>
                                        updateItineraryDay(
                                          index,
                                          "includes",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Car, guide, entrance fees..."
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </FormSection>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === "auto" && (
                <FormSection
                  title="Destination-wise Auto Notes"
                  description="These sections come from predefined admin destination templates."
                >
                  {templateLoading && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                      Loading destination template...
                    </div>
                  )}

                  {templateError && (
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                      {templateError}
                    </div>
                  )}

                  {!templateLoading && !activeDestinationTemplate && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                      No predefined quotation template found for this
                      destination. You can still create the quotation, but
                      auto notes will not be added.
                    </div>
                  )}

                  {activeDestinationTemplate && (
                    <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">
                      Template loaded for{" "}
                      <b>{activeDestinationTemplate.destinationName}</b>.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    {QUOTATION_AUTO_SECTION_KEYS.map(key => {
                      const section = templateSections?.[key];
                      const enabled = Boolean(section?.enabled);
                      const selected = Boolean(
                        quotationData.selectedAutoSections?.[key]
                      );

                      return (
                        <div
                          key={key}
                          className={`rounded-2xl border p-4 ${selected
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-200"
                            } ${!enabled ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={!enabled}
                                  onChange={() => toggleAutoSection(key)}
                                  className="rounded border-gray-300"
                                />
                                {section?.title ||
                                  QUOTATION_SECTION_LABELS[key]}
                              </label>

                              <p className="text-xs text-gray-500 mt-1">
                                Type: {section?.type || "—"} · Default:{" "}
                                {section?.defaultIncluded ? "Yes" : "No"} ·{" "}
                                Status: {enabled ? "Enabled" : "Disabled"}
                              </p>
                            </div>

                            <span className="text-[11px] rounded-full bg-white border border-gray-200 px-2 py-1 text-gray-500">
                              {key}
                            </span>
                          </div>

                          {enabled && (
                            <div className="mt-3 rounded-xl bg-white border border-gray-100 p-3 text-xs text-gray-600">
                              {section?.type === "bullets" && (
                                <ul className="list-disc pl-4 space-y-1">
                                  {safeArray(section.items)
                                    .slice(0, 4)
                                    .map((item, itemIndex) => (
                                      <li key={itemIndex}>{item}</li>
                                    ))}
                                </ul>
                              )}

                              {section?.type === "table" && (
                                <p>
                                  {safeArray(section.columns).length} columns ·{" "}
                                  {safeArray(section.rows).length} rows
                                </p>
                              )}

                              {section?.type === "html" && (
                                <p>
                                  {stripHtml(section.html || "").slice(0, 180) ||
                                    "HTML content added"}
                                </p>
                              )}

                              {section?.type === "text" && (
                                <p>{section.text || "Text content added"}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </FormSection>
              )}

              {activeTab === "email" && (
                <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-white">
                    <p className="text-sm font-semibold text-gray-900">
                      Email Preview
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      This is how the quotation email body will look before
                      sending.
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-5 overflow-x-auto">
                      <div
                        className="text-sm"
                        dangerouslySetInnerHTML={{
                          __html: previewEmailHtml
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "whatsapp" && (
                <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-white">
                    <p className="text-sm font-semibold text-gray-900">
                      WhatsApp Preview
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      This text will open in WhatsApp Web.
                    </p>
                  </div>

                  <div className="p-4">
                    <pre className="bg-white border border-gray-200 rounded-lg p-4 text-sm whitespace-pre-wrap text-gray-800">
                      {previewWhatsappMessage}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 p-5 space-y-4 bg-gray-50">
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Recipient
                  </p>

                  <p className="text-xs text-gray-500">
                    Customer or travel agent contact.
                  </p>
                </div>

                <InfoRow label="Name" value={recipient.name} />
                <InfoRow
                  label="Email"
                  value={recipient.email || "Email not available"}
                />
                <InfoRow
                  label="Mobile"
                  value={recipient.mobile || "Mobile not available"}
                />
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Communication Signature
                  </p>

                  <p className="text-xs text-gray-500">
                    Pulled from profile and admin branding.
                  </p>
                </div>

                <select
                  value={selectedSignatureUid}
                  onChange={e => setSelectedSignatureUid(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select team member signature</option>

                  {signatureOptions.map(member => {
                    const uid = getMemberUid(member);

                    return (
                      <option key={uid} value={uid}>
                        {getMemberName(member)}
                        {getMemberRole(member)
                          ? ` — ${getMemberRole(member)}`
                          : ""}
                      </option>
                    );
                  })}
                </select>

                {previewSignature && (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 space-y-1">
                    <p className="font-semibold text-gray-900">
                      {getMemberName(previewSignature)}
                    </p>

                    <p>{getMemberRole(previewSignature) || "Role not set"}</p>
                    <p>{getMemberEmail(previewSignature) || "Email not set"}</p>
                    <p>
                      {getMemberMobile(previewSignature) || "Mobile not set"}
                    </p>

                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <p>
                        Branding:{" "}
                        <b>
                          {previewSignature.companyName ||
                            "DreamTrawell Destination"}
                        </b>
                      </p>

                      <p>
                        Signature:{" "}
                        <b>
                          {previewSignature.signatureEnabled === false
                            ? "Inactive"
                            : "Active"}
                        </b>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {canViewVendorCost && (
                <QuotationVendorPricingSelector
                  lead={lead}
                  mode={quotationPricingMode}
                  selectedVendorQuoteId={selectedVendorQuoteId}
                  selectedVendorQuoteIds={selectedVendorQuoteIds}
                  currentVendorName={selectedVendorName}
                  currentVendorCost={hasVendorCost ? vendorCostNumber : null}
                  currentVendorCurrency={selectedVendorCurrency}
                  vendorQuoteFinalized={vendorQuoteFinalized}
                  onModeChange={handlePricingModeChange}
                  onUseDirect={applyDirectPricing}
                  onUseManual={applyManualPricing}
                  onUseSingleQuote={applySingleVendorPrice}
                  onUseMultiQuotes={applyMultiVendorPrices}
                  onFinalizedQuote={quote =>
                    applySingleVendorPrice({
                      ...quote,
                      vendorQuoteFinalized: true,
                      selected: true,
                      isFinal: true
                    })
                  }
                />
              )}

              {vendorPricingChangedFromDraft && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                  <p className="font-semibold">
                    Vendor pricing changed from Draft Rev {draftRevision || "—"}
                  </p>
                  <p className="mt-1 leading-5">
                    The current draft will be preserved. Save Draft or Send will create the next quotation revision with this new vendor cost.
                  </p>
                </div>
              )}

              {canViewVendorCost && (selectedVendorName || hasVendorCost) && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Selected Vendor Pricing
                    </p>

                    <p className="text-xs text-gray-500">
                      Cost basis currently linked to this quotation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Vendor</span>

                      <b className="text-gray-900 text-right">
                        {selectedVendorName || "Selected Vendor"}
                      </b>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Vendor Cost</span>

                      <b className="text-gray-900">
                        {hasVendorCost
                          ? formatCurrency(vendorCostNumber)
                          : "—"}
                      </b>
                    </div>

                    {selectedVendorQuoteId && (
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Vendor Quote ID</span>

                        <b className="text-gray-900 text-right break-all">
                          {selectedVendorQuoteId}
                        </b>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Internal Commercials
                    </p>

                    <p className="text-xs text-gray-500">
                      Never sent to customer.
                    </p>
                  </div>

                  <span className="text-[11px] bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                    Internal Only
                  </span>
                </div>

                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className={inputClass}
                  placeholder="Quotation Amount (₹)"
                  value={customerQuotedAmount}
                  onChange={e => setCustomerQuotedAmount(e.target.value)}
                />

                {canViewVendorCost && (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      className={inputClass}
                      placeholder="Vendor Cost (₹)"
                      value={vendorCost}
                      readOnly={vendorCostLocked}
                      onChange={e => {
                        if (!vendorCostLocked) {
                          setVendorCost(e.target.value);
                        }
                      }}
                    />

                    {vendorCostLocked && (
                      <p className="text-[11px] text-green-700">
                        Vendor cost is controlled by the pricing selection above. Choose Manual Cost to type a value directly.
                      </p>
                    )}
                  </>
                )}

                {(customerQuotedAmount || hasVendorCost) && (
                  <div className="bg-white border border-orange-100 rounded-lg p-3 text-xs text-gray-700 space-y-2">
                    <div className="flex justify-between">
                      <span>Quote</span>
                      <b>{formatCurrency(customerAmountNumber)}</b>
                    </div>

                    {canViewVendorCost && (
                      <div className="flex justify-between">
                        <span>Vendor Cost</span>
                        <b>
                          {hasVendorCost
                            ? formatCurrency(vendorCostNumber)
                            : "—"}
                        </b>
                      </div>
                    )}

                    {canViewRevenueGp && (
                      <>
                        <div className="flex justify-between">
                          <span>Gross Profit</span>
                          <b>
                            {grossProfit === null
                              ? "—"
                              : formatCurrency(grossProfit)}
                          </b>
                        </div>

                        <div className="flex justify-between">
                          <span>Margin</span>
                          <b>
                            {marginPercent === null
                              ? "—"
                              : `${marginPercent.toFixed(1)}%`}
                          </b>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {canViewVendorCost &&
                  hasVendorCost &&
                  Number.isFinite(vendorCostNumber) &&
                  customerAmountNumber > 0 &&
                  customerAmountNumber < vendorCostNumber && (
                    <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                      Customer quotation amount is lower than vendor cost.
                      Please increase quotation amount before sending.
                    </div>
                  )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">
                  Send Settings
                </p>

                <div className="flex flex-wrap gap-2">
                  <SelectableChip
                    label="Email"
                    selected={sendEmail}
                    disabled={!hasEmail}
                    onClick={() => {
                      if (hasEmail) setSendEmail(value => !value);
                    }}
                  />

                  <SelectableChip
                    label="WhatsApp"
                    selected={sendWhatsApp}
                    disabled={!hasWhatsApp}
                    onClick={() => {
                      if (hasWhatsApp) setSendWhatsApp(value => !value);
                    }}
                  />
                </div>

                {hasEmail && hasWhatsApp && (
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    Email and WhatsApp are ON by default. The same customer-safe PDF link is included in both. WhatsApp opens as a pre-filled message; click Send in WhatsApp to deliver it.
                  </p>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={isFinalQuotation}
                    onChange={e => setIsFinalQuotation(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Mark this as final quotation
                </label>

                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="Internal note"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {!hasEmail && !hasWhatsApp && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                  Email and WhatsApp are not available for this lead. Please
                  update the customer or SPOC contact details before sending.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 p-5 border-t bg-white">
            <div className="text-xs text-gray-500 flex-1">
              Email: <b>{sendEmail ? "On" : "Off"}</b> · WhatsApp:{" "}
              <b>{sendWhatsApp ? "On" : "Off"}</b> · Final:{" "}
              <b>{isFinalQuotation ? "Yes" : "No"}</b> · Signature:{" "}
              <b>{selectedSignatureName}</b>
              {draftRevision ? (
                <>
                  {" "}· Draft: <b>Rev {draftRevision}</b>
                </>
              ) : null}
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 text-blue-600">
                    <Package size={18} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Quotation Assets
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Add package PDFs, hotel images, payment details, terms, destination images or other sales assets.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAssetPickerOpen(true)}
                  className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Select Assets
                </button>
              </div>

              {selectedQuotationAssets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-sm font-medium text-gray-700">
                    No assets selected
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected assets will be added as share links in quotation Email / WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedQuotationAssets.map(asset => (
                    <div
                      key={asset.assetId || asset.url}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {getAssetTitle(asset)}
                        </p>

                        <p className="text-xs text-gray-500 truncate">
                          {asset.categoryName || asset.assetType || "Asset"} · v
                          {asset.currentVersion || 1}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {getAssetUrl(asset) && (
                          <a
                            href={getAssetUrl(asset)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSharedAssets(prev =>
                              normalizeQuotationAssets(prev).filter(
                                item =>
                                  (item.assetId || item.url) !==
                                  (asset.assetId || asset.url)
                              )
                            );
                          }}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || savingDraft || deletingDraft}
                className="flex-1 md:flex-none border border-gray-200 rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>

              {draftQuotationId ? (
                <button
                  type="button"
                  onClick={handleDeleteCurrentDraft}
                  disabled={saving || savingDraft || deletingDraft}
                  className="flex-1 md:flex-none border border-red-200 text-red-700 bg-red-50 rounded-md px-5 py-2 text-sm disabled:opacity-60"
                >
                  {deletingDraft ? "Deleting..." : "Delete Draft"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={saveDraft}
                disabled={saving || savingDraft || deletingDraft}
                className="flex-1 md:flex-none border border-blue-200 text-blue-700 bg-blue-50 rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                {savingDraft
                  ? "Saving Draft..."
                  : draftQuotationId
                    ? "Update Draft"
                    : "Save Draft"}
              </button>

              {canSendQuotation && (
                <button
                  type="button"
                  onClick={openSendConfirmation}
                  disabled={saving || savingDraft || deletingDraft || (!hasEmail && !hasWhatsApp)}
                  className="flex-1 md:flex-none bg-blue-600 text-white rounded-md px-5 py-2 text-sm disabled:opacity-60"
                >
                  {saving
                    ? "Sending..."
                    : draftQuotationId
                      ? "Send Draft"
                      : "Send Quotation"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmSendModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        saving={saving}
        recipient={recipient}
        sendEmail={sendEmail}
        sendWhatsApp={sendWhatsApp}
        selectedSignatureName={selectedSignatureName}
        isFinalQuotation={isFinalQuotation}
        customerAmount={formatCurrency(customerAmountNumber)}
        vendorCost={
          hasVendorCost ? formatCurrency(vendorCostNumber) : "—"
        }
        grossProfit={
          grossProfit === null ? "—" : formatCurrency(grossProfit)
        }
        marginPercent={
          marginPercent === null ? "—" : `${marginPercent.toFixed(1)}%`
        }
        isDraftSend={Boolean(draftQuotationId)}
        vendorCostingMode={vendorCostingMode}
        canViewVendorCost={canViewVendorCost}
        canViewRevenueGp={canViewRevenueGp}
      />

      <AssetPickerModal
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        selectedAssets={selectedQuotationAssets}
        title="Select Quotation Assets"
        channel="quotation"
        destinationId={
          lead?.destinationRefId ||
          lead?.destinationId ||
          quotationData?.destinationId ||
          ""
        }
        onConfirm={assets => {
          setSharedAssets(normalizeQuotationAssets(assets));
        }}
      />
    </>
  );
}