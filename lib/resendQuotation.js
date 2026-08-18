import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { sendWhatsAppWeb } from "@/lib/whatsapp";
import { LEAD_TIMELINE_TYPES, logLeadAction } from "@/lib/logLeadAction";
import { isDraftQuotation } from "@/lib/deleteQuotationDraft";
import { canAccessRecord } from "@/lib/rolePermissions";

const clean = value => String(value || "").trim();

function getRecipient(lead = {}) {
  return {
    name: clean(
      lead?.spoc?.name ||
      lead?.customerName ||
      lead?.travellerName ||
      lead?.guestName ||
      lead?.contactName ||
      lead?.customer?.name
    ),
    email: clean(
      lead?.spoc?.email ||
      lead?.email ||
      lead?.customerEmail ||
      lead?.customer?.email
    ),
    mobile: clean(
      lead?.spoc?.mobile ||
      lead?.mobile ||
      lead?.phone ||
      lead?.contactNumber ||
      lead?.customerMobile ||
      lead?.customer?.mobile
    )
  };
}

function getUserName(user = {}) {
  return clean(user.displayName || user.name || user.fullName || user.email) || "System User";
}

function getDestination(lead = {}, quotation = {}) {
  return clean(
    quotation?.quotationData?.travelDetails?.destinationName ||
    lead?.destinationName ||
    lead?.destination ||
    lead?.destination?.name ||
    lead?.travelDetails?.destinationName
  );
}

