// lib/sendVendorEmail.js

import {
  buildVendorEmailTemplate,
  buildVendorRateRequestSubject
} from "./emailTemplates";

import { sendEmailViaBrevo } from "./sendEmailViaBrevo";
import { sendWhatsAppWeb } from "./whatsapp";
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

function joinWhatsAppBlocks(blocks = []) {
  return blocks
    .map(block => cleanString(block))
    .filter(Boolean)
    .join("\n\n")
    .trim();
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

function getVendorMobile(vendor = {}) {
  return cleanString(
    getFirstValue(
      vendor?.mobile,
      vendor?.phone,
      vendor?.whatsapp,
      vendor?.whatsappNumber,
      vendor?.contactNumber,
      vendor?.contactMobile,
      vendor?.primaryMobile,
      vendor?.primaryPhone,
      vendor?.spocMobile,
      vendor?.spocPhone
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

function buildVendorWhatsAppMessage({
  vendorName,
  leadCode,
  destinationName,
  travelDates,
  paxText,
  requirementType,
  servicesRequired,
  referenceContent,
  specialNotes,
  replyDeadline,
  senderName,
  signatureText
}) {
  const requirementRows = [
    leadCode ? `Lead ID: ${leadCode}` : "",
    `Destination: ${destinationName}`,
    travelDates ? `Travel Dates: ${travelDates}` : "",
    paxText ? `Guests: ${paxText}` : "",
    requirementType ? `Requirement Type: ${requirementType}` : ""
  ].filter(Boolean);

  const servicesBlock = servicesRequired?.length
    ? servicesRequired.map(item => `- ${item}`).join("\n")
    : "";

  return joinWhatsAppBlocks([
    `Hello ${vendorName || "Team"},`,

    "We request your best possible support for the below travel requirement.",

    [
      "*Rate & Availability Request*",
      requirementRows.join("\n")
    ].join("\n"),

    servicesBlock
      ? [
          "*Please Share*",
          servicesBlock
        ].join("\n")
      : "",

    referenceContent
      ? [
          "*Reference / Requirement Notes*",
          referenceContent
        ].join("\n")
      : "",

    specialNotes
      ? [
          "*Special Notes*",
          specialNotes
        ].join("\n")
      : "",

    [
      "*Expected Update*",
      `Please share your net rates, availability, inclusions, cancellation policy, payment terms, and important operational notes ${replyDeadline || "at the earliest"}.`
    ].join("\n"),

    "Your quick support will help us shape a smooth and reliable travel experience for our partner’s client.",

    signatureText || senderName
  ]);
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
  signatureText = "",
  cc = [],
  bcc = [],

  sendEmail = true,
  sendWhatsApp = false
}) {
  const vendorEmail = getVendorEmail(vendor);
  const vendorMobile = getVendorMobile(vendor);
  const vendorName = getVendorName(vendor);

  if (!sendEmail && !sendWhatsApp) {
    throw new Error("Please select at least one vendor communication channel.");
  }

  if (sendEmail && (!vendorEmail || !isValidEmail(vendorEmail))) {
    throw new Error("Vendor email is missing or invalid.");
  }

  if (sendWhatsApp && !vendorMobile) {
    throw new Error("Vendor WhatsApp number is missing.");
  }

  const destinationName = getLeadDestination(lead);
  const leadCode = getFirstValue(lead?.leadCode, lead?.code, lead?.id);

  const travelDates = getTravelDates(lead);
  const paxText = getPaxText(lead);
  const requirementType = getRequirementType(lead, vendorRequest);
  const servicesRequired = getServicesRequired(vendorRequest, lead);

  const referenceContent = getFirstValue(
    vendorRequest?.referenceContent,
    vendorRequest?.reference,
    lead?.referenceContent,
    lead?.notes,
    lead?.remarks
  );

  const specialNotes = getFirstValue(
    vendorRequest?.specialNotes,
    vendorRequest?.notes,
    vendorRequest?.remarks
  );

  const replyDeadline = getFirstValue(
    vendorRequest?.replyDeadline,
    vendorRequest?.deadline,
    "at the earliest"
  );

  const senderName = getSenderName(user);

  const subject = buildVendorRateRequestSubject({
    destinationName,
    leadCode
  });

  const result = {
    emailSent: false,
    whatsappSent: false,
    vendorEmail,
    vendorMobile,
    subject
  };

  if (sendEmail) {
    const html = buildVendorEmailTemplate({
      branding,

      vendorName,
      senderName,

      leadCode,
      destinationName,
      travelDates,
      paxText,
      requirementType,

      servicesRequired,

      referenceContent,
      specialNotes,
      replyDeadline,

      emailSignatureHtml: signatureHtml
    });

    await sendEmailViaBrevo({
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

    result.emailSent = true;
  }

  if (sendWhatsApp) {
    const whatsappMessage = buildVendorWhatsAppMessage({
      vendorName,
      leadCode,
      destinationName,
      travelDates,
      paxText,
      requirementType,
      servicesRequired,
      referenceContent,
      specialNotes,
      replyDeadline,
      senderName,
      signatureText
    });

    await sendWhatsAppWeb({
      mobile: vendorMobile,
      message: whatsappMessage
    });

    result.whatsappSent = true;
  }

  return result;
}