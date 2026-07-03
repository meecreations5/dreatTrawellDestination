"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";

import EngagementForm from "./EngagementForm";
import EngagementCard from "@/components/engagement/EngagementCard";
import BottomSheetModal from "@/components/ui/BottomSheetModal";
import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";
import HeaderSkeleton from "@/components/ui/HeaderSkeleton";

/* =========================
   MOBILE DETECTION
========================= */

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");

    setIsMobile(mq.matches);

    const handler = e => setIsMobile(e.matches);

    mq.addEventListener("change", handler);

    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

/* =========================
   DATE HELPERS
========================= */

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const formatDateLabel = dateValue => {
  const d = toDate(dateValue) || new Date();
  const today = new Date();
  const yesterday = new Date(today);

  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

function isToday(value) {
  const date = toDate(value);
  if (!date) return false;

  return isSameDay(date, new Date());
}

function isUpcoming(value) {
  const date = toDate(value);
  if (!date) return false;

  return date.getTime() >= Date.now();
}

/* =========================
   LABEL HELPERS
========================= */

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getAgentName(agent = {}) {
  return getFirstValue(
    agent.agencyName,
    agent.name,
    agent.companyName,
    agent.businessName,
    "Travel Agent"
  );
}

function getAgentCode(agent = {}) {
  return getFirstValue(agent.agentCode, agent.code);
}

function getSpocCount(agent = {}) {
  return Array.isArray(agent.spocs) ? agent.spocs.length : 0;
}

function getChannelLabel(channel = "") {
  const map = {
    call: "Call",
    email: "Email",
    whatsapp: "WhatsApp",
    meeting: "Meeting"
  };

  return map[channel] || channel || "Other";
}

function getChannelIcon(channel = "") {
  const className = "w-4 h-4";

  if (channel === "call") return <Phone className={className} />;
  if (channel === "email") return <Mail className={className} />;
  if (channel === "whatsapp") return <MessageCircle className={className} />;
  if (channel === "meeting") return <UsersRound className={className} />;

  return <Activity className={className} />;
}

function getOutcomeLabel(item = {}) {
  return (
    item.outcomeLabel ||
    item.outcomeCode ||
    item.status ||
    "Not marked"
  );
}

/* =========================
   MAIN PAGE
========================= */

export default function EngagementPage() {
  const { agentId } = useParams();
  const todayRef = useRef(null);
  const isMobile = useIsMobile();

  const [agent, setAgent] = useState(null);
  const [engagements, setEngagements] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsedDates, setCollapsedDates] = useState({});
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);

  const agentProfileHref = agentId ? `/travel-agents/${agentId}` : "";

  /* =========================
     LOAD AGENT
  ========================== */

  useEffect(() => {
    if (!agentId) return;

    getDoc(doc(db, "travelAgents", agentId)).then(snap => {
      if (snap.exists()) {
        setAgent({
          id: snap.id,
          ...snap.data()
        });
      }
    });
  }, [agentId]);

  /* =========================
     REALTIME ENGAGEMENTS
  ========================== */

  useEffect(() => {
    if (!agentId) return;

    const q = query(
      collection(db, "engagements"),
      where("agentId", "==", agentId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .filter(item => item.deleted !== true && item.isDeleted !== true);

      setEngagements(prev => {
        if (prev.length && rows[0]?.id && rows[0]?.id !== prev[0]?.id) {
          setHighlightId(rows[0].id);

          setTimeout(() => {
            setHighlightId(null);
          }, 2500);
        }

        return rows;
      });

      setLoading(false);
    });

    return () => unsub();
  }, [agentId]);

  /* =========================
     STATS
  ========================== */

  const stats = useMemo(() => {
    const total = engagements.length;

    const todayCount = engagements.filter(item =>
      isToday(item.createdAt)
    ).length;

    const scheduledCount = engagements.filter(item =>
      item.status === "scheduled" ||
      item.requiresFollowUp === true ||
      isUpcoming(item.scheduledAt) ||
      isUpcoming(item.nextFollowUpDate)
    ).length;

    const smartReadyCount = engagements.filter(item =>
      item.communicationReady === true ||
      Boolean(item.intentCode)
    ).length;

    const awaitingAgentCount = engagements.filter(item =>
      item.waitingOn === "agent" ||
      item.communicationStatus === "waiting_for_agent"
    ).length;

    return {
      total,
      todayCount,
      scheduledCount,
      smartReadyCount,
      awaitingAgentCount
    };
  }, [engagements]);

  const latestEngagement = engagements[0] || null;

  const nextFollowUp = useMemo(() => {
    return engagements
      .map(item => ({
        ...item,
        followUpAt:
          item.scheduledAt ||
          item.nextFollowUpDate ||
          item.followUpDate ||
          item.nextActionDate ||
          null
      }))
      .filter(item => isUpcoming(item.followUpAt))
      .sort((a, b) => {
        const aTime = toDate(a.followUpAt)?.getTime() || 0;
        const bTime = toDate(b.followUpAt)?.getTime() || 0;

        return aTime - bTime;
      })[0];
  }, [engagements]);

  /* =========================
     FILTERED
  ========================== */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return engagements.filter(e => {
      const matchesSearch =
        !q ||
        [
          e.subject,
          e.message,
          e.messageText,
          e.destinationName,
          e.spoc?.name,
          e.spoc?.email,
          e.spoc?.mobile,
          e.outcomeLabel,
          e.outcomeCode,
          e.intentName,
          e.intentCode,
          e.communicationStatus
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q));

      const matchesChannel =
        channelFilter === "all" || e.channel === channelFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "scheduled" &&
          (e.status === "scheduled" ||
            e.requiresFollowUp === true ||
            Boolean(e.scheduledAt))) ||
        (statusFilter === "completed" && e.status === "completed") ||
        (statusFilter === "smart_ready" &&
          (e.communicationReady === true || Boolean(e.intentCode))) ||
        (statusFilter === "waiting_for_agent" &&
          (e.waitingOn === "agent" ||
            e.communicationStatus === "waiting_for_agent"));

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [search, channelFilter, statusFilter, engagements]);

  /* =========================
     GROUP BY DATE
  ========================== */

  const grouped = useMemo(() => {
    return filtered.reduce((acc, e) => {
      const date = toDate(e.createdAt) || new Date();
      const label = formatDateLabel(date);

      if (!acc[label]) acc[label] = [];
      acc[label].push(e);

      return acc;
    }, {});
  }, [filtered]);

  const hasActiveFilter =
    search.trim() ||
    channelFilter !== "all" ||
    statusFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setChannelFilter("all");
    setStatusFilter("all");
  };

  /* =========================
     LOADING
  ========================== */

  if (!agent || loading) {
    return (
      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <HeaderSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <div className="lg:col-span-2 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-6 max-w-9xl mx-auto space-y-6 pb-24">
      {/* HEADER */}
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                  <Activity className="w-3.5 h-3.5" />
                  Engagement Timeline
                </span>

                {getAgentCode(agent) && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                    {getAgentCode(agent)}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                {agentProfileHref ? (
                  <Link
                    href={agentProfileHref}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    {getAgentName(agent)}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                ) : (
                  getAgentName(agent)
                )}
              </h1>

              <p className="text-sm text-blue-100 mt-1">
                Track calls, emails, WhatsApp messages, meetings, follow-ups and smart communication intent.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-blue-100">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="w-3.5 h-3.5" />
                  {getSpocCount(agent)} SPOC
                </span>

                {latestEngagement && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5" />
                    Last activity: {formatDateLabel(latestEngagement.createdAt)}
                  </span>
                )}

                {nextFollowUp && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Next follow-up scheduled
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 lg:justify-end">
              <Link
                href={agentProfileHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                View Agent Profile
                <ExternalLink className="w-4 h-4" />
              </Link>

              {isMobile && (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" />
                  New Engagement
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* KPI CARDS */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          title="Total"
          value={stats.total}
          icon={<Activity className="w-4 h-4" />}
          tone="blue"
        />

        <KpiCard
          title="Today"
          value={stats.todayCount}
          icon={<Clock3 className="w-4 h-4" />}
          tone="green"
        />

        <KpiCard
          title="Follow-ups"
          value={stats.scheduledCount}
          icon={<CalendarClock className="w-4 h-4" />}
          tone="orange"
        />

        <KpiCard
          title="Smart Ready"
          value={stats.smartReadyCount}
          icon={<Sparkles className="w-4 h-4" />}
          tone="purple"
        />

        <KpiCard
          title="Waiting Agent"
          value={stats.awaitingAgentCount}
          icon={<AlertCircle className="w-4 h-4" />}
          tone="slate"
        />
      </section>

      {/* SMART SUMMARY */}
      {(latestEngagement || nextFollowUp) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {latestEngagement && (
            <SmartInfoCard
              title="Latest Engagement"
              icon={<Activity className="w-4 h-4" />}
              primary={latestEngagement.subject || getOutcomeLabel(latestEngagement)}
              secondary={
                latestEngagement.intentName
                  ? `Intent: ${latestEngagement.intentName}`
                  : `Channel: ${getChannelLabel(latestEngagement.channel)}`
              }
              footer={
                latestEngagement.communicationStatus ||
                latestEngagement.status ||
                "Saved"
              }
            />
          )}

          {nextFollowUp && (
            <SmartInfoCard
              title="Next Follow-up"
              icon={<CalendarClock className="w-4 h-4" />}
              primary={nextFollowUp.subject || getOutcomeLabel(nextFollowUp)}
              secondary={
                toDate(nextFollowUp.followUpAt)?.toLocaleString(undefined, {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit"
                }) || "Scheduled"
              }
              footer={
                nextFollowUp.suggestedNextActionLabel ||
                nextFollowUp.intentName ||
                "Follow-up required"
              }
            />
          )}
        </section>
      )}

      {/* SEARCH + FILTERS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by message, SPOC, destination, intent, outcome..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              icon={<Filter className="w-4 h-4" />}
              value={channelFilter}
              onChange={setChannelFilter}
              options={[
                { value: "all", label: "All Channels" },
                { value: "call", label: "Call" },
                { value: "email", label: "Email" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "meeting", label: "Meeting" }
              ]}
            />

            <FilterSelect
              icon={<CheckCircle2 className="w-4 h-4" />}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Status" },
                { value: "scheduled", label: "Follow-up / Scheduled" },
                { value: "completed", label: "Completed" },
                { value: "smart_ready", label: "Smart Ready" },
                { value: "waiting_for_agent", label: "Waiting Agent" }
              ]}
            />

            <button
              type="button"
              onClick={() =>
                todayRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              <Clock3 className="w-4 h-4" />
              Today
            </button>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      {/* LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* DESKTOP FORM */}
        {!isMobile && (
          <aside className="lg:sticky lg:top-6 h-fit">
            <EngagementForm agent={agent} />
          </aside>
        )}

        {/* TIMELINE */}
        <section className="lg:col-span-2 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Activity Timeline
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {filtered.length} of {engagements.length} engagement(s)
              </p>
            </div>

            {!isMobile && (
              <button
                type="button"
                onClick={() =>
                  todayRef.current?.scrollIntoView({ behavior: "smooth" })
                }
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Jump to Today
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No matching engagements"
              description={
                hasActiveFilter
                  ? "Try resetting filters or changing search keywords."
                  : "No engagement has been logged for this travel agent yet."
              }
            />
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([dateLabel, items]) => {
                const collapsed =
                  collapsedDates[dateLabel] &&
                  dateLabel !== "Today";

                return (
                  <div
                    key={dateLabel}
                    ref={dateLabel === "Today" ? todayRef : null}
                    className="relative"
                  >
                    <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur py-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedDates(s => ({
                              ...s,
                              [dateLabel]: !s[dateLabel]
                            }))
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {collapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          {dateLabel}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            {items.length}
                          </span>
                        </button>

                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    </div>

                    {!collapsed && (
                      <div className="space-y-5 pl-0 sm:pl-2">
                        {items.map(e => (
                          <TimelineItemWrapper
                            key={e.id}
                            engagement={e}
                            highlight={e.id === highlightId}
                          >
                            <EngagementCard
                              engagement={e}
                              agent={agent}
                              highlight={e.id === highlightId}
                              agentProfileHref={agentProfileHref}
                              showProfileBadge={false}
                            />
                          </TimelineItemWrapper>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* MOBILE ADD ENGAGEMENT */}
      {isMobile && (
        <>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="
              fixed bottom-6 right-6 z-30
              bg-blue-600 text-white
              rounded-full p-4 shadow-xl
              border border-blue-500
              hover:bg-blue-700
            "
            aria-label="Add engagement"
          >
            <Plus className="w-6 h-6" />
          </button>

          <BottomSheetModal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            title="New Engagement"
          >
            <EngagementForm agent={agent} />
          </BottomSheetModal>
        </>
      )}
    </main>
  );
}

/* =========================
   UI COMPONENTS
========================= */

function KpiCard({ title, value, icon, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {title}
          </p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {value}
          </p>
        </div>

        <div
          className={`
            h-10 w-10 rounded-xl border flex items-center justify-center
            ${toneClass[tone] || toneClass.blue}
          `}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SmartInfoCard({ title, icon, primary, secondary, footer }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-white border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-700">
            {title}
          </p>

          <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
            {primary || "-"}
          </p>

          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {secondary || "-"}
          </p>

          {footer && (
            <span className="inline-flex mt-2 rounded-full bg-white border border-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {footer}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ icon, value, onChange, options = [] }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="absolute left-3 text-slate-400 pointer-events-none">
        {icon}
      </span>

      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2.5 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus:border-blue-400"
      >
        {options.map(item => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
    </label>
  );
}

function TimelineItemWrapper({ children, engagement, highlight }) {
  return (
    <div className="relative">
      <div className="absolute left-0 top-0 bottom-0 hidden sm:block">
        <div className="h-full w-px bg-slate-200 ml-2" />
      </div>

      <div className="relative sm:pl-7">
        <div
          className={`
            absolute left-0 top-5 hidden sm:flex h-4 w-4 rounded-full border-2 bg-white items-center justify-center
            ${
              highlight
                ? "border-blue-500 ring-4 ring-blue-100"
                : "border-slate-300"
            }
          `}
        >
          <span
            className={`
              h-1.5 w-1.5 rounded-full
              ${highlight ? "bg-blue-600" : "bg-slate-300"}
            `}
          />
        </div>

        <div
          className={`
            rounded-2xl transition
            ${highlight ? "ring-2 ring-blue-300 ring-offset-2" : ""}
          `}
        >
          {children}
        </div>
      </div>
    </div>
  );
}