"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Filter,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserCheck,
  Users
} from "lucide-react";

/* =========================
   HELPERS
========================= */

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function getAgentName(agent) {
  return agent?.agencyName || agent?.name || "Untitled Travel Agent";
}

function getAssignedUid(agent) {
  return agent?.assignedToUid || agent?.accountManagerUid || "";
}

function getAssignedEmail(agent) {
  return agent?.assignedToEmail || agent?.assignedTo || "";
}

function getPrimarySpoc(agent) {
  const spocs = Array.isArray(agent?.spocs) ? agent.spocs : [];
  return spocs.find(spoc => spoc.isPrimary) || spocs[0] || {};
}

function getAssignmentStatus(agent) {
  if (agent?.assignmentStatus) return agent.assignmentStatus;

  return getAssignedUid(agent) || getAssignedEmail(agent)
    ? "Assigned"
    : "Unassigned";
}

function getAssignmentPriority(agent) {
  return agent?.assignmentPriority || "Medium";
}

function timestampToDate(value) {
  if (!value) return null;

  if (value?.toDate) return value.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = timestampToDate(value);

  if (!date) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getDaysUntil(dateValue) {
  const date = timestampToDate(dateValue);

  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getFollowUpStatus(agent) {
  const days = getDaysUntil(agent.nextReviewDate);

  if (days === null) return "not_set";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "upcoming";

  return "future";
}

function isAssignedToCurrentUser(agent, user) {
  if (!user) return false;

  const userUid = user.uid || user.id || "";
  const userEmail = normalizeText(
    user.email || user.workEmail || user.officialEmail
  );

  const assignedUid = getAssignedUid(agent);
  const assignedEmail = normalizeText(getAssignedEmail(agent));

  return (
    (!!userUid && assignedUid === userUid) ||
    (!!userEmail && assignedEmail === userEmail)
  );
}

function getLeadAgentId(lead) {
  return (
    lead.agentId ||
    lead.travelAgentId ||
    lead.travelAgentRefId ||
    lead.travelAgent?.id ||
    ""
  );
}

function getLeadStatus(lead) {
  return normalizeText(
    lead.status ||
      lead.stage ||
      lead.leadStatus ||
      lead.dealStatus ||
      lead.pipelineStatus
  );
}

function isWonLead(lead) {
  return [
    "won",
    "deal won",
    "converted",
    "confirmed",
    "booking confirmed"
  ].includes(getLeadStatus(lead));
}

function getLeadRevenue(lead) {
  return Number(
    lead.dealValue ||
      lead.totalAmount ||
      lead.quotationAmount ||
      lead.finalAmount ||
      lead.packageAmount ||
      lead.bookingValue ||
      0
  );
}

function formatCurrency(value = 0) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

/* =========================
   PAGE
========================= */

export default function MyAssignedTravelAgentsPage() {
  const { user, loading: authLoading } = useAuth("admin");

  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    priority: "all",
    followUp: "all",
    paymentRisk: "all"
  });

  /* =========================
     REALTIME LOAD
  ========================= */
  useEffect(() => {
    const unsubAgents = onSnapshot(
      collection(db, "travelAgents"),
      snap => {
        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });

        setAgents(rows);
        setLoading(false);
      },
      error => {
        console.error("Failed to load travel agents:", error);
        setLoading(false);
      }
    );

    const unsubLeads = onSnapshot(
      collection(db, "leads"),
      snap => {
        setLeads(
          snap.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
        );
      },
      error => {
        console.error("Failed to load leads:", error);
      }
    );

    return () => {
      unsubAgents();
      unsubLeads();
    };
  }, []);

  /* =========================
     MY ASSIGNED AGENTS
  ========================= */
  const myAgents = useMemo(() => {
    return agents.filter(agent => isAssignedToCurrentUser(agent, user));
  }, [agents, user]);

  const agentLeadMap = useMemo(() => {
    const map = {};

    leads.forEach(lead => {
      const agentId = getLeadAgentId(lead);

      if (!agentId) return;

      if (!map[agentId]) map[agentId] = [];

      map[agentId].push(lead);
    });

    return map;
  }, [leads]);

  const enrichedAgents = useMemo(() => {
    return myAgents.map(agent => {
      const agentLeads = agentLeadMap[agent.id] || [];
      const wonLeads = agentLeads.filter(isWonLead);

      const revenue = wonLeads.reduce(
        (sum, lead) => sum + getLeadRevenue(lead),
        0
      );

      const conversionRate =
        agentLeads.length === 0
          ? 0
          : Math.round((wonLeads.length / agentLeads.length) * 100);

      return {
        ...agent,
        totalLeads: agentLeads.length,
        wonLeads: wonLeads.length,
        revenue,
        conversionRate,
        followUpStatus: getFollowUpStatus(agent)
      };
    });
  }, [myAgents, agentLeadMap]);

  /* =========================
     FILTERED AGENTS
  ========================= */
  const filteredAgents = useMemo(() => {
    const search = normalizeText(filters.search);

    return enrichedAgents.filter(agent => {
      const primarySpoc = getPrimarySpoc(agent);

      const matchesSearch =
        !search ||
        normalizeText(getAgentName(agent)).includes(search) ||
        normalizeText(agent.partnerSegment).includes(search) ||
        normalizeText(agent.assignedTeam || agent.team).includes(search) ||
        normalizeText(primarySpoc.name).includes(search) ||
        normalizeText(primarySpoc.mobile).includes(search);

      const matchesCategory =
        filters.category === "all" ||
        (agent.agentCategory || "B") === filters.category;

      const matchesPriority =
        filters.priority === "all" ||
        getAssignmentPriority(agent) === filters.priority;

      const matchesFollowUp =
        filters.followUp === "all" ||
        agent.followUpStatus === filters.followUp;

      const matchesRisk =
        filters.paymentRisk === "all" ||
        (agent.paymentRisk || "Low") === filters.paymentRisk;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPriority &&
        matchesFollowUp &&
        matchesRisk
      );
    });
  }, [enrichedAgents, filters]);

  /* =========================
     SUMMARY
  ========================= */
  const summary = useMemo(() => {
    const active = enrichedAgents.filter(
      agent => agent.status === "active"
    ).length;

    const highValue = enrichedAgents.filter(agent =>
      ["A+", "A"].includes(agent.agentCategory || "B")
    ).length;

    const highPriority = enrichedAgents.filter(agent =>
      ["High", "Critical"].includes(getAssignmentPriority(agent))
    ).length;

    const overdueFollowUps = enrichedAgents.filter(
      agent => agent.followUpStatus === "overdue"
    ).length;

    const dueToday = enrichedAgents.filter(
      agent => agent.followUpStatus === "today"
    ).length;

    const kycPending = enrichedAgents.filter(
      agent => (agent.kycStatus || "Pending") !== "Approved"
    ).length;

    const highRisk = enrichedAgents.filter(
      agent => (agent.paymentRisk || "Low") === "High"
    ).length;

    const totalLeads = enrichedAgents.reduce(
      (sum, agent) => sum + agent.totalLeads,
      0
    );

    const totalWon = enrichedAgents.reduce(
      (sum, agent) => sum + agent.wonLeads,
      0
    );

    const totalRevenue = enrichedAgents.reduce(
      (sum, agent) => sum + agent.revenue,
      0
    );

    const conversion =
      totalLeads === 0 ? 0 : Math.round((totalWon / totalLeads) * 100);

    return {
      total: enrichedAgents.length,
      active,
      highValue,
      highPriority,
      overdueFollowUps,
      dueToday,
      kycPending,
      highRisk,
      totalLeads,
      totalWon,
      totalRevenue,
      conversion
    };
  }, [enrichedAgents]);

  if (loading || authLoading) {
    return (
      <AdminGuard>
        <main className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="min-h-screen p-4 md:p-6">
        <div className="mx-auto max-w-9xl space-y-6">
          {/* HEADER */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 p-5 text-white md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <Link
                    href="/admin/travel-agents"
                    className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-blue-50 hover:text-white"
                  >
                    <ArrowLeft size={16} />
                    Back to Travel Agents
                  </Link>

                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                      <UserCheck size={24} />
                    </div>

                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight">
                        My Assigned Travel Agents
                      </h1>
                      <p className="mt-1 text-sm text-blue-50">
                        Manage your assigned agents, follow-ups, lead activity,
                        payment risk and KYC priorities.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/15 p-3 text-sm ring-1 ring-white/20">
                  <HeaderMiniStat label="My Agents" value={summary.total} />
                  <HeaderMiniStat label="Revenue" value={formatCurrency(summary.totalRevenue)} />
                </div>
              </div>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <StatCard
              label="My Agents"
              value={summary.total}
              icon={<Building2 size={18} />}
            />
            <StatCard
              label="Active"
              value={summary.active}
              icon={<CheckCircle2 size={18} />}
              tone="green"
            />
            <StatCard
              label="A+ / A Agents"
              value={summary.highValue}
              icon={<BadgeCheck size={18} />}
              tone="purple"
            />
            <StatCard
              label="Overdue Follow-ups"
              value={summary.overdueFollowUps}
              icon={<AlertTriangle size={18} />}
              tone={summary.overdueFollowUps > 0 ? "red" : "green"}
            />
            <StatCard
              label="Due Today"
              value={summary.dueToday}
              icon={<Clock size={18} />}
              tone="amber"
            />
            <StatCard
              label="High Risk"
              value={summary.highRisk}
              icon={<CreditCard size={18} />}
              tone={summary.highRisk > 0 ? "red" : "green"}
            />
          </div>

          {/* PERFORMANCE SUMMARY */}
          <div className="grid gap-4 lg:grid-cols-4">
            <InsightCard
              title="My Total Leads"
              value={summary.totalLeads}
              description="From my assigned agents"
            />
            <InsightCard
              title="Won Deals"
              value={summary.totalWon}
              description="Confirmed / converted leads"
            />
            <InsightCard
              title="Revenue"
              value={formatCurrency(summary.totalRevenue)}
              description="Revenue from won leads"
            />
            <InsightCard
              title="Conversion"
              value={`${summary.conversion}%`}
              description="Won leads divided by total leads"
            />
          </div>

          {/* FILTER BAR */}
          <div className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Filter size={16} />
              My Agent Filters
            </div>

            <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={filters.search}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      search: e.target.value
                    }))
                  }
                  placeholder="Search agent, SPOC, team..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pl-9 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <Select
                value={filters.category}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    category: value
                  }))
                }
              >
                <option value="all">All Category</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </Select>

              <Select
                value={filters.priority}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    priority: value
                  }))
                }
              >
                <option value="all">All Priority</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>

              <Select
                value={filters.followUp}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    followUp: value
                  }))
                }
              >
                <option value="all">All Follow-ups</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due Today</option>
                <option value="upcoming">This Week</option>
                <option value="future">Future</option>
                <option value="not_set">Not Set</option>
              </Select>

              <Select
                value={filters.paymentRisk}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    paymentRisk: value
                  }))
                }
              >
                <option value="all">All Risk</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
              </Select>
            </div>
          </div>

          {/* ACTION LIST */}
          {(summary.overdueFollowUps > 0 ||
            summary.dueToday > 0 ||
            summary.kycPending > 0) && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 text-amber-700" size={20} />
                <div>
                  <h2 className="text-sm font-semibold text-amber-900">
                    Attention Required
                  </h2>
                  <p className="mt-1 text-sm text-amber-700">
                    You have {summary.overdueFollowUps} overdue follow-ups,{" "}
                    {summary.dueToday} follow-ups due today and{" "}
                    {summary.kycPending} agents with KYC pending.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* AGENT CARDS */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  My Assigned Agents
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {filteredAgents.length} of {enrichedAgents.length} assigned agents.
                </p>
              </div>
            </div>

            {filteredAgents.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredAgents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AdminGuard>
  );
}

