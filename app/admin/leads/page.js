"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

import AdminLeadCard from "@/components/admin/AdminLeadCard";
import AdminLeadTable from "@/components/admin/AdminLeadTable";
import AdminLeadFilters from "@/components/admin/AdminLeadFilters";
import AdminLeadCardSkeleton from "@/components/admin/AdminLeadCardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

import { exportLeadsCsv } from "@/lib/exportLeadsCsv";

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

  const nextActionAt = toDate(lead.nextActionAt);

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

const getAssignedFilterValues = lead => {
  return [
    lead.assignedToUid,
    lead.assignedToEmail,
    lead.assignedTo,
    lead.assignedToName,
    lead.assignedUserName
  ]
    .filter(Boolean)
    .map(value => String(value).trim());
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

const getUserOption = user => {
  const value = getFirstValue(
    user.uid,
    user.id,
    user.userId,
    user.email,
    user.workEmail,
    user.officialEmail
  );

  const label = getFirstValue(
    user.displayName,
    user.fullName,
    user.name,
    user.email,
    user.workEmail,
    user.officialEmail
  );

  if (!value || !label) return null;

  return {
    value,
    label,
    email: getFirstValue(user.email, user.workEmail, user.officialEmail)
  };
};

const getLeadAssignedOption = lead => {
  const value = getFirstValue(
    lead.assignedToUid,
    lead.assignedToEmail,
    lead.assignedTo,
    lead.assignedToName,
    lead.assignedUserName
  );

  const label = getFirstValue(
    lead.assignedToName,
    lead.assignedUserName,
    lead.assignedTo,
    lead.assignedToEmail,
    lead.assignedToUid
  );

  if (!value || !label) return null;

  return {
    value,
    label,
    email: getFirstValue(lead.assignedToEmail, lead.assignedTo)
  };
};

export default function AdminLeadsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("card");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  const isSuperAdmin = isUserSuperAdmin(user);

  const [filters, setFilters] = useState({
    stage: "all",
    assignedTo: "all",
    nextAction: "all",
    leadHealth: "all",
    dateRange: "all",
    search: ""
  });

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

  /* =========================
     REALTIME LOAD - USERS / TEAM
     This fills All Team dropdown.
  ========================== */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      snap => {
        setTeamMembers(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );
      },
      error => {
        console.warn("Unable to load users for team filter:", error);
        setTeamMembers([]);
      }
    );

    return () => unsub();
  }, []);

  const activeLeads = useMemo(() => {
    return leads.filter(lead => !isLeadDeleted(lead));
  }, [leads]);

  const teamOptions = useMemo(() => {
    const map = new Map();

    teamMembers.forEach(member => {
      const option = getUserOption(member);
      if (!option) return;

      map.set(option.value, option);
    });

    activeLeads.forEach(lead => {
      const option = getLeadAssignedOption(lead);
      if (!option) return;

      if (!map.has(option.value)) {
        map.set(option.value, option);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );
  }, [teamMembers, activeLeads]);

  /* =========================
     SUPER ADMIN ACTIONS
  ========================== */
  const handleStatusChange = async lead => {
    if (!isSuperAdmin || !lead?.id) return;

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
    return activeLeads.filter(lead => {
      const search = filters.search.trim().toLowerCase();

      if (search && !getSearchText(lead).includes(search)) {
        return false;
      }

      if (
        filters.stage !== "all" &&
        lead.stage !== filters.stage
      ) {
        return false;
      }

      if (filters.assignedTo !== "all") {
        const assignedValues = getAssignedFilterValues(lead);

        if (!assignedValues.includes(filters.assignedTo)) {
          return false;
        }
      }

      if (
        filters.leadHealth !== "all" &&
        getLeadHealth(lead) !== filters.leadHealth
      ) {
        return false;
      }

      const createdDate = getLeadCreatedDate(lead);
      const today = new Date();
      const yesterday = getYesterday();

      if (filters.dateRange === "today") {
        if (!createdDate || !isSameDay(createdDate, today)) {
          return false;
        }
      }

      if (filters.dateRange === "yesterday") {
        if (!createdDate || !isSameDay(createdDate, yesterday)) {
          return false;
        }
      }

      const nextActionAt = toDate(lead.nextActionAt);

      if (filters.nextAction === "overdue") {
        if (!nextActionAt || nextActionAt >= new Date()) {
          return false;
        }
      }

      if (filters.nextAction === "today") {
        if (!nextActionAt || !isSameDay(nextActionAt, new Date())) {
          return false;
        }
      }

      if (filters.nextAction === "none") {
        if (lead.nextActionAt) return false;
      }

      return true;
    });
  }, [activeLeads, filters]);

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
        teamOptions={teamOptions}
        totalCount={activeLeads.length}
        filteredCount={sortedLeads.length}
        isSuperAdmin={isSuperAdmin}
        onExport={() => {
          if (!sortedLeads.length) {
            alert("No leads to export");
            return;
          }

          exportLeadsCsv(sortedLeads);
        }}
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