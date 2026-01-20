import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

export const LEAD_TIMELINE_TYPES = {
  CREATED: "created",
  STAGE_CHANGED: "stage_changed",
  FOLLOW_UP: "follow_up",
  QUOTATION: "quotation",
  ASSIGNED: "assigned",
  REMARK: "remark"
};

export async function logLeadAction({
  leadId,
  type,
  title,
  description = "",
  metadata = {},
  user
}) {
  if (!leadId || !type || !title) {
    throw new Error("logLeadAction: missing required fields");
  }

  // 🔒 HARD NORMALIZATION (CRITICAL)
  const safeMetadata = {
    amount:
      metadata.amount ??
      metadata.totalPrice ??
      null,

    currency:
      metadata.currency ??
      "INR",

    revision:
      metadata.revision ??
      metadata.revisionNumber ??
      null,

    sendVia:
      metadata.sendVia ??
      [],

    itineraryHtml:
      metadata.itineraryHtml ??
      null,

    notes:
      metadata.notes ??
      metadata.note ??
      null,

    quotationId:
      metadata.quotationId ??
      null,

    toEmail:
      metadata.toEmail ??
      null,

    toMobile:
      metadata.toMobile ??
      null,

    toName:
      metadata.toName ??
      null
  };

  await addDoc(
    collection(db, "leads", leadId, "timeline"),
    {
      type,
      title,
      description,

      createdByUid: user?.uid || null,
      createdByEmail: user?.email || null,
      createdByName: user?.name || "System",

      // ✅ ALWAYS PRESENT
      metadata: safeMetadata,

      createdAt: serverTimestamp()
    }
  );
}
