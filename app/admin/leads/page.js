"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  Clock3,
  Loader2,
  ShieldAlert,
  Sparkles
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";

import AdminLeadCard from "@/components/admin/AdminLeadCard";
import AdminLeadTable from "@/components/admin/AdminLeadTable";
import AdminLeadFilters from "@/components/admin/AdminLeadFilters";
import AdminLeadCardSkeleton from "@/components/admin/AdminLeadCardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

import { exportLeadsCsv } from "@/lib/exportLeadsCsv";
import { getLeadAssignee, getLeadOwner } from "@/lib/leadOwnership";
import { normalizeLeadStage } from "@/lib/leadStages";
import { getLeadTravelMonthKey, matchesLeadTravelMonth } from "@/lib/leadTravelDates";
import { getLeadAging } from "@/lib/leadAging";
import { normalizeLeadClosingPotential } from "@/lib/leadPotential";
import { buildLocationOptions, getLeadAgentLocationParts, matchesLocation } from "@/lib/locationFilters";
import { matchesAdminDateScope } from "@/lib/adminScope";
import { canAccess, canAccessRecord, filterRecordsByAccess } from "@/lib/rolePermissions";
import {
  findDirectoryMember,
  getMembersForTeam,
  memberMatchesValues,
  resolveDirectoryIdentity,
  teamMatchesScope
} from "@/lib/teamDirectory";

/* =========================
   BASIC HELPERS
========================= */
const getFirstValue = (...values) => {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
};

/* =========================
   ROLE HELPERS
========================= */
const normalizeRole = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isUserSuperAdmin = user => {
  if (!user) return false;

  const possibleRoles = [
    user.role,
    user.userRole,
    user.type,
    user.claims?.role,
    user.customClaims?.role,
    user.profile?.role,
    user.dbUser?.role
  ];

  return (
    user.isSuperAdmin === true ||
    user.superAdmin === true ||
    user.claims?.super_admin === true ||
    user.customClaims?.super_admin === true ||
    possibleRoles.some(role => normalizeRole(role) === "super_admin")
  );
};

