"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Power,
  RotateCcw,
  Trash2,
  UserPlus
} from "lucide-react";

import LeadStatusChip from "@/components/leads/LeadStatusChip";
import { LeadPotentialBadge } from "@/components/leads/LeadPotentialControl";
import InitialAvatar from "@/components/ui/InitialAvatar";
import TravelChip from "@/components/ui/TravelChip";
import AssignLeadModal from "@/components/leads/AssignLeadModal";
import { reopenLead } from "@/lib/reopenLead";
import { useAuth } from "@/hooks/useAuth";
import { getLeadOwner as getLeadOwnerIdentity } from "@/lib/leadOwnership";
import { formatLeadAge, getLeadAging } from "@/lib/leadAging";
import { formatLeadTravelRange, getLeadTravelCountdown, getLeadTravelStartDate } from "@/lib/leadTravelDates";

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
  lead.assignedToName ||
  lead.assignedTo ||
  lead.assignedUserName ||
  lead.assignedToEmail ||
  "Unassigned";

const getOwnerName = lead =>
  getLeadOwnerIdentity(lead)?.name ||
  getLeadOwnerIdentity(lead)?.email ||
  "Legacy creator";

const getLeadHealth = lead => {
  const status = getLeadStatus(lead);
  if (status === "inactive") {
    return {
      label: "Inactive",
      icon: Power,
      className: "bg-slate-100 text-slate-600 border-slate-200"
    };
  }

  const nextActionAt = getLeadAging(lead).nextActionAt;

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
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        active
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminLeadCard({
  lead,
  isSuperAdmin = false,
  onStatusChange,
  onDelete,
  statusBusy = false,
  deleteBusy = false
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [assignOpen, setAssignOpen] = useState(false);
  const [reopening, setReopening] = useState(false);

  if (!lead) return null;

  const status = getLeadStatus(lead);
  const health = getLeadHealth(lead);
  const aging = getLeadAging(lead);
  const HealthIcon = health.icon;

  const nextActionAt = aging.nextActionAt;
  const isInactive = status === "inactive";

  const isClosed = aging.terminal;
  const travelStart = getLeadTravelStartDate(lead);
  const travelLabel = formatLeadTravelRange(lead, { short: true });
  const travelCountdown = getLeadTravelCountdown(lead);

  const showAdminActions = canManageLead(user);

  const handleReopen = async e => {
    e.stopPropagation();

    const reason = prompt("Reason for reopening lead");
    if (!reason?.trim()) return;

    setReopening(true);

    try {
      await reopenLead({
        leadId: lead.id,
        user,
        reason
      });
    } finally {
      setReopening(false);
    }
  };

  return (
    <>
      <div
        onClick={() => router.push(`/admin/leads/${lead.id}`)}
        className={`
          group relative overflow-hidden rounded-2xl border bg-white p-4
          shadow-sm transition-all duration-200
          hover:-translate-y-[1px] hover:border-blue-100 hover:shadow-md
          ${isInactive ? "border-slate-100 opacity-75" : "border-gray-100"}
        `}
      >
        <div
          className={`absolute left-0 top-0 h-full w-1 ${
            isInactive
              ? "bg-slate-300"
              : health.label === "Overdue"
              ? "bg-red-400"
              : health.label === "Due today"
              ? "bg-amber-400"
              : "bg-emerald-400"
          }`}
        />

        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 pl-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">
                {lead.leadCode || "No lead code"}
              </p>
              <ActiveStatusBadge status={status} />
            </div>

            <p className="mt-1 truncate text-xs text-gray-500">
              {getCustomerName(lead)}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-1.5">
            <LeadPotentialBadge lead={lead} />
            <LeadStatusChip stage={lead.stage} />
          </div>
        </div>

        {/* META CHIPS */}
        <div className="mt-3 flex flex-wrap gap-1.5 pl-1">
          {lead.destinationName && (
            <TravelChip
              label={lead.destinationName}
              icon="destination"
              color="primary"
            />
          )}

          {lead.agentName && (
            <TravelChip
              label={lead.agentName}
              icon="agent"
              color="neutral"
            />
          )}

          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${health.className}`}
          >
            <HealthIcon className="h-3 w-3" />
            {health.label}
          </span>
          {travelStart ? (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${travelCountdown.key === "past" ? "border-red-100 bg-red-50 text-red-700" : travelCountdown.days != null && travelCountdown.days <= 7 ? "border-amber-100 bg-amber-50 text-amber-700" : "border-blue-100 bg-blue-50 text-blue-700"}`}>
              <CalendarClock className="h-3 w-3" />
              Travel {travelLabel} · {travelCountdown.label}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">Travel date missing</span>
          )}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            Lead age {formatLeadAge(aging.ageDays)}
          </span>
          {aging.stageAgeDays != null ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
              Stage {formatLeadAge(aging.stageAgeDays)}
            </span>
          ) : null}
        </div>

        {/* FOOTER */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <InitialAvatar name={getOwnerName(lead)} />
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400">Lead owner</p>
              <p className="truncate font-medium text-gray-700">
                {getOwnerName(lead)}
              </p>
              <p className="text-[10px] text-gray-400">Creator credit</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-600">
            <InitialAvatar name={getAssignedName(lead)} />
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400">Current assignee</p>
              <p className="truncate font-medium text-gray-700">
                {getAssignedName(lead)}
              </p>
              <p className="text-[10px] text-gray-400">Working responsibility</p>
            </div>
          </div>

          <div className="text-xs sm:text-right">
            <p className="text-[11px] text-gray-400">Next action</p>
            <p
              className={`font-medium ${
                health.label === "Overdue"
                  ? "text-red-600"
                  : health.label === "Due today"
                  ? "text-amber-700"
                  : "text-gray-700"
              }`}
            >
              {nextActionAt ? formatDate(nextActionAt) : "No next action"}
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        {(showAdminActions || isSuperAdmin) && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-wrap gap-2">
              {showAdminActions && (
                <button
                  type="button"
                  onClick={() => setAssignOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Assign
                </button>
              )}

              {showAdminActions && isClosed && (
                <button
                  type="button"
                  disabled={reopening}
                  onClick={handleReopen}
                  className="inline-flex items-center gap-1 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-60"
                >
                  {reopening ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Reopen
                </button>
              )}
            </div>

            {isSuperAdmin && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={statusBusy || !onStatusChange}
                  onClick={() => onStatusChange?.(lead)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
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
                  className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {assignOpen && (
        <AssignLeadModal
          leadId={lead.id}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </>
  );
}