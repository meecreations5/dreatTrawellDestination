"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  getLeadAssignee,
  getLeadOwner
} from "@/lib/leadOwnership";
import {
  isMeaningfulEngagement,
  isSuccessfulEngagementConnection
} from "@/lib/engagementProductivity";
import { resolveUserRole } from "@/lib/rolePermissions";
import { WORKSTREAMS, roleWorkstream } from "@/lib/workstream";
import { calculateOperationalActivityMetrics } from "@/lib/workActivityClassifier";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Compass,
  Headphones,
  MapPin,
  ListChecks,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  TrendingUp,
  Users,
  Video,
  XCircle
} from "lucide-react";

/* =========================
   DATE HELPERS
========================= */
function toDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function toDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return `${map.year}-${map.month}-${map.day}`;
}

function isSameDay(dateA, dateB = new Date()) {
  if (!dateA) return false;
  return toDateKey(dateA) === toDateKey(dateB);
}


function formatDate(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatShortDateTime(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}


/* =========================
   BUSINESS HELPERS
========================= */
function normalizeText(value, fallback = "—") {
  if (!value) return fallback;
  return String(value).trim() || fallback;
}

function getUid(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    return (
      value.uid ||
      value.id ||
      value.userId ||
      value.value ||
      ""
    );
  }

  return "";
}

function getLeadCreatedByUid(lead) {
  return getLeadOwner(lead).uid || "";
}

function getLeadAssignedToUid(lead) {
  return getLeadAssignee(lead).uid || "";
}

function getLeadCreatedDate(lead) {
  return toDate(lead?.createdAt) || toDate(lead?.createdOn) || toDate(lead?.createdDate) || null;
}

function getLeadAssignedDate(lead) {
  return toDate(lead?.assignedAt) || null;
}