/* =========================
   DATE HELPERS
========================= */
const toDate = value => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value?.seconds === "number") {
    const parsed = new Date(value.seconds * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const getYesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
};

const getLeadCreatedDate = lead => {
  return (
    toDate(lead?.createdAt) ||
    toDate(lead?.createdOn) ||
    toDate(lead?.created_at) ||
    toDate(lead?.assignedAt) ||
    null
  );
};

const formatLeadDate = value => {
  const date = toDate(value);

  if (!date) return "Date not available";

  const today = new Date();
  const yesterday = getYesterday();

  const time = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  if (isSameDay(date, today)) {
    return `Today, ${time}`;
  }

  if (isSameDay(date, yesterday)) {
    return `Yesterday, ${time}`;
  }

  return `${date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })}, ${time}`;
};

/* =========================
   LEAD HELPERS
========================= */
const isLeadDeleted = lead => {
  return lead?.deleted === true || lead?.isDeleted === true;
};

const getLeadStatus = lead => {
  const status = String(lead?.status || "").toLowerCase();

  if (
    status === "inactive" ||
    status === "disabled" ||
    lead?.active === false ||
    lead?.disabled === true
  ) {
    return "inactive";
  }

  return "active";
};

const getLeadHealth = lead => {
  if (getLeadStatus(lead) === "inactive") {
    return "inactive";
  }

  const nextActionAt = getLeadNextActionDate(lead);

  if (!nextActionAt) {
    return "no_followup";
  }

  const now = new Date();

  if (isSameDay(nextActionAt, now)) {
    return "due_today";
  }

  if (nextActionAt < now) {
    return "overdue";
  }

  return "healthy";
};

const getCustomerName = lead => {
  return (
    lead.customerName ||
    lead.clientName ||
    lead.guestName ||
    lead.travellerName ||
    lead.name ||
    ""
  );
};

const getAssignedName = lead => {
  return getFirstValue(
    lead.assignedToName,
    lead.assignedUserName,
    lead.assignedTo,
    lead.assignedToEmail,
    lead.assignedToUid
  );
};

const getDestinationName = lead => {
  return (
    lead.destinationName ||
    lead.destination ||
    lead.city ||
    lead.location ||
    ""
  );
};

const getLeadNextActionDate = lead => {
  return toDate(
    lead?.nextActionAt ||
    lead?.nextActionDueAt ||
    lead?.followUpAt ||
    lead?.nextFollowUpAt
  );
};

const getSearchText = lead => {
  return [
    lead.leadCode,
    getCustomerName(lead),
    lead.mobile,
    lead.phone,
    lead.email,
    getDestinationName(lead),
    lead.agentName,
    getAssignedName(lead)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export default function AdminLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { scope, teamDirectory, userLookup } = useAdminScope();

  const [leads, setLeads] = useState([]);
  const [travelAgents, setTravelAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("card");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  const isSuperAdmin = isUserSuperAdmin(user);

  const [filters, setFilters] = useState({
    search: "",
    owner: "all",
    assignedTo: "all",
    potential: "all",
    stage: "all",
    followUp: "all",
    destination: "all",
    state: "",
    city: "",
    subArea: "",
    travelMonth: "all",
    openOnly: false,
    priorityAttention: false
  });

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      owner: "all",
      assignedTo: "all"
    }));
  }, [scope.team]);

  useEffect(() => {
    const followUp = searchParams.get("followUp");
    const potential = searchParams.get("potential");
    const stage = searchParams.get("stage");
    const destination = searchParams.get("destination");
    const state = searchParams.get("state");
    const city = searchParams.get("city");
    const subArea = searchParams.get("subArea");
    const travelMonth = searchParams.get("travelMonth");
    const openOnly = searchParams.get("openOnly") === "1";
    const priorityAttention = searchParams.get("priorityAttention") === "1";

    if (!followUp && !potential && !stage && !destination && !state && !city && !subArea && !travelMonth && !openOnly && !priorityAttention) return;

    setFilters(prev => ({
      ...prev,
      followUp: ["today", "overdue", "upcoming", "none"].includes(followUp) ? followUp : prev.followUp,
      potential: potential || prev.potential,
      stage: stage || prev.stage,
      destination: destination || prev.destination,
      state: state || prev.state,
      city: city || prev.city,
      subArea: subArea || prev.subArea,
      travelMonth: travelMonth || prev.travelMonth,
      openOnly: openOnly || prev.openOnly,
      priorityAttention
    }));
  }, [searchParams]);

  const [sort] = useState({
    key: "createdAt",
    direction: "desc"
  });

  const setBusy = (leadId, action, value) => {
    setActionLoading(prev => ({
      ...prev,
      [`${leadId}-${action}`]: value
    }));
  };

  const isBusy = (leadId, action) =>
    actionLoading[`${leadId}-${action}`] === true;

  /* =========================
     REALTIME LOAD - LEADS
  ========================== */
  useEffect(() => {
    const q = query(
      collection(db, "leads"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      snap => {
        setLeads(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );

        setLoading(false);
      },
      error => {
        console.error(error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "travelAgents"),
      snap => setTravelAgents(snap.docs.map(item => ({ id: item.id, ...item.data() }))),
      error => console.warn("Travel Agent location master unavailable:", error)
    );
    return () => unsub();
  }, []);

  const activeLeads = useMemo(() => {
    const current = leads.filter(lead => !isLeadDeleted(lead));
    return filterRecordsByAccess(current, user, "leads.view", "lead", { userLookup });
  }, [leads, user, userLookup]);

  const visibleDirectoryMembers = useMemo(() => {
    return getMembersForTeam(teamDirectory, scope.team);
  }, [teamDirectory, scope.team]);

  const ownerOptions = useMemo(() => {
    return visibleDirectoryMembers.map(member => ({
      value: member.key,
      label: member.label,
      email: member.email,
      team: member.team
    }));
  }, [visibleDirectoryMembers]);

  const assigneeOptions = ownerOptions;

  const destinationOptions = useMemo(() => {
    return Array.from(
      new Set(
        activeLeads
          .map(lead => String(getDestinationName(lead) || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [activeLeads]);

  const travelMonthOptions = useMemo(() => {
    return Array.from(
      new Set(
        activeLeads
          .filter(lead => !getLeadAging(lead).terminal)
          .map(getLeadTravelMonthKey)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [activeLeads]);

  const travelAgentMap = useMemo(() => {
    const map = new Map();
    travelAgents.forEach(agent => map.set(agent.id, agent));
    return map;
  }, [travelAgents]);

  const getLeadLocation = lead => {
    const agentId = lead?.travelAgentId || lead?.agentId || "";
    return getLeadAgentLocationParts(lead, agentId ? travelAgentMap.get(agentId) : null);
  };

  const locationOptions = useMemo(
    () => buildLocationOptions(activeLeads, getLeadLocation, filters.state, filters.city),
    [activeLeads, travelAgentMap, filters.state, filters.city]
  );

  const getMemberForLeadIdentity = identity => {
    if (!identity) return null;
    const resolved = resolveDirectoryIdentity(
      { uid: identity.uid, email: identity.email, name: identity.name },
      userLookup
    );
    return resolved?.isUnmapped ? null : resolved;
  };

  /* =========================
     SUPER ADMIN ACTIONS
  ========================== */
  const handleStatusChange = async lead => {
    if (!isSuperAdmin || !lead?.id) return;
    if (!canAccessRecord(user, "leads.edit", lead, "lead", { userLookup })) return;

    const currentStatus = getLeadStatus(lead);
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    const disabling = nextStatus === "inactive";

    setBusy(lead.id, "status", true);

    try {
      await updateDoc(doc(db, "leads", lead.id), {
        status: nextStatus,
        active: nextStatus === "active",
        disabled: disabling,
        disabledAt: disabling ? serverTimestamp() : null,
        disabledByUid: disabling ? user?.uid || "" : "",
        disabledByName: disabling
          ? user?.displayName || user?.email || ""
          : "",
        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid || "",
        updatedByName: user?.displayName || user?.email || ""
      });

      setLeads(prev =>
        prev.map(item =>
          item.id === lead.id
            ? {
                ...item,
                status: nextStatus,
                active: nextStatus === "active",
                disabled: disabling
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to update lead status.");
    } finally {
      setBusy(lead.id, "status", false);
    }
  };

  const handleDeleteLead = async () => {
    if (!isSuperAdmin || !deleteTarget?.id) return;

    const leadId = deleteTarget.id;

    setBusy(leadId, "delete", true);

    try {
      await updateDoc(doc(db, "leads", leadId), {
        deleted: true,
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedByUid: user?.uid || "",
        deletedByName: user?.displayName || user?.email || "",
        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid || "",
        updatedByName: user?.displayName || user?.email || ""
      });

      setLeads(prev => prev.filter(lead => lead.id !== leadId));
      setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to delete lead.");
    } finally {
      setBusy(leadId, "delete", false);
    }
  };

  const handleToggleLead = leadId => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  /* =========================
     FILTERED LEADS
  ========================== */
  const filteredLeads = useMemo(() => {
    const now = new Date();
    const today = new Date();

    return activeLeads.filter(lead => {
      const search = filters.search.trim().toLowerCase();

      if (search && !getSearchText(lead).includes(search)) return false;

      if (filters.stage !== "all" && normalizeLeadStage(lead.stage) !== filters.stage) return false;
      const closingPotential = normalizeLeadClosingPotential(lead);
      if (filters.potential !== "all" && closingPotential !== filters.potential) return false;
      if (filters.priorityAttention && !["hot", "at_risk"].includes(closingPotential)) return false;
      if (!matchesLocation(getLeadLocation(lead), filters)) return false;

      const owner = getLeadOwner(lead);
      const assignee = getLeadAssignee(lead);
      const ownerMember = getMemberForLeadIdentity(owner);
      const assigneeMember = getMemberForLeadIdentity(assignee);

      if (scope.team !== "all") {
        const ownerInTeam = ownerMember ? teamMatchesScope(ownerMember.team, scope.team) : false;
        const assigneeInTeam = assigneeMember ? teamMatchesScope(assigneeMember.team, scope.team) : false;
        if (!ownerInTeam && !assigneeInTeam) return false;
      }

      if (filters.owner !== "all") {
        const member = findDirectoryMember(teamDirectory, filters.owner);
        const values = [owner.uid, owner.email, owner.name];
        if (!member || !memberMatchesValues(member, values)) return false;
      }

      if (filters.assignedTo === "unassigned") {
        if (assignee.uid || assignee.email || assignee.name) return false;
      } else if (filters.assignedTo !== "all") {
        const member = findDirectoryMember(teamDirectory, filters.assignedTo);
        const values = [assignee.uid, assignee.email, assignee.name];
        if (!member || !memberMatchesValues(member, values)) return false;
      }

      const aging = getLeadAging(lead, now);
      if (filters.openOnly && aging.terminal) return false;
      if (!matchesLeadTravelMonth(lead, filters.travelMonth)) return false;

      const travelPipelineMode = filters.openOnly && filters.travelMonth !== "all";
      const createdDate = getLeadCreatedDate(lead);
      if (!travelPipelineMode && !matchesAdminDateScope(createdDate, scope.dateRange, scope.dateFrom, scope.dateTo)) return false;

      if (filters.destination !== "all" && String(getDestinationName(lead) || "").trim() !== filters.destination) return false;


      const nextActionAt = aging.nextActionAt;
      if (filters.followUp === "overdue" && !aging.overdue) return false;
      if (filters.followUp === "today" && (aging.terminal || !nextActionAt || !isSameDay(nextActionAt, today))) return false;
      if (filters.followUp === "upcoming" && (aging.terminal || !nextActionAt || nextActionAt <= now || isSameDay(nextActionAt, today))) return false;
      if (filters.followUp === "none" && !aging.noNextAction) return false;

      return true;
    });
  }, [activeLeads, filters, teamDirectory, userLookup, travelAgentMap, scope.team, scope.dateRange, scope.dateFrom, scope.dateTo]);

  /* =========================
     SORTED LEADS
  ========================== */
  const sortedLeads = useMemo(() => {
    const getSortValue = lead => {
      switch (sort.key) {
        case "createdAt":
          return getLeadCreatedDate(lead)?.getTime() || 0;

        case "nextActionAt":
          return toDate(lead.nextActionAt)?.getTime() || 0;

        case "overdue":
          return getLeadHealth(lead) === "overdue" ? 1 : 0;

        case "leadCode":
          return String(lead.leadCode || "").toLowerCase();

        case "stage":
          return String(lead.stage || "").toLowerCase();

        default:
          return getLeadCreatedDate(lead)?.getTime() || 0;
      }
    };

    const direction = sort.direction === "asc" ? 1 : -1;

    return [...filteredLeads].sort((a, b) => {
      const av = getSortValue(a);
      const bv = getSortValue(b);

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * direction;
      }

      return String(av).localeCompare(String(bv)) * direction;
    });
  }, [filteredLeads, sort]);

  /* =========================
     UI
  ========================== */
  return (
    <main className="w-full mx-auto space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            Lead Management
          </div>

          <h1 className="mt-2 text-xl font-semibold text-gray-900">
            Admin — Leads
          </h1>

          <p className="mt-1 text-xs text-gray-500">
            Manage leads, assignments, follow-ups and admin controls.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-xs text-gray-500">Showing</p>

          <p className="text-lg font-semibold text-gray-900">
            {sortedLeads.length}
            <span className="text-xs font-medium text-gray-400">
              {" "}of {activeLeads.length}
            </span>
          </p>

          {isSuperAdmin && (
            <p className="mt-1 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700">
              Super admin controls enabled
            </p>
          )}
        </div>
      </div>

      <AdminLeadFilters
        view={view}
        setView={setView}
        filters={filters}
        setFilters={setFilters}
        ownerOptions={ownerOptions}
        assigneeOptions={assigneeOptions}
        destinationOptions={destinationOptions}
        locationOptions={locationOptions}
        travelMonthOptions={travelMonthOptions}
        totalCount={activeLeads.length}
        filteredCount={sortedLeads.length}
        isSuperAdmin={isSuperAdmin}
        onExport={canAccess(user, "leads.export") ? () => {
          if (!sortedLeads.length) {
            alert("No leads to export");
            return;
          }

          exportLeadsCsv(sortedLeads, {
            travelAgentMap,
            includeVendorCost: canAccess(user, "payments.view_vendor_cost"),
            includeRevenueGp: canAccess(user, "payments.view_revenue_gp")
          });
        } : null}
      />

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <AdminLeadCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && sortedLeads.length === 0 && (
        <EmptyState
          title="No leads found"
          description="Try adjusting filters."
        />
      )}

      {!loading && view === "card" && sortedLeads.length > 0 && (
        <div className="space-y-3">
          {sortedLeads.map(lead => {
            const createdDate = getLeadCreatedDate(lead);

            return (
              <div
                key={lead.id}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:border-blue-100 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-white px-4 py-2">
                  <div className="text-xs font-medium text-blue-700">
                    {lead.leadCode || "Lead"}
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 shadow-sm">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatLeadDate(createdDate)}
                  </div>
                </div>

                <AdminLeadCard
                  lead={lead}
                  isSuperAdmin={isSuperAdmin}
                  onStatusChange={handleStatusChange}
                  onDelete={setDeleteTarget}
                  statusBusy={isBusy(lead.id, "status")}
                  deleteBusy={isBusy(lead.id, "delete")}
                />
              </div>
            );
          })}
        </div>
      )}

      {!loading && view === "table" && sortedLeads.length > 0 && (
        <AdminLeadTable
          leads={sortedLeads}
          selected={selectedLeadIds}
          onToggle={handleToggleLead}
          onRowClick={id => router.push(`/admin/leads/${id}`)}
          isSuperAdmin={isSuperAdmin}
          onStatusChange={handleStatusChange}
          onDelete={setDeleteTarget}
          isStatusBusy={id => isBusy(id, "status")}
          isDeleteBusy={id => isBusy(id, "delete")}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-50 p-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900">
                  Delete lead?
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  This will remove{" "}
                  <span className="font-medium text-gray-800">
                    {deleteTarget.leadCode ||
                      getCustomerName(deleteTarget) ||
                      "this lead"}
                  </span>{" "}
                  from the active lead list. This is saved as a soft delete for
                  audit safety.
                </p>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isBusy(deleteTarget.id, "delete")}
                    className="h-9 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteLead}
                    disabled={isBusy(deleteTarget.id, "delete")}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBusy(deleteTarget.id, "delete") && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}