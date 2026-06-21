"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import AdminGuard from "@/components/AdminGuard";
import AssignTravelAgentModal from "@/components/travel-agents/AssignTravelAgentModal";

import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Filter,
  Search,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users
} from "lucide-react";

/* =========================
   HELPERS
========================= */
function getAgentName(agent) {
  return agent?.agencyName || agent?.name || "Untitled Agent";
}

function getAssignedName(agent) {
  return (
    agent?.assignedToName ||
    agent?.assignedTo ||
    agent?.assignedToEmail ||
    agent?.accountManagerUid ||
    ""
  );
}

function getAssignmentStatus(agent) {
  if (agent?.assignmentStatus) return agent.assignmentStatus;

  return agent?.assignedToUid || agent?.accountManagerUid || agent?.assignedTo
    ? "Assigned"
    : "Unassigned";
}

function getAssignmentPriority(agent) {
  return agent?.assignmentPriority || "Medium";
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function formatDate(value) {
  if (!value) return "-";

  const date = value?.toDate?.() || new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/* =========================
   MAIN PAGE
========================= */
export default function AssignedTravelAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignAgent, setAssignAgent] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    assignmentStatus: "all",
    assignmentPriority: "all",
    category: "all",
    team: "all"
  });

  /* =========================
     REALTIME LOAD
  ========================= */
  useEffect(() => {
    const q = query(collection(db, "travelAgents"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      snap => {
        setAgents(
          snap.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
        );

        setLoading(false);
      },
      error => {
        console.error("Failed to load assigned travel agents:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  /* =========================
     FILTER OPTIONS
  ========================= */
  const teamOptions = useMemo(() => {
    return Array.from(
      new Set(
        agents
          .map(agent => agent.assignedTeam || agent.team)
          .filter(Boolean)
      )
    ).sort();
  }, [agents]);

  /* =========================
     FILTERED AGENTS
  ========================= */
  const filteredAgents = useMemo(() => {
    const search = normalizeText(filters.search);

    return agents.filter(agent => {
      const assignedName = getAssignedName(agent);
      const status = getAssignmentStatus(agent);
      const priority = getAssignmentPriority(agent);
      const category = agent.agentCategory || "B";
      const team = agent.assignedTeam || agent.team || "";

      const matchesSearch =
        !search ||
        normalizeText(getAgentName(agent)).includes(search) ||
        normalizeText(assignedName).includes(search) ||
        normalizeText(agent.assignedToEmail).includes(search) ||
        normalizeText(team).includes(search);

      const matchesStatus =
        filters.assignmentStatus === "all" ||
        status === filters.assignmentStatus;

      const matchesPriority =
        filters.assignmentPriority === "all" ||
        priority === filters.assignmentPriority;

      const matchesCategory =
        filters.category === "all" || category === filters.category;

      const matchesTeam =
        filters.team === "all" || team === filters.team;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory &&
        matchesTeam
      );
    });
  }, [agents, filters]);

  /* =========================
     SUMMARY
  ========================= */
  const summary = useMemo(() => {
    const assigned = agents.filter(
      agent => getAssignmentStatus(agent) !== "Unassigned"
    ).length;

    const unassigned = agents.filter(
      agent => getAssignmentStatus(agent) === "Unassigned"
    ).length;

    const highPriority = agents.filter(agent =>
      ["High", "Critical"].includes(getAssignmentPriority(agent))
    ).length;

    const reassigned = agents.filter(
      agent => getAssignmentStatus(agent) === "Reassigned"
    ).length;

    const onHold = agents.filter(
      agent => getAssignmentStatus(agent) === "On Hold"
    ).length;

    return {
      total: agents.length,
      assigned,
      unassigned,
      highPriority,
      reassigned,
      onHold
    };
  }, [agents]);

  if (loading) {
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
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white ">
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
                        Assigned Travel Agents
                      </h1>
                      <p className="mt-1 text-sm text-blue-50">
                        Manage ownership, assignment priority, unassigned queue,
                        and account manager mapping for travel agents.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/15 p-3 text-sm ring-1 ring-white/20">
                  <HeaderMiniStat label="Assigned" value={summary.assigned} />
                  <HeaderMiniStat label="Unassigned" value={summary.unassigned} />
                </div>
              </div>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <StatCard
              label="Total Agents"
              value={summary.total}
              icon={<Building2 size={18} />}
            />
            <StatCard
              label="Assigned"
              value={summary.assigned}
              icon={<UserCheck size={18} />}
              tone="green"
            />
            <StatCard
              label="Unassigned"
              value={summary.unassigned}
              icon={<UserPlus size={18} />}
              tone="amber"
            />
            <StatCard
              label="High Priority"
              value={summary.highPriority}
              icon={<AlertTriangle size={18} />}
              tone="red"
            />
            <StatCard
              label="Reassigned"
              value={summary.reassigned}
              icon={<Users size={18} />}
              tone="blue"
            />
            <StatCard
              label="On Hold"
              value={summary.onHold}
              icon={<ShieldAlert size={18} />}
              tone="slate"
            />
          </div>

          {/* FILTER BAR */}
          <div className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/95 p-4  backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Filter size={16} />
              Assignment Filters
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
                  placeholder="Search agent, assignee, email, team..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pl-9 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <Select
                value={filters.assignmentStatus}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    assignmentStatus: value
                  }))
                }
              >
                <option value="all">All Status</option>
                <option value="Assigned">Assigned</option>
                <option value="Reassigned">Reassigned</option>
                <option value="Unassigned">Unassigned</option>
                <option value="On Hold">On Hold</option>
              </Select>

              <Select
                value={filters.assignmentPriority}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    assignmentPriority: value
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
                value={filters.team}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    team: value
                  }))
                }
              >
                <option value="all">All Teams</option>
                {teamOptions.map(team => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* TABLE */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white ">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Assignment Queue
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {filteredAgents.length} of {agents.length} travel agents.
                </p>
              </div>
            </div>

            {filteredAgents.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Travel Agent</Th>
                      <Th>Category</Th>
                      <Th>Assigned To</Th>
                      <Th>Team</Th>
                      <Th>Status</Th>
                      <Th>Priority</Th>
                      <Th>KYC</Th>
                      <Th>Payment Risk</Th>
                      <Th>Assigned Date</Th>
                      <Th align="right">Action</Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredAgents.map(agent => {
                      const status = getAssignmentStatus(agent);
                      const priority = getAssignmentPriority(agent);
                      const assignedName = getAssignedName(agent);

                      return (
                        <tr key={agent.id} className="hover:bg-slate-50/70">
                          <Td>
                            <div>
                              <Link
                                href={`/admin/travel-agents/${agent.id}`}
                                className="font-semibold text-slate-900 hover:text-blue-700"
                              >
                                {getAgentName(agent)}
                              </Link>
                              <p className="mt-1 text-xs text-slate-500">
                                {agent.partnerSegment || "New Partner"}
                              </p>
                            </div>
                          </Td>

                          <Td>
                            <CategoryBadge category={agent.agentCategory || "B"} />
                          </Td>

                          <Td>
                            {assignedName ? (
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {assignedName}
                                </p>
                                {agent.assignedToEmail && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {agent.assignedToEmail}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-amber-600">
                                Not assigned
                              </span>
                            )}
                          </Td>

                          <Td>{agent.assignedTeam || agent.team || "-"}</Td>

                          <Td>
                            <AssignmentStatusBadge status={status} />
                          </Td>

                          <Td>
                            <PriorityBadge priority={priority} />
                          </Td>

                          <Td>
                            <KycBadge status={agent.kycStatus || "Pending"} />
                          </Td>

                          <Td>
                            <RiskBadge risk={agent.paymentRisk || "Low"} />
                          </Td>

                          <Td>{formatDate(agent.assignedAt)}</Td>

                          <Td align="right">
                            <button
                              type="button"
                              onClick={() => setAssignAgent(agent)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {status === "Unassigned" ? "Assign" : "Reassign"}
                            </button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <AssignTravelAgentModal
          open={!!assignAgent}
          agent={assignAgent}
          onClose={() => setAssignAgent(null)}
          onAssigned={() => setAssignAgent(null)}
        />
      </main>
    </AdminGuard>
  );
}

/* =========================
   SMALL UI COMPONENTS
========================= */
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
    blue: "bg-blue-50 text-blue-700"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
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

function Th({ children, align = "left" }) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wide text-slate-500`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-4 text-${align} text-sm text-slate-700`}
    >
      {children}
    </td>
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

function KycBadge({ status }) {
  const style =
    status === "Approved"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "Rejected"
      ? "bg-red-50 text-red-700 ring-red-100"
      : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
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
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
      {risk}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center p-8 text-center">
      <div>
        <UserCheck className="mx-auto mb-3 text-slate-400" size={28} />
        <h3 className="text-sm font-semibold text-slate-900">
          No travel agents found
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Try changing filters or add new travel agents.
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 ">
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