/* =========================
   UI COMPONENTS
========================= */

function AgentCard({ agent }) {
  const primarySpoc = getPrimarySpoc(agent);
  const followUpStatus = getFollowUpStatus(agent);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <CategoryBadge category={agent.agentCategory || "B"} />
            <PriorityBadge priority={getAssignmentPriority(agent)} />
          </div>

          <h3 className="truncate text-sm font-semibold text-slate-900">
            {getAgentName(agent)}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {agent.partnerSegment || "New Partner"}
          </p>
        </div>

        <AssignmentStatusBadge status={getAssignmentStatus(agent)} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniMetric label="Leads" value={agent.totalLeads} />
        <MiniMetric label="Won" value={agent.wonLeads} />
        <MiniMetric label="Conv." value={`${agent.conversionRate}%`} />
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">
          Primary Contact
        </p>

        <p className="mt-1 text-sm font-medium text-slate-900">
          {primarySpoc.name || "Not added"}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {primarySpoc.mobile && (
            <a
              href={`tel:${primarySpoc.mobile}`}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"
            >
              <Phone size={12} />
              Call
            </a>
          )}

          {primarySpoc.email && (
            <a
              href={`mailto:${primarySpoc.email}`}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"
            >
              <Mail size={12} />
              Email
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <InfoRow
          icon={<CalendarClock size={14} />}
          label="Next Review"
          value={formatDate(agent.nextReviewDate)}
          badge={<FollowUpBadge status={followUpStatus} />}
        />

        <InfoRow
          icon={<ShieldCheck size={14} />}
          label="KYC"
          value={agent.kycStatus || "Pending"}
          badge={<KycBadge status={agent.kycStatus || "Pending"} />}
        />

        <InfoRow
          icon={<CreditCard size={14} />}
          label="Payment Risk"
          value={agent.paymentRisk || "Low"}
          badge={<RiskBadge risk={agent.paymentRisk || "Low"} />}
        />

        <InfoRow
          icon={<MapPin size={14} />}
          label="Destinations"
          value={`${agent.destinationIds?.length || agent.destinations?.length || 0} mapped`}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-600">
          Revenue: {formatCurrency(agent.revenue)}
        </p>

        <div className="flex gap-2">
          <Link
            href={`/admin/travel-agents/${agent.id}`}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Eye size={13} />
            View
          </Link>

          <Link
            href={`/admin/travel-agents/${agent.id}/edit`}
            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Update
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeaderMiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 text-center">
      <p className="text-[11px] font-medium text-blue-50">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
          tones[tone] || tones.slate
        }`}
      >
        {icon}
      </div>

      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InsightCard({ title, value, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 truncate text-xl font-bold text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2 text-center ring-1 ring-slate-200">
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoRow({ icon, label, value, badge }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-2 text-slate-500">
        {icon}
        <span className="truncate text-xs font-medium">{label}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-800">{value}</span>
        {badge}
      </div>
    </div>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
    >
      {children}
    </select>
  );
}

function CategoryBadge({ category }) {
  const style =
    category === "A+"
      ? "bg-purple-50 text-purple-700 ring-purple-100"
      : category === "A"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : category === "B"
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
      {category}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const style =
    priority === "Critical"
      ? "bg-red-50 text-red-700 ring-red-100"
      : priority === "High"
      ? "bg-orange-50 text-orange-700 ring-orange-100"
      : priority === "Medium"
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
      {priority}
    </span>
  );
}

function AssignmentStatusBadge({ status }) {
  const style =
    status === "Assigned"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "Reassigned"
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : status === "On Hold"
      ? "bg-slate-100 text-slate-700 ring-slate-200"
      : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
      {status}
    </span>
  );
}

function FollowUpBadge({ status }) {
  const config = {
    overdue: {
      label: "Overdue",
      style: "bg-red-50 text-red-700 ring-red-100"
    },
    today: {
      label: "Today",
      style: "bg-amber-50 text-amber-700 ring-amber-100"
    },
    upcoming: {
      label: "This Week",
      style: "bg-blue-50 text-blue-700 ring-blue-100"
    },
    future: {
      label: "Planned",
      style: "bg-emerald-50 text-emerald-700 ring-emerald-100"
    },
    not_set: {
      label: "Not Set",
      style: "bg-slate-100 text-slate-600 ring-slate-200"
    }
  };

  const item = config[status] || config.not_set;

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${item.style}`}>
      {item.label}
    </span>
  );
}

function KycBadge({ status }) {
  const style =
    status === "Approved"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "Rejected"
      ? "bg-red-50 text-red-700 ring-red-100"
      : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${style}`}>
      {status}
    </span>
  );
}

function RiskBadge({ risk }) {
  const style =
    risk === "High"
      ? "bg-red-50 text-red-700 ring-red-100"
      : risk === "Medium"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : "bg-emerald-50 text-emerald-700 ring-emerald-100";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${style}`}>
      {risk}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div>
        <Users className="mx-auto mb-3 text-slate-400" size={28} />
        <h3 className="text-sm font-semibold text-slate-900">
          No assigned travel agents found
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          You do not have agents matching the selected filters.
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-1/3 rounded bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-4">
          <div className="h-24 rounded-xl bg-slate-200" />
          <div className="h-24 rounded-xl bg-slate-200" />
          <div className="h-24 rounded-xl bg-slate-200" />
          <div className="h-24 rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}