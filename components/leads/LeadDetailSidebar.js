"use client";

import Card from "@/components/ui/Card";
import LeadStatusChip from "@/components/leads/LeadStatusChip";
import LeadHealthChip from "@/components/leads/LeadHealthChip";
import InitialAvatar from "@/components/ui/InitialAvatar";

export default function LeadDetailSidebar({
  lead,
  user,
  isClosed,
  leadHealth,
  nextActionStatus,
  nextActionAt,
  onFollowUp,
  onQuote,
  onAssign,
  onReopen
}) {
  return (
    <div className="space-y-4">
      {/* LEAD HEADER */}
      <Card>
        <h2 className="font-semibold">{lead.leadCode}</h2>
        <p className="text-sm text-gray-500">
          {lead.destinationName || "No destination"}
        </p>
      </Card>

      {/* STATUS + HEALTH */}
      <Card className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Status</span>
          <LeadStatusChip stage={lead.stage} />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Health</span>
          <LeadHealthChip health={leadHealth} />
        </div>
      </Card>

      {/* NEXT ACTION */}
      <div
        className={`rounded-xl p-4 border ${
          nextActionStatus === "overdue"
            ? "bg-red-50 border-red-200"
            : "bg-blue-50 border-blue-200"
        }`}
      >
        <p className="text-xs text-gray-500 mb-1">
          Next Action
        </p>

        {nextActionAt ? (
          <>
            <p className="text-sm font-medium">
              {lead.nextActionType || "Follow-up"}
            </p>
            <p className="text-xs text-gray-600">
              {nextActionAt.toLocaleString()}
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-400">
            No next action scheduled
          </p>
        )}
      </div>

      {/* SPOC */}
      <Card className="space-y-1">
        <p className="text-xs text-gray-500">SPOC</p>
        <p className="text-sm font-medium">
          {lead.spoc?.name || "—"}
        </p>
        {lead.spoc?.email && (
          <p className="text-xs">📧 {lead.spoc.email}</p>
        )}
        {lead.spoc?.mobile && (
          <p className="text-xs">📱 {lead.spoc.mobile}</p>
        )}
      </Card>

      {/* ACTIONS */}
      <Card className="space-y-2">
        <button
          disabled={isClosed}
          onClick={onFollowUp}
          className="w-full bg-blue-600 text-white py-2 rounded-md"
        >
          + Log Follow-Up
        </button>

        <button
          disabled={isClosed}
          onClick={onQuote}
          className="w-full bg-purple-600 text-white py-2 rounded-md"
        >
          + Create Quotation
        </button>

        <button
          disabled={isClosed}
          onClick={onAssign}
          className="w-full bg-orange-600 text-white py-2 rounded-md"
        >
          Assign Team
        </button>
      </Card>

      {/* ADMIN REOPEN */}
      {isClosed && user.role === "admin" && (
        <Card className="bg-yellow-50 border border-yellow-200">
          <button
            onClick={onReopen}
            className="w-full bg-yellow-600 text-white py-2 rounded-md"
          >
            🔁 Reopen Lead
          </button>
        </Card>
      )}

      {/* ASSIGNED TO */}
      <Card className="space-y-2">
        <p className="text-xs text-gray-500">Assigned To</p>

        <div className="flex items-center gap-3">
          <InitialAvatar
            name={lead.assignedToName || lead.assignedTo}
          />
          <div>
            <p className="text-sm font-medium">
              {lead.assignedToName || "—"}
            </p>
            {lead.assignedTo && (
              <p className="text-xs text-gray-500">
                {lead.assignedTo}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
