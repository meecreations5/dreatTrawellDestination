"use client";

import { doc, collection, runTransaction, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isAdmin } from "@/lib/rolePermissions";
import {
  getDealWonEventDate, businessDateKey, isCurrentWon, validateWonDateInput
} from "@/lib/reporting/leadReportingDates.mjs";

/** Admin-audited correction; never changes the date lead was created or sent quotes. */
export async function correctDealWonDate({ leadId, wonDateKey, confirmationReference, reason, user }) {
  if (!isAdmin(user)) throw new Error("Only Admin may correct the Deal Won date.");
  const id=String(leadId || "").trim();
  const ref=String(confirmationReference || "").trim();
  const explanation=String(reason || "").trim();
  if (!id) throw new Error("Lead ID is required.");
  if (!ref) throw new Error("Booking confirmation reference is required.");
  if (explanation.length < 8) throw new Error("Enter a reason of at least 8 characters.");
  const leadRef=doc(db,"leads",id);
  const auditRef=doc(collection(db,"leads",id,"wonDateAudit"));
  await runTransaction(db,async trx=>{
    const snap=await trx.get(leadRef);
    if (!snap.exists()) throw new Error("Lead no longer exists.");
    const lead=snap.data();
    if (!isCurrentWon(lead)) throw new Error("Only an active Deal Won lead can have its confirmation date corrected.");
    const validated=validateWonDateInput({
      wonDateKey,
      leadCreatedAt:lead.createdAt || lead.leadCreatedAt,
      mayBackdate:true,
      correctionReason:explanation,
      confirmationReference:ref
    });
    const oldDateKey=businessDateKey(getDealWonEventDate(lead));
    if (oldDateKey===validated.dateKey) throw new Error("The selected date matches the existing confirmation date.");
    const who={ uid:String(user.uid || ""), name:String(user.name || user.displayName || user.email || ""), email:String(user.email || "") };
    trx.update(leadRef,{
      dealWonAt:Timestamp.fromDate(validated.actualDate),
      dealWonDateKey:validated.dateKey,
      dealWonDateSource:"admin_verified_correction",
      dealWonDateCorrectedAt:serverTimestamp(),
      dealWonDateCorrectedByUid:who.uid,
      bookingConfirmationReference:ref,
      wonDateCorrectionReason:explanation,
      // The confirmed value remains immutable; only the audited effective date changes.
      ...(lead.confirmedBusiness && typeof lead.confirmedBusiness === "object" ? {
        confirmedBusiness: { ...lead.confirmedBusiness, wonDateKey: validated.dateKey }
      } : {}),
      updatedAt:serverTimestamp()
    });
    trx.set(auditRef,{
      leadId:id, previousDateKey:oldDateKey || null, correctedDateKey:validated.dateKey,
      previousBookingReference:String(lead.bookingConfirmationReference || ""),
      confirmationReference:ref, reason:explanation, actorUid:who.uid,actorName:who.name,
      actorEmail:who.email,changedAt:serverTimestamp(),
      action:"deal_won_date_corrected"
    });
  });
  return {leadId:id,wonDateKey};
}
