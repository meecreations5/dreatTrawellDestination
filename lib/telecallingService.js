"use client";

import {
  collection, doc, runTransaction, serverTimestamp, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getHandoffSettings } from "@/lib/handoffService";
import { handoffDeadline } from "@/lib/handoffCore.mjs";
import { getPreferredTelecallingContact } from "@/lib/telecallingContacts.mjs";
import { canAccess, resolveUserRole } from "@/lib/rolePermissions";
import {
  validateTelecall, isAgentUnassigned, isAgentContactable, isHandoffEligible,
  canReceiveTelecallerHandoff
} from "@/lib/telecallingCore.mjs";

const clean = value => String(value || "").trim();
const actor = user => ({ uid: clean(user?.uid), name: clean(user?.name || user?.displayName || user?.email), email: clean(user?.email) });
const allowedCaller = user => user && user.active !== false && ["telecaller", "admin", "super_admin", "manager"].includes(resolveUserRole(user));

export async function recordTelecall({ agentId, spocIndex = 0, outcome, summary, followUpAt, user }) {
  if (!allowedCaller(user) || !canAccess(user, "telecalling.call")) throw new Error("Not allowed to record telecalls.");
  const outcomeInfo = validateTelecall({ outcome, summary, followUpAt });
  const agentRef = doc(db, "travelAgents", clean(agentId));
  const engagementRef = doc(collection(db, "engagements"));
  const who = actor(user);
  await runTransaction(db, async trx => {
    const agentSnap = await trx.get(agentRef);
    if (!agentSnap.exists()) throw new Error("Travel agent not found.");
    const agent = agentSnap.data();
    if (!isAgentUnassigned(agent)) throw new Error("This agent has already been handed over. Open its regular Engagement history instead.");
    if (!isAgentContactable(agent)) throw new Error("This agent is non-contactable or opted out. Admin must review the status before another call.");
    const spoc = Array.isArray(agent.spocs) && agent.spocs[Number(spocIndex)]
      ? agent.spocs[Number(spocIndex)]
      : getPreferredTelecallingContact(agent);
    const qualification = outcomeInfo.qualified ? "qualified" :
      (["not_interested", "invalid_number"].includes(outcome) ? "not_qualified" :
        (agent.telecallerQualification === "qualified" ? "qualified" : "not_qualified"));
    const details = {
      entityType: "travelAgent", source: "telecalling", agentId: agentRef.id,
      agentName: clean(agent.agencyName || agent.name), spoc,
      channel: "call", subject: outcomeInfo.label, message: clean(summary),
      callResult: outcomeInfo.connected ? "call_connected" : outcome,
      outcomeCode: outcomeInfo.connected ? "call_connected" : outcome,
      outcomeLabel: outcomeInfo.label,
      callAttempted: true, callConnected: Boolean(outcomeInfo.connected),
      connectionStatus: outcomeInfo.connected ? "connected" : "not_connected",
      meaningfulReply: Boolean(outcomeInfo.connected),
      callSourceOutcome: outcome,
      communicationCategory: "introduction", communicationPurpose: "introduction",
      agentResponseStatus: outcome === "interested" ? "interested" : outcome === "not_interested" ? "not_interested" : "not_confirmed",
      status: "completed", scheduledAt: followUpAt ? Timestamp.fromDate(new Date(followUpAt)) : null,
      createdByUid: who.uid, createdByName: who.name, createdByEmail: who.email,
      assignedToUid: who.uid, assignedToName: who.name, leadId: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    trx.set(engagementRef, details);
    trx.update(agentRef, {
      telecallerLastCalledByUid: who.uid,
      telecallerLastCalledByName: who.name,
      telecallerLastOutcome: outcome,
      telecallerLastSummary: clean(summary),
      telecallerLastCallAt: serverTimestamp(),
      telecallerQualification: qualification,
      telecallerCallCount: Number(agent.telecallerCallCount || 0) + 1,
      ...(outcomeInfo.connected ? { telecallerLastConnectedAt: serverTimestamp() } : {}),
      telecallerFollowUpAt: followUpAt ? Timestamp.fromDate(new Date(followUpAt)) : null,
      updatedAt: serverTimestamp()
    });
  });
  return { engagementId: engagementRef.id, qualified: outcomeInfo.qualified };
}

export async function handoffTelecalledAgent({ agentId, assigneeUid, reason, user }) {
  if (!allowedCaller(user) || !canAccess(user, "telecalling.assign")) throw new Error("Not allowed to assign telecalled agents.");
  const id = clean(agentId), assignee = clean(assigneeUid), handoffReason = clean(reason);
  if (!id || !assignee) throw new Error("Agent and Relationship Executive are required.");
  if (handoffReason.length < 5) throw new Error("Enter a short reason for the handover.");
  const agentRef = doc(db, "travelAgents", id);
  const userRef = doc(db, "users", assignee);
  const assignmentRef = doc(collection(db, "travelAgentAssignments"));
  const who = actor(user);
  let assignedAuthUid = "";
  const settings = await getHandoffSettings();
  const firstContactDueAt = Timestamp.fromDate(handoffDeadline(new Date(), settings));
  await runTransaction(db, async trx => {
    const [agentSnap, userSnap] = await Promise.all([trx.get(agentRef), trx.get(userRef)]);
    if (!agentSnap.exists() || !userSnap.exists()) throw new Error("Agent or executive no longer exists.");
    const agent = agentSnap.data(), target = userSnap.data();
    if (!isAgentUnassigned(agent)) throw new Error("This travel agent was already assigned. Refresh the list.");
    if (!isHandoffEligible(agent)) throw new Error("Record a connected, interested call before handing the agent over.");
    if (!canReceiveTelecallerHandoff(target)) throw new Error("Choose an active Engagement / Relationship Executive.");
    // The /users document key may differ from the Firebase Authentication UID.
    // Assignment ownership, Firestore queries, and notifications use auth UID.
    const targetAuthUid = clean(target.uid || userSnap.id);
    assignedAuthUid = targetAuthUid;
    if (!targetAuthUid) throw new Error("This executive is missing a Firebase user identity.");
    const assigneeName = clean(target.name || target.displayName || target.fullName || target.email);
    const assigneeEmail = clean(target.email || target.workEmail || target.officialEmail);
    const team = clean(target.teamName || target.team || target.department);
    const contact = getPreferredTelecallingContact(agent);
    trx.update(agentRef, {
      assignedToUid: targetAuthUid, accountManagerUid: targetAuthUid,
      assignedToName: assigneeName, assignedToEmail: assigneeEmail,
      assignedTo: assigneeEmail || assigneeName, assignedTeam: team,
      assignedRole: "Relationship Executive", assignmentStatus: "Assigned",
      assignmentPriority: "Medium", assignedAt: serverTimestamp(),
      assignedByUid: who.uid, assignedByName: who.name,
      telecallerHandoffAt: serverTimestamp(), telecallerHandoffByUid: who.uid,
      telecallerHandoffByName: who.name, telecallerHandoffReason: handoffReason,
      updatedAt: serverTimestamp(), updatedByUid: who.uid
    });
    trx.set(assignmentRef, {
      agentId: id, agentName: clean(agent.agencyName || agent.name),
      assignedToUid: targetAuthUid, assignedToUserDocId: userSnap.id,
      assignedToName: assigneeName, assignedToEmail: assigneeEmail,
      assignedTeam: team, assignedRole: "Relationship Executive",
      previousAssignedToUid: "", previousAssignedToName: "",
      assignmentStatus: "Assigned", assignmentPriority: "Medium",
      assignmentReason: handoffReason, source: "telecalling",
      handoffType: "telecalling_handoff", handoffStatus: "assigned",
      firstContactDueAt, firstContactHours: settings.firstContactHours,
      acceptedAt: null, firstContactAt: null, contactAttemptCount: 0,
      contactName: clean(contact.name && contact.name !== "Agency / office" ? contact.name : ""),
      contactPhone: clean(contact.phone),
      contactEmail: clean(contact.email),
      lastCallSummary: clean(agent.telecallerLastSummary),
      lastCallOutcome: clean(agent.telecallerLastOutcome),
      assignedByUid: who.uid, assignedByName: who.name,
      createdAt: serverTimestamp()
    });
  });
  return { agentId: id, assignedToUid: assignedAuthUid, assignedToUserDocId: assignee };
}
