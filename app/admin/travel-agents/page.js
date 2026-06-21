"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { Loader2, ShieldAlert, Trash2, UserCheck } from "lucide-react";
import Link from "next/link";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";

import TravelAgentFilterBar from "@/components/travel-agents/TravelAgentFilters";
import TravelAgentExportCSV from "@/components/travel-agents/TravelAgentExportCSV";
import TravelAgentImportCSV from "@/components/travel-agents/TravelAgentImportCSV";
import AgentSideDrawer from "@/components/travel-agents/AgentSideDrawer";
import AssignTravelAgentModal from "@/components/travel-agents/AssignTravelAgentModal";

import EmptyState from "@/components/ui/EmptyState";

const MAUChip = ({ label }) => (
  <span className="px-2 py-[2px] rounded-md text-[11px] bg-slate-100 text-slate-700">
    {label}
  </span>
);

const EngagementBadge = ({ status }) => (
  <span
    className={`px-2 py-[2px] rounded-md text-[11px] ${status.className}`}
  >
    {status.label}
  </span>
);

const StatusBadge = ({ status }) => {
  const active = status === "active";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
};

const AssignmentBadge = ({ status }) => {
  const finalStatus = status || "Unassigned";

  const style =
    finalStatus === "Assigned"
      ? "bg-emerald-50 text-emerald-700"
      : finalStatus === "Reassigned"
      ? "bg-blue-50 text-blue-700"
      : finalStatus === "On Hold"
      ? "bg-slate-100 text-slate-600"
      : "bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] ${style}`}>
      {finalStatus}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const finalPriority = priority || "Medium";

  const style =
    finalPriority === "Critical"
      ? "bg-red-50 text-red-700"
      : finalPriority === "High"
      ? "bg-orange-50 text-orange-700"
      : finalPriority === "Low"
      ? "bg-slate-100 text-slate-600"
      : "bg-blue-50 text-blue-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] ${style}`}>
      {finalPriority}
    </span>
  );
};

const CategoryBadge = ({ category }) => {
  const value = category || "B";

  const style =
    value === "A+"
      ? "bg-purple-50 text-purple-700"
      : value === "A"
      ? "bg-emerald-50 text-emerald-700"
      : value === "C"
      ? "bg-slate-100 text-slate-600"
      : "bg-blue-50 text-blue-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] ${style}`}>
      {value}
    </span>
  );
};

const RiskBadge = ({ risk }) => {
  const value = risk || "Low";

  const style =
    value === "High"
      ? "bg-red-50 text-red-700"
      : value === "Medium"
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <span className={`rounded-md px-2 py-[2px] text-[11px] ${style}`}>
      {value} Risk
    </span>
  );
};

