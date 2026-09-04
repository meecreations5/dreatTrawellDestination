"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Hourglass,
  ListChecks,
  MessageSquare,
  Phone,
  PhoneOff,
  PlayCircle,
  Plus,
  RefreshCcw,
  Target,
  UserPlus,
  Users
} from "lucide-react";

import { db } from "@/lib/firebase";
import { getLeadAging } from "@/lib/leadAging";
import { normalizeLeadClosingPotential } from "@/lib/leadPotential";
import {
  getLeadAssignee,
  getLeadOwner,
  isLeadAssignedToUser,
  isLeadOwnedByUser
} from "@/lib/leadOwnership";
import {
  memberMatchesValues,
  resolveDirectoryIdentity,
  teamMatchesScope
} from "@/lib/teamDirectory";
import { toMeetingDate } from "@/lib/meetings";
import { isSuccessfulEngagementConnection } from "@/lib/engagementProductivity";
import {
  WORKSTREAMS,
  roleWorkstream,
  userWorkstream,
  workstreamShortLabel
} from "@/lib/workstream";
import { classifyOperationalActivity } from "@/lib/workActivityClassifier";
import {
  WORK_TASK_STATUS,
  WORK_TASK_STATUS_OPTIONS,
  WORK_TASK_TYPES,
  updateWorkTaskStatus
} from "@/lib/workTaskService";

import AddFollowUpModal from "@/components/leads/AddFollowUpModal";
import WorkTaskModal from "./WorkTaskModal";
import WorkTaskUpdateModal from "./WorkTaskUpdateModal";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function isDeleted(row) {
  return Boolean(row?.isDeleted === true || row?.deleted === true || row?.deletedAt || row?.status === "deleted");
}

function clean(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function getUid(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") return clean(value.uid || value.id || value.userId || value.value);
  return "";
}

function isAgentContacted(agent) {
  return Boolean(
    agent?.lastEngagementAt ||
      agent?.lastContactedAt ||
      agent?.lastContactAt ||
      Number(agent?.engagementCount || agent?.totalEngagements || 0) > 0
  );
}

function agentMatchesUser(agent, user) {
  const uid = clean(user?.uid || user?.id);
  const email = normalize(user?.email);
  return Boolean(
    (uid && [agent?.assignedToUid, agent?.accountManagerUid, agent?.createdByUid].includes(uid)) ||
      (email && [agent?.assignedToEmail, agent?.createdByEmail].some(value => normalize(value) === email))
  );
}

function meetingMatchesUser(meeting, user) {
  const uid = clean(user?.uid || user?.id);
  const email = normalize(user?.email);
  return Boolean(
    (uid && [meeting?.assignedUserUid, meeting?.assignedUserKey].includes(uid)) ||
      (email && normalize(meeting?.assignedUserEmail) === email)
  );
}

function getAgentDirectoryIdentity(agent, lookup) {
  return resolveDirectoryIdentity(
    {
      uid: agent?.assignedToUid || agent?.accountManagerUid || agent?.createdByUid || "",
      email: agent?.assignedToEmail || agent?.createdByEmail || "",
      name: agent?.assignedToName || agent?.createdByName || ""
    },
    lookup
  );
}

function leadMatchesTeam(lead, lookup, team) {
  if (!team || team === "all") return true;
  const ownerMember = resolveDirectoryIdentity(getLeadOwner(lead), lookup);
  const assigneeMember = resolveDirectoryIdentity(getLeadAssignee(lead), lookup);
  return teamMatchesScope(ownerMember.team, team) || teamMatchesScope(assigneeMember.team, team);
}

function meetingMatchesTeam(meeting, lookup, team) {
  if (!team || team === "all") return true;
  const member = resolveDirectoryIdentity(
    {
      uid: meeting?.assignedUserUid || meeting?.assignedUserKey || "",
      email: meeting?.assignedUserEmail || "",
      name: meeting?.assignedUserName || ""
    },
    lookup
  );
  return teamMatchesScope(member.team, team);
}

function recordAssignedIdentity(row = {}, lookup) {
  return resolveDirectoryIdentity(
    {
      uid: row.assignedToUid || row.assignedUserUid || "",
      email: row.assignedToEmail || row.assignedUserEmail || "",
      name: row.assignedToName || row.assignedUserName || ""
    },
    lookup
  );
}

function recordPerformerIdentity(row = {}, lookup) {
  return resolveDirectoryIdentity(
    {
      uid: row.createdByUid || row.performedByUid || row.completedByUid || "",
      email: row.createdByEmail || row.performedByEmail || "",
      name: row.createdByName || row.performedByName || row.completedByName || ""
    },
    lookup
  );
}

function taskMatchesUser(task, user) {
  const userValues = [user?.uid, user?.id, user?.email, user?.name, user?.displayName]
    .filter(Boolean)
    .map(normalize);
  const assignedValues = [
    task?.assignedToUid,
    task?.assignedToEmail,
    task?.assignedToName
  ].filter(Boolean);

  // Once work is assigned, responsibility follows the assignee. The creator is
  // only a fallback for legacy/unassigned tasks so Engagement users do not keep
  // seeing Lead/Operations work after handover.
  if (assignedValues.length) {
    return assignedValues.some(value => userValues.includes(normalize(value)));
  }

  return [task?.createdByUid, task?.createdByEmail, task?.createdByName]
    .filter(Boolean)
    .some(value => userValues.includes(normalize(value)));
}

function taskMatchesTeam(task, lookup, team) {
  if (!team || team === "all") return true;
  return teamMatchesScope(recordAssignedIdentity(task, lookup).team, team);
}

function getLeadNextActionDate(lead) {
  return (
    toDate(lead?.nextActionDueAt) ||
    toDate(lead?.nextFollowUpAt) ||
    toDate(lead?.followUpAt) ||
    toDate(lead?.nextActionDate) ||
    null
  );
}

function getLeadCreatedDate(lead) {
  return toDate(lead?.createdAt) || toDate(lead?.createdOn) || toDate(lead?.createdDate) || null;
}

function getEngagementDate(item) {
  return toDate(item?.createdAt) || toDate(item?.engagementAt) || toDate(item?.updatedAt) || null;
}

function getEventDate(item) {
  return toDate(item?.activityAt) || toDate(item?.activityAtClient) || toDate(item?.updatedAt) || null;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function taskTypeLabel(value) {
  return WORK_TASK_TYPES.find(item => item.value === value)?.label || clean(value).replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase()) || "Follow-up";
}

function statusLabel(status) {
  return WORK_TASK_STATUS_OPTIONS.find(item => item.value === status)?.label || clean(status).replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase()) || "Pending";
}

