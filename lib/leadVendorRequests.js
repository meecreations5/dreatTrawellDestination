// lib/leadVendorRequests.js

import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  Timestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "./firebase";

import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

import {
  LEAD_STAGES,
  getLeadStageMeta,
  isTerminalLeadStage,
  normalizeLeadStage
} from "./leadStages";

import { VENDOR_REQUEST_STATUS } from "./vendorConstants";

import { getBrandingSettings } from "./brandingSettings";
import { getUserProfileByUid } from "./userProfileRef";

import {
  buildEmailSignatureHtml,
  buildWhatsAppSignatureText,
  getMemberUid
} from "./signatureUtils";

import {
  buildVendorEmailTemplate,
  buildVendorRateRequestSubject
} from "./emailTemplates";

/* =========================
   TAT OPTIONS
========================= */

export const VENDOR_EXPECTED_TAT_OPTIONS = [
  {
    value: "urgent_2_hours",
    label: "Urgent - within 2 hours"
  },
  {
    value: "same_day",
    label: "Same day"
  },
  {
    value: "within_4_working_hours",
    label: "Within 4 working hours"
  },
  {
    value: "within_24_hours",
    label: "Within 24 hours"
  },
  {
    value: "custom",
    label: "Custom date/time"
  }
];

/* =========================
   BASIC HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function cleanArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => cleanString(item))
    .filter(Boolean);
}

function getUserName(user = {}) {
  return (
    cleanString(user?.name) ||
    cleanString(user?.displayName) ||
    cleanString(user?.fullName) ||
    cleanString(user?.employeeName) ||
    cleanString(user?.email) ||
    "System"
  );
}

function getUserEmail(user = {}) {
  return (
    cleanString(user?.email) ||
    cleanString(user?.workEmail) ||
    cleanString(user?.officialEmail)
  );
}

function getUserUid(user = {}) {
  return (
    cleanString(user?.uid) ||
    cleanString(user?.id) ||
    cleanString(user?.userId) ||
    cleanString(user?.email)
  );
}

function getVendorDisplayName(vendor = {}) {
  return (
    cleanString(vendor?.vendorName) ||
    cleanString(vendor?.name) ||
    cleanString(vendor?.agencyName) ||
    cleanString(vendor?.companyName) ||
    cleanString(vendor?.businessName) ||
    "Vendor"
  );
}

function getVendorContactPerson(vendor = {}) {
  return (
    cleanString(vendor?.contactPerson) ||
    cleanString(vendor?.contactName) ||
    cleanString(vendor?.spocName) ||
    cleanString(vendor?.ownerName)
  );
}

function getVendorEmail(vendor = {}) {
  return cleanString(
    vendor?.email ||
      vendor?.vendorEmail ||
      vendor?.contactEmail ||
      vendor?.primaryEmail ||
      vendor?.spocEmail ||
      vendor?.officialEmail ||
      vendor?.workEmail
  ).toLowerCase();
}

function getVendorMobile(vendor = {}) {
  return cleanString(
    vendor?.whatsapp ||
      vendor?.mobile ||
      vendor?.phone ||
      vendor?.contactNumber ||
      vendor?.vendorMobile
  );
}

function getLeadDestination(lead = {}) {
  return (
    cleanString(lead?.destinationName) ||
    cleanString(lead?.destination) ||
    cleanString(lead?.destinationTitle) ||
    cleanString(lead?.city) ||
    cleanString(lead?.country) ||
    "Travel Query"
  );
}

function getLeadTravelDates(lead = {}) {
  if (lead?.checkIn && lead?.checkOut) {
    return `${cleanString(lead.checkIn)} to ${cleanString(lead.checkOut)}`;
  }

  if (lead?.checkInDate && lead?.checkOutDate) {
    return `${cleanString(lead.checkInDate)} to ${cleanString(lead.checkOutDate)}`;
  }

  return (
    cleanString(lead?.travelDates) ||
    cleanString(lead?.travelDateText) ||
    cleanString(lead?.travelDate) ||
    cleanString(lead?.travelMonth) ||
    cleanString(lead?.travelPeriod) ||
    cleanString(lead?.month)
  );
}

function getLeadPaxText(lead = {}) {
  return (
    cleanString(lead?.paxText) ||
    cleanString(lead?.noOfPax) ||
    cleanString(lead?.pax) ||
    cleanString(lead?.totalPax)
  );
}

function getLeadRequirementType(lead = {}) {
  return (
    cleanString(lead?.quotationType) ||
    cleanString(lead?.packageType) ||
    cleanString(lead?.leadType) ||
    "Travel Query"
  );
}

function getReferenceContent(lead = {}) {
  return (
    cleanString(lead?.referenceContent) ||
    cleanString(lead?.reference) ||
    cleanString(lead?.notes) ||
    cleanString(lead?.remarks)
  );
}

function splitRequirementIntoServices(text = "") {
  const cleanText = cleanString(text);

  if (!cleanText) {
    return [
      "Best net rates and availability",
      "Inclusions and exclusions",
      "Cancellation policy and payment terms",
      "Important operational notes, if any"
    ];
  }

  const lines = cleanText
    .split(/\r?\n/)
    .map(item => cleanString(item))
    .filter(Boolean);

  return lines.length ? lines : [cleanText];
}

function normalizeSendVia(sendVia = []) {
  if (typeof sendVia === "string") {
    return [sendVia].filter(Boolean);
  }

  return cleanArray(sendVia);
}

function normalizeDate(value) {
  if (!value) return null;

  if (value?.toDate) return value.toDate();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeExpectedTat(value = "") {
  const cleanValue = cleanString(value);

  return VENDOR_EXPECTED_TAT_OPTIONS.some(
    option => option.value === cleanValue
  )
    ? cleanValue
    : "within_4_working_hours";
}

function getExpectedTatLabel(value = "") {
  const cleanValue = normalizeExpectedTat(value);

  return (
    VENDOR_EXPECTED_TAT_OPTIONS.find(
      option => option.value === cleanValue
    )?.label || "Within 4 working hours"
  );
}

function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function getSameDayReplyDate() {
  const now = new Date();
  const replyDate = new Date(now);

  replyDate.setHours(18, 0, 0, 0);

  if (replyDate <= now) {
    return addHours(now, 2);
  }

  return replyDate;
}

function calculateExpectedReplyBy({
  expectedTat = "",
  expectedReplyBy = null
}) {
  const customDate = normalizeDate(expectedReplyBy);
  const cleanTat = normalizeExpectedTat(expectedTat);
  const now = new Date();

  if (cleanTat === "custom") {
    return customDate;
  }

  if (cleanTat === "urgent_2_hours") {
    return addHours(now, 2);
  }

  if (cleanTat === "same_day") {
    return getSameDayReplyDate();
  }

  if (cleanTat === "within_24_hours") {
    return addHours(now, 24);
  }

  return addHours(now, 4);
}

function formatExpectedReplyByText(value) {
  const date = normalizeDate(value);

  if (!date) return "";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function buildVendorLeadReference({
  lead = {},
  leadId = ""
}) {
  const leadCode = cleanString(lead?.leadCode || lead?.code);
  const digits = leadCode.replace(/\D/g, "");

  if (digits) {
    return `DT-VR-${digits.slice(-6).padStart(4, "0")}`;
  }

  const fallbackId = cleanString(leadId || lead?.id);

  if (fallbackId) {
    return `DT-VR-${fallbackId.slice(-6).toUpperCase()}`;
  }

  return `DT-VR-${Date.now().toString().slice(-6)}`;
}

function htmlToText(html = "") {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Vendor-safe requirement text.
 * Do not include travel agent/customer identity.
 */
