"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import Card from "@/components/ui/Card";
import CardSkeleton from "@/components/ui/CardSkeleton";

import LeadTimeline from "@/components/leads/LeadTimeline";
import AddFollowUpModal from "@/components/leads/AddFollowUpModal";
import QuotationEditor from "@/components/leads/QuotationEditor";
import AssignLeadModal from "@/components/leads/AssignLeadModal";
import ActivityViewerModal from "@/components/leads/ActivityViewerModal";

import LeadStatusChip from "@/components/leads/LeadStatusChip";
import LeadHealthChip from "@/components/leads/LeadHealthChip";

import { updateLeadStage } from "@/lib/updateLeadStage";
import { reopenLead } from "@/lib/reopenLead";
import { getLeadHealth } from "@/lib/getLeadHealth";
import { getNextActionStatus } from "@/lib/getNextActionStatus";
import InitialAvatar from "@/components/ui/InitialAvatar";

/* =========================
   PAGE
========================= */
export default function LeadDetailPage() {
  const { leadId } = useParams();
  const { user } = useAuth();

  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState("all");

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  /* =========================
     REALTIME LEAD SUBSCRIPTION
  ========================== */
  useEffect(() => {
    if (!leadId) return;

    setLoading(true);

    const unsub = onSnapshot(
      doc(db, "leads", leadId),
      snap => {
        if (snap.exists()) {
          setLead({ id: snap.id, ...snap.data() });
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  /* =========================
     DERIVED STATE
  ========================== */
  const isClosed =
    lead?.stage === "closed_won" ||
    lead?.stage === "closed_lost";

  const leadHealth = useMemo(
    () => getLeadHealth(lead),
    [lead]
  );

  const nextActionStatus = useMemo(
    () => getNextActionStatus(lead),
    [lead]
  );

  const nextActionAt = lead?.nextActionDueAt?.toDate
    ? lead.nextActionDueAt.toDate()
    : null;

  const filteredTimeline = useMemo(() => {
    if (filter === "all") return timeline;
    return timeline.filter(e => e.type === filter);
  }, [filter, timeline]);

  /* =========================
     LOADING
  ========================== */
  if (loading) {
    return (
      <main className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CardSkeleton />
        <div className="lg:col-span-2 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    );
  }

  if (!lead || !user) return null;

  /* =========================
     UI
  ========================== */
  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ================= LEFT PANEL ================= */}
        <div className="lg:sticky lg:top-6 self-start space-y-4">

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

            <select
              disabled={isClosed}
              value={lead.stage}
              onChange={async e => {
                const newStage = e.target.value;
                let remark = "";

                if (["closed_won", "closed_lost"].includes(newStage)) {
                  remark = prompt("Closing remark is required");
                  if (!remark?.trim()) return;
                }

                await updateLeadStage({
                  leadId: lead.id,
                  newStage,
                  remark,
                  user
                });
              }}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="new">New</option>
              <option value="follow_up">Follow Up</option>
              <option value="quoted">Quoted</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>
          </Card>

          {/* NEXT ACTION (REALTIME) */}
          <div
            className={`rounded-xl p-4 border ${nextActionStatus === "overdue"
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

                {nextActionStatus === "overdue" && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠ Overdue
                  </p>
                )}
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
              onClick={() => setFollowUpOpen(true)}
              className="w-full bg-blue-600 text-white py-2 rounded-md"
            >
              + Log Follow-Up
            </button>

            <button
              disabled={isClosed}
              onClick={() => setQuoteOpen(true)}
              className="w-full bg-purple-600 text-white py-2 rounded-md"
            >
              + Create Quotation
            </button>

            <button
              disabled={isClosed}
              onClick={() => setAssignOpen(true)}
              className="w-full bg-orange-600 text-white py-2 rounded-md"
            >
              Assign Team
            </button>
          </Card>

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

          {/* ADMIN REOPEN */}
          {isClosed && user.role === "admin" && (
            <Card className="bg-yellow-50 border border-yellow-200">
              <button
                onClick={async () => {
                  const reason = prompt("Reason for reopening");
                  if (!reason?.trim()) return;

                  await reopenLead({
                    leadId: lead.id,
                    reason,
                    user
                  });
                }}
                className="w-full bg-yellow-600 text-white py-2 rounded-md"
              >
                🔁 Reopen Lead
              </button>
            </Card>
          )}
        </div>

        {/* ================= RIGHT PANEL ================= */}
        <div className="lg:col-span-2 space-y-4">
          <LeadTimeline
            leadId={lead.id}
            onLoad={setTimeline}
            onSelect={setSelectedActivity}
            eventsOverride={filteredTimeline}
          />
        </div>
      </div>

      {/* MODALS */}
      {followUpOpen && (
        <AddFollowUpModal
          leadId={lead.id}
          onClose={() => setFollowUpOpen(false)}
        />
      )}

      {quoteOpen && (
        <QuotationEditor
          lead={lead}
          onClose={() => setQuoteOpen(false)}
        />
      )}

      {assignOpen && (
        <AssignLeadModal
          leadId={lead.id}
          onClose={() => setAssignOpen(false)}
        />
      )}

      <ActivityViewerModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </main>
  );
}