function isTerminalTaskStatus(status) {
  return ["completed", "skipped", "cancelled"].includes(status);
}

function isTaskOverdue(row, now = new Date()) {
  if (isTerminalTaskStatus(row.status)) return false;
  const due = toDate(row.dueAt);
  return Boolean(due && due < now);
}

function dueToday(row, now = new Date()) {
  const due = toDate(row.dueAt);
  return Boolean(due && dateKey(due) === dateKey(now));
}

function taskStatusTone(row) {
  if (row.status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (row.status === "in_progress") return "bg-blue-50 text-blue-700 border-blue-100";
  if (row.status === "waiting") return "bg-amber-50 text-amber-700 border-amber-100";
  if (row.status === "skipped" || row.status === "cancelled") return "bg-slate-100 text-slate-500 border-slate-200";
  if (row.overdue) return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function taskGroupLabel(group) {
  if (group === "engagement") return "Engagement";
  if (group === "on_ground") return "On-ground";
  return "Lead";
}

function getTaskLink(row, adminMode) {
  if (row.sourceType === "engagement_task") {
    return row.agentId ? `/engagements/travel-agent/${row.agentId}${row.id ? `?taskId=${encodeURIComponent(row.id)}` : ""}` : "/engagements/my";
  }
  if (row.leadId) return adminMode ? `/admin/leads/${row.leadId}` : `/leads/${row.leadId}`;
  return adminMode ? "/admin/action-center" : "/action-center";
}

function memberForRow(row, lookup) {
  return recordAssignedIdentity(row, lookup);
}

function rowMatchesMember(row, member) {
  if (!member || member === "all") return true;
  return memberMatchesValues(member, [
    row.assignedToUid,
    row.assignedToEmail,
    row.assignedToName
  ]);
}

function MiniStat({ label, value, helper, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700"
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
        </div>
        <div className={`rounded-xl p-2 ${tones[tone] || tones.blue}`}><Icon size={18} /></div>
      </div>
    </div>
  );
}

export default function ActionCenterWorkspace({
  adminMode = false,
  user,
  scopeTeam = "all",
  userLookup,
  directory = []
}) {
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [engagementTasks, setEngagementTasks] = useState([]);
  const [workTasks, setWorkTasks] = useState([]);
  const [workEvents, setWorkEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [updateState, setUpdateState] = useState({ open: false, task: null, action: "" });
  const [followUpLead, setFollowUpLead] = useState(null);
  const [queueStatus, setQueueStatus] = useState("open");
  const [queueGroup, setQueueGroup] = useState("all");
  const [queueType, setQueueType] = useState("all");
  const [queueMemberKey, setQueueMemberKey] = useState("all");
  const [activityDate, setActivityDate] = useState(() => dateKey(new Date()));
  const [actionBusyId, setActionBusyId] = useState("");

  const currentWorkstream = useMemo(
    () => adminMode ? WORKSTREAMS.MANAGEMENT : userWorkstream(user || {}),
    [adminMode, user]
  );
  const defaultQueueGroup = currentWorkstream === WORKSTREAMS.ENGAGEMENT
    ? "engagement"
    : "all";

  useEffect(() => {
    if (adminMode) return;
    setQueueGroup(current => current === "all" ? defaultQueueGroup : current);
  }, [adminMode, defaultQueueGroup]);

  useEffect(() => {
    const loaded = new Set();
    const done = key => {
      loaded.add(key);
      if (["leads", "agents", "meetings", "engagementTasks", "workTasks"].every(item => loaded.has(item))) setLoading(false);
    };

    const listen = (name, setter) => onSnapshot(
      collection(db, name),
      snap => {
        setter(snap.docs.map(item => ({ id: item.id, ...item.data() })));
        done(name);
      },
      error => {
        console.warn(`${name} unavailable in Action Center:`, error);
        setter([]);
        done(name);
      }
    );

    const unsubs = [
      listen("leads", setLeads),
      listen("travelAgents", setAgents),
      listen("meetings", setMeetings),
      listen("engagements", setEngagements),
      listen("engagementTasks", setEngagementTasks),
      listen("workTasks", setWorkTasks),
      listen("workActivityEvents", setWorkEvents)
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const scoped = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 86400000));

    const scopedLeads = leads.filter(lead => {
      if (isDeleted(lead)) return false;
      if (adminMode) return leadMatchesTeam(lead, userLookup, scopeTeam);
      return isLeadOwnedByUser(lead, user) || isLeadAssignedToUser(lead, user);
    });

    const scopedAgents = agents.filter(agent => {
      if (isDeleted(agent)) return false;
      if (!adminMode) return agentMatchesUser(agent, user);
      if (!scopeTeam || scopeTeam === "all") return true;
      return teamMatchesScope(getAgentDirectoryIdentity(agent, userLookup).team, scopeTeam);
    });

    const scopedMeetings = meetings.filter(meeting => {
      if (isDeleted(meeting)) return false;
      if (adminMode) return meetingMatchesTeam(meeting, userLookup, scopeTeam);
      return meetingMatchesUser(meeting, user);
    });

    const scopedWorkTasks = workTasks.filter(task => {
      if (isDeleted(task)) return false;
      return adminMode ? taskMatchesTeam(task, userLookup, scopeTeam) : taskMatchesUser(task, user);
    });

    const scopedEngagementTasks = engagementTasks.filter(task => {
      if (isDeleted(task)) return false;
      return adminMode ? taskMatchesTeam(task, userLookup, scopeTeam) : taskMatchesUser(task, user);
    });

    const scopedEngagements = engagements.filter(item => {
      if (isDeleted(item)) return false;
      if (!adminMode) {
        const uid = clean(user?.uid || user?.id);
        const email = normalize(user?.email);
        return Boolean(
          (uid && [item.createdByUid, item.assignedToUid].includes(uid)) ||
          (email && [item.createdByEmail, item.assignedToEmail].some(value => normalize(value) === email))
        );
      }
      if (!scopeTeam || scopeTeam === "all") return true;
      return teamMatchesScope(recordPerformerIdentity(item, userLookup).team, scopeTeam);
    });

    const scopedEvents = workEvents.filter(event => {
      if (isDeleted(event)) return false;
      if (!adminMode) {
        const uid = clean(user?.uid || user?.id);
        const email = normalize(user?.email);
        return Boolean(
          (uid && [event.performedByUid, event.assignedToUid].includes(uid)) ||
          (email && [event.performedByEmail, event.assignedToEmail].some(value => normalize(value) === email))
        );
      }
      if (!scopeTeam || scopeTeam === "all") return true;
      const identity = resolveDirectoryIdentity(
        { uid: event.performedByUid || event.assignedToUid, email: event.performedByEmail || event.assignedToEmail, name: event.performedByName || event.assignedToName },
        userLookup
      );
      return teamMatchesScope(identity.team, scopeTeam);
    });

    const responsibilityLeads = adminMode
      ? scopedLeads
      : scopedLeads.filter(lead => {
          const assignee = getLeadAssignee(lead);
          const hasAssignee = Boolean(assignee.uid || assignee.email);
          return hasAssignee ? isLeadAssignedToUser(lead, user) : isLeadOwnedByUser(lead, user);
        });

    const overdueLeads = responsibilityLeads.filter(lead => getLeadAging(lead, now).overdue);
    const noNextAction = responsibilityLeads.filter(lead => getLeadAging(lead, now).noNextAction);
    const priorityLeads = responsibilityLeads.filter(lead => {
      if (getLeadAging(lead, now).terminal) return false;
      return ["hot", "at_risk"].includes(normalizeLeadClosingPotential(lead));
    });
    const newAgentsNotContacted = scopedAgents.filter(agent => {
      const created = toDate(agent?.createdAt);
      return created && created >= sevenDaysAgo && created <= todayEnd && !isAgentContacted(agent);
    });
    const meetingsToday = scopedMeetings.filter(meeting => {
      const start = toMeetingDate(meeting?.scheduledStartAt);
      return start && start >= todayStart && start <= todayEnd && ["scheduled", "rescheduled"].includes(meeting?.status || "scheduled");
    });
    const missedMeetings = scopedMeetings.filter(meeting => {
      const start = toMeetingDate(meeting?.scheduledStartAt);
      return start && start < now && ["scheduled", "rescheduled"].includes(meeting?.status || "scheduled");
    });
    const momPending = scopedMeetings.filter(meeting => meeting?.status === "completed" && !clean(meeting?.mom));

    return {
      scopedLeads,
      scopedAgents,
      scopedMeetings,
      scopedWorkTasks,
      scopedEngagementTasks,
      scopedEngagements,
      scopedEvents,
      responsibilityLeads,
      overdueLeads,
      noNextAction,
      priorityLeads,
      newAgentsNotContacted,
      meetingsToday,
      missedMeetings,
      momPending
    };
  }, [adminMode, agents, engagements, engagementTasks, leads, meetings, scopeTeam, user, userLookup, workEvents, workTasks]);

  const queueRows = useMemo(() => {
    const now = new Date();
    const workRows = scoped.scopedWorkTasks.map(task => ({
      ...task,
      sourceType: "work_task",
      activityGroup: task.activityGroup || "lead",
      activityType: task.activityType || "lead_follow_up",
      activityTypeLabel: task.activityTypeLabel || taskTypeLabel(task.activityType),
      title: task.title || task.activityTypeLabel || taskTypeLabel(task.activityType),
      dueAt: task.dueAt,
      status: task.status || "pending",
      agentId: task.travelAgentId || task.agentId || "",
      agentName: task.travelAgentName || task.agentName || ""
    }));

    const engagementRows = scoped.scopedEngagementTasks.map(task => ({
      ...task,
      sourceType: "engagement_task",
      activityGroup: "engagement",
      activityType: "engagement_follow_up",
      activityTypeLabel: "Engagement Follow-up",
      title: task.title || task.purpose || "Engagement Follow-up",
      dueAt: task.dueAt,
      status: task.status || task.completionStatus || "pending",
      leadId: task.leadId || "",
      agentId: task.agentId || "",
      agentName: task.agentName || "",
      travelAgentName: task.agentName || "",
      destinationName: task.destinationName || ""
    }));

    const openLeadTaskIds = new Set(
      workRows
        .filter(row => row.activityType === "lead_follow_up" && !isTerminalTaskStatus(row.status) && row.leadId)
        .map(row => row.leadId)
    );

    const legacyLeadRows = scoped.scopedLeads
      .filter(lead => {
        const aging = getLeadAging(lead, now);
        if (aging.terminal || !getLeadNextActionDate(lead) || openLeadTaskIds.has(lead.id)) return false;
        if (adminMode) return true;
        const assignee = getLeadAssignee(lead);
        const hasAssignee = Boolean(assignee.uid || assignee.email);
        return hasAssignee ? isLeadAssignedToUser(lead, user) : isLeadOwnedByUser(lead, user);
      })
      .map(lead => {
        const assignee = getLeadAssignee(lead);
        const owner = getLeadOwner(lead);
        const dueAt = getLeadNextActionDate(lead);
        return {
          id: `legacy_lead_${lead.id}`,
          sourceType: "legacy_lead",
          activityGroup: "lead",
          activityType: "lead_follow_up",
          activityTypeLabel: "Lead Follow-up",
          title: "Lead Follow-up",
          leadId: lead.id,
          leadCode: lead.leadCode || "",
          travelAgentId: lead.travelAgentId || lead.agentId || "",
          travelAgentName: lead.travelAgentName || lead.agentName || lead.agencyName || "",
          destinationName: lead.destinationName || lead.destination || "",
          dueAt,
          status: "pending",
          assignedToUid: assignee.uid || owner.uid || "",
          assignedToName: assignee.name || owner.name || "",
          assignedToEmail: assignee.email || owner.email || "",
          note: lead.lastFollowUpSummary || lead.lastActivitySummary || "Existing lead next action"
        };
      });

    return [...workRows, ...engagementRows, ...legacyLeadRows]
      .map(row => ({ ...row, overdue: isTaskOverdue(row, now) }))
      .sort((a, b) => {
        const terminalDiff = Number(isTerminalTaskStatus(a.status)) - Number(isTerminalTaskStatus(b.status));
        if (terminalDiff) return terminalDiff;
        const aDue = toDate(a.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bDue = toDate(b.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });
  }, [adminMode, scoped.scopedEngagementTasks, scoped.scopedLeads, scoped.scopedWorkTasks, user]);

  const selectedMember = useMemo(
    () => directory.find(member => member.key === queueMemberKey) || null,
    [directory, queueMemberKey]
  );

  const filteredQueue = useMemo(() => {
    return queueRows.filter(row => {
      if (queueStatus === "open" && isTerminalTaskStatus(row.status)) return false;
      if (queueStatus === "completed" && row.status !== "completed") return false;
      if (queueStatus === "overdue" && !row.overdue) return false;
      if (!["all", "open", "completed", "overdue"].includes(queueStatus) && row.status !== queueStatus) return false;
      if (queueGroup !== "all" && row.activityGroup !== queueGroup) return false;
      if (queueType !== "all" && row.activityType !== queueType) return false;
      if (adminMode && selectedMember && !rowMatchesMember(row, selectedMember)) return false;
      return true;
    });
  }, [adminMode, queueGroup, queueRows, queueStatus, queueType, selectedMember]);

  const queueStats = useMemo(() => {
    const now = new Date();
    const open = queueRows.filter(row => !isTerminalTaskStatus(row.status));
    return {
      open: open.length,
      dueToday: open.filter(row => dueToday(row, now)).length,
      overdue: open.filter(row => row.overdue).length,
      inProgress: open.filter(row => row.status === "in_progress").length,
      waiting: open.filter(row => row.status === "waiting").length,
      completedToday: queueRows.filter(row => row.status === "completed" && dateKey(row.completedAt || row.updatedAt) === dateKey(now)).length
    };
  }, [queueRows]);

  const dailyMemberRows = useMemo(() => {
    const dayKey = activityDate;
    const members = adminMode
      ? directory.filter(member => member.active !== false && (!scopeTeam || scopeTeam === "all" || teamMatchesScope(member.team, scopeTeam)))
      : directory.filter(member => memberMatchesValues(member, [user?.uid, user?.email, user?.name, user?.displayName]));

    return members.map(member => {
      const memberTasks = queueRows.filter(row => rowMatchesMember(row, member));
      const memberEngagements = scoped.scopedEngagements.filter(item => {
        const performed = recordPerformerIdentity(item, userLookup);
        const activityAt = getEngagementDate(item);
        return performed.key === member.key && activityAt && dateKey(activityAt) === dayKey;
      });
      const memberEvents = scoped.scopedEvents.filter(event => {
        const performed = resolveDirectoryIdentity(
          { uid: event.performedByUid, email: event.performedByEmail, name: event.performedByName },
          userLookup
        );
        const activityAt = getEventDate(event);
        return performed.key === member.key && activityAt && dateKey(activityAt) === dayKey;
      });

      const due = memberTasks.filter(row => {
        const dueAt = toDate(row.dueAt);
        return dueAt && dateKey(dueAt) === dayKey;
      });
      const completed = memberTasks.filter(row => {
        const completedAt = toDate(row.completedAt || row.updatedAt);
        return row.status === "completed" && completedAt && dateKey(completedAt) === dayKey;
      });
      const leadEvents = new Set(
        memberEvents.filter(event => event.taskGroup === "lead").map(event => event.taskId || event.id)
      ).size;
      const groundEvents = new Set(
        memberEvents.filter(event => event.taskGroup === "on_ground").map(event => event.taskId || event.id)
      ).size;
      const memberWorkstream = roleWorkstream(member.role);
      const requirements = memberEngagements.filter(item =>
        ["requirement_received", "quote_needed"].includes(normalize(item?.outcomeCode))
      ).length;
      const leadsGenerated = scoped.scopedLeads.filter(lead => {
        const owner = resolveDirectoryIdentity(getLeadOwner(lead), userLookup);
        const createdAt = getLeadCreatedDate(lead);
        return owner.key === member.key && createdAt && dateKey(createdAt) === dayKey;
      }).length;
      const managedOpenLeads = scoped.scopedLeads.filter(lead => {
        const assignee = resolveDirectoryIdentity(getLeadAssignee(lead), userLookup);
        return assignee.key === member.key && !getLeadAging(lead).terminal;
      }).length;

      return {
        member,
        workstream: memberWorkstream,
        requirements,
        leadsGenerated,
        managedOpenLeads,
        due: due.length,
        completed: completed.length,
        pending: due.filter(row => row.status === "pending").length,
        inProgress: due.filter(row => row.status === "in_progress").length,
        waiting: due.filter(row => row.status === "waiting").length,
        overdue: memberTasks.filter(row => row.overdue).length,
        leadEvents,
        groundEvents,
        engagements: memberEngagements.length,
        connected: memberEngagements.filter(isSuccessfulEngagementConnection).length,
        totalTrackedActivity: memberEvents.length + memberEngagements.length
      };
    }).sort((a, b) => b.totalTrackedActivity - a.totalTrackedActivity || a.member.name.localeCompare(b.member.name));
  }, [activityDate, adminMode, directory, queueRows, scopeTeam, scoped.scopedEngagements, scoped.scopedEvents, user, userLookup]);

  const dailyActivityLog = useMemo(() => {
    const taskEvents = scoped.scopedEvents
      .filter(event => {
        const activityAt = getEventDate(event);
        return activityAt && dateKey(activityAt) === activityDate;
      })
      .map(event => {
        const classification = classifyOperationalActivity(event);
        return {
          id: `event_${event.id}`,
          at: getEventDate(event),
          person: event.performedByName || event.assignedToName || "Team Member",
          personKey: resolveDirectoryIdentity({ uid: event.performedByUid, email: event.performedByEmail, name: event.performedByName }, userLookup).key,
          type: classification.trackable ? classification.activityTypeLabel : (event.taskTypeLabel || taskTypeLabel(event.taskType)),
          group: classification.trackable ? classification.activityGroup : (event.taskGroup || "lead"),
          detail: event.note || event.eventType?.replaceAll("_", " ") || "Activity updated",
          status: event.toStatus || event.activityStatus || event.eventType || "updated",
          leadCode: event.leadCode || "",
          agentName: event.travelAgentName || "",
          source: "work"
        };
      });

    const engagementEvents = scoped.scopedEngagements
      .filter(item => {
        const activityAt = getEngagementDate(item);
        return activityAt && dateKey(activityAt) === activityDate;
      })
      .map(item => ({
        id: `eng_${item.id}`,
        at: getEngagementDate(item),
        person: item.createdByName || item.assignedToName || "Team Member",
        personKey: recordPerformerIdentity(item, userLookup).key,
        type: item.channel ? `${clean(item.channel).replace(/\b\w/g, char => char.toUpperCase())} Engagement` : "Engagement",
        group: "engagement",
        detail: item.outcomeLabel || item.messageText || item.subject || "Engagement recorded",
        status: isSuccessfulEngagementConnection(item) ? "connected" : item.connectionStatus || item.outcomeCode || "logged",
        leadCode: item.leadCode || "",
        agentName: item.travelAgentName || item.agentName || "",
        source: "engagement"
      }));

    return [...taskEvents, ...engagementEvents]
      .filter(row => !selectedMember || row.personKey === selectedMember.key)
      .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
      .slice(0, 100);
  }, [activityDate, scoped.scopedEngagements, scoped.scopedEvents, selectedMember, userLookup]);

  const leadBase = adminMode ? "/admin/leads" : "/leads/my";
  const agentBase = adminMode ? "/admin/travel-agents" : "/travel-agents";
  const meetingBase = adminMode ? "/admin/meetings" : "/meetings";

  const cards = [
    { key: "new-agents", label: "New Agents Not Contacted", helper: "Added in the last 7 days", value: scoped.newAgentsNotContacted.length, icon: UserPlus, href: `${agentBase}?contactStatus=never_contacted&createdRange=7d` },
    { key: "overdue", label: "Overdue Lead Follow-ups", helper: "Past next-action time", value: scoped.overdueLeads.length, icon: AlertTriangle, href: `${leadBase}?followUp=overdue` },
    { key: "no-action", label: "Leads Without Next Action", helper: "Open leads with no due action", value: scoped.noNextAction.length, icon: Clock3, href: `${leadBase}?followUp=none` },
    { key: "priority", label: "Hot / At-Risk Leads", helper: "Closing attention required", value: scoped.priorityLeads.length, icon: Flame, href: `${leadBase}?priorityAttention=1` },
    { key: "meetings-today", label: "Meetings Today", helper: "Scheduled or rescheduled", value: scoped.meetingsToday.length, icon: CalendarClock, href: `${meetingBase}?view=today` },
    { key: "missed", label: "Past-Due Meetings", helper: "Meeting time passed, still open", value: scoped.missedMeetings.length, icon: PhoneOff, href: `${meetingBase}?view=past_due` }
  ];

  const urgentLeads = [...scoped.overdueLeads, ...scoped.priorityLeads]
    .filter((lead, index, rows) => rows.findIndex(item => item.id === lead.id) === index)
    .sort((a, b) => Number(!getLeadAging(a).overdue) - Number(!getLeadAging(b).overdue))
    .slice(0, 8);

  const todayMeetings = [...scoped.meetingsToday]
    .sort((a, b) => (toMeetingDate(a.scheduledStartAt)?.getTime() || 0) - (toMeetingDate(b.scheduledStartAt)?.getTime() || 0))
    .slice(0, 8);

  const startTask = async row => {
    setActionBusyId(row.id);
    try {
      await updateWorkTaskStatus({ task: row, status: WORK_TASK_STATUS.IN_PROGRESS, note: "Work started", user });
    } catch (error) {
      console.error("Unable to start work task:", error);
    } finally {
      setActionBusyId("");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Daily Execution</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Action Center</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-500">
              {adminMode
                ? "Exact daily status by workstream: Engagement generates relationships and qualified leads; Lead & Operations manages conversion and execution."
                : currentWorkstream === WORKSTREAMS.ENGAGEMENT
                  ? "Your relationship queue: Travel Agent touchbase, Engagement follow-ups, requirements and qualified Lead generation."
                  : currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS
                    ? "Your execution queue: assigned Leads, quotations, re-quotes, vendor coordination, Lead follow-ups and on-ground operations."
                    : "Your single work queue for follow-ups and operational activity."}
            </p>
          </div>
          {!adminMode && currentWorkstream === WORKSTREAMS.ENGAGEMENT ? (
            <Link href="/engagements/my" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              <Plus size={16} /> Add Engagement / Follow-up
            </Link>
          ) : (
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              <Plus size={16} /> Add Lead / Operations Activity
            </button>
          )}
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <Link key={card.key} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{loading ? "—" : card.value}</p></div>
                  <div className="rounded-xl bg-slate-50 p-2 text-slate-600"><Icon size={18} /></div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400"><span>{card.helper}</span><ChevronRight size={14} className="transition group-hover:translate-x-0.5" /></div>
              </Link>
            );
          })}
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">{adminMode ? "Team Follow-up Status" : "My Follow-ups & Work"}</h2>
              <p className="text-sm text-slate-500">{adminMode ? "One manager view across both workstreams." : currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Focused on Travel Agent relationship follow-ups." : currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Focused on Lead and on-ground execution." : "One queue for all assigned work."}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MiniStat label="Open" value={queueStats.open} helper="All active work" icon={ListChecks} />
            <MiniStat label="Due Today" value={queueStats.dueToday} helper="Current due actions" icon={CalendarClock} tone="amber" />
            <MiniStat label="Overdue" value={queueStats.overdue} helper="Past due" icon={AlertTriangle} tone="rose" />
            <MiniStat label="In Progress" value={queueStats.inProgress} helper="Work started" icon={PlayCircle} />
            <MiniStat label="Waiting" value={queueStats.waiting} helper="Dependency pending" icon={Hourglass} tone="amber" />
            <MiniStat label="Completed Today" value={queueStats.completedToday} helper="Finished actions" icon={CheckCircle2} tone="green" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-5">
              <select value={queueStatus} onChange={event => setQueueStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="open">Open Work</option>
                <option value="overdue">Overdue</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="completed">Completed</option>
                <option value="all">All Statuses</option>
              </select>
              <select value={queueGroup} onChange={event => { setQueueGroup(event.target.value); setQueueType("all"); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="all">All Activity Groups</option>
                <option value="lead">Lead Activity</option>
                <option value="on_ground">On-ground Activity</option>
                <option value="engagement">Engagement Follow-up</option>
              </select>
              <select value={queueType} onChange={event => setQueueType(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="all">All Activity Types</option>
                {WORK_TASK_TYPES.filter(item => !item.hidden && (queueGroup === "all" || item.group === queueGroup)).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                {(queueGroup === "all" || queueGroup === "engagement") ? <option value="engagement_follow_up">Engagement Follow-up</option> : null}
              </select>
              {adminMode ? (
                <select value={queueMemberKey} onChange={event => setQueueMemberKey(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <option value="all">All Team Members</option>
                  {directory.filter(member => member.active !== false && (!scopeTeam || scopeTeam === "all" || teamMatchesScope(member.team, scopeTeam))).map(member => <option key={member.key} value={member.key}>{member.label || member.name}</option>)}
                </select>
              ) : <div className="hidden xl:block" />}
              <button type="button" onClick={() => { setQueueStatus("open"); setQueueGroup(defaultQueueGroup); setQueueType("all"); setQueueMemberKey("all"); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"><RefreshCcw size={15} /> Reset Filters</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Activity</th>
                    <th className="px-4 py-3 font-semibold">Lead / Agent</th>
                    {adminMode ? <th className="px-4 py-3 font-semibold">Assigned To</th> : null}
                    <th className="px-4 py-3 font-semibold">Due</th>
                    <th className="px-4 py-3 font-semibold">Exact Status</th>
                    <th className="px-4 py-3 font-semibold">Latest Note</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredQueue.length === 0 ? (
                    <tr><td colSpan={adminMode ? 7 : 6} className="px-4 py-10 text-center text-slate-400">No follow-ups match the selected filters.</td></tr>
                  ) : filteredQueue.slice(0, 100).map(row => {
                    const member = memberForRow(row, userLookup);
                    const canUpdate = row.sourceType === "work_task";
                    const isLeadFollowUp = row.activityType === "lead_follow_up" && row.leadId;
                    const rowStatusLabel = row.overdue && row.status === "pending" ? "Overdue" : statusLabel(row.status);
                    return (
                      <tr key={`${row.sourceType}_${row.id}`} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-3.5">
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 rounded-lg p-1.5 ${row.activityGroup === "engagement" ? "bg-violet-50 text-violet-700" : row.activityGroup === "on_ground" ? "bg-cyan-50 text-cyan-700" : "bg-blue-50 text-blue-700"}`}>
                              {row.activityGroup === "engagement" ? <MessageSquare size={15} /> : row.activityGroup === "on_ground" ? <Users size={15} /> : <Target size={15} />}
                            </div>
                            <div><p className="font-semibold text-slate-900">{row.title || row.activityTypeLabel}</p><p className="mt-0.5 text-xs text-slate-400">{taskGroupLabel(row.activityGroup)} · {row.activityTypeLabel || taskTypeLabel(row.activityType)}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-800">{row.leadCode || row.travelAgentName || row.agentName || "General Activity"}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{row.travelAgentName || row.agentName || ""}{row.destinationName ? ` · ${row.destinationName}` : ""}</p>
                        </td>
                        {adminMode ? <td className="px-4 py-3.5"><p className="font-medium text-slate-800">{member.name || row.assignedToName || "Unassigned"}</p><p className="mt-0.5 text-xs text-slate-400">{member.team || ""}</p></td> : null}
                        <td className="px-4 py-3.5"><p className={`font-semibold ${row.overdue ? "text-rose-600" : "text-slate-800"}`}>{formatDateTime(row.dueAt)}</p>{row.overdue ? <p className="mt-0.5 text-xs font-medium text-rose-500">Past due</p> : null}</td>
                        <td className="px-4 py-3.5"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${taskStatusTone(row)}`}>{rowStatusLabel}</span>{row.status === "waiting" && row.overdue ? <p className="mt-1 text-[11px] text-rose-500">Waiting + overdue</p> : null}</td>
                        <td className="max-w-[260px] px-4 py-3.5"><p className="line-clamp-2 text-xs leading-5 text-slate-500">{row.lastStatusNote || row.note || row.purpose || "—"}</p></td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {isLeadFollowUp ? <button type="button" onClick={() => setFollowUpLead(scoped.scopedLeads.find(lead => lead.id === row.leadId) || { id: row.leadId })} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"><Phone size={13} className="mr-1 inline" />Do Follow-up</button> : <Link href={getTaskLink(row, adminMode)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Open</Link>}
                            {canUpdate && !isTerminalTaskStatus(row.status) ? (
                              <>
                                {row.status === "pending" ? <button type="button" disabled={actionBusyId === row.id} onClick={() => startTask(row)} className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50">Start</button> : null}
                                <button type="button" onClick={() => setUpdateState({ open: true, task: row, action: "waiting" })} className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">Waiting</button>
                                <button type="button" onClick={() => setUpdateState({ open: true, task: row, action: "reschedule" })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600">Reschedule</button>
                                <button type="button" onClick={() => setUpdateState({ open: true, task: row, action: "completed" })} className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Complete</button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /><h2 className="text-base font-semibold text-slate-950">{adminMode ? "Daily Team Activity Status" : "My Daily Activity"}</h2></div>
              <p className="mt-1 text-xs text-slate-500">Lead work + On-ground work + Engagements captured for the selected day.</p>
            </div>
            <input type="date" value={activityDate} onChange={event => setActivityDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Team Member</th>
                  <th className="px-4 py-3 font-semibold">Workstream</th>
                  <th className="px-4 py-3 font-semibold">Primary Output</th>
                  <th className="px-4 py-3 text-right font-semibold">Due</th>
                  <th className="px-4 py-3 text-right font-semibold">Completed</th>
                  <th className="px-4 py-3 text-right font-semibold">Pending</th>
                  <th className="px-4 py-3 text-right font-semibold">In Progress</th>
                  <th className="px-4 py-3 text-right font-semibold">Waiting</th>
                  <th className="px-4 py-3 text-right font-semibold">Overdue Now</th>
                  <th className="px-4 py-3 text-right font-semibold">Lead Actions</th>
                  <th className="px-4 py-3 text-right font-semibold">On-ground</th>
                  <th className="px-4 py-3 text-right font-semibold">Engagements</th>
                  <th className="px-4 py-3 text-right font-semibold">Connected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {dailyMemberRows.length === 0 ? <tr><td colSpan={13} className="px-4 py-10 text-center text-slate-400">No team activity found for this date.</td></tr> : dailyMemberRows.map(row => (
                  <tr key={row.member.key} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.member.name}</p><p className="text-xs text-slate-400">{row.member.team || row.member.role || ""}</p></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.workstream === WORKSTREAMS.ENGAGEMENT ? "bg-violet-50 text-violet-700" : row.workstream === WORKSTREAMS.LEAD_OPERATIONS ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}`}>{workstreamShortLabel(row.workstream)}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.workstream === WORKSTREAMS.ENGAGEMENT ? `${row.requirements} requirements · ${row.leadsGenerated} leads` : row.workstream === WORKSTREAMS.LEAD_OPERATIONS ? `${row.managedOpenLeads} open leads · ${row.completed} completed` : `${row.totalTrackedActivity} tracked actions`}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{row.due}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{row.completed}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.pending}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{row.inProgress}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{row.waiting}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600">{row.overdue}</td>
                    <td className="px-4 py-3 text-right">{row.leadEvents}</td>
                    <td className="px-4 py-3 text-right">{row.groundEvents}</td>
                    <td className="px-4 py-3 text-right">{row.engagements}</td>
                    <td className="px-4 py-3 text-right font-semibold text-violet-700">{row.connected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><div className="flex items-center gap-2"><Activity size={18} className="text-blue-600" /><h2 className="text-base font-semibold text-slate-950">Exact Activity Log</h2></div><p className="mt-1 text-xs text-slate-500">Every tracked status change plus every Engagement logged on {activityDate}.</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{dailyActivityLog.length} entries</span>
          </div>
          {dailyActivityLog.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No tracked activity for the selected date.</div> : (
            <div className="divide-y divide-slate-100">
              {dailyActivityLog.slice(0, 60).map(row => (
                <div key={row.id} className="grid gap-2 px-5 py-3.5 md:grid-cols-[90px_180px_180px_1fr_130px] md:items-center">
                  <p className="text-xs font-semibold text-slate-500">{formatTime(row.at)}</p>
                  <p className="text-sm font-semibold text-slate-900">{row.person}</p>
                  <div><p className="text-sm font-medium text-slate-800">{row.type}</p><p className="text-[11px] text-slate-400">{taskGroupLabel(row.group)}</p></div>
                  <div className="min-w-0"><p className="truncate text-sm text-slate-600">{row.detail}</p><p className="mt-0.5 truncate text-xs text-slate-400">{row.leadCode || row.agentName || ""}</p></div>
                  <span className="justify-self-start rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600 md:justify-self-end">{clean(row.status).replaceAll("_", " ")}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-900">Closing Attention</h2><p className="text-xs text-slate-500">Overdue, Hot and At-Risk open leads</p></div><Target size={18} className="text-blue-600" /></div>
            {urgentLeads.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No urgent leads right now.</div> : <div className="divide-y divide-slate-100">{urgentLeads.map(lead => {
              const aging = getLeadAging(lead);
              const potential = normalizeLeadClosingPotential(lead);
              return <Link key={lead.id} href={adminMode ? `/admin/leads/${lead.id}` : `/leads/${lead.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{lead.leadCode || lead.destinationName || "Lead"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{lead.travelAgentName || lead.agentName || lead.agencyName || "Travel Agent"} · {lead.destinationName || "Destination not set"}</p></div><div className="shrink-0 text-right"><p className={`text-xs font-semibold ${aging.overdue ? "text-rose-600" : "text-amber-600"}`}>{aging.slaLabel}</p><p className="mt-0.5 text-[11px] font-medium uppercase text-slate-400">{potential.replaceAll("_", " ")}</p></div></Link>;
            })}</div>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-900">Today&apos;s Meetings</h2><p className="text-xs text-slate-500">Travel Agent meetings scheduled today</p></div><CalendarClock size={18} className="text-blue-600" /></div>
            {todayMeetings.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No meetings scheduled for today.</div> : <div className="divide-y divide-slate-100">{todayMeetings.map(meeting => {
              const start = toMeetingDate(meeting.scheduledStartAt);
              return <Link key={meeting.id} href={`${meetingBase}?agentId=${encodeURIComponent(meeting.travelAgentId || "")}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{meeting.travelAgentName || "Travel Agent"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{meeting.agenda || meeting.meetingType || "Meeting"}{meeting.location?.city ? ` · ${meeting.location.city}` : ""}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-blue-700">{start ? start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</p><p className="text-[11px] text-slate-400">{meeting.assignedUserName || "Unassigned"}</p></div></Link>;
            })}</div>}
          </section>
        </div>

        {scoped.momPending.length > 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><strong>{scoped.momPending.length}</strong> completed meeting{scoped.momPending.length === 1 ? " is" : "s are"} missing MOM in legacy data. Open Meetings to complete the record.</div> : null}
      </div>

      <WorkTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        user={user}
        leads={scoped.scopedLeads}
        directory={directory}
        adminMode={adminMode}
      />

      <WorkTaskUpdateModal
        open={updateState.open}
        task={updateState.task}
        action={updateState.action}
        user={user}
        onClose={() => setUpdateState({ open: false, task: null, action: "" })}
      />

      {followUpLead?.id ? (
        <AddFollowUpModal
          leadId={followUpLead.id}
          onClose={() => setFollowUpLead(null)}
        />
      ) : null}
    </main>
  );
}
