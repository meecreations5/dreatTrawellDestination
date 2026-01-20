// lib/sendQuotationWhatsApp.js

import { sendWhatsAppWeb } from "./whatsapp";
import {
  updateDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

export async function sendQuotationWhatsApp({
  leadId,
  quotationId,
  mobile,
  message,
  user
}) {
  if (!mobile || !message) {
    throw new Error("Mobile & message required");
  }

  /* =========================
     SEND WHATSAPP
  ========================== */
  sendWhatsAppWeb({
    mobile,
    message
  });

  /* =========================
     UPDATE QUOTATION
  ========================== */
  await updateDoc(
    doc(db, "leads", leadId, "quotations", quotationId),
    {
      sentVia: ["whatsapp"],
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
    description: "Quotation shared with travel agent",
    metadata: {
      channel: "whatsapp",
      quotationId
    },
    user
  });
}
