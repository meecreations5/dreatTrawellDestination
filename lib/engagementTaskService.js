// lib/engagementTaskService.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";

import { db } from "./firebase";

import {
  NEW_AGENT_SEQUENCE,
  inferAgentEngagementSegment,
  resolveCadencePlan,
  toDate
} from "./engagementCadenceEngine";

/* =========================
   CONSTANTS
========================= */

export const ENGAGEMENT_TASK_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled"
};

const OPEN_TASK_STATUSES = ["pending", "overdue"];

/* =========================
   BASIC HELPERS
========================= */

function getFirstValue(...values) {
  return (
    values.find(
      value =>
        typeof value === "string" &&
        value.trim().length > 0
    )?.trim() || ""
  );
}

function getUserUid(user = {}) {
  return getFirstValue(user.uid, user.id);
}

function getUserName(user = {}) {
  return getFirstValue(
    user.name,
    user.displayName,
    user.fullName,
    user.email,
    "Team Member"
  );
}

function getUserEmail(user = {}) {
  return getFirstValue(
    user.email,
    user.workEmail,
    user.officialEmail
  );
}

function getAgentName(agent = {}) {
  return getFirstValue(
    agent.agencyName,
    agent.agentName,
    agent.name,
    "Travel Agent"
  );
}

function getAgentCode(agent = {}) {
  return getFirstValue(
    agent.agentCode,
    agent.code
  );
}

function getAssignedUser(agent = {}, fallbackUser = {}) {
  return {
    uid: getFirstValue(
      agent.assignedToUid,
      agent.accountManagerUid,
      getUserUid(fallbackUser)
    ),

    name: getFirstValue(
      agent.assignedToName,
      agent.assignedToEmail,
      agent.assignedTo,
      getUserName(fallbackUser)
    ),

    email: getFirstValue(
      agent.assignedToEmail,
      agent.assignedTo,
      getUserEmail(fallbackUser)
    )
  };
}

function getEngagementNote(engagement = {}) {
  return getFirstValue(
    engagement.messageText,
    engagement.message,
    engagement.subject,
    engagement.outcomeLabel,
    engagement.outcomeCode,
    "Engagement recorded"
  );
}

function sanitizeId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function toTimestamp(value) {
  const date = toDate(value);

  return date ? Timestamp.fromDate(date) : null;
}

