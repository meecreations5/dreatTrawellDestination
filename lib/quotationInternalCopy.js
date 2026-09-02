import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value = "") {
  return String(value || "").trim();
}

function normalizeEmail(value = "") {
  return clean(value).toLowerCase();
}

/**
 * Resolve the internal quotation-copy recipient.
 * Prefer the selected quotation signature/team member because that is the
 * person presented to the Travel Agent as the quotation contact. Fall back to
 * the logged-in user so the person actually sending still receives a copy.
 */
export function resolveQuotationInternalRecipient({
  signatureUser = {},
  user = {},
  customerEmail = ""
} = {}) {
  const candidates = [
    signatureUser?.email,
    signatureUser?.workEmail,
    signatureUser?.officialEmail,
    signatureUser?.officeEmail,
    signatureUser?.contactEmail,
    user?.email
  ]
    .map(normalizeEmail)
    .filter(email => email && EMAIL_RE.test(email));

  const normalizedCustomerEmail = normalizeEmail(customerEmail);
  const email = candidates.find(candidate => candidate !== normalizedCustomerEmail) || "";

  if (!email) {
    return {
      email: "",
      name: "",
      reason: candidates.length ? "same_as_customer" : "missing"
    };
  }

  const name = clean(
    signatureUser?.displayName ||
    signatureUser?.name ||
    signatureUser?.fullName ||
    user?.displayName ||
    user?.name ||
    user?.fullName ||
    user?.email
  );

  return { email, name, reason: "" };
}

/**
 * Send a private/internal copy of a quotation email to the concerned team
 * member. This is intentionally a separate Brevo message rather than CC/BCC
 * on the customer message so customer delivery webhooks continue to represent
 * only the Travel Agent/customer recipient.
 */
export async function sendQuotationInternalCopy({
  leadId,
  quotationId,
  toEmail,
  toName = "",
  subject,
  html,
  text = "",
  sentByUser = {}
}) {
  const cleanLeadId = clean(leadId);
  const cleanQuotationId = clean(quotationId);
  const recipientEmail = normalizeEmail(toEmail);

  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return { skipped: true, sent: false, reason: "No valid internal team email" };
  }

  const internalSubject = `Copy | ${clean(subject)}`.slice(0, 180);

  try {
    const response = await sendEmailViaBrevo({
      toEmail: recipientEmail,
      toName: clean(toName) || "Team Member",
      subject: internalSubject,
      html,
      text,
      cc: [],
      bcc: [],
      replyTo: null,
      // Do not include lead_ / quotation_ tags here. The Brevo delivery
      // webhook uses those tags to update customer quotation-delivery status.
      tags: [
        "dreamtrawell_crm",
        "quotation_internal_copy"
      ],
      emailType: "transactional"
    });

    const messageId = clean(response?.messageId || response?.result?.messageId);

    if (cleanLeadId && cleanQuotationId) {
      try {
        await updateDoc(
          doc(db, "leads", cleanLeadId, "quotations", cleanQuotationId),
          {
            internalTeamCopyStatus: "accepted",
            internalTeamCopyRecipient: recipientEmail,
            internalTeamCopyRecipientName: clean(toName),
            internalTeamCopySubject: internalSubject,
            internalTeamCopyMessageId: messageId,
            internalTeamCopyError: "",
            internalTeamCopySentAt: serverTimestamp(),
            internalTeamCopySentByUid: clean(sentByUser?.uid || sentByUser?.id),
            internalTeamCopySentByName: clean(
              sentByUser?.displayName ||
              sentByUser?.name ||
              sentByUser?.fullName ||
              sentByUser?.email
            ),
            updatedAt: serverTimestamp()
          }
        );
      } catch (statusError) {
        console.warn("Quotation internal-copy status update skipped:", statusError);
      }
    }

    return {
      skipped: false,
      sent: true,
      email: recipientEmail,
      messageId
    };
  } catch (error) {
    const message = clean(error?.message) || "Internal quotation copy failed";

    if (cleanLeadId && cleanQuotationId) {
      try {
        await updateDoc(
          doc(db, "leads", cleanLeadId, "quotations", cleanQuotationId),
          {
            internalTeamCopyStatus: "failed",
            internalTeamCopyRecipient: recipientEmail,
            internalTeamCopyRecipientName: clean(toName),
            internalTeamCopySubject: internalSubject,
            internalTeamCopyError: message,
            internalTeamCopyFailedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
        );
      } catch (statusError) {
        console.warn("Quotation internal-copy failure status update skipped:", statusError);
      }
    }

    return {
      skipped: false,
      sent: false,
      email: recipientEmail,
      error: message
    };
  }
}

export default sendQuotationInternalCopy;
