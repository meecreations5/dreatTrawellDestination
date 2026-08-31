// lib/sendLeadNotifications.js

import { sendEmailViaBrevo } from "./sendEmailViaBrevo";
import { sendWhatsAppWeb } from "./whatsapp";

import { getBrandingSettings } from "./brandingSettings";
import { getUserProfileByUid } from "./userProfileRef";

import {
  buildEmailSignatureHtml,
  buildWhatsAppSignatureText,
  escapeHtml,
  getFirstValue,
  getMemberEmail,
  getMemberName,
  getMemberUid
} from "./signatureUtils";

import {
  cleanOfficeClipboardText,
  richTextHtmlToText,
  sanitizeRichTextHtml
} from "./richTextSanitizer";

import {
  buildTravelAgentEmailTemplate,
  buildInternalEmailTemplate,
  buildEmailAttachmentListHtml
} from "./emailTemplates";

/* =========================
   BASIC HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function normalizeText(value = "") {
  return cleanString(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limitText(value = "", maxLength = 520) {
  const text = normalizeText(value);

  if (!text) return "";
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength).trim()}...`;
}

function joinWhatsAppBlocks(blocks = []) {
  return blocks
    .map(block => cleanString(block))
    .filter(Boolean)
    .join("\n\n")
    .trim();
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

function getSpocName(spoc = {}) {
  return getFirstValue(
    spoc?.name,
    spoc?.contactName,
    spoc?.spocName,
    "Partner"
  );
}

function getSpocEmail(spoc = {}) {
  return cleanString(
    spoc?.email ||
    spoc?.contactEmail ||
    spoc?.spocEmail
  ).toLowerCase();
}

function getSpocMobile(spoc = {}) {
  return cleanString(
    spoc?.mobile ||
    spoc?.phone ||
    spoc?.whatsapp ||
    spoc?.contactNumber
  );
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
    console.warn("Lead notification user profile load skipped:", error);
  }

  return mergeSignatureUserWithProfile(normalizedMember, profileData);
}

async function getSignatureUserWithBranding(user) {
  const signatureUser = await getProfileMergedUser(user);

  let branding = {};

  try {
    branding = await getBrandingSettings();
  } catch (error) {
    console.warn("Lead notification branding load skipped:", error);
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
   CLIENT REFERENCE HELPERS
========================= */

function sanitizeReferenceHtml(html = "") {
  return sanitizeRichTextHtml(html);
}

function plainTextToHtml(text = "") {
  const safe = escapeHtml(text || "");

  if (!safe) return "";

  return safe.replace(/\n/g, "<br/>");
}

function getClientReferenceHtml(clientReference = {}) {
  return sanitizeReferenceHtml(
    getFirstValue(
      clientReference?.notesHtml,
      clientReference?.referenceHtml,
      clientReference?.html,
      clientReference?.contentHtml,
      clientReference?.descriptionHtml,
      clientReference?.notes
        ? plainTextToHtml(clientReference.notes)
        : "",
      clientReference?.reference
        ? plainTextToHtml(clientReference.reference)
        : "",
      clientReference?.message
        ? plainTextToHtml(clientReference.message)
        : ""
    )
  );
}

function getClientReferenceText(clientReference = {}) {
  const referenceHtml = getClientReferenceHtml(clientReference);
  const textFromHtml = richTextHtmlToText(referenceHtml);

  return cleanOfficeClipboardText(
    getFirstValue(
      textFromHtml,
      clientReference?.notes,
      clientReference?.reference,
      clientReference?.message
    )
  );
}