function isTerminalLead(lead) {
  const stage = String(getLeadStage(lead) || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ["won", "lost", "closed", "closed_won", "closed_lost", "cancelled", "completed"].includes(stage);
}

function getLeadTitle(lead) {
  return (
    lead.leadName ||
    lead.customerName ||
    lead.clientName ||
    lead.name ||
    lead.contactName ||
    lead.agencyName ||
    "Untitled Lead"
  );
}

function getAgentName(item) {
  return (
    item.travelAgentName ||
    item.agentName ||
    item.agencyName ||
    item.agent?.agencyName ||
    item.agent?.name ||
    "Travel Agent"
  );
}

function getLeadStage(lead) {
  return lead.stage || lead.status || lead.leadStage || "New";
}

function getDestinationName(item) {
  return (
    item.destinationName ||
    item.destination ||
    item.destinationTitle ||
    item.primaryDestination ||
    ""
  );
}

function getCityName(item) {
  return (
    item.city ||
    item.location ||
    item.address?.city ||
    item.customerCity ||
    item.agentCity ||
    ""
  );
}

function getNextActionDate(lead) {
  return (
    toDate(lead.nextActionDueAt) ||
    toDate(lead.nextFollowUpAt) ||
    toDate(lead.followUpAt) ||
    toDate(lead.nextActionDate) ||
    null
  );
}

function getLeadHealth(lead) {
  const dueDate = getNextActionDate(lead);

  if (!dueDate) return "no_followup";

  const now = new Date();

  if (dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return "overdue";
  }

  if (isSameDay(dueDate, now)) {
    return "at_risk";
  }

  return "healthy";
}

function isMeetingEngagement(item) {
  const value = String(
    item.channel ||
      item.type ||
      item.engagementType ||
      item.mode ||
      item.meetingMode ||
      ""
  ).toLowerCase();

  return value.includes("meeting");
}

function getMeetingDate(item) {
  return (
    toDate(item.meetingDate) ||
    toDate(item.tentativeMeetingDate) ||
    toDate(item.meetingAt) ||
    toDate(item.scheduledAt) ||
    toDate(item.nextActionDueAt) ||
    null
  );
}

function getEngagementDate(item) {
  return (
    toDate(item.createdAt) ||
    toDate(item.updatedAt) ||
    toDate(item.engagementAt) ||
    toDate(item.date) ||
    null
  );
}

function getWorkEventDate(item) {
  return (
    toDate(item.activityAt) ||
    toDate(item.activityAtClient) ||
    toDate(item.updatedAt) ||
    null
  );
}

function getTravelAgentCreatedDate(agent) {
  return (
    toDate(agent.createdAt) ||
    toDate(agent.addedAt) ||
    toDate(agent.createdOn) ||
    null
  );
}

function getTravelAgentCreatorUid(agent) {
  return (
    getUid(agent.createdByUid) ||
    getUid(agent.createdBy) ||
    getUid(agent.creatorUid) ||
    ""
  );
}

function getEngagementAgentId(item) {
  return (
    getUid(item.agentId) ||
    getUid(item.travelAgentId) ||
    getUid(item.agencyId) ||
    ""
  );
}

function isCallEngagement(item) {
  return String(
    item.channel || item.type || item.engagementType || ""
  )
    .trim()
    .toLowerCase()
    .includes("call");
}

function getChannelIcon(channel = "") {
  const value = String(channel).toLowerCase();

  if (value.includes("call") || value.includes("phone")) return Phone;
  if (value.includes("whatsapp") || value.includes("message")) return MessageCircle;
  if (value.includes("meeting") || value.includes("video")) return Video;

  return Headphones;
}

async function safeGetDocs(q) {
  try {
    const snap = await getDocs(q);

    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error("Team dashboard query failed:", error);
    return [];
  }
}

function mergeById(...lists) {
  const map = new Map();

  lists.flat().forEach(item => {
    if (!item?.id) return;
    map.set(item.id, item);
  });

  return Array.from(map.values());
}

/* =========================
   UI COMPONENTS
========================= */
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "blue",
  onClick
}) {
  const toneMap = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
    purple: "border-violet-100 bg-violet-50 text-violet-700",
    slate: "border-slate-100 bg-slate-50 text-slate-700"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-[126px] text-left rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-md hover:-translate-y-0.5 transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-default"
      disabled={!onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-950">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className={`h-11 w-11 rounded-2xl border flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children, right }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="h-10 w-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-950">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {right}
      </div>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function EmptyMiniState({ title, subtitle }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-slate-800">
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, description, onClick, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100",
    purple: "bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${toneMap[tone]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-10 w-10 rounded-2xl bg-white/80 flex items-center justify-center ">
          <Icon className="w-5 h-5" />
        </div>

        <ArrowRight className="w-4 h-4 opacity-60" />
      </div>

      <p className="mt-3 text-sm font-bold">
        {label}
      </p>
      <p className="mt-1 text-xs opacity-80">
        {description}
      </p>
    </button>
  );
}

function LeadRow({ lead, tone = "red", onClick }) {
  const dueDate = getNextActionDate(lead);

  const toneMap = {
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-100 bg-white px-3 py-3 text-left hover:bg-slate-50 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {getLeadTitle(lead)}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {getAgentName(lead)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {getLeadStage(lead)}
            </span>

            {getDestinationName(lead) && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                {getDestinationName(lead)}
              </span>
            )}
          </div>
        </div>

        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${toneMap[tone]}`}>
          {dueDate ? formatShortDateTime(dueDate) : "No follow-up"}
        </span>
      </div>
    </button>
  );
}

function EngagementRow({ item }) {
  const channel = item.channel || item.type || item.engagementType || "Activity";
  const Icon = getChannelIcon(channel);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {item.subject || item.title || getAgentName(item)}
            </p>

            <span className="shrink-0 text-[11px] text-slate-400">
              {formatShortDateTime(getEngagementDate(item))}
            </span>
          </div>

          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
            {item.message || item.notes || item.remark || item.outcomeCode || "No note added"}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {channel}
            </span>

            {getDestinationName(item) && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                {getDestinationName(item)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, tone = "blue" }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;

  const toneMap = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
    purple: "bg-violet-600",
    slate: "bg-slate-500"
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600">
          {label}
        </span>
        <span className="font-bold text-slate-900">
          {value}
        </span>
      </div>

      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${toneMap[tone]}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function TeamDashboardGraph() {
  const { user, loading } = useAuth("team");
  const router = useRouter();

  const [leads, setLeads] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [travelAgents, setTravelAgents] = useState([]);
  const [workTasks, setWorkTasks] = useState([]);
  const [workEvents, setWorkEvents] = useState([]);
  const [engagementTasks, setEngagementTasks] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const currentRole = resolveUserRole(user || {});
  const currentWorkstream = roleWorkstream(currentRole);

  useEffect(() => {
    if (loading || !user?.uid) return;

    let active = true;

    async function loadDashboard() {
      setFetching(true);

      const uid = user.uid;

      const [
        assignedToLeads,
        assignedToUidLeads,
        createdByLeads,
        ownerUidLeads,
        createdByEngagements,
        ownerEngagements,
        createdAgentRows,
        assignedAgentRows,
        assignedWorkTasks,
        performedWorkEvents,
        assignedEngagementTasks
      ] = await Promise.all([
        safeGetDocs(
          query(
            collection(db, "leads"),
            where("assignedTo", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "leads"),
            where("assignedToUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "leads"),
            where("createdByUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "leads"),
            where("ownerUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "engagements"),
            where("createdByUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "engagements"),
            where("ownerUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "travelAgents"),
            where("createdByUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "travelAgents"),
            where("assignedToUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "workTasks"),
            where("assignedToUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "workActivityEvents"),
            where("performedByUid", "==", uid)
          )
        ),
        safeGetDocs(
          query(
            collection(db, "engagementTasks"),
            where("assignedToUid", "==", uid)
          )
        )
      ]);

      if (!active) return;

      const mergedLeads = mergeById(
        assignedToLeads,
        assignedToUidLeads,
        createdByLeads,
        ownerUidLeads
      );

      const mergedEngagements = mergeById(
        createdByEngagements,
        ownerEngagements
      );

      setLeads(mergedLeads);
      setEngagements(mergedEngagements);
      setTravelAgents(mergeById(createdAgentRows, assignedAgentRows));
      setWorkTasks(assignedWorkTasks);
      setWorkEvents(performedWorkEvents);
      setEngagementTasks(assignedEngagementTasks);
      setLastUpdated(new Date());
      setFetching(false);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [loading, user?.uid, refreshKey]);


  const stats = useMemo(() => {
    const health = {
      healthy: 0,
      at_risk: 0,
      overdue: 0,
      no_followup: 0
    };

    const ownership = {
      createdByMe: 0,
      assignedToMe: 0,
      assignedByOthers: 0,
      selfOwned: 0,
      unassigned: 0
    };

    const responsibilityLeads = leads.filter(lead => {
      const ownerUid = getLeadCreatedByUid(lead);
      const assignedToUid = getLeadAssignedToUid(lead);
      if (assignedToUid) return assignedToUid === user?.uid;
      return ownerUid === user?.uid;
    });

    responsibilityLeads.forEach(lead => {
      health[getLeadHealth(lead)] += 1;
    });

    leads.forEach(lead => {
      const createdByUid = getLeadCreatedByUid(lead);
      const assignedToUid = getLeadAssignedToUid(lead);

      const createdByMe = createdByUid === user?.uid;
      const assignedToMe = assignedToUid === user?.uid;

      if (createdByMe) ownership.createdByMe += 1;
      if (assignedToMe) ownership.assignedToMe += 1;
      if (createdByMe && assignedToMe) ownership.selfOwned += 1;
      if (!createdByMe && assignedToMe) ownership.assignedByOthers += 1;
      if (createdByMe && !assignedToUid) ownership.unassigned += 1;
    });

    const overdueLeads = responsibilityLeads
      .filter(lead => getLeadHealth(lead) === "overdue")
      .sort((a, b) => {
        const da = getNextActionDate(a)?.getTime() || 0;
        const db = getNextActionDate(b)?.getTime() || 0;
        return da - db;
      });

    const dueTodayLeads = responsibilityLeads
      .filter(lead => getLeadHealth(lead) === "at_risk")
      .sort((a, b) => {
        const da = getNextActionDate(a)?.getTime() || 0;
        const db = getNextActionDate(b)?.getTime() || 0;
        return da - db;
      });

    const meetingsToday = engagements.filter(item => {
      return isMeetingEngagement(item) && isSameDay(getMeetingDate(item));
    });

    const newAgentsToday = travelAgents.filter(agent => {
      return (
        getTravelAgentCreatorUid(agent) === user?.uid &&
        isSameDay(getTravelAgentCreatedDate(agent))
      );
    });

    // A New Agent Call is the first call this team member has ever logged
    // against that Travel Agent. The Travel Agent profile may have existed in
    // the CRM long before the first outreach.
    const firstCallByAgent = new Map();

    [...engagements]
      .filter(isCallEngagement)
      .sort((a, b) => {
        const da = getEngagementDate(a)?.getTime() || 0;
        const db = getEngagementDate(b)?.getTime() || 0;
        return da - db;
      })
      .forEach(item => {
        const agentId = getEngagementAgentId(item);
        if (!agentId || firstCallByAgent.has(agentId)) return;
        firstCallByAgent.set(agentId, item);
      });

    const newAgentCallsToday = Array.from(firstCallByAgent.values())
      .filter(item => isSameDay(getEngagementDate(item)));

    const todayEngagements = engagements.filter(item =>
      isSameDay(getEngagementDate(item))
    );
    const todayCalls = todayEngagements.filter(isCallEngagement);
    const todayConnectedCalls = todayCalls.filter(isSuccessfulEngagementConnection);
    const todayUniqueAgentIds = new Set(
      todayEngagements.map(getEngagementAgentId).filter(Boolean)
    );
    const todayMeaningfulEngagements = todayEngagements.filter(isMeaningfulEngagement);
    const todayRequirements = todayEngagements.filter(item =>
      ["requirement_received", "quote_needed"].includes(
        String(item?.outcomeCode || "").trim().toLowerCase()
      )
    );
    const todayConnectionRate = todayCalls.length
      ? Math.round((todayConnectedCalls.length / todayCalls.length) * 100)
      : 0;
    const leadsGeneratedToday = leads.filter(lead =>
      getLeadCreatedByUid(lead) === user?.uid && isSameDay(getLeadCreatedDate(lead))
    );
    const leadsAssignedToday = responsibilityLeads.filter(lead =>
      getLeadAssignedToUid(lead) === user?.uid && isSameDay(getLeadAssignedDate(lead))
    );

    const structuredTasks = [...workTasks, ...engagementTasks]
      .filter(item => !(item?.deleted === true || item?.isDeleted === true));
    const openStructuredTasks = structuredTasks.filter(item =>
      !["completed", "skipped", "cancelled"].includes(
        String(item?.status || item?.completionStatus || "pending").trim().toLowerCase()
      )
    );
    const structuredDueToday = openStructuredTasks.filter(item => {
      const due = toDate(item?.dueAt);
      return due && isSameDay(due);
    });
    const structuredOverdue = openStructuredTasks.filter(item => {
      const due = toDate(item?.dueAt);
      return Boolean(due && due < new Date());
    });
    const todayWorkTasks = workTasks.filter(item => {
      const due = toDate(item?.dueAt);
      const completed = toDate(item?.completedAt || item?.updatedAt);
      return (due && isSameDay(due)) || (completed && isSameDay(completed));
    });
    const todayWorkEvents = workEvents.filter(item => isSameDay(getWorkEventDate(item)));
    const actualOperationsMetrics = calculateOperationalActivityMetrics(todayWorkEvents);
    const openAssignedLeads = responsibilityLeads.filter(lead => !isTerminalLead(lead)).length;

    const latestEngagements = [...engagements]
      .sort((a, b) => {
        const da = getEngagementDate(a)?.getTime() || 0;
        const db = getEngagementDate(b)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 6);

    const destinationCounter = new Map();
    const cityCounter = new Map();

    [...leads, ...engagements].forEach(item => {
      const destination = getDestinationName(item);
      const city = getCityName(item);

      if (destination) {
        destinationCounter.set(destination, (destinationCounter.get(destination) || 0) + 1);
      }

      if (city) {
        cityCounter.set(city, (cityCounter.get(city) || 0) + 1);
      }
    });

    travelAgents.forEach(agent => {
      const city = getCityName(agent);

      if (city) {
        cityCounter.set(city, (cityCounter.get(city) || 0) + 1);
      }
    });

    const topDestinations = Array.from(destinationCounter.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topCities = Array.from(cityCounter.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const stageCounter = new Map();

    const stageSource = currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS
      ? responsibilityLeads
      : leads.filter(lead => getLeadCreatedByUid(lead) === user?.uid);

    stageSource.forEach(lead => {
      const stage = getLeadStage(lead);
      stageCounter.set(stage, (stageCounter.get(stage) || 0) + 1);
    });

    const stageBreakdown = Array.from(stageCounter.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      health,
      ownership,
      overdueLeads,
      dueTodayLeads,
      meetingsToday,
      newAgentsToday,
      newAgentCallsToday,
      workQueue: {
        open: openStructuredTasks.length,
        dueToday: structuredDueToday.length,
        overdue: structuredOverdue.length
      },
      workstream: currentWorkstream,
      engagementOutput: {
        leadsGenerated: leadsGeneratedToday.length,
        engagementFollowUpsDue: structuredDueToday.filter(item => item?.activityGroup === "engagement" || item?.purpose).length
      },
      operationsOutput: {
        openAssignedLeads,
        leadsAssignedToday: leadsAssignedToday.length,
        quoteWork: actualOperationsMetrics.quoteWork,
        requoteWork: actualOperationsMetrics.requoteWork,
        leadFollowUps: actualOperationsMetrics.leadFollowUps,
        vendorCoordination: actualOperationsMetrics.vendorCoordination,
        paymentWork: actualOperationsMetrics.paymentWork,
        onGround: actualOperationsMetrics.onGroundWork,
        completedWork: actualOperationsMetrics.completedWork
      },
      productivity: {
        engagements: todayEngagements.length,
        calls: todayCalls.length,
        connectedCalls: todayConnectedCalls.length,
        connectionRate: todayConnectionRate,
        uniqueAgents: todayUniqueAgentIds.size,
        meaningful: todayMeaningfulEngagements.length,
        requirements: todayRequirements.length
      },
      latestEngagements,
      topDestinations,
      topCities,
      stageBreakdown
    };
  }, [currentWorkstream, leads, engagements, travelAgents, workTasks, workEvents, engagementTasks, user?.uid]);


  if (fetching) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-32 rounded-3xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-32 rounded-3xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-32 rounded-3xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-32 rounded-3xl bg-white border border-slate-200 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  const maxHealth = Math.max(
    stats.health.healthy,
    stats.health.at_risk,
    stats.health.overdue,
    stats.health.no_followup,
    1
  );

  const maxStage = Math.max(
    ...stats.stageBreakdown.map(item => item.count),
    1
  );

  const maxDestination = Math.max(
    ...stats.topDestinations.map(item => item.count),
    1
  );

  const maxCity = Math.max(
    ...stats.topCities.map(item => item.count),
    1
  );


  return (
    <div className="space-y-5">

      {/* ================= ROLE-BASED PRODUCTIVITY ================= */}
      {currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
          <StatCard title="Open Assigned Leads" value={stats.operationsOutput.openAssignedLeads} subtitle="Current Lead & Operations responsibility" icon={Users} tone="blue" onClick={() => router.push("/leads")} />
          <StatCard title="New Leads Received" value={stats.operationsOutput.leadsAssignedToday} subtitle="Assigned to you today" icon={ArrowRight} tone="purple" onClick={() => router.push("/leads")} />
          <StatCard title="Quote Work" value={stats.operationsOutput.quoteWork} subtitle="Quote creation + quote follow-up today" icon={Compass} tone="blue" onClick={() => router.push("/action-center")} />
          <StatCard title="Re-Quote Work" value={stats.operationsOutput.requoteWork} subtitle="Revision activity today" icon={RefreshCcw} tone="amber" onClick={() => router.push("/action-center")} />
          <StatCard title="Lead Follow-ups" value={stats.operationsOutput.leadFollowUps} subtitle="Structured Lead follow-up activity" icon={Phone} tone="green" onClick={() => router.push("/action-center")} />
          <StatCard title="Ops Work Completed" value={stats.operationsOutput.completedWork} subtitle={`${stats.operationsOutput.vendorCoordination} vendor · ${stats.operationsOutput.paymentWork} payment · ${stats.operationsOutput.onGround} on-ground`} icon={CheckCircle2} tone="green" onClick={() => router.push("/action-center")} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
          <StatCard title="Engagements Today" value={stats.productivity.engagements} subtitle={`${stats.productivity.calls} call attempts`} icon={Headphones} tone="blue" onClick={() => router.push("/engagements/my")} />
          <StatCard title="Calls Connected" value={stats.productivity.connectedCalls} subtitle="Actual successful call connections" icon={Phone} tone="green" onClick={() => router.push("/engagements/my")} />
          <StatCard title="Unique Agents Touched" value={stats.productivity.uniqueAgents} subtitle={`${stats.productivity.connectionRate}% connection rate`} icon={Users} tone="purple" onClick={() => router.push("/engagements/my")} />
          <StatCard title="Meaningful Engagements" value={stats.productivity.meaningful} subtitle="Relationship or business progress" icon={BarChart3} tone="amber" onClick={() => router.push("/engagements/my")} />
          <StatCard title="Requirements Generated" value={stats.productivity.requirements} subtitle="Requirement received / quote needed" icon={Compass} tone="blue" onClick={() => router.push("/engagements/my")} />
          <StatCard title="Qualified Leads Created" value={stats.engagementOutput.leadsGenerated} subtitle="Your permanent Lead generation credit" icon={Plus} tone="green" onClick={() => router.push("/leads")} />
        </div>
      )}

      {/* ================= UNIFIED FOLLOW-UP QUEUE ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "My Relationship Follow-ups" : "My Open Work"}
          value={stats.workQueue.open}
          subtitle={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Agent and Engagement follow-ups" : "Lead + On-ground execution"}
          icon={ListChecks}
          tone="blue"
          onClick={() => router.push("/action-center")}
        />
        <StatCard
          title="Work Due Today"
          value={stats.workQueue.dueToday}
          subtitle="Structured actions due today"
          icon={Clock}
          tone="amber"
          onClick={() => router.push("/action-center")}
        />
        <StatCard
          title="Work Overdue"
          value={stats.workQueue.overdue}
          subtitle="Open actions past due"
          icon={AlertTriangle}
          tone="red"
          onClick={() => router.push("/action-center")}
        />
      </div>

      {/* ================= ENGAGEMENT DAILY PULSE ================= */}
      {currentWorkstream !== WORKSTREAMS.LEAD_OPERATIONS ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="New Agents Added Today"
          value={stats.newAgentsToday.length}
          subtitle="Travel-agent profiles created by you today"
          icon={Users}
          tone="blue"
          onClick={() => router.push("/travel-agents")}
        />

        <StatCard
          title="New Agents Called"
          value={stats.newAgentCallsToday.length}
          subtitle="Agents you called for the first time today"
          icon={Phone}
          tone="green"
          onClick={() => router.push(currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "/action-center" : "/engagements/my")}
        />

        <StatCard
          title={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Leads Still With Me" : "Due Today"}
          value={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? stats.ownership.selfOwned + stats.ownership.unassigned : stats.dueTodayLeads.length}
          subtitle={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Created leads not fully handed over" : "Lead follow-ups scheduled today"}
          icon={Clock}
          tone="amber"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title="Overdue Follow-ups"
          value={stats.overdueLeads.length}
          subtitle="Needs immediate attention"
          icon={AlertTriangle}
          tone="red"
          onClick={() => router.push("/leads")}
        />
      </div>

      ) : null}

      {/* ================= LEAD OWNERSHIP ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Leads Generated By Me" : "Leads Created By Me"}
          value={stats.ownership.createdByMe}
          subtitle={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Permanent opportunity-generation credit" : "Permanent creator credit"}
          icon={Plus}
          tone="blue"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Leads Managed By Me" : "Assigned Workload"}
          value={stats.ownership.assignedToMe}
          subtitle={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Current Lead/Operations responsibility" : "Current follow-up responsibility"}
          icon={Users}
          tone="green"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Handover From Engagement" : "Assigned By Others"}
          value={stats.ownership.assignedByOthers}
          subtitle={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Leads generated by others, now managed by you" : "Created by others but assigned to you"}
          icon={ArrowRight}
          tone="purple"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title="Owner + Assignee"
          value={stats.ownership.selfOwned}
          subtitle="You created and currently work it"
          icon={CheckCircle2}
          tone="slate"
          onClick={() => router.push("/leads")}
        />
      </div>

      {/* ================= QUICK ACTIONS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          icon={Plus}
          label={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "My Lead Queue" : "Create Qualified Lead"}
          description={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Work assigned enquiries" : "Create lead from identified requirement"}
          tone="blue"
          onClick={() => router.push(currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "/leads" : "/leads/create")}
        />

        <QuickAction
          icon={MessageCircle}
          label={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Action Center" : "Add Engagement"}
          description={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Quote, follow-up and operations work" : "Log call or relationship follow-up"}
          tone="purple"
          onClick={() => router.push(currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "/action-center" : "/engagements/my")}
        />

        <QuickAction
          icon={Users}
          label="My Leads"
          description="View assigned leads"
          tone="amber"
          onClick={() => router.push("/leads")}
        />
      </div>

      {/* ================= MAIN GRID ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* LEFT BIG AREA */}
        <div className="xl:col-span-2 space-y-5">

          {/* FOLLOW-UP QUEUE */}
          <SectionCard
            title={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Leads Still Under Your Responsibility" : "Follow-up Priority Queue"}
            subtitle={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Only unassigned or still-assigned Leads appear here after handover." : "Overdue and today’s Lead follow-ups should be closed first"}
            icon={AlertTriangle}
            right={
              <button
                onClick={() => router.push("/leads")}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                View all
              </button>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-600">
                    Overdue
                  </p>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700">
                    {stats.overdueLeads.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {stats.overdueLeads.slice(0, 5).length ? (
                    stats.overdueLeads.slice(0, 5).map(lead => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        tone="red"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      />
                    ))
                  ) : (
                    <EmptyMiniState
                      title="No overdue follow-ups"
                      subtitle="Great! Your pending queue is clean."
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                    Due Today
                  </p>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                    {stats.dueTodayLeads.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {stats.dueTodayLeads.slice(0, 5).length ? (
                    stats.dueTodayLeads.slice(0, 5).map(lead => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        tone="amber"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      />
                    ))
                  ) : (
                    <EmptyMiniState
                      title="No follow-ups due today"
                      subtitle="You can focus on new engagement activity."
                    />
                  )}
                </div>
              </div>

            </div>
          </SectionCard>

          {/* LEAD HEALTH + STAGE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard
              title={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Unhanded Lead Health" : "Lead Health"}
              subtitle={currentWorkstream === WORKSTREAMS.ENGAGEMENT ? "Only Leads still under your responsibility" : "Health based on next follow-up date"}
              icon={TrendingUp}
            >
              <div className="space-y-4">
                <MiniBar
                  label="Healthy"
                  value={stats.health.healthy}
                  max={maxHealth}
                  tone="green"
                />
                <MiniBar
                  label="Due Today"
                  value={stats.health.at_risk}
                  max={maxHealth}
                  tone="amber"
                />
                <MiniBar
                  label="Overdue"
                  value={stats.health.overdue}
                  max={maxHealth}
                  tone="red"
                />
                <MiniBar
                  label="No Follow-up Set"
                  value={stats.health.no_followup}
                  max={maxHealth}
                  tone="slate"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Lead Stage Summary"
              subtitle={currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? "Current split of Leads you manage" : "Current split of Leads you generated"}
              icon={BarChart3}
            >
              {stats.stageBreakdown.length ? (
                <div className="space-y-4">
                  {stats.stageBreakdown.map(item => (
                    <MiniBar
                      key={item.name}
                      label={item.name}
                      value={item.count}
                      max={maxStage}
                      tone="blue"
                    />
                  ))}
                </div>
              ) : (
                <EmptyMiniState
                  title="No lead stage data"
                  subtitle="Lead stage summary will appear once leads are assigned."
                />
              )}
            </SectionCard>
          </div>

        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-5">

          {/* LATEST ENGAGEMENT */}
          <SectionCard
            title="Latest Engagements"
            subtitle="Recent calls, messages and meetings"
            icon={Headphones}
            right={
              <button
                onClick={() => router.push("/engagements/my")}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                View all
              </button>
            }
          >
            <div className="space-y-2">
              {stats.latestEngagements.length ? (
                stats.latestEngagements.map(item => (
                  <EngagementRow key={item.id} item={item} />
                ))
              ) : (
                <EmptyMiniState
                  title="No engagements yet"
                  subtitle="Log your first call, WhatsApp or meeting."
                />
              )}
            </div>
          </SectionCard>

        </div>
      </div>

      {/* ================= TRAVEL INSIGHTS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title="Top Destinations"
          subtitle="Based on your leads and engagements"
          icon={Compass}
        >
          {stats.topDestinations.length ? (
            <div className="space-y-4">
              {stats.topDestinations.map(item => (
                <MiniBar
                  key={item.name}
                  label={item.name}
                  value={item.count}
                  max={maxDestination}
                  tone="purple"
                />
              ))}
            </div>
          ) : (
            <EmptyMiniState
              title="No destination insight yet"
              subtitle="Destination data will appear after lead or engagement activity."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Top Cities / Locations"
          subtitle="Useful for location-based follow-ups"
          icon={MapPin}
        >
          {stats.topCities.length ? (
            <div className="space-y-4">
              {stats.topCities.map(item => (
                <MiniBar
                  key={item.name}
                  label={item.name}
                  value={item.count}
                  max={maxCity}
                  tone="green"
                />
              ))}
            </div>
          ) : (
            <EmptyMiniState
              title="No city insight yet"
              subtitle="City data will appear when agent or lead locations are available."
            />
          )}
        </SectionCard>
      </div>

      {/* ================= FOOTER INFO ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 ">
        <div className="flex items-center gap-2">
          <RefreshCcw className="w-3.5 h-3.5" />
          <span>
            Last updated: {lastUpdated ? formatShortDateTime(lastUpdated) : "—"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>

          {stats.overdueLeads.length > 0 ? (
            <>
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-red-600 font-medium">
                {stats.overdueLeads.length} overdue follow-up pending
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">
                No overdue follow-up
              </span>
            </>
          )}
        </div>
      </div>

    </div>
  );
}