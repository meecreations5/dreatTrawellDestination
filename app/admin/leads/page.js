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
import { Loader2, ShieldAlert } from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import AdminLeadCard from "@/components/admin/AdminLeadCard";
import AdminLeadTable from "@/components/admin/AdminLeadTable";
import AdminLeadFilters from "@/components/admin/AdminLeadFilters";
import AdminLeadCardSkeleton from "@/components/admin/AdminLeadCardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

import { exportLeadsCsv } from "@/lib/exportLeadsCsv";

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

const isSameDay = (a, b) => {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

/* =========================
   LEAD HELPERS
========================= */
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
  return (
    lead.assignedTo ||
    lead.assignedToName ||
    lead.assignedUserName ||
    ""
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
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
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
    status: "all",
    leadHealth: "all",
    search: ""
  });

  const [sort, setSort] = useState({
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
     REALTIME LOAD
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
      // Soft delete for CRM safety
      await updateDoc(doc(db, "leads", leadId), {
        deleted: true,
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
    return leads.filter(lead => {
      if (lead.deleted === true) {
        return false;
      }

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

      if (
        filters.assignedTo !== "all" &&
        lead.assignedToUid !== filters.assignedTo
      ) {
        return false;
      }

      if (
        filters.status !== "all" &&
        getLeadStatus(lead) !== filters.status
      ) {
        return false;
      }

      if (
        filters.leadHealth !== "all" &&
        getLeadHealth(lead) !== filters.leadHealth
      ) {
        return false;
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
  }, [leads, filters]);

  /* =========================
     SORTED LEADS
  ========================== */
  const sortedLeads = useMemo(() => {
    const getSortValue = lead => {
      switch (sort.key) {
        case "createdAt":
          return toDate(lead.createdAt)?.getTime() || 0;

        case "nextActionAt":
          return toDate(lead.nextActionAt)?.getTime() || 0;

        case "overdue":
          return getLeadHealth(lead) === "overdue" ? 1 : 0;

        case "leadCode":
          return String(lead.leadCode || "").toLowerCase();

        case "stage":
          return String(lead.stage || "").toLowerCase();

        default:
          return toDate(lead.createdAt)?.getTime() || 0;
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
    <main className="p-6 w-full mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Admin — Leads
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Manage leads, assignments, follow-ups and admin controls
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-500">
            {sortedLeads.length} of {leads.filter(l => !l.deleted).length} leads
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
        sort={sort}
        setSort={setSort}
        totalCount={leads.filter(l => !l.deleted).length}
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
          description="Try adjusting filters"
        />
      )}

      {!loading && view === "card" && sortedLeads.length > 0 && (
        <div className="space-y-3">
          {sortedLeads.map(lead => (
            <AdminLeadCard
              key={lead.id}
              lead={lead}
              isSuperAdmin={isSuperAdmin}
              onStatusChange={handleStatusChange}
              onDelete={setDeleteTarget}
              statusBusy={isBusy(lead.id, "status")}
              deleteBusy={isBusy(lead.id, "delete")}
            />
          ))}
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