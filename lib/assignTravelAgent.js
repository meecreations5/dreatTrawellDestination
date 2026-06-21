// src/lib/assignTravelAgent.js

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/* =========================
   CONSTANTS
========================= */

export const ASSIGNMENT_ROLES = [
  "Account Manager",
  "Sales Executive",
  "Relationship Manager",
  "Team Lead",
  "Operations SPOC",
  "Accounts SPOC"
];

export const ASSIGNMENT_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

export const ASSIGNMENT_STATUSES = [
  "Unassigned",
  "Assigned",
  "Reassigned",
  "On Hold"
];

/* =========================
   USER HELPERS
========================= */

export function getUserName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.employeeName ||
    user?.email ||
    user?.workEmail ||
    "Unknown User"
  );
}

export function getUserEmail(user) {
  return (
    user?.email ||
    user?.workEmail ||
    user?.officialEmail ||
    ""
  );
}

export function getUserTeam(user) {
  return (
    user?.team ||
    user?.teamName ||
    user?.department ||
    user?.departmentName ||
    ""
  );
}

export function getUserUid(user) {
  return user?.uid || user?.id || "";
}

/* =========================
   AGENT HELPERS
========================= */

export function getAgentName(agent) {
  return (
    agent?.agencyName ||
    agent?.name ||
    agent?.agentName ||
    "Untitled Travel Agent"
  );
}

export function getCurrentAssignedUid(agent) {
  return (
    agent?.assignedToUid ||
    agent?.accountManagerUid ||
    ""
  );
}

export function getCurrentAssignedName(agent) {
  return (
    agent?.assignedToName ||
    agent?.assignedTo ||
    ""
  );
}

export function getAssignmentStatus(agent) {
  if (agent?.assignmentStatus) return agent.assignmentStatus;

  return getCurrentAssignedUid(agent) || getCurrentAssignedName(agent)
    ? "Assigned"
    : "Unassigned";
}

/* =========================
   ASSIGN TRAVEL AGENT
========================= */

export async function assignTravelAgent({
  agent,
  assignee,
  currentUser,
  assignedRole = "Account Manager",
  assignedTeam = "",
  assignmentPriority = "Medium",
  assignmentReason = ""
}) {
  if (!agent?.id) {
    throw new Error("Travel agent id is required.");
  }

  if (!assignee) {
    throw new Error("Assignee is required.");
  }

  const assigneeUid = getUserUid(assignee);

  if (!assigneeUid) {
    throw new Error("Assignee uid is required.");
  }

  const previousAssignedToUid = getCurrentAssignedUid(agent);
  const previousAssignedToName = getCurrentAssignedName(agent);

  const assignedToName = getUserName(assignee);
  const assignedToEmail = getUserEmail(assignee);
  const finalAssignedTeam = assignedTeam || getUserTeam(assignee);

  const assignedByUid = getUserUid(currentUser);
  const assignedByName = getUserName(currentUser);

  const assignmentStatus = previousAssignedToUid
    ? "Reassigned"
    : "Assigned";

  const agentRef = doc(db, "travelAgents", agent.id);

  const updatePayload = {
    assignedToUid: assigneeUid,
    assignedToName,
    assignedToEmail,
    assignedTeam: finalAssignedTeam,
    assignedRole,
    assignmentPriority,
    assignmentStatus,

    assignedAt: serverTimestamp(),
    assignedByUid,
    assignedByName,

    // Backward-compatible fields for existing Travel Agent module
    assignedTo: assignedToEmail || assignedToName,
    accountManagerUid: assigneeUid,
    team: finalAssignedTeam,

    updatedAt: serverTimestamp(),
    updatedByUid: assignedByUid
  };

  await updateDoc(agentRef, updatePayload);

  const historyPayload = {
    agentId: agent.id,
    agentName: getAgentName(agent),

    assignedToUid: assigneeUid,
    assignedToName,
    assignedToEmail,
    assignedTeam: finalAssignedTeam,
    assignedRole,

    previousAssignedToUid,
    previousAssignedToName,

    assignmentStatus,
    assignmentPriority,
    assignmentReason: assignmentReason || "",

    assignedByUid,
    assignedByName,

    createdAt: serverTimestamp()
  };

  const historyRef = await addDoc(
    collection(db, "travelAgentAssignments"),
    historyPayload
  );

  return {
    agentId: agent.id,
    historyId: historyRef.id,
    assignmentStatus,
    assignedToUid: assigneeUid,
    assignedToName,
    assignedToEmail,
    assignedTeam: finalAssignedTeam,
    assignedRole,
    assignmentPriority
  };
}

/* =========================
   UNASSIGN TRAVEL AGENT
========================= */

