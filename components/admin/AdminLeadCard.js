"use client";

import { useRouter } from "next/navigation";
import LeadStatusChip from "@/components/leads/LeadStatusChip";
import InitialAvatar from "@/components/ui/InitialAvatar";
import TravelChip from "@/components/ui/TravelChip";
import AssignLeadModal from "@/components/leads/AssignLeadModal";
import { reopenLead } from "@/lib/reopenLead";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function AdminLeadCard({ lead }) {
  const router = useRouter();
  const { user } = useAuth();

  const [assignOpen, setAssignOpen] = useState(false);

  if (!lead) return null;

  const nextActionAt =
    lead.nextActionAt?.toDate?.() || null;

  const isOverdue =
    nextActionAt && nextActionAt < new Date();

  const isClosed =
    lead.stage === "closed_won" ||
    lead.stage === "closed_lost";

  return (
    <>
      <div
        onClick={() =>
          router.push(`/admin/leads/${lead.id}`)
        }
        className="
          bg-white rounded-xl
          border border-gray-100
          p-4 space-y-3
          cursor-pointer
          hover:bg-gray-50/40
        "
      >
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {lead.leadCode}
            </p>
            <p className="text-xs text-gray-500">
              {lead.destinationName || "No destination"}
            </p>
          </div>

          <LeadStatusChip stage={lead.stage} />
        </div>

        {/* META */}
        <div className="flex flex-wrap gap-1.5">
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
        </div>

        {/* FOOTER */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2 text-gray-600">
            <InitialAvatar
              name={lead.assignedTo || "User"}
            />
            <span>{lead.assignedTo || "Unassigned"}</span>
          </div>

          <div
            className={`font-medium ${
              isOverdue ? "text-red-600" : "text-gray-500"
            }`}
          >
            {nextActionAt
              ? `Next: ${nextActionAt.toLocaleDateString()}`
              : "No next action"}
          </div>
        </div>

        {/* ACTIONS */}
        {user?.role === "admin" && (
          <div
            className="flex gap-2 pt-2"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setAssignOpen(true)}
              className="text-xs border px-3 py-1 rounded-md hover:bg-gray-50"
            >
              Assign
            </button>

            {isClosed && (
              <button
                onClick={async () => {
                  const reason = prompt(
                    "Reason for reopening lead"
                  );
                  if (!reason?.trim()) return;

                  await reopenLead({
                    leadId: lead.id,
                    user,
                    reason
                  });
                }}
                className="text-xs border border-yellow-300 text-yellow-700 px-3 py-1 rounded-md hover:bg-yellow-50"
              >
                Reopen
              </button>
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
