"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Power,
  RotateCcw,
  Trash2,
  UserPlus
} from "lucide-react";

import LeadStatusChip from "@/components/leads/LeadStatusChip";
import AssignLeadModal from "@/components/leads/AssignLeadModal";
import { reopenLead } from "@/lib/reopenLead";
import { useAuth } from "@/hooks/useAuth";

const normalizeRole = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const canManageLead = user => {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "super_admin" || user?.isAdmin === true;
};

const toDate = value => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const formatDate = value => {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
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

const getCustomerName = lead =>
  lead.customerName ||
  lead.clientName ||
  lead.guestName ||
  lead.travellerName ||
  lead.name ||
  "Unnamed customer";

const getAssignedName = lead =>
  lead.assignedTo ||
  lead.assignedToName ||
  lead.assignedUserName ||
  "Unassigned";

const getLeadHealth = lead => {
  const status = getLeadStatus(lead);
  if (status === "inactive") {
    return {
      label: "Inactive",
      icon: Power,
      className: "bg-slate-100 text-slate-600 border-slate-200"
    };
  }

  const nextActionAt = toDate(lead.nextActionAt);

  if (!nextActionAt) {
    return {
      label: "No follow-up",
      icon: CalendarClock,
      className: "bg-gray-50 text-gray-600 border-gray-200"
    };
  }

  const now = new Date();
  const sameDay =
    nextActionAt.toDateString() === now.toDateString();

  if (nextActionAt < now && !sameDay) {
    return {
      label: "Overdue",
      icon: AlertTriangle,
      className: "bg-red-50 text-red-700 border-red-100"
    };
  }

  if (sameDay) {
    return {
      label: "Due today",
      icon: CalendarClock,
      className: "bg-amber-50 text-amber-700 border-amber-100"
    };
  }

  return {
    label: "Healthy",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-100"
  };
};

function ActiveStatusBadge({ status }) {
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
}

export default function AdminLeadTable({
  leads,
  selected = [],
  onToggle,
  onRowClick,
  isSuperAdmin = false,
  onStatusChange,
  onDelete,
  isStatusBusy = () => false,
  isDeleteBusy = () => false
}) {
  const { user } = useAuth();

  const [assignLeadId, setAssignLeadId] = useState(null);
  const [reopeningId, setReopeningId] = useState(null);

  const showAdminActions = canManageLead(user);

  const handleReopen = async lead => {
    const reason = prompt("Reason for reopening lead");
    if (!reason?.trim()) return;

    setReopeningId(lead.id);

    try {
      await reopenLead({
        leadId: lead.id,
        user,
        reason
      });
    } finally {
      setReopeningId(null);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-sm">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr className="border-b border-gray-100">
                <th className="w-10 p-3 text-center" />
                <th className="p-3 text-left">Lead</th>
                <th className="p-3 text-left">Customer / Travel</th>
                <th className="p-3 text-left">Stage</th>
                <th className="p-3 text-left">Assigned</th>
                <th className="p-3 text-left">Next Action</th>
                <th className="p-3 text-left">Health</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {leads.map(lead => {
                const next = toDate(lead.nextActionAt);
                const status = getLeadStatus(lead);
                const health = getLeadHealth(lead);
                const HealthIcon = health.icon;

                const isClosed =
                  lead.stage === "closed_won" ||
                  lead.stage === "closed_lost";

                const checked = selected.includes(lead.id);
                const inactive = status === "inactive";
                const statusBusy = isStatusBusy(lead.id);
                const deleteBusy = isDeleteBusy(lead.id);

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onRowClick?.(lead.id)}
                    className={`
                      cursor-pointer border-b border-gray-100 transition
                      hover:bg-blue-50/30
                      ${inactive ? "opacity-75" : ""}
                    `}
                  >
                    <td
                      className="p-3 text-center"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle?.(lead.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </td>

                    <td className="p-3">
                      <p className="font-semibold text-gray-900">
                        {lead.leadCode || "No lead code"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        Created {formatDate(lead.createdAt)}
                      </p>
                    </td>

                    <td className="p-3">
                      <p className="font-medium text-gray-800">
                        {getCustomerName(lead)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {lead.destinationName || "No destination"}
                        {lead.agentName ? ` • ${lead.agentName}` : ""}
                      </p>
                    </td>

                    <td className="p-3">
                      <LeadStatusChip stage={lead.stage} />
                    </td>

                    <td className="p-3 text-xs text-gray-700">
                      {getAssignedName(lead)}
                    </td>

                    <td className="p-3 text-xs">
                      <span
                        className={
                          health.label === "Overdue"
                            ? "font-semibold text-red-600"
                            : health.label === "Due today"
                            ? "font-semibold text-amber-700"
                            : "text-gray-600"
                        }
                      >
                        {next ? formatDate(next) : "—"}
                      </span>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${health.className}`}
                      >
                        <HealthIcon className="h-3 w-3" />
                        {health.label}
                      </span>
                    </td>

                    <td className="p-3">
                      <ActiveStatusBadge status={status} />
                    </td>

                    <td
                      className="p-3 text-right"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onRowClick?.(lead.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>

                        {showAdminActions && (
                          <button
                            type="button"
                            onClick={() => setAssignLeadId(lead.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Assign
                          </button>
                        )}

                        {showAdminActions && isClosed && (
                          <button
                            type="button"
                            disabled={reopeningId === lead.id}
                            onClick={() => handleReopen(lead)}
                            className="inline-flex items-center gap-1 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-60"
                          >
                            {reopeningId === lead.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Reopen
                          </button>
                        )}

                        {isSuperAdmin && (
                          <>
                            <button
                              type="button"
                              disabled={statusBusy || !onStatusChange}
                              onClick={() => onStatusChange?.(lead)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                                status === "active"
                                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {statusBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                              {status === "active" ? "Disable" : "Enable"}
                            </button>

                            <button
                              type="button"
                              disabled={deleteBusy || !onDelete}
                              onClick={() => onDelete?.(lead)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deleteBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {assignLeadId && (
        <AssignLeadModal
          leadId={assignLeadId}
          onClose={() => setAssignLeadId(null)}
        />
      )}
    </>
  );
}