function buildRequirementText({
  lead,
  requirementSubject,
  requirementText,
  requirementHtml,
  travelDates = "",
  paxText = "",
  vendorLeadReference = "",
  expectedTatLabel = "",
  expectedReplyByText = ""
}) {
  const cleanText =
    cleanString(requirementText) ||
    htmlToText(requirementHtml);

  const parts = [
    requirementSubject,
    "",
    vendorLeadReference
      ? `Vendor Reference: ${vendorLeadReference}`
      : "",
    expectedTatLabel
      ? `Expected TAT: ${expectedTatLabel}`
      : "",
    expectedReplyByText
      ? `Reply Required By: ${expectedReplyByText}`
      : "",
    "",
    cleanText,
    "",
    getLeadDestination(lead)
      ? `Destination: ${getLeadDestination(lead)}`
      : "",
    travelDates
      ? `Travel Dates: ${travelDates}`
      : "",
    paxText
      ? `Pax: ${paxText}`
      : "",
    lead?.nights
      ? `Nights / Duration: ${lead.nights}`
      : "",
    lead?.hotelCategory
      ? `Hotel Category: ${lead.hotelCategory}`
      : "",
    lead?.mealPlan
      ? `Meal Plan: ${lead.mealPlan}`
      : "",
    lead?.roomRequirement
      ? `Room Requirement: ${lead.roomRequirement}`
      : "",
    "",
    "Please share your best costing, hotel options, inclusions, exclusions, payment terms and cancellation policy."
  ];

  return parts.filter(part => part !== "").join("\n");
}

