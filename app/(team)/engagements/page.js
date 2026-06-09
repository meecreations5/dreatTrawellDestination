"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCcw,
  Search,
  TrendingUp,
  Users,
  Video
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import CardSkeleton from "@/components/ui/CardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

/* =========================
   DEFAULT FILTERS
========================= */
const DEFAULT_FILTERS = {
  search: "",
  dateFrom: "",
  dateTo: "",
  channel: "all"
};

/* =========================
   HELPERS
========================= */
const normalize = value =>
  String(value || "")
    .trim()
    .toLowerCase();

const getValidDate = value => {
  if (!value) return null;

  if (value?.toDate) return value.toDate();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getStartOfDay = value => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
};

const getEndOfDay = value => {
  if (!value) return null;
  return new Date(`${value}T23:59:59`);
};

const toDateInput = date => {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const formatDateTime = value => {
  const date = getValidDate(value);

  if (!date) return "—";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatLabel = value => {
  if (!value) return "Not Set";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const getAgentName = engagement =>
  engagement?.travelAgentName ||
  engagement?.agentName ||
  engagement?.agent?.agencyName ||
  engagement?.agent?.name ||
  engagement?.agencyName ||
  "Unknown Agent";

const getSpocName = engagement =>
  engagement?.spoc?.name ||
  engagement?.spocName ||
  engagement?.contactPerson ||
  "";

const getDestinationName = engagement =>
  engagement?.destinationName ||
  engagement?.destination?.name ||
  "Not Set";

const getOutcome = engagement =>
  engagement?.outcomeLabel ||
  engagement?.outcomeCode ||
  engagement?.status ||
  "Not Set";

const getFollowUpDate = engagement =>
  getValidDate(
    engagement?.nextActionDate ||
      engagement?.nextFollowUpDate ||
      engagement?.followUpDate ||
      engagement?.tentativeMeetingDate
  );

const getChannelIcon = channel => {
  const icons = {
    call: Phone,
    whatsapp: MessageCircle,
    email: Mail,
    meeting: Users,
    online_meeting: Video,
    offline_meeting: Users,
    site_visit: MapPin,
    other: Activity
  };

  return icons[channel] || Activity;
};

const getChannelLabel = channel => {
  const labels = {
    call: "Call",
    whatsapp: "WhatsApp",
    email: "Email",
    meeting: "Meeting",
    online_meeting: "Online Meeting",
    offline_meeting: "Offline Meeting",
    site_visit: "Site Visit",
    other: "Other"
  };

  return labels[channel] || formatLabel(channel);
};

/* =========================
   UI COMPONENTS
========================= */
function KpiCard({ icon: Icon, label, value, helper, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700"
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>

          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {value}
          </p>

          {helper && (
            <p className="mt-1 text-xs text-gray-400">
              {helper}
            </p>
          )}
        </div>

        <div
          className={`h-11 w-11 rounded-2xl flex items-center justify-center ${
            toneClass[tone] || toneClass.blue
          }`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-500">
            {subtitle}
          </p>
        )}
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
}

function ProgressRow({ label, value, total }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-700 truncate">
          {label}
        </p>
        <p className="text-xs font-semibold text-gray-900">
          {value}
        </p>
      </div>

      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function EmptyMiniState({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      <p className="text-sm font-medium text-gray-700">
        {title}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Data will appear here once engagements are available.
      </p>
    </div>
  );
}

function RecentEngagementItem({ engagement }) {
  const Icon = getChannelIcon(engagement.channel);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-950 truncate">
                {engagement.subject || getAgentName(engagement)}
              </p>

              <p className="mt-0.5 text-xs text-gray-500">
                {getChannelLabel(engagement.channel)} • {formatDateTime(engagement.createdAt)}
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {formatLabel(getOutcome(engagement))}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {getAgentName(engagement)}
            </span>

            {getSpocName(engagement) && (
              <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
                SPOC: {getSpocName(engagement)}
              </span>
            )}

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {getDestinationName(engagement)}
            </span>
          </div>

          {engagement.message && (
            <p className="mt-3 text-sm text-gray-500 line-clamp-2">
              {engagement.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN PAGE
========================= */
export default function EngagementDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  /* =========================
     LOAD ENGAGEMENTS
  ========================== */
  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid) {
      setEngagements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const q = query(
      collection(db, "engagements"),
      where("createdByUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const rows = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        setEngagements(rows);
        setLoading(false);
      },
      err => {
        console.error("Failed to load engagement dashboard:", err);
        setError(
          "Unable to load engagement dashboard. Please check Firestore permissions or required index."
        );
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, authLoading]);

  /* =========================
     FILTER OPTIONS
  ========================== */
  const channelOptions = useMemo(() => {
    const channels = Array.from(
      new Set(engagements.map(e => e.channel).filter(Boolean))
    );

    return channels.sort();
  }, [engagements]);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "channel") return value && value !== "all";
      return Boolean(String(value || "").trim());
    }).length;
  }, [filters]);

  const dateRangeError = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) return "";

    const fromDate = getStartOfDay(filters.dateFrom);
    const toDate = getEndOfDay(filters.dateTo);

    if (fromDate && toDate && fromDate > toDate) {
      return "From Date cannot be later than To Date.";
    }

    return "";
  }, [filters.dateFrom, filters.dateTo]);

  const filteredEngagements = useMemo(() => {
    if (dateRangeError) return [];

    const searchText = normalize(filters.search);
    const fromDate = getStartOfDay(filters.dateFrom);
    const toDate = getEndOfDay(filters.dateTo);

    return engagements.filter(e => {
      const createdDate = getValidDate(e.createdAt);
      const channel = normalize(e.channel);

      if ((fromDate || toDate) && !createdDate) return false;
      if (fromDate && createdDate < fromDate) return false;
      if (toDate && createdDate > toDate) return false;

      if (
        filters.channel !== "all" &&
        channel !== normalize(filters.channel)
      ) {
        return false;
      }

      if (searchText) {
        const searchableText = [
          e.subject,
          e.message,
          e.outcomeCode,
          e.outcomeLabel,
          e.channel,
          getAgentName(e),
          getSpocName(e),
          getDestinationName(e),
          e.createdByName
        ]
          .map(normalize)
          .join(" ");

        if (!searchableText.includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }, [engagements, filters, dateRangeError]);

  /* =========================
     SUMMARY
  ========================== */
  const summary = useMemo(() => {
    const today = new Date();

    let todayCount = 0;
    let meetingCount = 0;
    let followUpDue = 0;
    let overdueFollowUp = 0;

    const channelMap = {};
    const destinationMap = {};
    const agentMap = {};
    const outcomeMap = {};

    filteredEngagements.forEach(e => {
      const createdDate = getValidDate(e.createdAt);

      if (createdDate && isSameDay(createdDate, today)) {
        todayCount += 1;
      }

      if (
        ["meeting", "online_meeting", "offline_meeting"].includes(e.channel)
      ) {
        meetingCount += 1;
      }

      const followDate = getFollowUpDate(e);

      if (followDate) {
        if (followDate < today && !isSameDay(followDate, today)) {
          overdueFollowUp += 1;
        } else if (isSameDay(followDate, today)) {
          followUpDue += 1;
        }
      }

      const channel = e.channel || "other";
      channelMap[channel] = (channelMap[channel] || 0) + 1;

      const destination = getDestinationName(e);
      destinationMap[destination] =
        (destinationMap[destination] || 0) + 1;

      const agent = getAgentName(e);
      agentMap[agent] = (agentMap[agent] || 0) + 1;

      const outcome = getOutcome(e);
      outcomeMap[outcome] = (outcomeMap[outcome] || 0) + 1;
    });

    const toSorted = obj =>
      Object.entries(obj)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    const topChannel = toSorted(channelMap)[0];

    return {
      total: filteredEngagements.length,
      today: todayCount,
      meetings: meetingCount,
      followUpDue,
      overdueFollowUp,
      channelRows: toSorted(channelMap),
      destinationRows: toSorted(destinationMap).slice(0, 5),
      agentRows: toSorted(agentMap).slice(0, 5),
      outcomeRows: toSorted(outcomeMap).slice(0, 5),
      topChannel: topChannel
        ? `${getChannelLabel(topChannel.label)} (${topChannel.value})`
        : "—"
    };
  }, [filteredEngagements]);

  const recentEngagements = useMemo(() => {
    return filteredEngagements.slice(0, 6);
  }, [filteredEngagements]);

  /* =========================
     FILTER ACTIONS
  ========================== */
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const setDateRange = type => {
    const today = new Date();

    if (type === "today") {
      const date = toDateInput(today);

      setFilters(prev => ({
        ...prev,
        dateFrom: date,
        dateTo: date
      }));
    }

    if (type === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const date = toDateInput(yesterday);

      setFilters(prev => ({
        ...prev,
        dateFrom: date,
        dateTo: date
      }));
    }

    if (type === "last7") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);

      setFilters(prev => ({
        ...prev,
        dateFrom: toDateInput(from),
        dateTo: toDateInput(today)
      }));
    }

    if (type === "thisMonth") {
      const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

      setFilters(prev => ({
        ...prev,
        dateFrom: toDateInput(firstDay),
        dateTo: toDateInput(today)
      }));
    }
  };

  /* =========================
     LOADING
  ========================== */
  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          <CardSkeleton />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ================= BANNER ================= */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/15 text-white flex items-center justify-center shrink-0">
                <BarChart3 size={24} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 mb-3">
                  <Activity size={14} />
                  Engagement Analytics
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Engagement Dashboard
                </h1>

                <p className="mt-1 text-sm text-blue-100 max-w-2xl leading-6">
                  Monitor your calls, WhatsApp messages, emails, meetings and follow-up performance from one dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= FILTER PANEL ================= */}
        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">

            <div className="xl:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Search
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={filters.search}
                  onChange={e => updateFilter("search", e.target.value)}
                  placeholder="Agent, destination, SPOC, outcome..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Channel
              </label>
              <select
                value={filters.channel}
                onChange={e => updateFilter("channel", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">All Channels</option>
                {channelOptions.map(channel => (
                  <option key={channel} value={channel}>
                    {getChannelLabel(channel)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => updateFilter("dateFrom", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => updateFilter("dateTo", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                <RefreshCcw size={15} />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDateRange("today")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setDateRange("yesterday")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              Yesterday
            </button>

            <button
              type="button"
              onClick={() => setDateRange("last7")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={() => setDateRange("thisMonth")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              This Month
            </button>

            {activeFilterCount > 0 && (
              <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {activeFilterCount} active filter
                {activeFilterCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {dateRangeError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {dateRangeError}
          </div>
        )}

        {/* ================= KPI GRID ================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <KpiCard
            icon={Activity}
            label="Total Engagements"
            value={summary.total}
            helper="Matching selected filters"
            tone="blue"
          />

          <KpiCard
            icon={CalendarDays}
            label="Today"
            value={summary.today}
            helper="Created today"
            tone="emerald"
          />

          <KpiCard
            icon={Users}
            label="Meetings"
            value={summary.meetings}
            helper="Meeting-based engagements"
            tone="purple"
          />

          <KpiCard
            icon={Clock3}
            label="Due Today"
            value={summary.followUpDue}
            helper="Follow-ups due today"
            tone="amber"
          />

          <KpiCard
            icon={AlertTriangle}
            label="Overdue"
            value={summary.overdueFollowUp}
            helper="Pending past due date"
            tone="red"
          />
        </section>

        {/* ================= CHARTS / INSIGHTS ================= */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          <div className="xl:col-span-4">
            <SectionCard
              title="Channel Breakdown"
              subtitle="Engagements by communication channel"
            >
              {summary.channelRows.length === 0 ? (
                <EmptyMiniState title="No channel data" />
              ) : (
                <div className="space-y-4">
                  {summary.channelRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={getChannelLabel(row.label)}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="xl:col-span-4">
            <SectionCard
              title="Top Destinations"
              subtitle="Most discussed destinations"
            >
              {summary.destinationRows.length === 0 ? (
                <EmptyMiniState title="No destination data" />
              ) : (
                <div className="space-y-4">
                  {summary.destinationRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="xl:col-span-4">
            <SectionCard
              title="Top Travel Agents"
              subtitle="Most engaged agencies"
            >
              {summary.agentRows.length === 0 ? (
                <EmptyMiniState title="No agent data" />
              ) : (
                <div className="space-y-4">
                  {summary.agentRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </section>

        {/* ================= LOWER GRID ================= */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          <div className="xl:col-span-4">
            <SectionCard
              title="Outcome Summary"
              subtitle="Common outcomes from engagements"
            >
              {summary.outcomeRows.length === 0 ? (
                <EmptyMiniState title="No outcome data" />
              ) : (
                <div className="space-y-4">
                  {summary.outcomeRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={formatLabel(row.label)}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="xl:col-span-8">
            <SectionCard
              title="Recent Engagements"
              subtitle="Latest engagement activity based on selected filters"
            >
              {recentEngagements.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No engagements found"
                  description="Try changing your filters or date range."
                />
              ) : (
                <div className="space-y-3">
                  {recentEngagements.map(engagement => (
                    <RecentEngagementItem
                      key={engagement.id}
                      engagement={engagement}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </section>
      </div>
    </main>
  );
}