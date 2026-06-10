import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";

import { db } from "./firebase";
import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

const CLOSED_STAGES = ["closed_won", "closed_lost"];

const STAGE_LABELS = {
  new: "New",
  assigned: "Assigned",
  follow_up: "Follow Up",
  vendor_pricing_requested: "Sent to Vendor for Pricing",
  awaiting_vendor_revert: "Awaiting Vendor Revert",
  quoted: "Quoted",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost"
};

function getStageLabel(stage = "") {
  return STAGE_LABELS[stage] || stage.replaceAll("_", " ");
}

function getUserName(user) {
  return (
    user?.name ||
    user?.displayName ||
    user?.fullName ||
    user?.email ||
    "System"
  );
}

function getUserEmail(user) {
  return user?.email || "";
}

function isClosedStage(stage) {
  return CLOSED_STAGES.includes(stage);
}

export async function updateLeadStage({
  leadId,
  newStage,
  user,
  remark = ""
}) {
  if (!leadId) {
    throw new Error("Lead ID is required");
  }

  if (!newStage) {
    throw new Error("Lead stage is required");
  }

  const cleanRemark = String(remark || "").trim();

  /* =========================
     HARD BUSINESS RULE
  ========================== */
  if (isClosedStage(newStage) && !cleanRemark) {
    throw new Error("Closing remark is mandatory for closed leads");
  }

  const leadRef = doc(db, "leads", leadId);
  const leadSnap = await getDoc(leadRef);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found");
  }

  const lead = {
    id: leadSnap.id,
    ...leadSnap.data()
  };

  const oldStage = lead.stage || "new";

  if (oldStage === newStage) {
    return;
  }

  const oldStageLabel = getStageLabel(oldStage);
  const newStageLabel = getStageLabel(newStage);

  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const closing = isClosedStage(newStage);

  const stageHistoryItem = {
    fromStage: oldStage,
    fromStageLabel: oldStageLabel,

    toStage: newStage,
    toStageLabel: newStageLabel,

    stage: newStage,
    stageLabel: newStageLabel,

    remark: cleanRemark || null,

    changedAt: Timestamp.now(),
    changedBy: userEmail,
    changedByUid: user?.uid || "",
    changedByName: userName,
    changedByEmail: userEmail
  };

  const updatePayload = {
    stage: newStage,
    stageLabel: newStageLabel,

    status: closing ? "closed" : "open",

    previousStage: oldStage,
    previousStageLabel: oldStageLabel,

    stageRemark: cleanRemark || "",
    lastStageRemark: cleanRemark || "",

    stageUpdatedAt: serverTimestamp(),
    stageUpdatedByUid: user?.uid || "",
    stageUpdatedByName: userName,
    stageUpdatedByEmail: userEmail,

    stageHistory: arrayUnion(stageHistoryItem),

    updatedAt: serverTimestamp()
  };

  /* =========================
     SPECIAL FIELDS FOR VENDOR STAGES
  ========================== */
  if (newStage === "vendor_pricing_requested") {
    updatePayload.vendorPricingRequestedAt = serverTimestamp();
    updatePayload.vendorPricingRequestedByUid = user?.uid || "";
    updatePayload.vendorPricingRequestedByName = userName;
    updatePayload.vendorPricingRemark = cleanRemark || "";
  }

  if (newStage === "awaiting_vendor_revert") {
    updatePayload.awaitingVendorRevertAt = serverTimestamp();
    updatePayload.awaitingVendorRevertByUid = user?.uid || "";
    updatePayload.awaitingVendorRevertByName = userName;
    updatePayload.awaitingVendorRevertRemark = cleanRemark || "";
  }

  /* =========================
     SPECIAL FIELDS FOR CLOSURE
  ========================== */
  if (closing) {
    updatePayload.closedAt = serverTimestamp();
    updatePayload.closedByUid = user?.uid || "";
    updatePayload.closedByName = userName;
    updatePayload.closedByEmail = userEmail;

    updatePayload.closingStage = newStage;
    updatePayload.closingStageLabel = newStageLabel;

    updatePayload.closingRemark = cleanRemark;
    updatePayload.closeRemark = cleanRemark;
    updatePayload.closedReason = cleanRemark;
  }

  await updateDoc(leadRef, updatePayload);

  /* =========================
     TIMELINE
  ========================== */
  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.STAGE_CHANGED || "stage",
    title: closing
      ? `Lead ${newStageLabel}`
      : `Stage changed to ${newStageLabel}`,
    description: cleanRemark
      ? cleanRemark
      : `Lead moved from ${oldStageLabel} to ${newStageLabel}`,
    metadata: {
      action: closing ? "lead_closed" : "stage_changed",

      oldStage,
      oldStageLabel,

      newStage,
      newStageLabel,

      stage: newStage,
      stageLabel: newStageLabel,

      remark: cleanRemark || "",
      closingRemark: closing ? cleanRemark : "",

      status: closing ? "closed" : "open",

      changedByUid: user?.uid || "",
      changedByName: userName,
      changedByEmail: userEmail
    },
    user
  });
}