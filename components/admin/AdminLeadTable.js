"use client";

import LeadStatusChip from "@/components/leads/LeadStatusChip";
import AssignLeadModal from "@/components/leads/AssignLeadModal";
import { reopenLead } from "@/lib/reopenLead";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function AdminLeadTable({
  leads,
  selected,
  onToggle,
  onRowClick
}) {
  const { user } = useAuth();
  const [assignLeadId, setAssignLeadId] = useState(null);

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr className="border-b border-gray-100">
              <th className="p-3 w-10" />
              <th className="p-3 text-left">Lead</th>
              <th className="p-3">Stage</th>
              <th className="p-3">Assigned</th>
              <th className="p-3">Next Action</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {leads.map(l => {
              const next =
                l.nextActionAt?.toDate?.();
              const isClosed =
                l.stage === "closed_won" ||
                l.stage === "closed_lost";

              return (
                <tr
                  key={l.id}
                  onClick={() => onRowClick(l.id)}
                  className="border-b border-gray-100 hover:bg-gray-50/40 cursor-pointer"
                >
                  <td className="p-3" />

                  <td className="p-3 font-medium">
                    {l.leadCode}
                  </td>

                  <td className="p-3">
                    <LeadStatusChip stage={l.stage} />
                  </td>

                  <td className="p-3 text-xs">
                    {l.assignedTo || "—"}
                  </td>

                  <td className="p-3 text-xs">
                    {next
                      ? next.toLocaleDateString()
                      : "—"}
                  </td>

                  <td
                    className="p-3"
                    onClick={e => e.stopPropagation()}
                  >
                    {user?.role === "admin" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setAssignLeadId(l.id)
                          }
                          className="text-xs border px-2 py-1 rounded-md"
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
                                leadId: l.id,
                                user,
                                reason
                              });
                            }}
                            className="text-xs border border-yellow-300 text-yellow-700 px-2 py-1 rounded-md"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
