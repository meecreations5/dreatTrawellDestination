"use client";
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resolveUserRole } from "@/lib/rolePermissions";
import {
  DEFAULT_HANDOFF_SETTINGS, handoffDeadline, handoffStatus, isTelecallingHandoff,
  normalizeHandoffSettings, validateFirstContact
} from "@/lib/handoffCore.mjs";

const clean = value => String(value ?? "").trim();
const who = user => ({ uid: clean(user?.uid), name: clean(user?.name || user?.displayName || user?.email), email: clean(user?.email) });
const canReceive = user => user?.active !== false && ["employee", "operation_executive"].includes(resolveUserRole(user));
const isAdmin = user => user?.active !== false && ["admin", "super_admin"].includes(resolveUserRole(user));

export function subscribeMyHandoffs(user, onChange, onError) {
  if (!user?.uid || !canReceive(user)) { onChange?.([]); return () => {}; }
  // Equality-only query avoids a composite-index requirement. The real-time
  // assignment row is also the notification record, not a second copy.
  return onSnapshot(query(collection(db, "travelAgentAssignments"), where("assignedToUid", "==", clean(user.uid))), snap => {
    const records = snap.docs.map(item => ({ id: item.id, ...item.data() }))
      .filter(isTelecallingHandoff)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    onChange?.(records);
  }, onError);
}

export function subscribeHandoffSettings(onChange, onError) {
  return onSnapshot(doc(db, "settings", "telecallingHandoffs"), snap => {
    onChange?.(normalizeHandoffSettings(snap.exists() ? snap.data() : DEFAULT_HANDOFF_SETTINGS));
  }, err => { onChange?.(DEFAULT_HANDOFF_SETTINGS); onError?.(err); });
}

export async function getHandoffSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "telecallingHandoffs"));
    return normalizeHandoffSettings(snap.exists() ? snap.data() : DEFAULT_HANDOFF_SETTINGS);
  } catch {
    // Legacy installations may not yet have this settings read rule. Handover
    // remains usable with the documented default SLA.
    return DEFAULT_HANDOFF_SETTINGS;
  }
}

export async function saveHandoffSettings(user, settings) {
  if (!isAdmin(user)) throw new Error("Only Admin can change the handover contact deadline.");
  const value = normalizeHandoffSettings(settings);
  await setDoc(doc(db, "settings", "telecallingHandoffs"), {
    ...value, updatedByUid: clean(user.uid), updatedAt: serverTimestamp()
  }, { merge: true });
  return value;
}

export async function acceptAssignedHandoff({ handoffId, user }) {
  if (!canReceive(user)) throw new Error("Only the assigned Relationship Executive can accept a handover.");
  const ref = doc(db, "travelAgentAssignments", clean(handoffId));
  const identity = who(user);
  await runTransaction(db, async trx => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error("Handover no longer exists.");
    const record = snap.data();
    if (!isTelecallingHandoff(record) || record.assignedToUid !== identity.uid) throw new Error("This handover was not assigned to you.");
    if (handoffStatus(record) !== "assigned") throw new Error("This handover has already been acknowledged.");
    const agentRef = doc(db, "travelAgents", clean(record.agentId));
    const agentSnap = await trx.get(agentRef);
    if (!agentSnap.exists() || clean(agentSnap.data().assignedToUid || agentSnap.data().accountManagerUid) !== identity.uid) {
      throw new Error("This travel agent is no longer assigned to you. Ask your manager to review it.");
    }
    trx.update(ref, {
      handoffStatus: "accepted", acceptedAt: serverTimestamp(), acceptedByUid: identity.uid,
      acceptedByName: identity.name
    });
  });
}

export async function recordHandoffFirstContact({ handoffId, user, outcome, summary }) {
  if (!canReceive(user)) throw new Error("Only the assigned Relationship Executive can record first contact.");
  const result = validateFirstContact({ outcome, summary });
  const identity = who(user);
  const assignmentRef = doc(db, "travelAgentAssignments", clean(handoffId));
  const engagementRef = doc(collection(db, "engagements"));
  await runTransaction(db, async trx => {
    const assignmentSnap = await trx.get(assignmentRef);
    if (!assignmentSnap.exists()) throw new Error("Handover not found.");
    const record = assignmentSnap.data();
    if (!isTelecallingHandoff(record) || record.assignedToUid !== identity.uid) throw new Error("This agent is not assigned to you.");
    if (handoffStatus(record) !== "accepted") throw new Error("Accept this assignment before recording first contact.");
    const agentRef = doc(db, "travelAgents", clean(record.agentId));
    const agentSnap = await trx.get(agentRef);
    if (!agentSnap.exists() || clean(agentSnap.data().assignedToUid || agentSnap.data().accountManagerUid) !== identity.uid) {
      throw new Error("This agent has been reassigned. Contact your manager.");
    }
    trx.set(engagementRef, {
      entityType: "travelAgent", source: "telecalling_handoff_first_contact", agentId: clean(record.agentId),
      agentName: clean(record.agentName), handoffId: assignmentRef.id,
      channel: "call", subject: result.label, message: clean(summary),
      callAttempted: true, callConnected: Boolean(result.connected),
      callResult: result.connected ? "call_connected" : outcome,
      outcomeCode: result.connected ? "call_connected" : outcome,
      connectionStatus: result.connected ? "connected" : "not_connected",
      meaningfulReply: Boolean(result.connected),
      communicationCategory: "introduction", communicationPurpose: "introduction",
      status: "completed", leadId: null,
      createdByUid: identity.uid, createdByName: identity.name, createdByEmail: identity.email,
      assignedToUid: identity.uid, assignedToName: identity.name,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    trx.update(assignmentRef, {
      ...(result.connected ? {
        handoffStatus: "contacted", firstContactAt: serverTimestamp(),
        firstContactEngagementId: engagementRef.id, firstContactByUid: identity.uid
      } : {}),
      lastContactAttemptAt: serverTimestamp(),
      lastContactAttemptOutcome: outcome,
      contactAttemptCount: Number(record.contactAttemptCount || 0) + 1
    });
  });
  return { engagementId: engagementRef.id, contacted: result.connected };
}
