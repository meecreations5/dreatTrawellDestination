import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

import { db } from "./firebase";

export const WORK_TASK_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  WAITING: "waiting",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled"
};

export const WORK_TASK_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
  { value: "cancelled", label: "Cancelled" }
];

export const WORK_TASK_TYPES = [
  { value: "quote_follow_up", label: "Quote", group: "lead" },
  { value: "requote_follow_up", label: "Re-Quote", group: "lead" },
  { value: "vendor_coordination", label: "Vendor Coordination", group: "lead" },
  { value: "quote_creation", label: "Quote Creation", group: "lead" },
  { value: "lead_follow_up", label: "Lead Follow-up", group: "lead" },
  { value: "group_coordination", label: "Group Coordination", group: "on_ground" },
  { value: "supplier_coordination", label: "Supplier Coordination", group: "on_ground" },
  { value: "ticket_editing", label: "Ticket Editing", group: "on_ground" }
];

export const WORK_TASK_GROUPS = [
  { value: "lead", label: "Lead Activity" },
  { value: "on_ground", label: "On-ground Activity" },
  { value: "engagement", label: "Engagement Follow-up" }
];

export const WORK_TASK_PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

const OPEN_STATUSES = new Set([
  WORK_TASK_STATUS.PENDING,
  WORK_TASK_STATUS.IN_PROGRESS,
  WORK_TASK_STATUS.WAITING
]);

function clean(value) {
  return String(value || "").trim();
}

function userIdentity(user = {}) {
  return {
    uid: clean(user.uid || user.id || user.userUid),
    name: clean(user.name || user.displayName || user.fullName || user.email || "Team Member"),
    email: clean(user.email || user.workEmail || user.officialEmail)
  };
}