function buildEmailHtml({ lead, quotation, recipient }) {
  const itinerary = clean(quotation?.itineraryHtml) || "<p>Your quotation is attached below.</p>";
  const assetLinks = clean(quotation?.assetLinksHtml);
  const signatureHtml = clean(quotation?.signatureUser?.signatureHtml || quotation?.communicationSignature?.signatureHtml);
  const greeting = recipient.name ? `Dear ${recipient.name},` : "Dear Partner,";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
      <p>${greeting}</p>
      <p>Please find the same quotation shared with you earlier for your reference.</p>
      <div style="margin:20px 0">${itinerary}</div>
      ${assetLinks ? `<div style="margin:16px 0">${assetLinks}</div>` : ""}
      ${signatureHtml ? `<div style="margin-top:24px">${signatureHtml}</div>` : ""}
    </div>
  `;
}

function buildWhatsAppText({ lead, quotation, recipient }) {
  const destination = getDestination(lead, quotation);
  const revision = quotation?.revision || quotation?.revisionNumber || quotation?.version || "";
  const signature = clean(quotation?.signatureUser?.signatureText || quotation?.communicationSignature?.signatureText);
  const links = clean(quotation?.assetLinksText);

  return [
    `Dear ${recipient.name || "Partner"},`,
    "",
    `Sharing the same quotation again${destination ? ` for ${destination}` : ""}.`,
    [lead?.leadCode, revision ? `Rev ${revision}` : ""].filter(Boolean).length
      ? `Quotation Ref: ${[lead?.leadCode, revision ? `Rev ${revision}` : ""].filter(Boolean).join(" / ")}`
      : "",
    "",
    links,
    signature
  ].filter(Boolean).join("\n");
}

function isResendable(quotation = {}) {
  if (quotation.isDeleted === true || quotation.deleted === true) return false;
  if (isDraftQuotation(quotation)) return false;
  return Boolean(
    quotation.sentAt ||
    quotation.emailSentAt ||
    quotation.whatsappSentAt ||
    (Array.isArray(quotation.sentVia) && quotation.sentVia.length) ||
    ["sent", "final", "approved", "accepted", "shared"].includes(clean(quotation.status).toLowerCase()) ||
    quotation.isFinalQuotation === true
  );
}

export function canResendQuotation(quotation = {}) {
  return isResendable(quotation);
}

/**
 * Re-send an existing immutable quotation revision. This never creates a new
 * revision and never mutates itinerary/pricing/vendor content.
 */
export async function resendQuotation({ lead, leadId, quotationId, channels = [], user }) {
  const id = clean(leadId || lead?.id || lead?.leadId);
  const quoteId = clean(quotationId);
  const uniqueChannels = Array.from(new Set(channels.filter(channel => ["email", "whatsapp"].includes(channel))));

  if (!id || !quoteId) throw new Error("Lead and quotation are required.");
  if (!uniqueChannels.length) throw new Error("Select Email and/or WhatsApp to resend the quotation.");
  if (!user) throw new Error("Signed-in user is required.");

  const leadSnap = await getDoc(doc(db, "leads", id));
  if (!leadSnap.exists()) throw new Error("Lead not found.");
  const leadRecord = { id: leadSnap.id, ...leadSnap.data(), ...(lead || {}) };

  if (!canAccessRecord(user, "quotations.resend", leadRecord, "lead")) {
    throw new Error("You do not have permission to resend this quotation.");
  }

  const quotationRef = doc(db, "leads", id, "quotations", quoteId);
  const quotationSnap = await getDoc(quotationRef);
  if (!quotationSnap.exists()) throw new Error("Quotation not found.");

  const quotation = { id: quotationSnap.id, ...quotationSnap.data() };
  if (!isResendable(quotation)) throw new Error("Only sent/final quotations can be resent. Drafts should be edited and sent first.");

  const recipient = getRecipient(leadRecord);
  if (uniqueChannels.includes("email") && !recipient.email) throw new Error("Recipient email is not available on this lead.");
  if (uniqueChannels.includes("whatsapp") && !recipient.mobile) throw new Error("Recipient WhatsApp/mobile number is not available on this lead.");

  const revision = quotation.revision || quotation.revisionNumber || quotation.version || "";
  const subject = `Travel Quotation - ${clean(leadRecord?.leadCode)}${revision ? ` / Rev ${revision}` : ""}`;
  const emailHtml = buildEmailHtml({ lead: leadRecord, quotation, recipient });
  const whatsappText = buildWhatsAppText({ lead: leadRecord, quotation, recipient });

  const completed = [];

  if (uniqueChannels.includes("email")) {
    const signatureEmail = clean(quotation?.signatureUser?.email || quotation?.communicationSignature?.email);
    const signatureName = clean(quotation?.signatureUser?.name || quotation?.communicationSignature?.name);

    await sendEmailViaBrevo({
      toEmail: recipient.email,
      toName: recipient.name || "Partner",
      subject,
      html: emailHtml,
      replyTo: signatureEmail ? { email: signatureEmail, name: signatureName || undefined } : null
    });
    completed.push("email");
  }

  if (uniqueChannels.includes("whatsapp")) {
    sendWhatsAppWeb({ mobile: recipient.mobile, message: whatsappText });
    completed.push("whatsapp");
  }

  const update = {
    resentAt: serverTimestamp(),
    resentByUid: clean(user.uid || user.id),
    resentByName: getUserName(user),
    resentByEmail: clean(user.email),
    resendCount: increment(1),
    lastResentVia: completed,
    updatedAt: serverTimestamp()
  };

  update.sentVia = arrayUnion(...completed);
  if (completed.includes("email")) update.emailSentAt = serverTimestamp();
  if (completed.includes("whatsapp")) update.whatsappSentAt = serverTimestamp();

  await updateDoc(quotationRef, update);

  await logLeadAction({
    leadId: id,
    type: LEAD_TIMELINE_TYPES.QUOTATION,
    title: `Quotation resent${revision ? ` - Rev ${revision}` : ""}`,
    description: `Existing quotation revision resent via ${completed.join(" & ")}.`,
    metadata: {
      action: "quotation_resent",
      quotationId: quoteId,
      revision,
      channels: completed,
      immutableRevision: true
    },
    user
  });

  return { quotationId: quoteId, revision, channels: completed };
}

export default resendQuotation;
