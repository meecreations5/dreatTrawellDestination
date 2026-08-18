"use client";

import Card from "@/components/ui/Card";
import LeadStatusChip from "@/components/leads/LeadStatusChip";
import LeadHealthChip from "@/components/leads/LeadHealthChip";
import InitialAvatar from "@/components/ui/InitialAvatar";

export default function LeadLeftPanel(props) {
  console.log("LeadLeftPanel props:", props);

  const {
    lead,
    isClosed,
    leadHealth,
    nextActionStatus,
    nextActionAt,
    setFollowUpOpen,
    setQuoteOpen,
    setAssignOpen
  } = props || {};

  // 🔴 HARD GUARD — THIS PREVENTS CRASH
  if (!lead) {
    return (
      <div className="p-4 bg-red-100 text-sm rounded">
        LeadLeftPanel: lead is undefined
      </div>
    );
  }

  return (
    <div className="space-y-4">

      

      <Card>
        <h2 className="font-semibold">
          {lead.leadCode || "—"}
        </h2>
        <p className="text-sm text-gray-500">
          {lead.destinationName || "No destination"}
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">Status</span>
          <LeadStatusChip stage={lead.stage} />
        </div>

        <div className="flex justify-between">
          <span className="text-xs text-gray-500">Health</span>
          <LeadHealthChip health={leadHealth} />
        </div>
      </Card>

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

      <Card className="space-y-2">
        <button
          onClick={() => setFollowUpOpen?.(true)}
          disabled={isClosed}
          className="w-full bg-blue-600 text-white py-2 rounded-md"
        >
          + Log Follow-Up
        </button>

        <button
          onClick={() => setQuoteOpen?.(true)}
          disabled={isClosed}
          className="w-full bg-purple-600 text-white py-2 rounded-md"
        >
          + Create Quotation
        </button>

        <button
          onClick={() => setAssignOpen?.(true)}
          disabled={isClosed}
          className="w-full bg-orange-600 text-white py-2 rounded-md"
        >
          Assign Team
        </button>
      </Card>

      <Card>
        <p className="text-xs text-gray-500">Assigned To</p>
        <div className="flex gap-3 mt-2">
          <InitialAvatar
            name={lead.assignedToName || lead.assignedTo || "—"}
          />
          <div>
            <p className="text-sm font-medium">
              {lead.assignedToName || "—"}
            </p>
            <p className="text-xs text-gray-500">
              {lead.assignedTo || ""}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
