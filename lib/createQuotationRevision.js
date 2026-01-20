import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

export async function createQuotationRevision({
  leadId,
  itineraryHtml,
  totalPrice,
  note = "",
  sendVia = [],
  user
}) {
  if (!leadId || !itineraryHtml || !totalPrice) {
    throw new Error("Missing quotation data");
  }

  /* =========================
     LOAD LEAD
  ========================== */
  const leadRef = doc(db, "leads", leadId);
  const leadSnap = await getDoc(leadRef);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found");
  }

  /* =========================
     GET LAST REVISION
  ========================== */
  const lastSnap = await getDocs(
    query(
      collection(db, "leads", leadId, "quotations"),
      orderBy("revisionNumber", "desc"),
      limit(1)
    )
  );

  const lastRevision = lastSnap.empty
    ? 0
    : lastSnap.docs[0].data().revisionNumber;

  const revisionNumber = lastRevision + 1;

  /* =========================
     SAVE QUOTATION
  ========================== */
  await addDoc(
    collection(db, "leads", leadId, "quotations"),
    {
      revisionNumber,
      itineraryHtml,
      totalPrice,
      note,
      sendVia,

      createdByUid: user.uid,
      createdByEmail: user.email,

      createdAt: serverTimestamp()
    }
  );

  /* =========================
     🔥 TIMELINE (ONLY PLACE)
  ========================== */
  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.QUOTATION,
    title:
      revisionNumber === 1
        ? "Quotation Sent"
        : `Quotation Revised (v${revisionNumber})`,
    description: `Total Amount: INR ${totalPrice}`,
    metadata: {
      revisionNumber,
      totalPrice,
      sendVia,
      note,
      itineraryHtml
    },
    user
  });

  return revisionNumber;
}