const SortButton = ({ label, sortKey, sort, setSort }) => {
  const active = sort.key === sortKey;
  const nextDirection =
    active && sort.direction === "asc" ? "desc" : "asc";

  return (
    <button
      type="button"
      onClick={() =>
        setSort({
          key: sortKey,
          direction: nextDirection
        })
      }
      className="inline-flex items-center gap-1 hover:text-gray-800"
    >
      {label}
      <span className="text-[10px] text-gray-400">
        {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
};

const normalizeRole = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizeText = value =>
  String(value || "")
    .trim()
    .toLowerCase();

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

const toDate = value => {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }

  return null;
};

const getDaysSince = date => {
  if (!date) return null;

  const diffMs = new Date().getTime() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

const formatRelativeDate = date => {
  if (!date) return "No engagement";

  const days = getDaysSince(date);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};

const getPrimarySpoc = agent =>
  agent.spocs?.find(x => x.isPrimary) || agent.spocs?.[0] || null;

const getAgentLocation = agent => {
  return (
    agent.city ||
    agent.location ||
    agent.officeCity ||
    agent.address?.city ||
    agent.billingAddress?.city ||
    agent.state ||
    "No city"
  );
};

const getAgentStatus = agent => {
  const status = String(agent.status || "").toLowerCase();

  if (status === "active" || agent.active === true) return "active";
  return "inactive";
};

const getLatestEngagement = agent => {
  if (Array.isArray(agent.engagements) && agent.engagements.length > 0) {
    const latest = [...agent.engagements]
      .map(item => ({
        ...item,
        parsedDate: toDate(
          item.engagedAt ||
            item.createdAt ||
            item.date ||
            item.followUpAt
        )
      }))
      .filter(item => item.parsedDate)
      .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())[0];

    if (latest) {
      return {
        date: latest.parsedDate,
        type: latest.type || latest.mode || "Engagement",
        note: latest.note || latest.remarks || latest.summary || ""
      };
    }
  }

  const fallbackDate = toDate(
    agent.lastEngagementAt ||
      agent.lastContactedAt
  );

  return {
    date: fallbackDate,
    type: agent.lastEngagementType || agent.lastContactType || "Follow-up",
    note: agent.lastEngagementNote || agent.lastContactNote || ""
  };
};

const getEngagementStatus = agent => {
  const engagement = getLatestEngagement(agent);

  if (!engagement.date) {
    return {
      label: "No Contact",
      className: "bg-gray-100 text-gray-600"
    };
  }

  const days = getDaysSince(engagement.date);

  if (days <= 7) {
    return {
      label: "Fresh",
      className: "bg-emerald-50 text-emerald-700"
    };
  }

  if (days <= 30) {
    return {
      label: "Warm",
      className: "bg-amber-50 text-amber-700"
    };
  }

  return {
    label: "Follow-up",
    className: "bg-red-50 text-red-700"
  };
};

/* =========================
   ASSIGNMENT HELPERS
========================= */

const getAssignedUid = agent =>
  agent.assignedToUid || agent.accountManagerUid || "";

const getAssignedName = agent =>
  agent.assignedToName ||
  agent.assignedToEmail ||
  agent.assignedTo ||
  agent.accountManagerUid ||
  "";

const getAssignedTeam = agent =>
  agent.assignedTeam || agent.team || "";

const getAssignmentStatus = agent => {
  if (agent.assignmentStatus) return agent.assignmentStatus;

  return getAssignedUid(agent) || getAssignedName(agent)
    ? "Assigned"
    : "Unassigned";
};

const getAssignmentPriority = agent =>
  agent.assignmentPriority || "Medium";

const getAgentCategory = agent =>
  agent.agentCategory || "B";

const getPaymentRisk = agent =>
  agent.paymentRisk || "Low";

export default function AdminTravelAgentsPage() {
  const { user } = useAuth();

  const [agents, setAgents] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("table");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const isSuperAdmin = isUserSuperAdmin(user);

  const [sort, setSort] = useState({
    key: "agencyName",
    direction: "asc"
  });

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    agencyType: "",
    destinationId: "",
    relationshipStage: "",
    city: "",
    engagement: "",
    assignmentStatus: "",
    assignmentPriority: "",
    assignedTeam: "",
    assignedUser: ""
  });

  const setBusy = (agentId, action, value) => {
    setActionLoading(prev => ({
      ...prev,
      [`${agentId}-${action}`]: value
    }));
  };

  const isBusy = (agentId, action) =>
    actionLoading[`${agentId}-${action}`] === true;

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [agentSnap, destSnap] = await Promise.all([
        getDocs(collection(db, "travelAgents")),
        getDocs(collection(db, "destinations"))
      ]);

      setAgents(
        agentSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );

      setDestinations(
        destSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name
        }))
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to load travel agents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async agent => {
    if (!isSuperAdmin) return;

    const currentStatus = getAgentStatus(agent);
    const nextStatus = currentStatus === "active" ? "inactive" : "active";

    setBusy(agent.id, "status", true);

    try {
      await updateDoc(doc(db, "travelAgents", agent.id), {
        status: nextStatus,
        active: nextStatus === "active",
        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid || "",
        updatedByName: user?.displayName || user?.email || ""
      });

      setAgents(prev =>
        prev.map(item =>
          item.id === agent.id
            ? {
                ...item,
                status: nextStatus,
                active: nextStatus === "active"
              }
            : item
        )
      );

      setSelectedAgent(prev =>
        prev?.id === agent.id
          ? {
              ...prev,
              status: nextStatus,
              active: nextStatus === "active"
            }
          : prev
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to update travel agent status.");
    } finally {
      setBusy(agent.id, "status", false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!isSuperAdmin || !deleteTarget?.id) return;

    const agentId = deleteTarget.id;
    setBusy(agentId, "delete", true);

    try {
      await deleteDoc(doc(db, "travelAgents", agentId));

      setAgents(prev => prev.filter(agent => agent.id !== agentId));

      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }

      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to delete travel agent.");
    } finally {
      setBusy(agentId, "delete", false);
    }
  };

  const destinationMap = useMemo(() => {
    const map = {};

    destinations.forEach(d => {
      map[d.id] = d.name;
    });

    return map;
  }, [destinations]);

  const getAgentDestinations = useCallback(
    agent => {
      if (Array.isArray(agent.destinationIds)) {
        return agent.destinationIds.map((id, i) => ({
          id: id || `dest-${i}`,
          name: destinationMap[id] || id || "Unknown"
        }));
      }

      if (
        Array.isArray(agent.destinations) &&
        typeof agent.destinations[0] === "string"
      ) {
        return agent.destinations.map((id, i) => ({
          id: id || `dest-${i}`,
          name: destinationMap[id] || id || "Unknown"
        }));
      }

      if (
        Array.isArray(agent.destinations) &&
        typeof agent.destinations[0] === "object"
      ) {
        return agent.destinations.map((d, i) => ({
          id: d.id || d.name || `dest-${i}`,
          name:
            d.name ||
            destinationMap[d.id] ||
            d.id ||
            "Unknown"
        }));
      }

      return [];
    },
    [destinationMap]
  );

  const cityOptions = useMemo(() => {
    const cities = agents
      .map(agent => getAgentLocation(agent))
      .filter(city => city && city !== "No city");

    return [...new Set(cities)].sort();
  }, [agents]);

  const assignedTeamOptions = useMemo(() => {
    return [
      ...new Set(
        agents
          .map(agent => getAssignedTeam(agent))
          .filter(Boolean)
      )
    ].sort();
  }, [agents]);

  const assignedUserOptions = useMemo(() => {
    return [
      ...new Set(
        agents
          .map(agent => getAssignedName(agent))
          .filter(Boolean)
      )
    ].sort();
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const spoc = getPrimarySpoc(agent);
      const s = filters.search.trim().toLowerCase();
      const location = getAgentLocation(agent);
      const agentDestinations = getAgentDestinations(agent);

      const assignedName = getAssignedName(agent);
      const assignedTeam = getAssignedTeam(agent);
      const assignmentStatus = getAssignmentStatus(agent);
      const assignmentPriority = getAssignmentPriority(agent);

      if (
        s &&
        !agent.agencyName?.toLowerCase().includes(s) &&
        !agent.agentCode?.toLowerCase().includes(s) &&
        !spoc?.name?.toLowerCase().includes(s) &&
        !spoc?.email?.toLowerCase().includes(s) &&
        !spoc?.mobile?.toLowerCase().includes(s) &&
        !location?.toLowerCase().includes(s) &&
        !normalizeText(assignedName).includes(s) &&
        !normalizeText(assignedTeam).includes(s)
      ) {
        return false;
      }

      if (filters.status && getAgentStatus(agent) !== filters.status) {
        return false;
      }

      if (filters.agencyType && agent.agencyType !== filters.agencyType) {
        return false;
      }

      if (
        filters.relationshipStage &&
        agent.relationshipStage !== filters.relationshipStage
      ) {
        return false;
      }

      if (
        filters.destinationId &&
        !agentDestinations.some(d => d.id === filters.destinationId)
      ) {
        return false;
      }

      if (filters.city && location !== filters.city) {
        return false;
      }

      if (
        filters.assignmentStatus &&
        assignmentStatus !== filters.assignmentStatus
      ) {
        return false;
      }

      if (
        filters.assignmentPriority &&
        assignmentPriority !== filters.assignmentPriority
      ) {
        return false;
      }

      if (
        filters.assignedTeam &&
        assignedTeam !== filters.assignedTeam
      ) {
        return false;
      }

      if (
        filters.assignedUser &&
        assignedName !== filters.assignedUser
      ) {
        return false;
      }

      if (filters.engagement) {
        const engagement = getLatestEngagement(agent);
        const days = getDaysSince(engagement.date);

        if (filters.engagement === "no_contact" && engagement.date) {
          return false;
        }

        if (filters.engagement === "7d") {
          if (!engagement.date || days > 7) return false;
        }

        if (filters.engagement === "30d") {
          if (!engagement.date || days > 30) return false;
        }

        if (filters.engagement === "follow_up") {
          if (engagement.date && days <= 30) return false;
        }
      }

      return true;
    });
  }, [agents, filters, getAgentDestinations]);

  const sortedAgents = useMemo(() => {
    const normalize = value =>
      String(value || "").trim().toLowerCase();

    const priorityOrder = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };

    const getValue = agent => {
      const spoc = getPrimarySpoc(agent);
      const engagement = getLatestEngagement(agent);

      switch (sort.key) {
        case "agencyName":
          return normalize(agent.agencyName);

        case "agentCode":
          return normalize(agent.agentCode);

        case "spoc":
          return normalize(spoc?.name);

        case "destinations":
          return getAgentDestinations(agent).length;

        case "status":
          return normalize(getAgentStatus(agent));

        case "agencyType":
          return normalize(agent.agencyType);

        case "relationshipStage":
          return normalize(agent.relationshipStage);

        case "city":
          return normalize(getAgentLocation(agent));

        case "latestEngagement":
          return engagement.date ? engagement.date.getTime() : 0;

        case "assignedTo":
          return normalize(getAssignedName(agent));

        case "assignmentStatus":
          return normalize(getAssignmentStatus(agent));

        case "assignmentPriority":
          return priorityOrder[getAssignmentPriority(agent)] || 0;

        default:
          return normalize(agent.agencyName);
      }
    };

    const direction = sort.direction === "asc" ? 1 : -1;

    return [...filteredAgents].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * direction;
      }

      const result = String(av).localeCompare(String(bv));
      return result * direction;
    });
  }, [filteredAgents, sort, getAgentDestinations]);

  const renderStatusAction = agent => {
    const status = getAgentStatus(agent);
    const nextLabel = status === "active" ? "Disable" : "Enable";
    const busy = isBusy(agent.id, "status");

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />

          {isSuperAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange(agent)}
              className={`inline-flex h-7 items-center rounded-lg border px-2.5 text-[11px] font-medium transition ${
                status === "active"
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                nextLabel
              )}
            </button>
          )}
        </div>

        {!isSuperAdmin && (
          <span className="text-[10px] text-gray-400">
            Super admin only
          </span>
        )}
      </div>
    );
  };

  const renderDeleteAction = agent => {
    if (!isSuperAdmin) return null;

    return (
      <button
        type="button"
        onClick={() => setDeleteTarget(agent)}
        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    );
  };

  const renderAssignAction = agent => {
    const status = getAssignmentStatus(agent);
    const label = status === "Unassigned" ? "Assign" : "Reassign";

    return (
      <button
        type="button"
        onClick={() => setAssignTarget(agent)}
        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
      >
        <UserCheck className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  };

  return (
    <AdminGuard>
      <main className="p-6 w-full mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              Travel Agents
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Manage agencies, assignments, locations and latest engagement
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500">
              {sortedAgents.length} of {agents.length} agents
            </p>

            {isSuperAdmin && (
              <p className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700">
                Super admin controls enabled
              </p>
            )}
          </div>
        </div>

        <TravelAgentFilterBar
          view={view}
          setView={setView}
          filters={filters}
          setFilters={setFilters}
          destinations={destinations}
          cityOptions={cityOptions}
          exportAgents={filteredAgents}
        />

        {/* COMPACT ASSIGNMENT FILTERS */}
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <select
              value={filters.assignmentStatus}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  assignmentStatus: e.target.value
                }))
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs"
            >
              <option value="">All Assignment Status</option>
              <option value="Assigned">Assigned</option>
              <option value="Reassigned">Reassigned</option>
              <option value="Unassigned">Unassigned</option>
              <option value="On Hold">On Hold</option>
            </select>

            <select
              value={filters.assignmentPriority}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  assignmentPriority: e.target.value
                }))
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs"
            >
              <option value="">All Priority</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              value={filters.assignedTeam}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  assignedTeam: e.target.value
                }))
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs"
            >
              <option value="">All Assigned Teams</option>
              {assignedTeamOptions.map(team => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>

            <select
              value={filters.assignedUser}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  assignedUser: e.target.value
                }))
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs"
            >
              <option value="">All Assigned Users</option>
              {assignedUserOptions.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">
              Sort
            </label>

            <select
              value={`${sort.key}:${sort.direction}`}
              onChange={e => {
                const [key, direction] = e.target.value.split(":");
                setSort({ key, direction });
              }}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="agencyName:asc">Agency A-Z</option>
              <option value="agencyName:desc">Agency Z-A</option>
              <option value="agentCode:asc">Agent Code A-Z</option>
              <option value="city:asc">City A-Z</option>
              <option value="latestEngagement:desc">Latest Engagement</option>
              <option value="status:asc">Status A-Z</option>
              <option value="agencyType:asc">Agency Type A-Z</option>
              <option value="relationshipStage:asc">Stage A-Z</option>
              <option value="destinations:desc">Most Destinations</option>
              <option value="destinations:asc">Least Destinations</option>
              <option value="assignedTo:asc">Assigned User A-Z</option>
              <option value="assignmentStatus:asc">Assignment Status A-Z</option>
              <option value="assignmentPriority:desc">Highest Priority</option>
              <option value="assignmentPriority:asc">Lowest Priority</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <TravelAgentImportCSV onImported={loadData} />
            <TravelAgentExportCSV agents={sortedAgents} />
          </div>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">
            Loading travel agents…
          </div>
        )}

        {!loading && sortedAgents.length === 0 && (
          <EmptyState
            title="No travel agents found"
            description="Try adjusting filters"
          />
        )}

        {!loading && view === "table" && sortedAgents.length > 0 && (
          <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1320px] w-full text-sm">
                <thead className="bg-gray-50/60 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="Agency"
                        sortKey="agencyName"
                        sort={sort}
                        setSort={setSort}
                      />
                    </th>

                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="Location"
                        sortKey="city"
                        sort={sort}
                        setSort={setSort}
                      />
                    </th>

                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="SPOC"
                        sortKey="spoc"
                        sort={sort}
                        setSort={setSort}
                      />
                    </th>

                    <th className="px-4 py-3 text-left">
                      Assignment
                    </th>

                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="Destinations"
                        sortKey="destinations"
                        sort={sort}
                        setSort={setSort}
                      />
                    </th>

                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="Latest Engagement"
                        sortKey="latestEngagement"
                        sort={sort}
                        setSort={setSort}
                      />
                    </th>

                    <th className="px-4 py-3 text-left">
                      <SortButton
                        label="Status"
                        sortKey="status"
                        sort={sort}
                        setSort={setSort}
                      />
                    </th>

                    <th className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedAgents.map(agent => {
                    const spoc = getPrimarySpoc(agent);
                    const agentDestinations = getAgentDestinations(agent);
                    const location = getAgentLocation(agent);
                    const engagement = getLatestEngagement(agent);
                    const engagementStatus = getEngagementStatus(agent);

                    return (
                      <tr
                        key={agent.id}
                        className="border-b border-gray-100 hover:bg-gray-50/60"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="max-w-[220px] truncate font-medium text-gray-800">
                              {agent.agencyName || "Unnamed agency"}
                            </p>
                            <CategoryBadge category={getAgentCategory(agent)} />
                          </div>

                          <p className="text-xs text-gray-500">
                            {agent.agentCode || "No code"}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-1">
                            <RiskBadge risk={getPaymentRisk(agent)} />
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">
                            {location}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          {spoc ? (
                            <>
                              <p>{spoc.name || "Unnamed SPOC"}</p>
                              <p className="text-xs text-gray-500">
                                {spoc.email || spoc.mobile || "No contact"}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">
                              No SPOC
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {getAssignedName(agent) ? (
                              <>
                                <p className="max-w-[170px] truncate text-sm font-medium text-gray-800">
                                  {getAssignedName(agent)}
                                </p>

                                {getAssignedTeam(agent) && (
                                  <p className="max-w-[170px] truncate text-xs text-gray-500">
                                    {getAssignedTeam(agent)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-amber-600">
                                Not assigned
                              </p>
                            )}

                            <div className="flex flex-wrap gap-1">
                              <AssignmentBadge
                                status={getAssignmentStatus(agent)}
                              />
                              <PriorityBadge
                                priority={getAssignmentPriority(agent)}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {agentDestinations.slice(0, 2).map((d, i) => (
                              <MAUChip
                                key={`${d.id}-${i}`}
                                label={d.name}
                              />
                            ))}

                            {agentDestinations.length > 2 && (
                              <span className="text-[11px] text-gray-500">
                                +{agentDestinations.length - 2} more
                              </span>
                            )}

                            {agentDestinations.length === 0 && (
                              <span className="text-xs text-gray-400">
                                No destinations
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <EngagementBadge status={engagementStatus} />
                              <span className="text-xs text-gray-500">
                                {formatRelativeDate(engagement.date)}
                              </span>
                            </div>

                            {engagement.date && (
                              <>
                                <p className="text-xs text-gray-700">
                                  {engagement.type}
                                </p>

                                {engagement.note && (
                                  <p className="text-xs text-gray-400 truncate max-w-[180px]">
                                    {engagement.note}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {renderStatusAction(agent)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => setSelectedAgent(agent)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Quick view
                            </button>

                            <Link
                              href={`/admin/travel-agents/${agent.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              View
                            </Link>

                            <Link
                              href={`/admin/travel-agents/${agent.id}/edit`}
                              className="text-gray-600 hover:underline"
                            >
                              Edit
                            </Link>

                            {renderAssignAction(agent)}
                            {renderDeleteAction(agent)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && view === "card" && sortedAgents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedAgents.map(agent => {
              const agentDestinations = getAgentDestinations(agent);
              const location = getAgentLocation(agent);
              const engagement = getLatestEngagement(agent);
              const engagementStatus = getEngagementStatus(agent);

              return (
                <div
                  key={agent.id}
                  className="border border-gray-100 rounded-xl bg-white p-4 hover:bg-gray-50/50"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="max-w-[220px] truncate font-semibold text-gray-800">
                          {agent.agencyName || "Unnamed agency"}
                        </p>
                        <CategoryBadge category={getAgentCategory(agent)} />
                      </div>

                      <p className="text-xs text-gray-500">
                        {agent.agentCode || "No code"}
                      </p>
                    </div>

                    {renderStatusAction(agent)}
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      Assigned
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-slate-800">
                      {getAssignedName(agent) || "Not assigned"}
                    </p>

                    {getAssignedTeam(agent) && (
                      <p className="truncate text-xs text-slate-500">
                        {getAssignedTeam(agent)}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      <AssignmentBadge
                        status={getAssignmentStatus(agent)}
                      />
                      <PriorityBadge
                        priority={getAssignmentPriority(agent)}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400">Location</p>
                      <p className="mt-1 text-gray-700">
                        {location}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-400">Engagement</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <EngagementBadge status={engagementStatus} />
                        <span className="text-gray-500">
                          {formatRelativeDate(engagement.date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {engagement.date && engagement.note && (
                    <p className="mt-3 text-xs text-gray-500 line-clamp-2">
                      {engagement.note}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    <RiskBadge risk={getPaymentRisk(agent)} />

                    {agentDestinations.slice(0, 3).map((d, i) => (
                      <MAUChip
                        key={`${d.id}-${i}`}
                        label={d.name}
                      />
                    ))}

                    {agentDestinations.length === 0 && (
                      <span className="text-xs text-gray-400">
                        No destinations
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedAgent(agent)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Quick view
                    </button>

                    <Link
                      href={`/admin/travel-agents/${agent.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>

                    <Link
                      href={`/admin/travel-agents/${agent.id}/edit`}
                      className="text-gray-600 hover:underline"
                    >
                      Edit
                    </Link>

                    {renderAssignAction(agent)}
                    {renderDeleteAction(agent)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedAgent && (
          <AgentSideDrawer
            agent={selectedAgent}
            destinations={getAgentDestinations(selectedAgent)}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        <AssignTravelAgentModal
          open={!!assignTarget}
          agent={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={async () => {
            setAssignTarget(null);
            await loadData();
          }}
        />

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-red-50 p-2 text-red-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>

                <div className="flex-1">
                  <h2 className="text-base font-semibold text-gray-900">
                    Delete travel agent?
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    This will permanently delete{" "}
                    <span className="font-medium text-gray-800">
                      {deleteTarget.agencyName || "this agency"}
                    </span>
                    . This action cannot be undone.
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
                      onClick={handleDeleteAgent}
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
    </AdminGuard>
  );
}