import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { cancelPendingAgentTasks } from "@/lib/engagementTaskService";
import {
  getTravelAgentStatusMeta,
  outcomeToTravelAgentStatus
} from "@/lib/travelAgentStatus";

function getUserUid(user = {}) {
  return user?.uid || user?.id || user?.userId || "";
}

function getUserName(user = {}) {
  return (
    user?.name ||
    user?.displayName ||
    user?.fullName ||
    user?.email ||
    "Team member"
  );
}

function getUserEmail(user = {}) {
  return user?.email || user?.userEmail || "";
}

/**
 * Synchronize a permanent engagement outcome back to the Travel Agent master.
 *
 * Temporary outcomes (for example no response, busy, follow-up required) return
 * updated=false and never change the Travel Agent master status.
 *
 * Permanent outcomes currently include Invalid Number, Business Shut Down /
 * Not in Business, Not Interested, Wrong Details and Do Not Contact.
 */
export async function syncTravelAgentStatusFromEngagement({
  agentId = "",
  engagementId = "",
  outcomeCode = "",
  outcomeLabel = "",
  user = null
} = {}) {
  const safeAgentId = String(agentId || "").trim();
  const nextStatus = outcomeToTravelAgentStatus(outcomeCode);

  if (!safeAgentId || !nextStatus) {
    return {
      updated: false,
      status: "",
      statusLabel: "",
      cancelledTaskCount: 0
    };
  }

  const meta = getTravelAgentStatusMeta(nextStatus);
  const reason = outcomeLabel || meta.label;

  await updateDoc(doc(db, "travelAgents", safeAgentId), {
    status: nextStatus,
    active: nextStatus === "active",
    statusReason: reason,
    statusSource: "engagement_outcome",
    statusUpdatedFromEngagementId: engagementId || "",
    statusUpdatedFromEngagementOutcome: String(outcomeCode || "").trim(),
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedByUid: getUserUid(user),
    statusUpdatedByName: getUserName(user),
    statusUpdatedByEmail: getUserEmail(user),

    // Permanent non-contactable outcomes must also stop the active cadence so
    // the same unusable Travel Agent is not automatically queued again.
    nextEngagementAt: null,
    nextEngagementTaskId: "",
    newAgentSequenceActive: false,
    cadenceUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  let cancelledTaskCount = 0;
  let cancellationError = null;

  try {
    cancelledTaskCount = await cancelPendingAgentTasks({
      agentId: safeAgentId,
      user,
      reason: `Travel agent status changed to ${meta.label} from engagement outcome`
    });
  } catch (error) {
    cancellationError = error;
    console.error(
      "Travel Agent status was synchronized, but pending task cancellation failed:",
      error
    );
  }

  return {
    updated: true,
    status: nextStatus,
    statusLabel: meta.label,
    cancelledTaskCount,
    cancellationError
  };
}
