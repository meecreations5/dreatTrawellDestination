import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { LEAD_TIMELINE_TYPES, logLeadAction } from "@/lib/logLeadAction";
import { canAccess, canAccessRecord } from "@/lib/rolePermissions";

const clean = value => String(value || "").trim();
const normalize = value => clean(value).toLowerCase();


export function isDraftQuotation(quotation = {}) {
  const status = normalize(quotation.status);
  const sent = Boolean(
    quotation.sentAt ||
      quotation.sentVia?.length ||
      quotation.sendVia?.length ||
      quotation.isFinalQuotation === true ||
      ["sent", "final", "approved", "accepted", "shared"].includes(status)
  );

  if (sent) return false;

  // Backward-compatible legacy drafts: older saved quotations did not always
  // persist `isDraft: true`, but an unsent record with no final/sent status is
  // still a draft workspace revision.
  if (quotation.isDraft === true) return true;
  if (["", "draft", "saved", "editing", "in_progress"].includes(status)) return true;

  return false;
}

export function canDeleteQuotationDraft(quotation = {}, user = {}) {
  if (!quotation?.id && !quotation?.quotationId) return false;
  if (!isDraftQuotation(quotation)) return false;
  return canAccess(user, "quotations.delete_draft");
}

function getRevision(item = {}) {
  return Number(item.revision || item.revisionNumber || item.version || 0) || 0;
}

function getStatus(item = {}) {
  if (item.isFinalQuotation === true) return "final";
  return normalize(item.status) || (item.isDraft ? "draft" : "");
}

/**
 * Soft-delete a draft quotation. Sent/final/shared quotations are never deleted.
 * Revision numbers are intentionally not renumbered so history stays stable.
 */
export async function deleteQuotationDraft({ leadId, quotationId, user }) {
  const cleanLeadId = clean(leadId);
  const cleanQuotationId = clean(quotationId);

  if (!cleanLeadId || !cleanQuotationId) {
    throw new Error("Lead and quotation are required.");
  }

  const quotationRef = doc(db, "leads", cleanLeadId, "quotations", cleanQuotationId);
  const quotationSnap = await getDoc(quotationRef);

  if (!quotationSnap.exists()) {
    throw new Error("Draft quotation not found.");
  }

  const quotation = {
    id: quotationSnap.id,
    ...quotationSnap.data()
  };

  if (quotation.isDeleted === true || quotation.deleted === true) {
    return { alreadyDeleted: true };
  }

  if (!isDraftQuotation(quotation)) {
    throw new Error("Only an unsent draft quotation can be deleted.");
  }

  const leadRef = doc(db, "leads", cleanLeadId);
  const leadSnap = await getDoc(leadRef);
  const lead = leadSnap.exists() ? { id: leadSnap.id, ...leadSnap.data() } : null;

  if (!lead || !canAccessRecord(user, "quotations.delete_draft", lead, "lead")) {
    throw new Error("You do not have permission to delete this draft quotation.");
  }

  await updateDoc(quotationRef, {
    isDeleted: true,
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedByUid: clean(user?.uid || user?.id) || null,
    deletedByName: clean(user?.name || user?.displayName || user?.fullName || user?.email) || "System",
    deletedByEmail: clean(user?.email) || null,
    deletionReason: "draft_deleted",
    updatedAt: serverTimestamp()
  });

  // Recalculate pointers without rewriting or renumbering quotation history.
  const quotationListSnap = await getDocs(collection(db, "leads", cleanLeadId, "quotations"));
  const remaining = quotationListSnap.docs
    .filter(item => item.id !== cleanQuotationId)
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.isDeleted !== true && item.deleted !== true)
    .sort((a, b) => getRevision(b) - getRevision(a));

  const remainingDrafts = remaining.filter(isDraftQuotation);
  const latestQuotation = remaining[0] || null;
  const latestDraft = remainingDrafts[0] || null;


  const leadUpdate = {
    latestQuotationId: latestQuotation?.id || null,
    latestQuotationRevision: latestQuotation ? getRevision(latestQuotation) : null,
    latestQuotationStatus: latestQuotation ? getStatus(latestQuotation) : null,
    latestDraftQuotationId: latestDraft?.id || null,
    latestDraftQuotationRevision: latestDraft ? getRevision(latestDraft) : null,
    latestQuotationDraftAt:
      latestDraft?.draftSavedAt || latestDraft?.updatedAt || latestDraft?.createdAt || null,
    latestQuotationDraftByUid:
      latestDraft?.updatedByUid || latestDraft?.createdByUid || null,
    latestQuotationDraftByName:
      latestDraft?.updatedByName || latestDraft?.createdByName || null,
    lastActivityAt: serverTimestamp(),
    lastActivityType: "quotation_draft_deleted",
    lastActivitySummary: `Quotation draft deleted${getRevision(quotation) ? ` - Rev ${getRevision(quotation)}` : ""}`,
    updatedAt: serverTimestamp()
  };

  const deletedWasLatest = clean(lead.latestQuotationId) === cleanQuotationId;
  const stage = normalize(lead.stage).replace(/[\s-]+/g, "_");
  if (deletedWasLatest && !latestQuotation && stage === "quote_pending" && lead.previousStage) {
    leadUpdate.stage = lead.previousStage;
    if (lead.previousStageLabel) leadUpdate.stageLabel = lead.previousStageLabel;
  }

  if (leadSnap.exists()) {
    await updateDoc(leadRef, leadUpdate);
  }

  await logLeadAction({
    leadId: cleanLeadId,
    type: LEAD_TIMELINE_TYPES.QUOTATION,
    title: `Draft quotation deleted${getRevision(quotation) ? ` - Rev ${getRevision(quotation)}` : ""}`,
    description: "Draft quotation removed before it was sent to the customer.",
    metadata: {
      action: "draft_deleted",
      quotationId: cleanQuotationId,
      revision: getRevision(quotation),
      status: "draft",
      softDelete: true
    },
    user
  });

  return {
    quotationId: cleanQuotationId,
    revision: getRevision(quotation),
    softDeleted: true
  };
}

export default deleteQuotationDraft;