function getClientReferenceAttachments(clientReference = {}) {
  const possibleArrays = [
    clientReference?.attachments,
    clientReference?.files,
    clientReference?.referenceFiles,
    clientReference?.documents,
    clientReference?.uploadedFiles
  ];

  const merged = possibleArrays
    .filter(Array.isArray)
    .flat()
    .filter(Boolean);

  const seen = new Set();

  return merged.filter(file => {
    const key = getFirstValue(
      file?.url,
      file?.downloadURL,
      file?.downloadUrl,
      file?.fileUrl,
      file?.name,
      file?.fileName,
      file?.originalName
    );

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function buildClientReferenceContentHtml(clientReference = {}) {
  const referenceHtml = getClientReferenceHtml(clientReference);
  const attachments = getClientReferenceAttachments(clientReference);

  const attachmentsHtml = buildEmailAttachmentListHtml({
    title: "Reference Files",
    attachments
  });

  return [referenceHtml, attachmentsHtml]
    .filter(Boolean)
    .join("");
}


/* =========================
   WHATSAPP MESSAGE TEMPLATES
========================= */

function buildLeadAcknowledgementWhatsAppMessage({
  spocName,
  leadCode,
  destinationName,
  clientReference,
  companyName,
  whatsappSignatureText
}) {
  const safeSpocName = getFirstValue(spocName, "Partner");
  const safeLeadCode = getFirstValue(leadCode, "Not assigned");
  const safeDestinationName = getFirstValue(destinationName, "Not specified");

  const safeCompanyName = getFirstValue(
    companyName,
    "Dream Trawell Destinations"
  );

  const referenceText = limitText(getClientReferenceText(clientReference), 520);
  const referenceAttachments = getClientReferenceAttachments(clientReference);
  const attachmentCount = referenceAttachments.length;

  const referenceBlock =
    referenceText || attachmentCount
      ? [
        "*Reference Shared*",
        referenceText ? referenceText : "",
        attachmentCount
          ? `Reference files received: ${attachmentCount}`
          : ""
      ]
        .filter(Boolean)
        .join("\n")
      : "";

  return joinWhatsAppBlocks([
    `Hello ${safeSpocName},`,

    `Your travel requirement is now in motion with ${safeCompanyName}. Thank you for sharing the details with us. Our destination team has received the enquiry and will review it thoughtfully to help create a travel experience your client will remember with ease and confidence.`,

    [
      "*Travel in Motion*",
      `Lead ID: ${safeLeadCode}`,
      `Destination: ${safeDestinationName}`
    ].join("\n"),

    referenceBlock,

    [
      "*What Happens Next*",
      "Our team will study the requirement and shape suitable itinerary and pricing options for your client."
    ].join("\n"),

    "We will keep the planning focused on comfort, seamless arrangements, and memorable travel moments.",

    whatsappSignatureText
  ]);
}


/* =========================
   INTERNAL TEAM EMAIL SEND
========================= */

async function sendAssignedTeamLeadEmail({
  assignedUser,
  spoc,
  leadId = "",
  leadCode,
  destinationName,
  branding,
  clientReference,
  emailSignatureHtml,
  senderUser
}) {
  if (!assignedUser) return;

  const assignedEmail = cleanString(
    getMemberEmail(assignedUser) ||
    assignedUser?.email ||
    assignedUser?.workEmail ||
    assignedUser?.officialEmail
  ).toLowerCase();

  if (!assignedEmail) return;

  const assignedName = getFirstValue(
    getMemberName(assignedUser),
    assignedUser?.displayName,
    assignedUser?.name,
    assignedEmail
  );

  const spocName = getSpocName(spoc);
  const spocEmail = getSpocEmail(spoc);
  const spocMobile = getSpocMobile(spoc);

  const referenceHtml = buildClientReferenceContentHtml(clientReference);

  const html = buildInternalEmailTemplate({
    branding,

    title: "New Lead Assigned",
    subtitle: "Review the Requirement and Shape the Next Step",
    introLine:
      "A clear brief helps us create a thoughtful travel experience.",

    recipientName: assignedName,

    openingHtml: `
      <p style="margin:0;">
        A new travel lead has been assigned to you. Please review the partner reference and plan the next action accordingly.
      </p>
    `,

    detailsTitle: "Lead Brief",
    detailsRows: [
      {
        label: "Lead ID",
        value: leadCode
      },
      {
        label: "Destination",
        value: destinationName
      },
      {
        label: "Travel Partner",
        value: spocName
      },
      {
        label: "Partner Email",
        value: spocEmail
      },
      {
        label: "Partner Mobile",
        value: spocMobile
      }
    ].filter(row => row.value),

    referenceTitle: "Reference Shared by Travel Partner",
    referenceHtml,
    showReference: true,
    emptyReferenceText:
      "No additional reference content was provided.",

    actionTitle: "Suggested Next Action",
    actionText:
      "Review the reference, understand the traveler’s expectation, and connect with the partner with suitable itinerary and pricing options.",

    emailSignatureHtml
  });

  const text = htmlToText(html);

  const senderEmail = cleanString(getMemberEmail(senderUser));
  const senderName = cleanString(getMemberName(senderUser));

  return await sendEmailViaBrevo({
    toEmail: assignedEmail,
    toName: assignedName,

    recipientEmail: assignedEmail,
    recipientName: assignedName,
    to: assignedEmail,
    email: assignedEmail,

    subject: `New Lead Assigned - ${leadCode}`,

    html,
    htmlContent: html,
    body: html,

    text,
    textContent: text,

    replyTo: senderEmail
      ? {
        email: senderEmail,
        name: senderName || senderEmail
      }
      : null,
    emailType: "transactional",
    tags: [
      "dreamtrawell_crm",
      "lead_assignment",
      leadId ? `lead_${leadId}` : "",
      leadCode ? `leadcode_${leadCode}` : ""
    ].filter(Boolean)
  });
}

/* =========================
   MAIN NOTIFICATION FUNCTION
========================= */

/**
 * Sends:
 * 1. External polished acknowledgement email to Travel Agent / SPOC
 * 2. WhatsApp acknowledgement to Travel Agent / SPOC
 * 3. Separate internal lead brief email to assigned team member
 */
export async function sendLeadNotifications({
  spoc,
  leadId = "",
  leadCode,
  destinationName,
  user = null,
  assignedUser = null,
  clientReference = null
}) {
  const result = {
    assignedTeamEmail: { requested: false, status: "not_requested", recipient: "", messageId: "", error: "" },
    travelAgentEmail: { requested: false, status: "not_requested", recipient: "", messageId: "", error: "" },
    whatsapp: { requested: false, status: "not_requested", recipient: "", error: "" }
  };

  if (!spoc) return result;

  const {
    signatureUser,
    signatureUserWithBranding,
    branding
  } = await getSignatureUserWithBranding(user);

  const assignedUserWithProfile = assignedUser
    ? await getProfileMergedUser(assignedUser)
    : null;

  const signatureEnabled =
    signatureUserWithBranding?.signatureEnabled !== false;

  const emailSignatureHtml = signatureEnabled
    ? buildEmailSignatureHtml(signatureUserWithBranding)
    : "";

  const whatsappSignatureText = signatureEnabled
    ? buildWhatsAppSignatureText(signatureUserWithBranding)
    : "";

  const spocEmail = getSpocEmail(spoc);
  const spocName = getSpocName(spoc);
  const spocMobile = getSpocMobile(spoc);

  const assignedEmail = cleanString(
    getMemberEmail(assignedUserWithProfile) ||
    assignedUserWithProfile?.email ||
    assignedUserWithProfile?.workEmail ||
    assignedUserWithProfile?.officialEmail
  ).toLowerCase();

  const assignedName = getFirstValue(
    getMemberName(assignedUserWithProfile),
    assignedUserWithProfile?.displayName,
    assignedUserWithProfile?.name,
    assignedEmail
  );

  const referenceHtml = buildClientReferenceContentHtml(clientReference);

  const companyName = getFirstValue(
    branding?.companyName,
    branding?.brandName,
    "DreamTrawell Destination"
  );

  /* =========================
     1. INTERNAL EMAIL TO ASSIGNED TEAM MEMBER
     Send independently so a Travel Agent email failure can never prevent the
     assigned team member from receiving the lead notification.
  ========================== */
  if (assignedUserWithProfile && assignedEmail) {
    const spocEmailLower = cleanString(spocEmail).toLowerCase();

    if (assignedEmail !== spocEmailLower) {
      result.assignedTeamEmail.requested = true;
      result.assignedTeamEmail.recipient = assignedEmail;

      try {
        const response = await sendAssignedTeamLeadEmail({
          assignedUser: assignedUserWithProfile,
          spoc,
          leadId,
          leadCode,
          destinationName,
          branding,
          clientReference,
          emailSignatureHtml,
          senderUser: signatureUser
        });
        result.assignedTeamEmail.status = "accepted";
        result.assignedTeamEmail.messageId = response?.messageId || "";
      } catch (error) {
        result.assignedTeamEmail.status = "failed";
        result.assignedTeamEmail.error = cleanString(error?.message || error || "Email sending failed");
        console.warn("Assigned team lead email failed:", {
          leadCode,
          recipient: assignedEmail,
          message: result.assignedTeamEmail.error
        });
      }
    }
  }

  /* =========================
     2. EXTERNAL EMAIL TO TRAVEL AGENT / SPOC
  ========================== */
  if (spocEmail) {
    result.travelAgentEmail.requested = true;
    result.travelAgentEmail.recipient = spocEmail;

    const html = buildTravelAgentEmailTemplate({
      branding,

      title: "Travel Requirement Received",
      subtitle: "Our destination team is reviewing the requirement",
      introLine:
        "Thank you for sharing the travel requirement with DreamTrawell Destination.",

      recipientName: spocName,

      openingHtml: `
        <p style="margin:0;">
          We have received your travel requirement and created reference
          <strong>${escapeHtml(leadCode)}</strong> for ${escapeHtml(destinationName)}.
        </p>
      `,

      detailsTitle: "Lead Details",
      detailsRows: [
        { label: "Lead ID", value: leadCode },
        { label: "Destination", value: destinationName }
      ],

      referenceTitle: "Reference Received",
      referenceHtml,

      actionTitle: "Next Step",
      actionText:
        "Our destination team will review the requirement and connect with you with the relevant itinerary and pricing options.",

      closingLine:
        "Please reply to this email if you need to add or correct any requirement details.",

      emailSignatureHtml
    });

    const text = htmlToText(html);

    try {
      const response = await sendEmailViaBrevo({
        toEmail: spocEmail,
        toName: spocName,
        subject: `Requirement Received | ${destinationName} | ${leadCode}`,
        html,
        text,
        replyTo: assignedEmail
          ? { email: assignedEmail, name: assignedName || assignedEmail }
          : null,
        emailType: "transactional",
        tags: [
          "dreamtrawell_crm",
          "travel_requirement_received",
          leadId ? `lead_${leadId}` : "",
          leadCode ? `leadcode_${leadCode}` : ""
        ].filter(Boolean)
      });
      result.travelAgentEmail.status = "accepted";
      result.travelAgentEmail.messageId = response?.messageId || "";
    } catch (error) {
      result.travelAgentEmail.status = "failed";
      result.travelAgentEmail.error = cleanString(error?.message || error || "Email sending failed");
      console.warn("Travel Agent lead acknowledgement failed:", {
        leadCode,
        recipient: spocEmail,
        message: result.travelAgentEmail.error
      });
    }
  }

  /* =========================
     3. WHATSAPP TO SPOC
  ========================== */
  if (spocMobile) {
    result.whatsapp.requested = true;
    result.whatsapp.recipient = spocMobile;
    try {
      await sendWhatsAppWeb({
        mobile: spocMobile,
        message: buildLeadAcknowledgementWhatsAppMessage({
          spocName,
          leadCode,
          destinationName,
          clientReference,
          companyName,
          whatsappSignatureText
        })
      });
      result.whatsapp.status = "opened";
    } catch (error) {
      result.whatsapp.status = "failed";
      result.whatsapp.error = cleanString(error?.message || error || "WhatsApp action failed");
      console.warn("Lead WhatsApp acknowledgement failed:", {
        leadCode,
        recipient: spocMobile,
        message: result.whatsapp.error
      });
    }
  }

  return result;
}

