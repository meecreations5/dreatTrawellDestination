// components/leads/QuotationEditor.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
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

import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { sendWhatsAppWeb } from "@/lib/whatsapp";
import { createQuotationRevision } from "@/lib/createQuotationRevision";
import { saveQuotationDraft } from "@/lib/saveQuotationDraft";

import { getCommunicationSettings } from "@/lib/communicationSettings";
import { getBrandingSettings } from "@/lib/brandingSettings";
import { getUserProfileByUid } from "@/lib/userProfileRef";
import { buildTravelAgentQuotationEmailTemplate } from "@/lib/emailTemplates";

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

/* =========================
   BASIC HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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
  itineraryAlreadyHasGreeting
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

    emailSignatureHtml,
    itineraryAlreadyHasGreeting
  });
}

function stripHtml(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, "")
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
    initialQuotation?.selectedVendorCost ??
    initialQuotation?.vendorCost ??
    initialQuotation?.metadata?.vendorCost ??
    lead?.selectedVendorCost ??
    lead?.finalVendorCost ??
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

  return {
    quotationPricingMode,
    vendorQuoteFinalized,
    selectedVendorCost,
    selectedVendorCurrency,
    selectedVendorName,
    selectedVendorQuoteId,
    selectedVendorRequestId,
    customerQuoteAmount
  };
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
      paxText: travelDefaults.paxText
    },

    packageDetails: {
      currency: currency || "USD",
      hotelPart: {
        enabled: true,
        amount: "",
        unit: "Per Person",
        basis: "on DBL/Twin Sharing"
      },
      landPart: {
        enabled: true,
        amount: "",
        unit: "Per Adult",
        basis: ""
      }
    },

    hotelInclusions: [
      {
        nights: "",
        hotelName: "",
        roomCategory: "",
        mealPlan: "Breakfast",
        location: ""
      }
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
      hotelPart: {
        ...defaults.packageDetails.hotelPart,
        ...(saved.packageDetails?.hotelPart || {})
      },
      landPart: {
        ...defaults.packageDetails.landPart,
        ...(saved.packageDetails?.landPart || {})
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
    .map(row => ({
      nights: cleanString(row?.nights),
      hotelName: cleanString(row?.hotelName),
      roomCategory: cleanString(row?.roomCategory),
      mealPlan: cleanString(row?.mealPlan),
      location: cleanString(row?.location)
    }))
    .filter(
      row =>
        row.nights ||
        row.hotelName ||
        row.roomCategory ||
        row.location
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
    .filter(
      row =>
        row.serviceType ||
        row.title ||
        row.description ||
        row.amount ||
        row.remarks
    );
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

  return {
    leadCode: source.leadCode || lead?.leadCode || "",

    quotationType: source.quotationType || "package",

    travelDetails: {
      destinationName: cleanString(source.travelDetails?.destinationName),
      travelMonth: cleanString(source.travelDetails?.travelMonth),
      checkIn: cleanString(source.travelDetails?.checkIn),
      checkOut: cleanString(source.travelDetails?.checkOut),
      paxText: cleanString(source.travelDetails?.paxText)
    },

    packageDetails: {
      currency: cleanString(source.packageDetails?.currency) || "USD",
      hotelPart: {
        enabled: Boolean(source.packageDetails?.hotelPart?.enabled),
        amount: cleanString(source.packageDetails?.hotelPart?.amount),
        unit: cleanString(source.packageDetails?.hotelPart?.unit),
        basis: cleanString(source.packageDetails?.hotelPart?.basis)
      },
      landPart: {
        enabled: Boolean(source.packageDetails?.landPart?.enabled),
        amount: cleanString(source.packageDetails?.landPart?.amount),
        unit: cleanString(source.packageDetails?.landPart?.unit),
        basis: cleanString(source.packageDetails?.landPart?.basis)
      }
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
  user
}) {
  if (!leadId || !quotationId || !channel) return;

  try {
    await updateDoc(
      doc(db, "leads", leadId, "quotations", quotationId),
      {
        sentVia: arrayUnion(channel),
        updatedAt: serverTimestamp(),

        ...(channel === "email"
          ? {
            emailSentAt: serverTimestamp(),
            emailSentByUid: user?.uid || "",
            emailSentByName:
              user?.displayName || user?.name || user?.email || ""
          }
          : {}),

        ...(channel === "whatsapp"
          ? {
            whatsappSentAt: serverTimestamp(),
            whatsappSentByUid: user?.uid || "",
            whatsappSentByName:
              user?.displayName || user?.name || user?.email || ""
          }
          : {})
      }
    );
  } catch (error) {
    console.warn("Quotation sent status update skipped:", error);
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

  selectedVendorName,
  selectedVendorQuoteId,
  selectedVendorRequestId,
  selectedVendorCurrency
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
        revision: revision || "",

        itineraryHtml: itineraryHtml || "",
        quotationData: quotationData || null,

        quotationPricingMode,
        vendorQuoteFinalized,
        totalAmount: customerAmountNumber,
        customerQuotedAmount: customerAmountNumber,
        customerQuoteAmount: customerAmountNumber,
        customerQuoteCurrency: selectedVendorCurrency || "INR",

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
  isDraftSend
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

              <div>
                <span className="text-gray-500">Vendor Cost</span>
                <p className="font-semibold text-gray-900">{vendorCost}</p>
              </div>

              <div>
                <span className="text-gray-500">Gross Profit</span>
                <p className="font-semibold text-gray-900">{grossProfit}</p>
              </div>

              <div>
                <span className="text-gray-500">Margin</span>
                <p className="font-semibold text-gray-900">{marginPercent}</p>
              </div>
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
  const [draftQuotationId, setDraftQuotationId] = useState("");
  const [draftRevision, setDraftRevision] = useState(null);

  const initialPricingSnapshot = useMemo(() => {
    return getInitialPricingSnapshot(initialQuotation, lead);
  }, [initialQuotation, lead]);

  const selectedVendorName = initialPricingSnapshot.selectedVendorName;
  const selectedVendorQuoteId = initialPricingSnapshot.selectedVendorQuoteId;
  const selectedVendorRequestId =
    initialPricingSnapshot.selectedVendorRequestId;

  const selectedVendorCurrency =
    initialPricingSnapshot.selectedVendorCurrency || "INR";

  const quotationPricingMode =
    initialPricingSnapshot.quotationPricingMode || "direct";

  const vendorQuoteFinalized =
    Boolean(initialPricingSnapshot.vendorQuoteFinalized);

  const vendorCostLocked = Boolean(
    selectedVendorQuoteId ||
    selectedVendorRequestId ||
    selectedVendorName
  );

  const recipient = useMemo(() => {
    const name = getFirstValue(
      lead?.spoc?.name,
      lead?.customerName,
      lead?.travellerName,
      lead?.guestName,
      lead?.contactName,
      lead?.customer?.name
    );

    const email = getFirstValue(
      lead?.spoc?.email,
      lead?.email,
      lead?.customerEmail,
      lead?.customer?.email
    );

    const mobile = getFirstValue(
      lead?.spoc?.mobile,
      lead?.mobile,
      lead?.phone,
      lead?.contactNumber,
      lead?.customerMobile,
      lead?.customer?.mobile
    );

    return { name, email, mobile };
  }, [lead]);

  const [sendEmail, setSendEmail] = useState(Boolean(recipient.email));
  const [sendWhatsApp, setSendWhatsApp] = useState(
    !recipient.email && Boolean(recipient.mobile)
  );

  useEffect(() => {
    setSendEmail(Boolean(recipient.email));
    setSendWhatsApp(!recipient.email && Boolean(recipient.mobile));
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

    const assignedUid = getFirstValue(
      lead?.assignedTo,
      lead?.assignedToUid,
      lead?.teamLeadUid,
      lead?.ownerUid
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
  ========================== */

  useEffect(() => {
    const pricing = getInitialPricingSnapshot(initialQuotation, lead);

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

    setActiveTab("edit");
  }, [initialQuotation, lead]);

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

  if (!user || !lead) return null;

  const hasEmail = Boolean(recipient.email);
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


  function shouldShowPackageDetails(type) {
    return ["package", "hotel_only", "land_only", "custom"].includes(type);
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
    setQuotationData(prev => ({
      ...prev,
      travelDetails: {
        ...(prev.travelDetails || {}),
        [key]: value
      },
      ...(key === "destinationName"
        ? {
          destinationTemplateId: "",
          destinationTemplateSnapshot: null,
          selectedAutoSections: {}
        }
        : {})
    }));
  };

  const updatePackageCurrency = value => {
    setQuotationData(prev => ({
      ...prev,
      packageDetails: {
        ...(prev.packageDetails || {}),
        currency: value
      }
    }));
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

  const addHotelRow = () => {
    setQuotationData(prev => ({
      ...prev,
      hotelInclusions: [
        ...safeArray(prev.hotelInclusions),
        {
          nights: "",
          hotelName: "",
          roomCategory: "",
          mealPlan: "Breakfast",
          location: ""
        }
      ]
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

    const hotelPart = cleanData.packageDetails?.hotelPart;
    const landPart = cleanData.packageDetails?.landPart;

    if (["package", "hotel_only", "land_only"].includes(quotationType)) {
      if (!hotelPart?.enabled && !landPart?.enabled) {
        alert("Select at least one quotation component");
        return false;
      }

      if (hotelPart?.enabled && !hotelPart?.amount) {
        alert("Hotel Part amount is required");
        return false;
      }

      if (landPart?.enabled && !landPart?.amount) {
        alert("Land Part amount is required");
        return false;
      }
    }

    if (
      shouldShowHotelSection(quotationType) &&
      hotelPart?.enabled &&
      !cleanData.hotelInclusions?.length
    ) {
      alert("At least one hotel detail is required");
      return false;
    }

    if (
      shouldShowItinerarySection(quotationType) &&
      quotationType !== "hotel_only" &&
      !cleanData.itineraryDays?.length
    ) {
      alert("At least one itinerary day is required");
      return false;
    }

    if (
      shouldShowServiceSection(quotationType) &&
      !cleanData.serviceItems?.length
    ) {
      alert("At least one service item is required");
      return false;
    }

    if (
      shouldShowFlightSection(quotationType) &&
      !cleanData.flightDetails?.length
    ) {
      alert("At least one flight detail is required");
      return false;
    }

    if (quotationType === "custom") {
      const hasAnyCustomContent =
        cleanData.hotelInclusions?.length ||
        cleanData.transferInclusions?.length ||
        cleanData.itineraryDays?.length ||
        cleanData.serviceItems?.length ||
        cleanData.flightDetails?.length;

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

  /* =========================
     SAVE DRAFT
  ========================== */

  const saveDraft = async () => {
    if (saving || savingDraft) return;
    if (!validateStructuredQuotation()) return;

    const selectedSignatureBaseUser =
      selectedSignatureUser || currentUserOption;

    const selectedUid = getMemberUid(selectedSignatureBaseUser);

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

      const result = await saveQuotationDraft({
        leadId: lead.id,

        quotationId: draftQuotationId,
        revision: draftRevision,

        itineraryHtml: finalItineraryHtml,
        quotationData: finalQuotationData,

        customerQuotedAmount: customerAmountNumber || 0,
        customerQuoteAmount: customerAmountNumber || 0,
        customerQuoteCurrency: selectedVendorCurrency,

        vendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCurrency,
        selectedVendorName,
        selectedVendorQuoteId,
        selectedVendorRequestId,
        quotationPricingMode,
        vendorQuoteFinalized,
        grossProfit,
        marginPercent:
          marginPercent === null ? null : Number(marginPercent.toFixed(2)),

        pricingVisibleToCustomer: false,

        note,

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

      setDraftQuotationId(result.quotationId || "");
      setDraftRevision(result.revision || null);

      alert(
        result.revision
          ? `Draft saved successfully - Rev ${result.revision}`
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

    const finalStatus = isFinalQuotation ? "final" : "sent";

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
        customerQuoteCurrency: selectedVendorCurrency,

        vendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCost: hasVendorCost ? vendorCostNumber : null,
        selectedVendorCurrency,
        selectedVendorName,
        selectedVendorQuoteId,
        selectedVendorRequestId,
        quotationPricingMode,
        vendorQuoteFinalized,
        grossProfit,
        marginPercent:
          marginPercent === null
            ? null
            : Number(marginPercent.toFixed(2)),
        pricingVisibleToCustomer: false,

        note,
        sendVia,
        sentVia: sendVia,

        signatureUser: signaturePayload,

        sentAt: serverTimestamp(),
        sentByUid: user?.uid || "",
        sentByName: user?.displayName || user?.name || user?.email || "",

        updatedAt: serverTimestamp()
      }
    );

    await updateDoc(doc(db, "leads", lead.id), {
      latestQuotationId: quotationId,
      latestQuotationRevision: safeRevision,
      latestQuotationStatus: finalStatus,

      latestQuotationAmount: customerAmountNumber,
      latestCustomerQuoteCurrency: selectedVendorCurrency,

      latestVendorCost: hasVendorCost ? vendorCostNumber : null,
      latestSelectedVendorName: selectedVendorName,
      latestSelectedVendorQuoteId: selectedVendorQuoteId,
      latestSelectedVendorRequestId: selectedVendorRequestId,
      quotationPricingMode,
      vendorQuoteFinalized,

      latestGrossProfit: grossProfit,
      latestMarginPercent:
        marginPercent === null
          ? null
          : Number(marginPercent.toFixed(2)),

      stage: "quote_sent",
      stageLabel: "Quote sent",
      updatedAt: serverTimestamp(),

      ...(isFinalQuotation
        ? {
          finalQuotationId: quotationId,
          finalQuotationRevision: safeRevision,
          finalQuotationAmount: customerAmountNumber,
          finalCustomerQuoteCurrency: selectedVendorCurrency,

          finalVendorCost: hasVendorCost ? vendorCostNumber : null,
          finalSelectedVendorName: selectedVendorName,
          finalSelectedVendorQuoteId: selectedVendorQuoteId,
          finalSelectedVendorRequestId: selectedVendorRequestId,

          finalGrossProfit: grossProfit,
          finalMarginPercent:
            marginPercent === null
              ? null
              : Number(marginPercent.toFixed(2)),
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

  const openSendConfirmation = () => {
    if (saving || savingDraft) return;
    if (!validateBeforeSend()) return;
    setConfirmOpen(true);
  };

  /* =========================
     SEND QUOTATION
  ========================== */

  const submit = async () => {
    if (saving) return;
    if (!validateBeforeSend()) return;

    const selectedSignatureBaseUser =
      selectedSignatureUser || currentUserOption;

    const selectedUid = getMemberUid(selectedSignatureBaseUser);

    if (!selectedUid) {
      alert("Please select team member signature");
      return;
    }

    setSaving(true);

    try {
      setConfirmOpen(false);

      let profileSignatureData = {};

      try {
        const profile = await getUserProfileByUid(selectedUid);
        profileSignatureData = profile?.data || {};
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

      if (draftQuotationId) {
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
          customerQuoteCurrency: selectedVendorCurrency,
          quotationPricingMode,
          vendorQuoteFinalized,

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

      const revision =
        typeof quotationResult === "object"
          ? quotationResult?.revision
          : quotationResult;

      const quotationId =
        typeof quotationResult === "object"
          ? quotationResult?.quotationId || quotationResult?.id || ""
          : "";

      const subject = `Your Travel Quotation Is Ready - ${lead.leadCode || ""
        }${revision ? ` / Rev ${revision}` : ""}`;

      const itineraryAlreadyHasGreeting =
        htmlContainsGreeting(finalItineraryHtml);

      const emailHtml = buildQuotationTravelAgentEmailHtml({
        recipient,
        lead,
        revision,
        itineraryHtml: finalItineraryHtml,
        branding,
        emailSignatureHtml,
        itineraryAlreadyHasGreeting
      });

      let communicationSettings = {
        quotationManagementBcc: [],
        quotationCcSelectedTeamMember: true,
        quotationBccManagement: false
      };

      try {
        communicationSettings = await getCommunicationSettings();
      } catch (error) {
        console.warn("Communication settings not found:", error);
      }

      const selectedTeamEmail = getMemberEmail(signatureUser);
      const selectedTeamName = getMemberName(signatureUser);

      const cc = [];

      if (
        sendEmail &&
        communicationSettings.quotationCcSelectedTeamMember &&
        selectedTeamEmail
      ) {
        cc.push({
          email: selectedTeamEmail,
          name: selectedTeamName
        });
      }

      const bcc =
        sendEmail && communicationSettings.quotationBccManagement
          ? (communicationSettings.quotationManagementBcc || []).map(email => ({
            email
          }))
          : [];

      let emailSent = false;
      let whatsappSent = false;

      if (sendEmail && hasEmail) {
        await sendEmailViaBrevo({
          toEmail: recipient.email,
          toName: recipient.name || "Guest",
          subject,
          html: emailHtml,
          cc,
          bcc,
          replyTo: selectedTeamEmail
            ? {
              email: selectedTeamEmail,
              name: selectedTeamName
            }
            : null
        });

        emailSent = true;

        await updateQuotationSentStatus({
          leadId: lead.id,
          quotationId,
          channel: "email",
          user
        });
      }

      if (sendWhatsApp && hasWhatsApp) {
        const whatsappMessage = [
          `Dear ${recipient.name || "Guest"},`,
          "",
          "Thank you for choosing DreamTrawell Destination.",
          "",
          `Your quotation for ${lead.destinationName || "your travel enquiry"
          } has been prepared.`,
          lead.leadCode || revision
            ? `Quotation Ref: ${[
              lead.leadCode || "",
              revision ? `Rev ${revision}` : ""
            ]
              .filter(Boolean)
              .join(" / ")}`
            : "",
          "",
          "Please review the itinerary details shared with you and let us know if you would like any changes.",
          "",
          whatsappSignatureText
        ]
          .filter(Boolean)
          .join("\n");

        sendWhatsAppWeb({
          mobile: recipient.mobile,
          message: whatsappMessage
        });

        whatsappSent = true;

        await updateQuotationSentStatus({
          leadId: lead.id,
          quotationId,
          channel: "whatsapp",
          user
        });
      }

      if (emailSent || whatsappSent) {
        const sentChannel =
          emailSent && whatsappSent
            ? "email_whatsapp"
            : emailSent
              ? "email"
              : "whatsapp";

        await logQuotationCommunication({
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

          selectedVendorName,
          selectedVendorQuoteId,
          selectedVendorRequestId,
          selectedVendorCurrency
        });
      }

      onClose();
    } catch (error) {
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
    lead,
    revision: draftRevision,
    itineraryHtml:
      previewItineraryHtml || "<p>No quotation content added yet.</p>",
    branding: previewSignature || {},
    emailSignatureHtml: previewEmailSignatureHtml,
    itineraryAlreadyHasGreeting: previewAlreadyHasGreeting
  });

  const previewWhatsappMessage = [
    `Dear ${recipient.name || "Guest"},`,
    "",
    "Thank you for choosing DreamTrawell Destination.",
    "",
    `Your quotation for ${lead.destinationName || "your travel enquiry"
    } has been prepared.`,
    lead.leadCode ? `Quotation Ref: ${lead.leadCode}` : "",
    "",
    "Please review the itinerary details shared with you and let us know if you would like any changes.",
    "",
    previewWhatsappSignatureText
  ]
    .filter(Boolean)
    .join("\n");

  const selectedSignatureName =
    getMemberName(previewSignature) ||
    getMemberName(selectedSignatureUser) ||
    "Not selected";

  const templateSections =
    activeDestinationTemplate?.sections || {};

  const currentQuotationType = quotationData.quotationType || "package";

  const showPackageDetails =
    shouldShowPackageDetails(currentQuotationType);

  const showHotelSection =
    shouldShowHotelSection(currentQuotationType) &&
    quotationData.packageDetails?.hotelPart?.enabled;

  const showTransferSection =
    shouldShowTransferSection(currentQuotationType) &&
    quotationData.packageDetails?.landPart?.enabled;

  const showItinerarySection =
    shouldShowItinerarySection(currentQuotationType);

  const showServiceSection =
    shouldShowServiceSection(currentQuotationType);

  const showFlightSection =
    shouldShowFlightSection(currentQuotationType);

  /* =========================
     RENDER
  ========================== */

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

            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-full">
                Structured quotation
              </span>

              <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-1 rounded-full">
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
                          title="Package Details"
                          description="Select Hotel Part, Land Part or both."
                        >
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
                                      onChange={() =>
                                        togglePackagePart(partKey)
                                      }
                                      className="rounded border-gray-300"
                                    />
                                    {label}
                                  </label>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="text-xs text-gray-500">
                                        Amount
                                      </label>
                                      <input
                                        className={inputClass}
                                        value={part.amount || ""}
                                        disabled={!part.enabled}
                                        onChange={e =>
                                          updatePackagePart(
                                            partKey,
                                            "amount",
                                            e.target.value
                                          )
                                        }
                                        placeholder="256"
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
                                        placeholder="DBL/Twin Sharing"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </FormSection>
                      )}

                      {showHotelSection && (
                        <FormSection
                          title="Hotel Inclusions"
                          description="Add hotel-wise stay details."
                          right={<AddButton onClick={addHotelRow}>+ Add Hotel</AddButton>}
                        >
                          {safeArray(quotationData.hotelInclusions).map(
                            (row, index) => (
                              <div
                                key={index}
                                className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold text-gray-500">
                                    Hotel {index + 1}
                                  </p>

                                  <RemoveButton
                                    onClick={() => removeHotelRow(index)}
                                  />
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
                                        updateHotelRow(
                                          index,
                                          "nights",
                                          e.target.value
                                        )
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
                                        updateHotelRow(
                                          index,
                                          "hotelName",
                                          e.target.value
                                        )
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
                                        updateHotelRow(
                                          index,
                                          "roomCategory",
                                          e.target.value
                                        )
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
                                        updateHotelRow(
                                          index,
                                          "mealPlan",
                                          e.target.value
                                        )
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
                                        updateHotelRow(
                                          index,
                                          "location",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Bali / Gili / Ubud"
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          )}

                          {!safeArray(quotationData.hotelInclusions).length && (
                            <p className="text-sm text-gray-400">
                              No hotel rows added.
                            </p>
                          )}
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

                      {showTransferSection && (
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

              {(selectedVendorName || hasVendorCost) && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Final Vendor Pricing
                    </p>

                    <p className="text-xs text-gray-500">
                      Pulled from selected vendor quote.
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
                    Vendor cost is locked from final selected vendor quote.
                  </p>
                )}

                {(customerQuotedAmount || hasVendorCost) && (
                  <div className="bg-white border border-orange-100 rounded-lg p-3 text-xs text-gray-700 space-y-2">
                    <div className="flex justify-between">
                      <span>Quote</span>
                      <b>{formatCurrency(customerAmountNumber)}</b>
                    </div>

                    <div className="flex justify-between">
                      <span>Vendor Cost</span>
                      <b>
                        {hasVendorCost
                          ? formatCurrency(vendorCostNumber)
                          : "—"}
                      </b>
                    </div>

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
                  </div>
                )}

                {hasVendorCost &&
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

            <div className="flex gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || savingDraft}
                className="flex-1 md:flex-none border border-gray-200 rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveDraft}
                disabled={saving || savingDraft}
                className="flex-1 md:flex-none border border-blue-200 text-blue-700 bg-blue-50 rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                {savingDraft
                  ? "Saving Draft..."
                  : draftQuotationId
                    ? "Update Draft"
                    : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={openSendConfirmation}
                disabled={saving || savingDraft || (!hasEmail && !hasWhatsApp)}
                className="flex-1 md:flex-none bg-blue-600 text-white rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                {saving
                  ? "Sending..."
                  : draftQuotationId
                    ? "Send Draft"
                    : "Send Quotation"}
              </button>
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
      />
    </>
  );
}