export async function unassignTravelAgent({
  agent,
  currentUser,
  assignmentReason = "Marked as unassigned."
}) {
  if (!agent?.id) {
    throw new Error("Travel agent id is required.");
  }

  const previousAssignedToUid = getCurrentAssignedUid(agent);
  const previousAssignedToName = getCurrentAssignedName(agent);

  const assignedByUid = getUserUid(currentUser);
  const assignedByName = getUserName(currentUser);

  const agentRef = doc(db, "travelAgents", agent.id);

  await updateDoc(agentRef, {
    assignedToUid: "",
    assignedToName: "",
    assignedToEmail: "",
    assignedTeam: "",
    assignedRole: "",
    assignmentPriority: "Medium",
    assignmentStatus: "Unassigned",

    assignedAt: null,
    assignedByUid: "",
    assignedByName: "",

    // Backward-compatible clear
    assignedTo: "",
    accountManagerUid: "",

    updatedAt: serverTimestamp(),
    updatedByUid: assignedByUid
  });

  const historyPayload = {
    agentId: agent.id,
    agentName: getAgentName(agent),

    assignedToUid: "",
    assignedToName: "",
    assignedToEmail: "",
    assignedTeam: "",
    assignedRole: "",

    previousAssignedToUid,
    previousAssignedToName,

    assignmentStatus: "Unassigned",
    assignmentPriority: agent.assignmentPriority || "Medium",
    assignmentReason,

    assignedByUid,
    assignedByName,

    createdAt: serverTimestamp()
  };

  const historyRef = await addDoc(
    collection(db, "travelAgentAssignments"),
    historyPayload
  );

  return {
    agentId: agent.id,
    historyId: historyRef.id,
    assignmentStatus: "Unassigned"
  };
}

/* =========================
   HOLD ASSIGNMENT
========================= */

export async function putTravelAgentAssignmentOnHold({
  agent,
  currentUser,
  assignmentReason = ""
}) {
  if (!agent?.id) {
    throw new Error("Travel agent id is required.");
  }

  const assignedByUid = getUserUid(currentUser);
  const assignedByName = getUserName(currentUser);

  const agentRef = doc(db, "travelAgents", agent.id);

  await updateDoc(agentRef, {
    assignmentStatus: "On Hold",
    updatedAt: serverTimestamp(),
    updatedByUid: assignedByUid
  });

  const historyPayload = {
    agentId: agent.id,
    agentName: getAgentName(agent),

    assignedToUid: getCurrentAssignedUid(agent),
    assignedToName: getCurrentAssignedName(agent),
    assignedToEmail: agent.assignedToEmail || "",
    assignedTeam: agent.assignedTeam || agent.team || "",
    assignedRole: agent.assignedRole || "",

    previousAssignedToUid: getCurrentAssignedUid(agent),
    previousAssignedToName: getCurrentAssignedName(agent),

    assignmentStatus: "On Hold",
    assignmentPriority: agent.assignmentPriority || "Medium",
    assignmentReason: assignmentReason || "Assignment moved on hold.",

    assignedByUid,
    assignedByName,

    createdAt: serverTimestamp()
  };

  const historyRef = await addDoc(
    collection(db, "travelAgentAssignments"),
    historyPayload
  );

  return {
    agentId: agent.id,
    historyId: historyRef.id,
    assignmentStatus: "On Hold"
  };
}

/* =========================
   CHANGE ASSIGNMENT PRIORITY
========================= */

export async function updateTravelAgentAssignmentPriority({
  agent,
  currentUser,
  assignmentPriority,
  assignmentReason = ""
}) {
  if (!agent?.id) {
    throw new Error("Travel agent id is required.");
  }

  if (!assignmentPriority) {
    throw new Error("Assignment priority is required.");
  }

  const assignedByUid = getUserUid(currentUser);
  const assignedByName = getUserName(currentUser);

  const previousPriority = agent.assignmentPriority || "Medium";

  const agentRef = doc(db, "travelAgents", agent.id);

  await updateDoc(agentRef, {
    assignmentPriority,
    updatedAt: serverTimestamp(),
    updatedByUid: assignedByUid
  });

  const historyPayload = {
    agentId: agent.id,
    agentName: getAgentName(agent),

    assignedToUid: getCurrentAssignedUid(agent),
    assignedToName: getCurrentAssignedName(agent),
    assignedToEmail: agent.assignedToEmail || "",
    assignedTeam: agent.assignedTeam || agent.team || "",
    assignedRole: agent.assignedRole || "",

    previousAssignedToUid: getCurrentAssignedUid(agent),
    previousAssignedToName: getCurrentAssignedName(agent),

    assignmentStatus: "Priority Updated",
    previousAssignmentPriority: previousPriority,
    assignmentPriority,
    assignmentReason:
      assignmentReason ||
      `Priority changed from ${previousPriority} to ${assignmentPriority}.`,

    assignedByUid,
    assignedByName,

    createdAt: serverTimestamp()
  };

  const historyRef = await addDoc(
    collection(db, "travelAgentAssignments"),
    historyPayload
  );

  return {
    agentId: agent.id,
    historyId: historyRef.id,
    assignmentPriority
  };
}

/* =========================
   FETCH ASSIGNMENT HISTORY
========================= */

export async function getTravelAgentAssignmentHistory(agentId) {
  if (!agentId) return [];

  const q = query(
    collection(db, "travelAgentAssignments"),
    where("agentId", "==", agentId)
  );

  const snap = await getDocs(q);

  const rows = snap.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  return rows.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

/* =========================
   BULK ASSIGN
========================= */

export async function bulkAssignTravelAgents({
  agents = [],
  assignee,
  currentUser,
  assignedRole = "Account Manager",
  assignedTeam = "",
  assignmentPriority = "Medium",
  assignmentReason = ""
}) {
  if (!Array.isArray(agents) || agents.length === 0) {
    throw new Error("At least one travel agent is required.");
  }

  const results = [];

  for (const agent of agents) {
    const result = await assignTravelAgent({
      agent,
      assignee,
      currentUser,
      assignedRole,
      assignedTeam,
      assignmentPriority,
      assignmentReason:
        assignmentReason || "Bulk assignment from travel agent module."
    });

    results.push(result);
  }

  return results;
}