function memberIdentity(member = {}, fallbackUser = {}) {
  const fallback = userIdentity(fallbackUser);
  return {
    uid: clean(member.uid || member.key || fallback.uid),
    name: clean(member.name || member.label || fallback.name),
    email: clean(member.email || fallback.email),
    team: clean(member.team || "")
  };
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toTimestamp(value) {
  const date = toDate(value);
  return date ? Timestamp.fromDate(date) : null;
}

function dateKey(value = new Date()) {
  const date = toDate(value) || new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function typeMeta(type) {
  return WORK_TASK_TYPES.find(item => item.value === type) || {
    value: clean(type) || "lead_follow_up",
    label: clean(type) || "Work Task",
    group: "lead"
  };
}

function leadSnapshot(lead = {}) {
  return {
    leadId: clean(lead.id || lead.leadId),
    leadCode: clean(lead.leadCode || lead.code),
    leadName: clean(lead.leadName || lead.customerName || lead.clientName || lead.contactName),
    travelAgentId: clean(lead.travelAgentId || lead.agentId || lead.agencyId),
    travelAgentName: clean(lead.travelAgentName || lead.agentName || lead.agencyName),
    destinationName: clean(lead.destinationName || lead.destination || lead.primaryDestination)
  };
}

async function logWorkActivityEvent({
  task = {},
  eventType,
  fromStatus = "",
  toStatus = "",
  note = "",
  user,
  extra = {}
}) {
  const performer = userIdentity(user);
  const now = new Date();

  try {
    await addDoc(collection(db, "workActivityEvents"), {
      taskId: clean(task.id || task.taskId),
      taskType: clean(task.activityType || task.taskType),
      taskTypeLabel: clean(task.activityTypeLabel || task.title),
      taskGroup: clean(task.activityGroup || task.group),
      title: clean(task.title || task.activityTypeLabel || "Work Activity"),
      leadId: clean(task.leadId),
      leadCode: clean(task.leadCode),
      travelAgentId: clean(task.travelAgentId || task.agentId),
      travelAgentName: clean(task.travelAgentName || task.agentName),
      destinationName: clean(task.destinationName),
      assignedToUid: clean(task.assignedToUid),
      assignedToName: clean(task.assignedToName),
      assignedToEmail: clean(task.assignedToEmail),
      assignedTeam: clean(task.assignedTeam),
      eventType: clean(eventType),
      fromStatus: clean(fromStatus),
      toStatus: clean(toStatus),
      note: clean(note),
      performedByUid: performer.uid,
      performedByName: performer.name,
      performedByEmail: performer.email,
      activityDateKey: dateKey(now),
      activityAtClient: Timestamp.fromDate(now),
      activityAt: serverTimestamp(),
      ...extra
    });
  } catch (error) {
    console.warn("Unable to write work activity event:", error);
  }
}

export async function createWorkTask({
  activityType,
  lead = null,
  dueAt,
  priority = "normal",
  note = "",
  assignedMember = null,
  user,
  source = "manual_action_center"
}) {
  if (!user) throw new Error("User is required.");

  const meta = typeMeta(activityType);
  const assigned = memberIdentity(assignedMember || {}, user);
  const leadData = leadSnapshot(lead || {});
  const dueDate = toDate(dueAt);

  if (!dueDate) throw new Error("Please select a valid due date and time.");

  const ref = doc(collection(db, "workTasks"));
  const payload = {
    taskId: ref.id,
    activityType: meta.value,
    activityTypeLabel: meta.label,
    activityGroup: meta.group,
    title: meta.label,
    ...leadData,
    dueAt: Timestamp.fromDate(dueDate),
    originalDueAt: Timestamp.fromDate(dueDate),
    priority: clean(priority) || "normal",
    note: clean(note),
    status: WORK_TASK_STATUS.PENDING,
    statusLabel: "Pending",
    assignedToUid: assigned.uid,
    assignedToName: assigned.name,
    assignedToEmail: assigned.email,
    assignedTeam: assigned.team,
    source,
    startedAt: null,
    waitingAt: null,
    completedAt: null,
    skippedAt: null,
    cancelledAt: null,
    lastStatusNote: "",
    createdByUid: userIdentity(user).uid,
    createdByName: userIdentity(user).name,
    createdByEmail: userIdentity(user).email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(ref, payload);
  await logWorkActivityEvent({ task: { id: ref.id, ...payload }, eventType: "task_created", toStatus: "pending", note, user });
  return { id: ref.id, ...payload };
}

export async function updateWorkTaskStatus({ task, taskId, status, note = "", user }) {
  const id = clean(taskId || task?.id || task?.taskId);
  if (!id) throw new Error("Task ID is required.");
  if (!Object.values(WORK_TASK_STATUS).includes(status)) throw new Error("Invalid task status.");

  const previous = clean(task?.status || "pending");
  const performer = userIdentity(user);
  const update = {
    status,
    statusLabel: WORK_TASK_STATUS_OPTIONS.find(item => item.value === status)?.label || status,
    lastStatusNote: clean(note),
    lastStatusChangedAt: serverTimestamp(),
    lastStatusChangedByUid: performer.uid,
    lastStatusChangedByName: performer.name,
    updatedAt: serverTimestamp()
  };

  if (status === WORK_TASK_STATUS.IN_PROGRESS) {
    update.startedAt = serverTimestamp();
    update.startedByUid = performer.uid;
    update.startedByName = performer.name;
  }
  if (status === WORK_TASK_STATUS.WAITING) {
    update.waitingAt = serverTimestamp();
    update.waitingByUid = performer.uid;
    update.waitingByName = performer.name;
  }
  if (status === WORK_TASK_STATUS.COMPLETED) {
    update.completedAt = serverTimestamp();
    update.completedByUid = performer.uid;
    update.completedByName = performer.name;
  }
  if (status === WORK_TASK_STATUS.SKIPPED) {
    update.skippedAt = serverTimestamp();
    update.skippedByUid = performer.uid;
    update.skippedByName = performer.name;
  }
  if (status === WORK_TASK_STATUS.CANCELLED) {
    update.cancelledAt = serverTimestamp();
    update.cancelledByUid = performer.uid;
    update.cancelledByName = performer.name;
  }

  await updateDoc(doc(db, "workTasks", id), update);
  await logWorkActivityEvent({
    task: { ...(task || {}), id },
    eventType: "status_changed",
    fromStatus: previous,
    toStatus: status,
    note,
    user
  });
  return true;
}

export async function rescheduleWorkTask({ task, taskId, dueAt, note = "", user }) {
  const id = clean(taskId || task?.id || task?.taskId);
  const dueDate = toDate(dueAt);
  if (!id) throw new Error("Task ID is required.");
  if (!dueDate) throw new Error("Please select a valid due date and time.");

  const performer = userIdentity(user);
  await updateDoc(doc(db, "workTasks", id), {
    dueAt: Timestamp.fromDate(dueDate),
    status: WORK_TASK_STATUS.PENDING,
    statusLabel: "Pending",
    rescheduledAt: serverTimestamp(),
    rescheduledByUid: performer.uid,
    rescheduledByName: performer.name,
    rescheduleNote: clean(note),
    updatedAt: serverTimestamp()
  });

  await logWorkActivityEvent({
    task: { ...(task || {}), id },
    eventType: "task_rescheduled",
    fromStatus: clean(task?.status),
    toStatus: WORK_TASK_STATUS.PENDING,
    note,
    user,
    extra: { dueAt: Timestamp.fromDate(dueDate) }
  });
  return true;
}

export async function syncLeadWorkTasksAfterFollowUp({
  lead,
  followUpId,
  nextFollowUpAt = null,
  summary = "",
  outcome = "",
  user
}) {
  const leadId = clean(lead?.id || lead?.leadId);
  if (!leadId || !followUpId || !user) return { completedTaskId: "", nextTaskId: "" };

  let completedTaskId = "";
  const snap = await getDocs(query(collection(db, "workTasks"), where("leadId", "==", leadId)));
  const openLeadFollowUps = snap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.activityType === "lead_follow_up" && OPEN_STATUSES.has(item.status));

  const completionNote = clean(summary) || "Lead follow-up completed";
  const primary = openLeadFollowUps.sort((a, b) => {
    const aDue = toDate(a.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER;
    const bDue = toDate(b.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  })[0];

  if (primary) {
    completedTaskId = primary.id;
    await updateWorkTaskStatus({
      task: primary,
      status: WORK_TASK_STATUS.COMPLETED,
      note: completionNote,
      user
    });
    await updateDoc(doc(db, "workTasks", primary.id), {
      completedByFollowUpId: followUpId,
      followUpOutcome: clean(outcome),
      updatedAt: serverTimestamp()
    });
  } else {
    const ref = doc(db, "workTasks", `lead_followup_done__${followUpId}`);
    const assigned = memberIdentity({}, user);
    const leadData = leadSnapshot(lead);
    const now = new Date();
    const payload = {
      taskId: ref.id,
      activityType: "lead_follow_up",
      activityTypeLabel: "Lead Follow-up",
      activityGroup: "lead",
      title: "Lead Follow-up",
      ...leadData,
      dueAt: Timestamp.fromDate(now),
      originalDueAt: Timestamp.fromDate(now),
      priority: "normal",
      note: completionNote,
      status: WORK_TASK_STATUS.COMPLETED,
      statusLabel: "Completed",
      assignedToUid: assigned.uid,
      assignedToName: assigned.name,
      assignedToEmail: assigned.email,
      assignedTeam: assigned.team,
      source: "lead_follow_up_auto",
      completedAt: serverTimestamp(),
      completedByUid: assigned.uid,
      completedByName: assigned.name,
      completedByFollowUpId: followUpId,
      followUpOutcome: clean(outcome),
      createdByUid: assigned.uid,
      createdByName: assigned.name,
      createdByEmail: assigned.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, payload, { merge: true });
    completedTaskId = ref.id;
    await logWorkActivityEvent({
      task: { id: ref.id, ...payload },
      eventType: "lead_follow_up_completed",
      toStatus: WORK_TASK_STATUS.COMPLETED,
      note: completionNote,
      user,
      extra: { followUpId, followUpOutcome: clean(outcome) }
    });
  }

  for (const extraTask of openLeadFollowUps.filter(item => item.id !== completedTaskId)) {
    await updateWorkTaskStatus({
      task: extraTask,
      status: WORK_TASK_STATUS.CANCELLED,
      note: "Superseded by a newer lead follow-up",
      user
    });
  }

  let nextTaskId = "";
  const nextDate = toDate(nextFollowUpAt);
  if (nextDate) {
    const assigned = memberIdentity(
      {
        uid: lead?.assignedToUid || lead?.assigneeUid || "",
        name: lead?.assignedToName || lead?.assigneeName || "",
        email: lead?.assignedToEmail || lead?.assigneeEmail || "",
        team: lead?.assignedTeam || lead?.assignedToTeam || ""
      },
      user
    );
    const leadData = leadSnapshot(lead);
    const ref = doc(db, "workTasks", `lead_followup_next__${followUpId}`);
    const payload = {
      taskId: ref.id,
      activityType: "lead_follow_up",
      activityTypeLabel: "Lead Follow-up",
      activityGroup: "lead",
      title: "Lead Follow-up",
      ...leadData,
      dueAt: Timestamp.fromDate(nextDate),
      originalDueAt: Timestamp.fromDate(nextDate),
      priority: "normal",
      note: clean(summary),
      status: WORK_TASK_STATUS.PENDING,
      statusLabel: "Pending",
      assignedToUid: assigned.uid,
      assignedToName: assigned.name,
      assignedToEmail: assigned.email,
      assignedTeam: assigned.team,
      source: "lead_follow_up_auto",
      sourceFollowUpId: followUpId,
      createdByUid: assigned.uid,
      createdByName: assigned.name,
      createdByEmail: assigned.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, payload, { merge: true });
    nextTaskId = ref.id;
    await logWorkActivityEvent({
      task: { id: ref.id, ...payload },
      eventType: "lead_follow_up_scheduled",
      toStatus: WORK_TASK_STATUS.PENDING,
      note: clean(summary),
      user,
      extra: { followUpId, dueAt: Timestamp.fromDate(nextDate) }
    });
  }

  return { completedTaskId, nextTaskId };
}

export async function recordDailyActivity({
  activityType = "lead_activity",
  activityTypeLabel = "Lead Activity",
  activityGroup = "lead",
  title = "Lead Activity",
  lead = null,
  eventType = "activity_logged",
  note = "",
  status = "logged",
  user,
  extra = {}
}) {
  const leadData = leadSnapshot(lead || {});
  return logWorkActivityEvent({
    task: {
      activityType,
      activityTypeLabel,
      activityGroup,
      title,
      ...leadData
    },
    eventType,
    toStatus: status,
    note,
    user,
    extra: { activityKind: "timeline", ...extra }
  });
}

export function isOpenWorkTask(task = {}) {
  return OPEN_STATUSES.has(clean(task.status));
}