/* =========================
   SIGNATURE / BRANDING
   Same pattern as sendLeadNotifications.js
========================= */

function normalizeMemberInput(member) {
  if (!member) return {};

  if (typeof member === "string") {
    return {
      uid: member,
      id: member
    };
  }

  return member;
}

function mergeSignatureUserWithProfile(signatureUser, profileData) {
  return {
    ...(signatureUser || {}),
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

async function getProfileMergedUser(member) {
  const normalizedMember = normalizeMemberInput(member);
  const uid = getMemberUid(normalizedMember);

  let profileData = {};

  try {
    if (uid) {
      const profile = await getUserProfileByUid(uid);
      profileData = profile?.data || {};
    }
  } catch (error) {
    console.warn("Vendor request user profile load skipped:", error);
  }

  return mergeSignatureUserWithProfile(
    normalizedMember,
    profileData
  );
}

async function getSignatureUserWithBranding(user) {
  const signatureUser = await getProfileMergedUser(user);

  let branding = {};

  try {
    branding = await getBrandingSettings();
  } catch (error) {
    console.warn("Vendor request branding load skipped:", error);
  }

  return {
    signatureUser,
    signatureUserWithBranding: {
      ...signatureUser,
      ...branding
    },
    branding
  };
}

/* =========================
   WHATSAPP
========================= */

function buildVendorWhatsappMessage({
  vendor,
  lead,
  requirementSubject,
  requirementText,
  requirementHtml,
  vendorLeadReference = "",
  expectedTatLabel = "",
  expectedReplyByText = "",
  travelDates = "",
  paxText = "",
  user
}) {
  const vendorGreetingName =
    getVendorContactPerson(vendor) ||
    getVendorDisplayName(vendor) ||
    "Partner";

  const bodyText = buildRequirementText({
    lead,
    requirementSubject,
    requirementText,
    requirementHtml,
    travelDates,
    paxText,
    vendorLeadReference,
    expectedTatLabel,
    expectedReplyByText
  });

  const signatureText =
    typeof buildWhatsAppSignatureText === "function"
      ? buildWhatsAppSignatureText(user)
      : "";

  return [
    `Hello ${vendorGreetingName},`,
    "",
    "Please check this travel requirement and share your best quotation.",
    "",
    bodyText,
    "",
    signatureText
  ]
    .filter(line => line !== null && line !== undefined && line !== "")
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function normalizePhoneForWhatsapp(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

function buildWhatsappUrl({ phone, message }) {
  const normalizedPhone = normalizePhoneForWhatsapp(phone);

  if (!normalizedPhone) return "";

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

/* =========================
   EMAIL SENDER
========================= */

async function sendVendorEmailViaBrevo({
  to,
  toName = "",
  cc = "",
  ccName = "",
  subject,
  html,
  text,
  replyToEmail = "",
  replyToName = ""
}) {
  const recipientEmail = cleanString(to).toLowerCase();
  const recipientName = cleanString(toName) || "Vendor";

  const ccEmail = cleanString(cc).toLowerCase();
  const cleanCcName =
    cleanString(ccName) ||
    "Dream Trawell Team";

  if (!recipientEmail) {
    return {
      skipped: true,
      status: "missing_email",
      message: "Vendor email is missing."
    };
  }

  const finalCc =
    ccEmail && ccEmail !== recipientEmail
      ? ccEmail
      : "";

  const module = await import("./sendEmailViaBrevo");

  const sendEmailViaBrevo =
    module.sendEmailViaBrevo ||
    module.default;

  if (typeof sendEmailViaBrevo !== "function") {
    throw new Error("sendEmailViaBrevo helper not found.");
  }

  return await sendEmailViaBrevo({
    toEmail: recipientEmail,
    toName: recipientName,

    recipientEmail,
    recipientName,

    to: recipientEmail,
    email: recipientEmail,

    cc: finalCc
      ? [
          {
            email: finalCc,
            name: cleanCcName
          }
        ]
      : [],

    ccEmail: finalCc,
    ccName: cleanCcName,

    ccEmails: finalCc
      ? [
          {
            email: finalCc,
            name: cleanCcName
          }
        ]
      : [],

    subject,

    html,
    htmlContent: html,
    body: html,

    text,
    textContent: text,

    replyTo: replyToEmail
      ? {
          email: replyToEmail,
          name: replyToName || replyToEmail
        }
      : null
  });
}

function getVendorTimelineType() {
  return (
    LEAD_TIMELINE_TYPES?.VENDOR_REQUEST ||
    "vendor_request"
  );
}

function getVendorFollowUpTimelineType() {
  return (
    LEAD_TIMELINE_TYPES?.VENDOR_FOLLOW_UP ||
    "vendor_follow_up"
  );
}

/* =========================
   CREATE VENDOR REQUEST
========================= */

export async function createLeadVendorRequest({
  leadId,
  vendorId,

  requirementSubject = "",
  requirementHtml = "",
  requirementText = "",

  travelDates = "",
  paxText = "",

  sendVia = ["email", "whatsapp"],

  expectedTat = "within_4_working_hours",
  expectedReplyBy = null,
  autoFollowUpFromExpectedReply = true,

  nextFollowUpAt = null,

  user
}) {
  if (!leadId) {
    throw new Error("Lead ID is required.");
  }

  if (!vendorId) {
    throw new Error("Vendor is required.");
  }

  if (!user) {
    throw new Error("User session is required.");
  }

  const cleanSubject =
    cleanString(requirementSubject) ||
    "Travel requirement for quotation";

  const cleanRequirementHtml = cleanString(requirementHtml);
  const cleanRequirementText =
    cleanString(requirementText) ||
    htmlToText(cleanRequirementHtml);

  if (!cleanRequirementHtml && !cleanRequirementText) {
    throw new Error("Requirement details are required.");
  }

  const cleanSendVia = normalizeSendVia(sendVia);

  const leadRef = doc(db, "leads", leadId);
  const vendorRef = doc(db, "vendors", vendorId);

  const [leadSnap, vendorSnap] = await Promise.all([
    getDoc(leadRef),
    getDoc(vendorRef)
  ]);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found.");
  }

  if (!vendorSnap.exists()) {
    throw new Error("Vendor not found.");
  }

  const lead = {
    id: leadSnap.id,
    ...leadSnap.data()
  };

  const vendor = {
    id: vendorSnap.id,
    vendorId: vendorSnap.id,
    ...vendorSnap.data()
  };

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const currentStage = normalizeLeadStage(
    lead.stage || LEAD_STAGES.NEW_ENQUIRY
  );

  const nextStage = isTerminalLeadStage(currentStage)
    ? currentStage
    : LEAD_STAGES.QUOTE_PENDING;

  const nextStageMeta = getLeadStageMeta(nextStage);
  const currentStageMeta = getLeadStageMeta(currentStage);

  const cleanExpectedTat = normalizeExpectedTat(expectedTat);
  const expectedTatLabel = getExpectedTatLabel(cleanExpectedTat);

  const expectedReplyDate = calculateExpectedReplyBy({
    expectedTat: cleanExpectedTat,
    expectedReplyBy
  });

  const expectedReplyByTimestamp = expectedReplyDate
    ? Timestamp.fromDate(expectedReplyDate)
    : null;

  const expectedReplyByText =
    formatExpectedReplyByText(expectedReplyDate);

  const nextFollowUpDate =
    normalizeDate(nextFollowUpAt) ||
    (autoFollowUpFromExpectedReply
      ? expectedReplyDate
      : null);

  const nextFollowUpTimestamp = nextFollowUpDate
    ? Timestamp.fromDate(nextFollowUpDate)
    : null;

  const emailRequested = cleanSendVia.includes("email");
  const whatsappRequested = cleanSendVia.includes("whatsapp");

  const vendorEmail = getVendorEmail(vendor);
  const vendorMobile = getVendorMobile(vendor);
  const vendorName = getVendorDisplayName(vendor);
  const vendorContactPerson = getVendorContactPerson(vendor);

  const vendorLeadReference = buildVendorLeadReference({
    lead,
    leadId
  });

  const finalTravelDates =
    cleanString(travelDates) || getLeadTravelDates(lead);

  const finalPaxText =
    cleanString(paxText) || getLeadPaxText(lead);

  const destinationName = getLeadDestination(lead);
  const requirementType = getLeadRequirementType(lead);

  const {
    signatureUser,
    signatureUserWithBranding,
    branding
  } = await getSignatureUserWithBranding(user);

  const signatureEnabled =
    signatureUserWithBranding?.signatureEnabled !== false;

  const emailSignatureHtml = signatureEnabled
    ? buildEmailSignatureHtml(signatureUserWithBranding)
    : "";

  const whatsappSignatureText = signatureEnabled
    ? buildWhatsAppSignatureText(signatureUserWithBranding)
    : "";

  const emailSubject = buildVendorRateRequestSubject({
    destinationName,
    leadCode: vendorLeadReference
  });

  const emailHtml = buildVendorEmailTemplate({
    branding,

    vendorName:
      vendorContactPerson ||
      vendorName ||
      "Vendor Partner",

    senderName: userName,

    leadCode: vendorLeadReference,
    destinationName,
    travelDates: finalTravelDates,
    paxText: finalPaxText,
    requirementType,

    expectedTat: cleanExpectedTat,
    expectedTatLabel,
    expectedReplyByText,

    servicesRequired: splitRequirementIntoServices(cleanRequirementText),

    requirementTitle: "Services Required",
    requirementHtml: cleanRequirementHtml,

    referenceContent: getReferenceContent(lead),

    replyDeadline:
      expectedReplyByText ||
      "at the earliest",

    emailSignatureHtml
  });

  const emailText = buildRequirementText({
    lead,
    requirementSubject: cleanSubject,
    requirementText: cleanRequirementText,
    requirementHtml: cleanRequirementHtml,
    travelDates: finalTravelDates,
    paxText: finalPaxText,
    vendorLeadReference,
    expectedTatLabel,
    expectedReplyByText
  });

  const whatsappMessage = buildVendorWhatsappMessage({
    vendor,
    lead,
    requirementSubject: cleanSubject,
    requirementText: cleanRequirementText,
    requirementHtml: cleanRequirementHtml,
    vendorLeadReference,
    expectedTatLabel,
    expectedReplyByText,
    travelDates: finalTravelDates,
    paxText: finalPaxText,
    user: {
      ...signatureUserWithBranding,
      signatureText: whatsappSignatureText
    }
  });

  const whatsappUrl = buildWhatsappUrl({
    phone: vendorMobile,
    message: whatsappMessage
  });

  let emailStatus = emailRequested ? "pending" : "not_requested";
  let emailError = "";
  let emailCc = "";
  let emailSentTo = "";

  if (emailRequested) {
    const senderEmail = cleanString(userEmail).toLowerCase();

    emailSentTo = vendorEmail;

    emailCc =
      senderEmail && senderEmail !== vendorEmail
        ? senderEmail
        : "";

    if (!vendorEmail) {
      emailStatus = "missing_email";
      emailError = "Vendor email is missing.";
    } else {
      try {
        await sendVendorEmailViaBrevo({
          to: vendorEmail,
          toName:
            vendorContactPerson ||
            vendorName ||
            "Vendor Partner",
          cc: emailCc,
          ccName: userName || "Dream Trawell Team",
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
          replyToEmail: getUserEmail(signatureUser),
          replyToName: getUserName(signatureUser)
        });

        emailStatus = "sent";
      } catch (error) {
        console.error("Vendor email send failed:", error);
        emailStatus = "failed";
        emailError = error?.message || "Email send failed.";
      }
    }
  }

  const whatsappStatus = whatsappRequested
    ? whatsappUrl
      ? "prepared"
      : "missing_number"
    : "not_requested";

  const requestPayload = {
    leadId,
    leadCode: lead.leadCode || "",
    internalLeadCode: lead.leadCode || "",
    vendorLeadReference,

    vendorId: vendor.id,
    vendorCode: vendor.vendorCode || "",
    vendorName,
    vendorType: vendor.vendorType || "",

    vendorContactPerson,
    vendorEmail,
    vendorMobile,
    vendorWhatsapp: vendor.whatsapp || "",

    destinationName,
    travelDates: finalTravelDates,
    paxText: finalPaxText,
    requirementType,

    requirementSubject: cleanSubject,
    requirementHtml: cleanRequirementHtml,
    requirementText: cleanRequirementText,

    expectedTat: cleanExpectedTat,
    expectedTatLabel,
    expectedReplyBy: expectedReplyByTimestamp,
    expectedReplyByText,
    autoFollowUpFromExpectedReply: Boolean(
      autoFollowUpFromExpectedReply
    ),

    brandingSnap: {
      companyName: branding.companyName || "",
      companyLogoUrl: branding.companyLogoUrl || "",
      websiteUrl: branding.websiteUrl || "",
      facebookUrl: branding.facebookUrl || "",
      instagramUrl: branding.instagramUrl || "",
      linkedinUrl: branding.linkedinUrl || "",
      youtubeUrl: branding.youtubeUrl || "",
      emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
      tagline: branding.tagline || ""
    },

    sendVia: cleanSendVia,

    emailStatus,
    emailError,
    emailCc,
    emailSentTo,
    emailSubject,
    emailVendorReference: vendorLeadReference,
    emailSentAt: emailStatus === "sent" ? serverTimestamp() : null,

    whatsappStatus,
    whatsappMessage,
    whatsappUrl,
    whatsappPreparedAt: whatsappRequested ? serverTimestamp() : null,

    status: VENDOR_REQUEST_STATUS.SENT,

    latestQuoteId: "",
    latestRevision: 0,
    latestVendorCost: null,
    latestQuoteStatus: "",

    followUpCount: 0,
    lastFollowUpAt: null,
    nextFollowUpAt: nextFollowUpTimestamp,
    nextActionDueAt: nextFollowUpTimestamp,
    nextActionType: nextFollowUpTimestamp ? "vendor_follow_up" : null,

    selected: false,
    rejected: false,

    sentAt: serverTimestamp(),
    sentByUid: userUid,
    sentByName: userName,
    sentByEmail: userEmail,

    createdByUid: userUid,
    createdByName: userName,
    createdByEmail: userEmail,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const requestRef = await addDoc(
    collection(db, "leads", leadId, "vendorRequests"),
    requestPayload
  );

  const leadUpdate = {
    vendorRequestCount: increment(1),

    latestVendorRequestId: requestRef.id,
    latestVendorId: vendor.id,
    latestVendorName: vendorName,
    latestVendorRequestStatus: VENDOR_REQUEST_STATUS.SENT,

    lastVendorCommunicationAt: serverTimestamp(),
    lastVendorCommunicationType: "requirement_sent",
    lastVendorCommunicationVendorId: vendor.id,
    lastVendorCommunicationVendorName: vendorName,

    lastActivityAt: serverTimestamp(),
    lastActivityType: "vendor_requirement_sent",
    lastActivitySummary: `Requirement sent to ${vendorName || "vendor"}`,

    updatedAt: serverTimestamp()
  };

  if (!isTerminalLeadStage(currentStage)) {
    leadUpdate.previousStage = currentStage;
    leadUpdate.previousStageLabel = currentStageMeta.label;
    leadUpdate.stage = nextStage;
    leadUpdate.stageLabel = nextStageMeta.label;
    leadUpdate.status = "open";
  }

  await updateDoc(leadRef, leadUpdate);

  await logLeadAction({
    leadId,
    type: getVendorTimelineType(),
    title: `Requirement sent to ${vendorName || "Vendor"}`,
    description: cleanRequirementText || cleanSubject,
    metadata: {
      action: "vendor_requirement_sent",

      leadId,
      vendorRequestId: requestRef.id,

      vendorId: vendor.id,
      vendorCode: vendor.vendorCode || "",
      vendorName,
      vendorType: vendor.vendorType || "",

      vendorLeadReference,
      internalLeadCode: lead.leadCode || "",

      destinationName,
      travelDates: finalTravelDates,
      paxText: finalPaxText,
      requirementType,

      requirementSubject: cleanSubject,
      requirementText: cleanRequirementText,
      requirementHtml: cleanRequirementHtml,

      expectedTat: cleanExpectedTat,
      expectedTatLabel,
      expectedReplyBy: expectedReplyByTimestamp,
      expectedReplyByText,

      sendVia: cleanSendVia,

      emailStatus,
      emailError,
      emailCc,
      emailSentTo,
      emailSubject,
      emailVendorReference: vendorLeadReference,

      whatsappStatus,
      whatsappUrl,
      whatsappMessage,

      oldStage: currentStage,
      oldStageLabel: currentStageMeta.label,

      newStage: nextStage,
      newStageLabel: nextStageMeta.label,

      stage: nextStage,
      stageLabel: nextStageMeta.label,

      status: VENDOR_REQUEST_STATUS.SENT,

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail
    },
    user
  });

  return {
    vendorRequestId: requestRef.id,
    vendorId: vendor.id,
    vendorName,

    vendorLeadReference,

    expectedTat: cleanExpectedTat,
    expectedTatLabel,
    expectedReplyByText,

    emailStatus,
    emailError,
    emailCc,
    emailSentTo,
    emailSubject,

    whatsappStatus,
    whatsappUrl,
    whatsappMessage,

    status: VENDOR_REQUEST_STATUS.SENT
  };
}

/* =========================
   LOG VENDOR FOLLOW-UP
========================= */

export async function logVendorFollowUp({
  leadId,
  vendorRequestId,

  channel = "call",
  outcome = "follow_up_required",
  summary = "",
  nextFollowUpAt = null,

  user
}) {
  if (!leadId) {
    throw new Error("Lead ID is required.");
  }

  if (!vendorRequestId) {
    throw new Error("Vendor request ID is required.");
  }

  if (!user) {
    throw new Error("User session is required.");
  }

  const cleanChannel = cleanString(channel) || "call";
  const cleanOutcome = cleanString(outcome) || "follow_up_required";
  const cleanSummary = cleanString(summary);

  if (!cleanSummary) {
    throw new Error("Follow-up summary is required.");
  }

  const requestRef = doc(
    db,
    "leads",
    leadId,
    "vendorRequests",
    vendorRequestId
  );

  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error("Vendor request not found.");
  }

  const request = {
    id: requestSnap.id,
    ...requestSnap.data()
  };

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const nextFollowUpDate = normalizeDate(nextFollowUpAt);
  const nextFollowUpTimestamp = nextFollowUpDate
    ? Timestamp.fromDate(nextFollowUpDate)
    : null;

  const followUpRef = await addDoc(
    collection(
      db,
      "leads",
      leadId,
      "vendorRequests",
      vendorRequestId,
      "followUps"
    ),
    {
      leadId,
      vendorRequestId,

      vendorId: request.vendorId || "",
      vendorName: request.vendorName || "",

      channel: cleanChannel,
      outcome: cleanOutcome,
      summary: cleanSummary,

      nextFollowUpAt: nextFollowUpTimestamp,
      nextActionDueAt: nextFollowUpTimestamp,
      nextActionType: nextFollowUpTimestamp ? "vendor_follow_up" : null,

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  const requestStatus =
    cleanOutcome === "quote_expected" ||
    cleanOutcome === "follow_up_required" ||
    cleanOutcome === "no_response"
      ? "follow_up_pending"
      : request.status || VENDOR_REQUEST_STATUS.SENT;

  await updateDoc(requestRef, {
    status: requestStatus,

    followUpCount: increment(1),
    lastFollowUpAt: serverTimestamp(),
    lastFollowUpChannel: cleanChannel,
    lastFollowUpOutcome: cleanOutcome,
    lastFollowUpSummary: cleanSummary,

    nextFollowUpAt: nextFollowUpTimestamp,
    nextActionDueAt: nextFollowUpTimestamp,
    nextActionType: nextFollowUpTimestamp ? "vendor_follow_up" : null,

    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "leads", leadId), {
    lastVendorFollowUpAt: serverTimestamp(),
    lastVendorFollowUpVendorId: request.vendorId || "",
    lastVendorFollowUpVendorName: request.vendorName || "",
    lastVendorFollowUpSummary: cleanSummary,

    lastActivityAt: serverTimestamp(),
    lastActivityType: "vendor_follow_up_logged",
    lastActivitySummary: `Vendor follow-up: ${request.vendorName || "Vendor"}`,

    updatedAt: serverTimestamp()
  });

  await logLeadAction({
    leadId,
    type: getVendorFollowUpTimelineType(),
    title: `Vendor follow-up - ${request.vendorName || "Vendor"}`,
    description: cleanSummary,
    metadata: {
      action: "vendor_follow_up_logged",

      leadId,
      vendorRequestId,
      vendorFollowUpId: followUpRef.id,

      vendorId: request.vendorId || "",
      vendorName: request.vendorName || "",

      channel: cleanChannel,
      outcome: cleanOutcome,
      summary: cleanSummary,

      nextFollowUpAt: nextFollowUpTimestamp,
      nextActionDueAt: nextFollowUpTimestamp,
      nextActionType: nextFollowUpTimestamp ? "vendor_follow_up" : null,

      status: requestStatus,

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail
    },
    user
  });

  return {
    vendorFollowUpId: followUpRef.id,
    vendorRequestId,
    status: requestStatus
  };
}

/* =========================
   MARK WHATSAPP OPENED
========================= */

export async function markVendorWhatsappOpened({
  leadId,
  vendorRequestId
}) {
  if (!leadId || !vendorRequestId) return;

  const requestRef = doc(
    db,
    "leads",
    leadId,
    "vendorRequests",
    vendorRequestId
  );

  await updateDoc(requestRef, {
    whatsappStatus: "opened",
    whatsappOpenedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export default createLeadVendorRequest;