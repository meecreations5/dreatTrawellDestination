// lib/sendVendorEmail.js

import {
  buildVendorEmailTemplate,
  buildVendorRateRequestSubject
} from "./emailTemplates";

import { sendEmailViaBrevo } from "./sendEmailViaBrevo";
import { getFirstValue } from "./signatureUtils";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function cleanEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(email));
}

function getVendorName(vendor = {}) {
  return getFirstValue(
    vendor?.name,
    vendor?.vendorName,
    vendor?.companyName,
    vendor?.businessName,
    vendor?.displayName,
    "Vendor Partner"
  );
}

function getVendorEmail(vendor = {}) {
  return cleanEmail(
    getFirstValue(
      vendor?.email,
      vendor?.vendorEmail,
      vendor?.contactEmail,
      vendor?.primaryEmail,
      vendor?.spocEmail,
      vendor?.officialEmail,
      vendor?.workEmail
    )
  );
}

function getLeadDestination(lead = {}) {
  return getFirstValue(
    lead?.destinationName,
    lead?.destination,
    lead?.destinationTitle,
    lead?.city,
    lead?.country,
    "Travel Query"
  );
}

function getTravelDates(lead = {}) {
  return getFirstValue(
    lead?.travelDates,
    lead?.travelDateText,
    lead?.travelMonth,
    lead?.month,
    lead?.travelPeriod,
    lead?.checkInDate && lead?.checkOutDate
      ? `${lead.checkInDate} to ${lead.checkOutDate}`
      : "",
    lead?.checkIn && lead?.checkOut
      ? `${lead.checkIn} to ${lead.checkOut}`
      : ""
  );
}

function getPaxText(lead = {}) {
  return getFirstValue(
    lead?.paxText,
    lead?.noOfPax,
    lead?.pax,
    lead?.totalPax
  );
}

function getRequirementType(lead = {}, vendorRequest = {}) {
  return getFirstValue(
    vendorRequest?.requirementType,
    vendorRequest?.serviceType,
    lead?.quotationType,
    lead?.packageType,
    lead?.leadType,
    "Travel Query"
  );
}

function getSenderName(user = {}) {
  return getFirstValue(
    user?.displayName,
    user?.name,
    user?.fullName,
    user?.email,
    "Team Dream Trawell"
  );
}

function getServicesRequired(vendorRequest = {}, lead = {}) {
  const fromRequest = vendorRequest?.servicesRequired;

  if (Array.isArray(fromRequest) && fromRequest.length) {
    return fromRequest.map(cleanString).filter(Boolean);
  }

  const serviceText = getFirstValue(
    vendorRequest?.servicesText,
    vendorRequest?.requirement,
    vendorRequest?.requirementText,
    lead?.requirement,
    lead?.serviceRequired
  );

  if (serviceText) {
    return serviceText
      .split(/\r?\n|,/)
      .map(cleanString)
      .filter(Boolean);
  }

  return [
    "Best net rates and availability",
    "Inclusions and exclusions",
    "Cancellation policy and payment terms",
    "Important operational notes, if any"
  ];
}

/* =========================
   MAIN SEND FUNCTION
========================= */

export async function sendVendorEmail({
  vendor = {},
  lead = {},
  vendorRequest = {},
  user = {},
  branding = {},
  signatureHtml = "",
  cc = [],
  bcc = []
}) {
  const vendorEmail = getVendorEmail(vendor);
  const vendorName = getVendorName(vendor);

  if (!vendorEmail || !isValidEmail(vendorEmail)) {
    throw new Error("Vendor email is missing or invalid.");
  }

  const destinationName = getLeadDestination(lead);
  const leadCode = getFirstValue(lead?.leadCode, lead?.code, lead?.id);

  const subject = buildVendorRateRequestSubject({
    destinationName,
    leadCode
  });

  const html = buildVendorEmailTemplate({
    branding,

    vendorName,
    senderName: getSenderName(user),

    leadCode,
    destinationName,
    travelDates: getTravelDates(lead),
    paxText: getPaxText(lead),
    requirementType: getRequirementType(lead, vendorRequest),

    servicesRequired: getServicesRequired(vendorRequest, lead),

    referenceContent: getFirstValue(
      vendorRequest?.referenceContent,
      vendorRequest?.reference,
      lead?.referenceContent,
      lead?.notes,
      lead?.remarks
    ),

    specialNotes: getFirstValue(
      vendorRequest?.specialNotes,
      vendorRequest?.notes,
      vendorRequest?.remarks
    ),

    replyDeadline: getFirstValue(
      vendorRequest?.replyDeadline,
      vendorRequest?.deadline,
      "at the earliest"
    ),

    emailSignatureHtml: signatureHtml
  });

  return sendEmailViaBrevo({
    to: [
      {
        email: vendorEmail,
        name: vendorName
      }
    ],
    cc,
    bcc,
    subject,
    html
  });
}