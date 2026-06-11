"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Compass,
  Headphones,
  MapPin,
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

function formatTime(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
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

function formatMinutes(minutes) {
  if (!minutes || Number.isNaN(Number(minutes))) return "0h 0m";

  const hrs = Math.floor(Number(minutes) / 60);
  const mins = Number(minutes) % 60;

  return `${hrs}h ${mins}m`;
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
  return (
    getUid(lead.createdByUid) ||
    getUid(lead.createdBy) ||
    getUid(lead.createdByUser) ||
    getUid(lead.createdByUserId) ||
    ""
  );
}

function getLeadAssignedToUid(lead) {
  return (
    getUid(lead.assignedToUid) ||
    getUid(lead.assignedTo) ||
    getUid(lead.assignedToUser) ||
    getUid(lead.ownerUid) ||
    getUid(lead.accountManagerUid) ||
    ""
  );
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
      className="group text-left rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition disabled:cursor-default"
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
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
      className={`rounded-3xl border p-4 text-left transition ${toneMap[tone]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-10 w-10 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
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
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [travelAgents, setTravelAgents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

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
        agentRows
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
            collection(db, "travel-agents"),
            where("assignedTo", "==", uid)
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
      setTravelAgents(agentRows || []);
      setLastUpdated(new Date());
      setFetching(false);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [loading, user?.uid]);

  /* =========================
     LIVE ATTENDANCE LISTENER
     Firestore path:
     attendance/{uid}_{YYYY-MM-DD}
  ========================= */
  useEffect(() => {
    if (loading || !user?.uid) return;

    const attendanceDocId = `${user.uid}_${todayKey}`;
    const attendanceRef = doc(db, "attendance", attendanceDocId);

    const unsubscribe = onSnapshot(
      attendanceRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setAttendanceToday(null);
          return;
        }

        setAttendanceToday({
          id: docSnap.id,
          ...docSnap.data()
        });
      },
      (error) => {
        console.error("Today attendance listener failed:", error);
        setAttendanceToday(null);
      }
    );

    return () => unsubscribe();
  }, [loading, user?.uid, todayKey]);

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

    leads.forEach(lead => {
      health[getLeadHealth(lead)] += 1;

      const createdByUid = getLeadCreatedByUid(lead);
      const assignedToUid = getLeadAssignedToUid(lead);

      const createdByMe = createdByUid === user?.uid;
      const assignedToMe = assignedToUid === user?.uid;

      if (createdByMe) ownership.createdByMe += 1;
      if (assignedToMe) ownership.assignedToMe += 1;
      if (createdByMe && assignedToMe) ownership.selfOwned += 1;
      if (!createdByMe && assignedToMe) ownership.assignedByOthers += 1;
      if (!assignedToUid) ownership.unassigned += 1;
    });

    const overdueLeads = leads
      .filter(lead => getLeadHealth(lead) === "overdue")
      .sort((a, b) => {
        const da = getNextActionDate(a)?.getTime() || 0;
        const db = getNextActionDate(b)?.getTime() || 0;
        return da - db;
      });

    const dueTodayLeads = leads
      .filter(lead => getLeadHealth(lead) === "at_risk")
      .sort((a, b) => {
        const da = getNextActionDate(a)?.getTime() || 0;
        const db = getNextActionDate(b)?.getTime() || 0;
        return da - db;
      });

    const meetingsToday = engagements.filter(item => {
      return isMeetingEngagement(item) && isSameDay(getMeetingDate(item));
    });

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

    leads.forEach(lead => {
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
      latestEngagements,
      topDestinations,
      topCities,
      stageBreakdown
    };
  }, [leads, engagements, travelAgents, user?.uid]);

  const attendanceStatus = useMemo(() => {
    if (!attendanceToday) {
      return {
        label: "Not marked",
        tone: "amber",
        icon: Clock,
        checkIn: "—",
        checkOut: "—",
        total: "0h 0m"
      };
    }

    const sessions = Array.isArray(attendanceToday.sessions)
      ? attendanceToday.sessions
      : [];

    const firstSession = sessions[0];
    const lastSession = sessions[sessions.length - 1];

    const checkedIn = firstSession?.checkInAt || attendanceToday.checkInAt;
    const checkedOut = lastSession?.checkOutAt || attendanceToday.checkOutAt;

    const totalMinutes =
      Number(attendanceToday.totalMinutes || 0) ||
      sessions.reduce((sum, session) => {
        return sum + Number(session.minutes || 0);
      }, 0);

    const hasOpenSession = sessions.some(
      session => session.checkInAt && !session.checkOutAt
    );

    const hasCompletedSession = sessions.some(
      session => session.checkInAt && session.checkOutAt
    );

    if (hasOpenSession) {
      return {
        label: "Checked in",
        tone: "blue",
        icon: CalendarCheck,
        checkIn: formatTime(checkedIn),
        checkOut: "—",
        total: formatMinutes(totalMinutes)
      };
    }

    if (
      hasCompletedSession ||
      attendanceToday.status === "present" ||
      totalMinutes > 0
    ) {
      return {
        label: "Present",
        tone: "green",
        icon: CheckCircle2,
        checkIn: formatTime(checkedIn),
        checkOut: formatTime(checkedOut),
        total: formatMinutes(totalMinutes)
      };
    }

    return {
      label: attendanceToday.status || "Marked",
      tone: "blue",
      icon: CalendarCheck,
      checkIn: formatTime(checkedIn),
      checkOut: formatTime(checkedOut),
      total: formatMinutes(totalMinutes)
    };
  }, [attendanceToday]);

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

  const AttendanceIcon = attendanceStatus.icon;

  return (
    <div className="space-y-5">

      {/* ================= TODAY PULSE ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Attendance Today"
          value={attendanceStatus.label}
          subtitle={`In ${attendanceStatus.checkIn} • Out ${attendanceStatus.checkOut}`}
          icon={attendanceStatus.icon}
          tone={attendanceStatus.tone}
          onClick={() => router.push("/attendance")}
        />

        <StatCard
          title="Overdue Follow-ups"
          value={stats.overdueLeads.length}
          subtitle="Needs immediate attention"
          icon={AlertTriangle}
          tone="red"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title="Due Today"
          value={stats.dueTodayLeads.length}
          subtitle="Follow-ups scheduled today"
          icon={Clock}
          tone="amber"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title="Meetings Today"
          value={stats.meetingsToday.length}
          subtitle="Online / offline meetings"
          icon={Video}
          tone="purple"
          onClick={() => router.push("/engagements")}
        />
      </div>

      {/* ================= LEAD OWNERSHIP ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Created By Me"
          value={stats.ownership.createdByMe}
          subtitle="Leads originally created by you"
          icon={Plus}
          tone="blue"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title="Assigned To Me"
          value={stats.ownership.assignedToMe}
          subtitle="Leads currently assigned to you"
          icon={Users}
          tone="green"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title="Assigned By Others"
          value={stats.ownership.assignedByOthers}
          subtitle="Created by others but assigned to you"
          icon={ArrowRight}
          tone="purple"
          onClick={() => router.push("/leads")}
        />

        <StatCard
          title="Self Owned"
          value={stats.ownership.selfOwned}
          subtitle="Created and assigned to you"
          icon={CheckCircle2}
          tone="slate"
          onClick={() => router.push("/leads")}
        />
      </div>

      {/* ================= QUICK ACTIONS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction
          icon={Plus}
          label="Add Lead"
          description="Create new enquiry"
          tone="blue"
          onClick={() => router.push("/leads/create")}
        />

        <QuickAction
          icon={MessageCircle}
          label="Add Engagement"
          description="Log call or follow-up"
          tone="purple"
          onClick={() => router.push("/engagements/my")}
        />

        <QuickAction
          icon={CalendarCheck}
          label="Attendance"
          description="Check-in / check-out"
          tone="green"
          onClick={() => router.push("/attendance")}
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
            title="Follow-up Priority Queue"
            subtitle="Overdue and today’s follow-ups should be closed first"
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
              title="Lead Health"
              subtitle="Health based on next follow-up date"
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
              subtitle="Current split of your leads"
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

          {/* ATTENDANCE DETAIL */}
          <SectionCard
            title="Today Attendance"
            subtitle={`Date: ${formatDate(new Date())}`}
            icon={CalendarCheck}
            right={
              <button
                onClick={() => router.push("/attendance")}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Mark
              </button>
            }
          >
            <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600">
                    Status
                  </p>
                  <p className="mt-1 text-xl font-bold capitalize text-slate-950">
                    {attendanceStatus.label}
                  </p>
                </div>

                <div className="h-12 w-12 rounded-2xl bg-white text-blue-700 flex items-center justify-center shadow-sm">
                  <AttendanceIcon className="w-6 h-6" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="text-[11px] text-slate-500">
                    Check-in
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {attendanceStatus.checkIn}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="text-[11px] text-slate-500">
                    Check-out
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {attendanceStatus.checkOut}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="text-[11px] text-slate-500">
                    Total
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {attendanceStatus.total}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
        <div className="flex items-center gap-2">
          <RefreshCcw className="w-3.5 h-3.5" />
          <span>
            Last updated: {lastUpdated ? formatShortDateTime(lastUpdated) : "—"}
          </span>
        </div>

        <div className="flex items-center gap-2">
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