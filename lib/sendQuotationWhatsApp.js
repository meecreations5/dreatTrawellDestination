import { sendWhatsAppWeb } from "./whatsapp";
import {
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "./firebase";
import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

/* =========================
   HELPERS
========================= */
function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getUserName(user) {
  return getFirstValue(
    user?.displayName,
    user?.name,
    user?.email,
    "System User"
  );
}

function buildSignatureText(signatureUser, fallbackUser) {
  const customSignature = getFirstValue(
    signatureUser?.whatsappSignature,
    signatureUser?.signatureText
  );

  if (customSignature) return customSignature;

  const name = getFirstValue(
    signatureUser?.name,
    signatureUser?.displayName,
    fallbackUser?.displayName,
    fallbackUser?.name,
    fallbackUser?.email,
    "DreamTrawell Team"
  );

  const role = getFirstValue(
    signatureUser?.role,
    signatureUser?.designation,
    signatureUser?.roleTitle
  );

  const email = getFirstValue(
    signatureUser?.email,
    fallbackUser?.email
  );

  const mobile = getFirstValue(
    signatureUser?.mobile,
    signatureUser?.phone,
    fallbackUser?.mobile,
    fallbackUser?.phone
  );

  return [
    "Regards,",
    name,
    role,
    "DreamTrawell",
    email ? `Email: ${email}` : "",
    mobile ? `Mobile: ${mobile}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildQuotationWhatsAppMessage({
  leadCode,
  destinationName,
  recipientName,
  revision,
  customMessage,
  signatureText
}) {
  if (customMessage) {
    return [
      customMessage,
      "",
      signatureText
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Dear ${recipientName || "Guest"},`,
    "",
    "Greetings from DreamTrawell.",
    "",
    `Your quotation for ${destinationName || "your travel enquiry"} has been prepared.`,
    leadCode || revision
      ? `Quotation Ref: ${[leadCode, revision ? `Rev ${revision}` : ""]
          .filter(Boolean)
          .join(" / ")}`
      : "",
    "",
    "Please review the itinerary details shared with you and let us know if you would like any changes.",
    "",
    signatureText
  ]
    .filter(Boolean)
    .join("\n");
}

/* =========================
   SEND QUOTATION WHATSAPP
========================= */
export async function sendQuotationWhatsApp({
  leadId,
  quotationId,
  mobile,

  // Optional message from QuotationEditor.
  // Pass raw text only. Do not pass encodeURIComponent(message).
  message = "",

  // Optional fields for better WhatsApp draft.
  leadCode = "",
  destinationName = "",
  recipientName = "",
  revision = "",

  // Selected team member signature.
  // If admin creates quotation, pass selected team member here.
  signatureUser = null,

  user
}) {
  if (!leadId) {
    throw new Error("Lead ID required");
  }

  if (!quotationId) {
    throw new Error("Quotation ID required");
  }

  if (!mobile) {
    throw new Error("Mobile required");
  }

  if (!user) {
    throw new Error("User required");
  }

  const signatureText = buildSignatureText(signatureUser, user);

  const whatsappMessage = buildQuotationWhatsAppMessage({
    leadCode,
    destinationName,
    recipientName,
    revision,
    customMessage: message,
    signatureText
  });

  if (!whatsappMessage.trim()) {
    throw new Error("WhatsApp message required");
  }

  /* =========================
     SEND WHATSAPP
     Do not encode message here.
     sendWhatsAppWeb will encode only once.
  ========================== */
  sendWhatsAppWeb({
    mobile,
    message: whatsappMessage
  });

  /* =========================
     UPDATE QUOTATION
     This keeps pricing/vendor cost internal.
  ========================== */
  await updateDoc(
    doc(db, "leads", leadId, "quotations", quotationId),
    {
      sentVia: arrayUnion("whatsapp"),
      whatsappSentAt: serverTimestamp(),
      whatsappSentByUid: user?.uid || "",
      whatsappSentByName: getUserName(user),

      communicationSignature: {
        uid: signatureUser?.uid || "",
        name: signatureUser?.name || "",
        email: signatureUser?.email || "",
        mobile: signatureUser?.mobile || "",
        role: signatureUser?.role || "",
        signatureText
      },

      updatedAt: serverTimestamp()
    }
  );

  /* =========================
     TIMELINE
  ========================== */
  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.QUOTATION,
    title: "Quotation sent via WhatsApp",
    description: "Quotation shared via WhatsApp",
    metadata: {
      channel: "whatsapp",
      quotationId,
      leadCode,
      revision,
      signatureUser: {
        uid: signatureUser?.uid || "",
        name: signatureUser?.name || "",
        role: signatureUser?.role || ""
      }

      // Do not add customerQuotedAmount, vendorCost, or grossProfit here
      // because WhatsApp communication should not expose pricing.
    },
    user
  });

  return {
    success: true,
    channel: "whatsapp"
  };
}