function toDateKey(value) {
  const date = toDate(value) || new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}`;
}

function buildTaskId({
  agentId,
  leadId = "",
  plan
}) {
  if (!agentId || !plan?.ruleCode || !plan?.nextDueAt) {
    throw new Error(
      "Cannot build engagement task ID: required values are missing."
    );
  }

  const sequencePart =
    plan.sequenceStep === null ||
    plan.sequenceStep === undefined
      ? "normal"
      : `step_${plan.sequenceStep}`;

  return [
    sanitizeId(agentId),
    sanitizeId(leadId || "agent"),
    sanitizeId(plan.ruleCode),
    sequencePart,
    toDateKey(plan.nextDueAt)
  ]
    .filter(Boolean)
    .join("__");
}

function getCurrentNewAgentStep(agent = {}) {
  const value = Number(agent.newAgentSequenceStep);

  return Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function getLeadId(lead = {}, engagement = {}) {
  return getFirstValue(
    lead.id,
    lead.leadId,
    engagement.leadId
  );
}

function getLeadCode(lead = {}, engagement = {}) {
  return getFirstValue(
    lead.leadCode,
    engagement.leadCode
  );
}

function buildCadenceSnapshot(plan) {
  if (!plan) return null;

  return {
    ruleCode: plan.ruleCode || "",
    ruleGroup: plan.ruleGroup || "",
    label: plan.label || "",
    title: plan.title || "",
    purpose: plan.purpose || "",

    frequencyLabel: plan.frequencyLabel || "",
    priority: Number(plan.priority || 0),

    intentCode: plan.intentCode || "",
    recommendedChannels: Array.isArray(
      plan.recommendedChannels
    )
      ? plan.recommendedChannels
      : [],

    dueWindow: plan.dueWindow || "",
    cadencePhase: plan.cadencePhase || "",

    sequenceStep:
      plan.sequenceStep ?? null,

    sequenceDay:
      plan.sequenceDay ?? null,

    newAgentSequenceComplete:
      plan.newAgentSequenceComplete === true
  };
}

function isNewAgentSequencePlan(plan) {
  return plan?.cadencePhase === "new_agent_sequence";
}

function isNewAgentSequenceComplete(plan) {
  return (
    plan?.newAgentSequenceComplete === true ||
    plan?.cadencePhase === "weekly_after_new_agent"
  );
}

/* =========================
   TASK PAYLOAD
========================= */

function buildTaskPayload({
  taskId,
  agent,
  plan,
  user,
  lead = null,
  engagement = null,
  source = "cadence_engine"
}) {
  const assigned = getAssignedUser(agent, user);

  const leadId = getLeadId(
    lead || {},
    engagement || {}
  );

  const leadCode = getLeadCode(
    lead || {},
    engagement || {}
  );

  return {
    taskId,

    entityType: "travelAgent",

    agentId: agent.id,
    agentCode: getAgentCode(agent),
    agentName: getAgentName(agent),

    leadId,
    leadCode,

    sourceEngagementId:
      engagement?.id || "",

    sourceEngagementType:
      engagement?.engagementType ||
      engagement?.activityType ||
      "",

    sourceOutcomeCode:
      engagement?.outcomeCode || "",

    sourceOutcomeLabel:
      engagement?.outcomeLabel || "",

    sourceChannel:
      engagement?.channel || "",

    ruleCode: plan.ruleCode || "",
    ruleGroup: plan.ruleGroup || "",

    title: plan.title || "Agent follow-up",
    purpose: plan.purpose || "",

    frequencyLabel:
      plan.frequencyLabel || "",

    priority:
      Number(plan.priority || 0),

    recommendedChannels:
      Array.isArray(plan.recommendedChannels)
        ? plan.recommendedChannels
        : [],

    suggestedIntentCode:
      plan.intentCode || "",

    dueAt: toTimestamp(plan.nextDueAt),

    originalDueAt:
      toTimestamp(plan.nextDueAt),

    dueWindow:
      plan.dueWindow || "",

    sequenceStep:
      plan.sequenceStep ?? null,

    sequenceDay:
      plan.sequenceDay ?? null,

    cadencePhase:
      plan.cadencePhase || "",

    newAgentSequenceComplete:
      plan.newAgentSequenceComplete === true,

    assignedToUid: assigned.uid,
    assignedToName: assigned.name,
    assignedToEmail: assigned.email,

    status: ENGAGEMENT_TASK_STATUS.PENDING,
    completionStatus:
      ENGAGEMENT_TASK_STATUS.PENDING,

    completedAt: null,
    completedByEngagementId: "",
    completedByUid: "",
    completedByName: "",

    skippedAt: null,
    skippedReason: "",

    cancelledAt: null,
    cancellationReason: "",

    rescheduledAt: null,
    rescheduleReason: "",

    source,

    cadenceSnapshot:
      buildCadenceSnapshot(plan),

    deleted: false,
    isDeleted: false,

    createdByUid: getUserUid(user),
    createdByName: getUserName(user),
    createdByEmail: getUserEmail(user),

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

/* =========================
   AGENT CADENCE UPDATE
========================= */

function buildAgentCadenceUpdate({
  agent,
  plan,
  taskId,
  now = new Date()
}) {
  const inferredSegment =
    inferAgentEngagementSegment(agent);

  const sequenceCompleted =
    isNewAgentSequenceComplete(plan);

  const finalSegment = sequenceCompleted
    ? "warm_irregular"
    : inferredSegment;

  const update = {
    engagementSegment: finalSegment,

    cadenceAutoManaged:
      agent.cadenceAutoManaged !== false,

    cadenceRuleCode:
      plan?.ruleCode || "",

    cadenceRuleGroup:
      plan?.ruleGroup || "",

    cadencePriority:
      plan?.priority ?? null,

    cadenceFrequencyLabel:
      plan?.frequencyLabel || "",

    cadencePhase:
      plan?.cadencePhase || "",

    cadenceSnapshot:
      buildCadenceSnapshot(plan),

    nextEngagementAt:
      plan ? toTimestamp(plan.nextDueAt) : null,

    nextEngagementTaskId:
      taskId || "",

    cadenceUpdatedAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp()
  };

  if (isNewAgentSequencePlan(plan)) {
    update.newAgentSequenceActive = true;
    update.newAgentSequenceStep =
      plan.sequenceStep ?? 0;
    update.newAgentSequenceDay =
      plan.sequenceDay ?? 0;

    update.newAgentSequenceCompletedAt = null;

    if (!agent.newAgentSequenceStartedAt) {
      update.newAgentSequenceStartedAt =
        Timestamp.fromDate(toDate(now) || new Date());
    }
  }

  if (sequenceCompleted) {
    update.newAgentSequenceActive = false;
    update.newAgentSequenceStep =
      NEW_AGENT_SEQUENCE.length;
    update.newAgentSequenceDay = null;
    update.newAgentSequenceCompletedAt =
      serverTimestamp();
  }

  return update;
}

/* =========================
   CANCEL EXISTING OPEN TASKS
========================= */

export async function cancelPendingAgentTasks({
  agentId,
  user,
  exceptTaskId = "",
  reason = "Superseded by a newer cadence task"
}) {
  if (!agentId) return 0;

  const snapshot = await getDocs(
    query(
      collection(db, "engagementTasks"),
      where("agentId", "==", agentId)
    )
  );

  const tasks = snapshot.docs.filter(taskDoc => {
    const data = taskDoc.data();

    return (
      taskDoc.id !== exceptTaskId &&
      OPEN_TASK_STATUSES.includes(data.status) &&
      data.deleted !== true &&
      data.isDeleted !== true
    );
  });

  if (!tasks.length) return 0;

  const chunks = [];

  for (let index = 0; index < tasks.length; index += 450) {
    chunks.push(tasks.slice(index, index + 450));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    chunk.forEach(taskDoc => {
      batch.update(taskDoc.ref, {
        status: ENGAGEMENT_TASK_STATUS.CANCELLED,
        completionStatus:
          ENGAGEMENT_TASK_STATUS.CANCELLED,

        cancelledAt: serverTimestamp(),
        cancellationReason: reason,

        cancelledByUid: getUserUid(user),
        cancelledByName: getUserName(user),

        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }

  return tasks.length;
}

/* =========================
   INITIALIZE AGENT CADENCE
========================= */

export async function initializeAgentCadence({
  agent,
  user,
  now = new Date(),
  cancelExisting = true
}) {
  if (!agent?.id) {
    throw new Error(
      "Cannot initialize cadence: travel agent ID is missing."
    );
  }

  if (agent.cadenceAutoManaged === false) {
    return {
      taskId: "",
      plan: null,
      skipped: true
    };
  }

  const segment =
    inferAgentEngagementSegment(agent);

  const nextNewAgentStep =
    segment === "new_agent"
      ? getCurrentNewAgentStep(agent)
      : null;

  const plan = resolveCadencePlan({
    agent,
    now,
    nextNewAgentStep
  });

  if (!plan) {
    return {
      taskId: "",
      plan: null
    };
  }

  const taskId = buildTaskId({
    agentId: agent.id,
    plan
  });

  if (cancelExisting) {
    await cancelPendingAgentTasks({
      agentId: agent.id,
      user,
      exceptTaskId: taskId,
      reason: "Cadence initialized again"
    });
  }

  const taskRef = doc(
    db,
    "engagementTasks",
    taskId
  );

  const agentRef = doc(
    db,
    "travelAgents",
    agent.id
  );

  const taskPayload = buildTaskPayload({
    taskId,
    agent,
    plan,
    user,
    source: "agent_cadence_initialization"
  });

  const batch = writeBatch(db);

  batch.set(
    taskRef,
    taskPayload,
    { merge: true }
  );

  batch.update(
    agentRef,
    buildAgentCadenceUpdate({
      agent,
      plan,
      taskId,
      now
    })
  );

  await batch.commit();

  return {
    taskId,
    plan
  };
}

/* =========================
   SYNC AFTER ENGAGEMENT
========================= */

export async function syncAgentCadenceAfterEngagement({
  agent,
  engagement,
  user,

  lead = null,

  sourceTaskId = "",

  now = new Date(),

  advanceNewAgentSequence = null,

  cancelExisting = true
}) {
  if (!agent?.id) {
    throw new Error(
      "Cannot sync cadence: travel agent ID is missing."
    );
  }

  if (!engagement?.id) {
    throw new Error(
      "Cannot sync cadence: engagement ID is missing."
    );
  }

  const inferredSegment =
    inferAgentEngagementSegment(agent);

  const currentSequenceStep =
    getCurrentNewAgentStep(agent);

  const shouldAdvanceSequence =
    inferredSegment === "new_agent" &&
    (
      advanceNewAgentSequence === true ||
      (
        advanceNewAgentSequence === null &&
        (
          agent.cadencePhase ===
            "new_agent_sequence" ||
          engagement.cadencePhase ===
            "new_agent_sequence" ||
          engagement.sourceTaskRuleGroup ===
            "new_agent_sequence"
        )
      )
    );

  const nextNewAgentStep =
    inferredSegment === "new_agent"
      ? shouldAdvanceSequence
        ? currentSequenceStep + 1
        : currentSequenceStep
      : null;

  const agentForResolution = {
    ...agent,

    firstContactedAt:
      agent.firstContactedAt || now,

    newAgentSequenceStartedAt:
      agent.newAgentSequenceStartedAt ||
      agent.firstContactedAt ||
      now,

    newAgentSequenceStep:
      nextNewAgentStep ?? agent.newAgentSequenceStep
  };

  const plan =
    agent.cadenceAutoManaged === false
      ? null
      : resolveCadencePlan({
          agent: agentForResolution,
          lead,
          engagement,
          now,
          nextNewAgentStep
        });

  const leadId = getLeadId(
    lead || {},
    engagement
  );

  const taskId = plan
    ? buildTaskId({
        agentId: agent.id,
        leadId,
        plan
      })
    : "";

  if (cancelExisting && plan) {
    await cancelPendingAgentTasks({
      agentId: agent.id,
      user,
      exceptTaskId: taskId,
      reason:
        "Superseded after a new engagement"
    });
  }

  const batch = writeBatch(db);

  const agentRef = doc(
    db,
    "travelAgents",
    agent.id
  );

  const engagementRef = doc(
    db,
    "engagements",
    engagement.id
  );

  if (plan) {
    const taskRef = doc(
      db,
      "engagementTasks",
      taskId
    );

    const taskPayload = buildTaskPayload({
      taskId,
      agent,
      plan,
      user,
      lead,
      engagement,
      source: "engagement_cadence_sync"
    });

    batch.set(
      taskRef,
      taskPayload,
      { merge: true }
    );
  }

  if (sourceTaskId) {
    const sourceTaskRef = doc(
      db,
      "engagementTasks",
      sourceTaskId
    );

    batch.set(
      sourceTaskRef,
      {
        status:
          ENGAGEMENT_TASK_STATUS.COMPLETED,

        completionStatus:
          ENGAGEMENT_TASK_STATUS.COMPLETED,

        completedAt:
          serverTimestamp(),

        completedByEngagementId:
          engagement.id,

        completedByUid:
          getUserUid(user),

        completedByName:
          getUserName(user),

        updatedAt:
          serverTimestamp()
      },
      { merge: true }
    );
  }

  const agentUpdate = {
    lastEngagementAt:
      serverTimestamp(),

    lastEngagementId:
      engagement.id,

    lastEngagementType:
      engagement.engagementType ||
      engagement.activityType ||
      engagement.channel ||
      "Engagement",

    lastEngagementChannel:
      engagement.channel || "",

    lastEngagementDirection:
      engagement.direction || "",

    lastEngagementOutcomeCode:
      engagement.outcomeCode || "",

    lastEngagementOutcomeLabel:
      engagement.outcomeLabel || "",

    lastEngagementNote:
      getEngagementNote(engagement),

    lastEngagementByUid:
      getUserUid(user),

    lastEngagementByName:
      getUserName(user),

    ...buildAgentCadenceUpdate({
      agent: agentForResolution,
      plan,
      taskId,
      now
    })
  };

  if (!agent.firstContactedAt) {
    agentUpdate.firstContactedAt =
      Timestamp.fromDate(
        toDate(now) || new Date()
      );
  }

  batch.update(
    agentRef,
    agentUpdate
  );

  batch.update(
    engagementRef,
    {
      cadenceRuleCode:
        plan?.ruleCode || "",

      cadenceRuleGroup:
        plan?.ruleGroup || "",

      cadencePhase:
        plan?.cadencePhase || "",

      cadenceTaskId:
        taskId,

      sourceTaskId:
        sourceTaskId || "",

      cadenceSnapshot:
        buildCadenceSnapshot(plan),

      nextEngagementAt:
        plan
          ? toTimestamp(plan.nextDueAt)
          : null,

      updatedAt:
        serverTimestamp()
    }
  );

  await batch.commit();

  return {
    taskId,
    plan
  };
}

/* =========================
   COMPLETE TASK
========================= */

export async function completeEngagementTask({
  taskId,
  engagementId = "",
  user
}) {
  if (!taskId) {
    throw new Error(
      "Cannot complete engagement task: task ID is missing."
    );
  }

  await setDoc(
    doc(db, "engagementTasks", taskId),
    {
      status:
        ENGAGEMENT_TASK_STATUS.COMPLETED,

      completionStatus:
        ENGAGEMENT_TASK_STATUS.COMPLETED,

      completedAt:
        serverTimestamp(),

      completedByEngagementId:
        engagementId || "",

      completedByUid:
        getUserUid(user),

      completedByName:
        getUserName(user),

      updatedAt:
        serverTimestamp()
    },
    { merge: true }
  );

  return true;
}

/* =========================
   RESCHEDULE TASK
========================= */

export async function rescheduleEngagementTask({
  taskId,
  dueAt,
  reason = "",
  user
}) {
  if (!taskId) {
    throw new Error(
      "Cannot reschedule task: task ID is missing."
    );
  }

  const date = toDate(dueAt);

  if (!date) {
    throw new Error(
      "Cannot reschedule task: invalid due date."
    );
  }

  const taskRef = doc(
    db,
    "engagementTasks",
    taskId
  );

  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) {
    throw new Error(
      "Engagement task was not found."
    );
  }

  const task = {
    id: taskSnap.id,
    ...taskSnap.data()
  };

  const batch = writeBatch(db);

  batch.update(taskRef, {
    status:
      ENGAGEMENT_TASK_STATUS.PENDING,

    completionStatus:
      ENGAGEMENT_TASK_STATUS.PENDING,

    dueAt:
      Timestamp.fromDate(date),

    rescheduledAt:
      serverTimestamp(),

    rescheduleReason:
      reason || "",

    rescheduledByUid:
      getUserUid(user),

    rescheduledByName:
      getUserName(user),

    updatedAt:
      serverTimestamp()
  });

  if (task.agentId) {
    const agentRef = doc(
      db,
      "travelAgents",
      task.agentId
    );

    batch.update(agentRef, {
      nextEngagementAt:
        Timestamp.fromDate(date),

      nextEngagementTaskId:
        taskId,

      cadenceUpdatedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()
    });
  }

  await batch.commit();

  return true;
}

/* =========================
   SKIP TASK
========================= */

export async function skipEngagementTask({
  taskId,
  reason,
  user
}) {
  if (!taskId) {
    throw new Error(
      "Cannot skip task: task ID is missing."
    );
  }

  if (!String(reason || "").trim()) {
    throw new Error(
      "Please provide a reason for skipping the task."
    );
  }

  await updateDoc(
    doc(db, "engagementTasks", taskId),
    {
      status:
        ENGAGEMENT_TASK_STATUS.SKIPPED,

      completionStatus:
        ENGAGEMENT_TASK_STATUS.SKIPPED,

      skippedAt:
        serverTimestamp(),

      skippedReason:
        String(reason).trim(),

      skippedByUid:
        getUserUid(user),

      skippedByName:
        getUserName(user),

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}

/* =========================
   CANCEL TASK
========================= */

export async function cancelEngagementTask({
  taskId,
  reason = "Task cancelled",
  user
}) {
  if (!taskId) {
    throw new Error(
      "Cannot cancel task: task ID is missing."
    );
  }

  await updateDoc(
    doc(db, "engagementTasks", taskId),
    {
      status:
        ENGAGEMENT_TASK_STATUS.CANCELLED,

      completionStatus:
        ENGAGEMENT_TASK_STATUS.CANCELLED,

      cancelledAt:
        serverTimestamp(),

      cancellationReason:
        reason || "Task cancelled",

      cancelledByUid:
        getUserUid(user),

      cancelledByName:
        getUserName(user),

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}

/* =========================
   REBUILD AGENT CADENCE
========================= */

export async function rebuildAgentCadence({
  agent,
  user,
  lead = null,
  engagement = null,
  now = new Date()
}) {
  if (!agent?.id) {
    throw new Error(
      "Cannot rebuild cadence: travel agent ID is missing."
    );
  }

  await cancelPendingAgentTasks({
    agentId: agent.id,
    user,
    reason: "Cadence manually rebuilt"
  });

  const plan = resolveCadencePlan({
    agent,
    lead,
    engagement,
    now,

    nextNewAgentStep:
      inferAgentEngagementSegment(agent) ===
      "new_agent"
        ? getCurrentNewAgentStep(agent)
        : null
  });

  if (!plan) {
    await updateDoc(
      doc(db, "travelAgents", agent.id),
      {
        cadenceRuleCode: "",
        cadenceRuleGroup: "",
        cadencePriority: null,
        cadenceFrequencyLabel: "",
        cadencePhase: "",
        cadenceSnapshot: null,

        nextEngagementAt: null,
        nextEngagementTaskId: "",

        cadenceUpdatedAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      }
    );

    return {
      taskId: "",
      plan: null
    };
  }

  const taskId = buildTaskId({
    agentId: agent.id,
    leadId: getLeadId(
      lead || {},
      engagement || {}
    ),
    plan
  });

  const taskRef = doc(
    db,
    "engagementTasks",
    taskId
  );

  const agentRef = doc(
    db,
    "travelAgents",
    agent.id
  );

  const batch = writeBatch(db);

  batch.set(
    taskRef,
    buildTaskPayload({
      taskId,
      agent,
      plan,
      user,
      lead,
      engagement,
      source: "manual_cadence_rebuild"
    }),
    { merge: true }
  );

  batch.update(
    agentRef,
    buildAgentCadenceUpdate({
      agent,
      plan,
      taskId,
      now
    })
  );

  await batch.commit();

  return {
    taskId,
    plan
  };
}