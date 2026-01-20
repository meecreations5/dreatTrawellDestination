"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

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

/* =========================
   HELPERS
========================= */

function computeNextActionStatus(lead) {
  if (!lead?.nextActionDueAt) return "none";

  const due =
    lead.nextActionDueAt.toDate?.() ||
    new Date(lead.nextActionDueAt.seconds * 1000);

  if (due < new Date()) return "overdue";
  if (due.toDateString() === new Date().toDateString())
    return "today";

  return "upcoming";
}

/* =========================
   PAGE
========================= */

export default function AdminLeadDetailPage() {
  const { leadId } = useParams();
  const { user } = useAuth();

  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  /* =========================
     LOAD LEAD
  ========================== */
  useEffect(() => {
    if (!leadId) return;

    getDoc(doc(db, "leads", leadId)).then(snap => {
      if (snap.exists()) {
        setLead({ id: snap.id, ...snap.data() });
      }
    });
  }, [leadId]);

  if (!lead || !user) return null;

  const isClosed =
    lead.stage === "closed_won" ||
    lead.stage === "closed_lost";

  const nextActionStatus = computeNextActionStatus(lead);
  const health = getLeadHealth(lead);

  /* =========================
     UI
  ========================== */

  return (
    <main className="p-6 w-full mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">



        {/* ================= RIGHT PANEL ================= */}
        <section className="lg:col-span-2 space-y-4">
          <LeadTimeline
            leadId={lead.id}
            onLoad={setTimeline}
            onSelect={setSelectedActivity}
          />
        </section>
        {/* ================= LEFT PANEL ================= */}
        <aside className="lg:sticky lg:top-30 space-y-4 self-start">

          {/* LEAD HEADER */}
          <div className="bg-white rounded-xl p-4 space-y-1">
            <p className="text-xs text-gray-500">Lead</p>
            <h2 className="text-md font-semibold">
              {lead.leadCode}
            </h2>
            <p className="text-sm text-gray-500">
              {lead.destinationName || "—"}
            </p>

            <div className="flex gap-2 mt-2">
              <LeadStatusChip stage={lead.stage} />
              <LeadHealthChip lead={lead} />
            </div>
          </div>

          {/* NEXT ACTION */}
          <div
            className={`rounded-xl p-4 border ${nextActionStatus === "overdue"
                ? "bg-red-50 border-red-200"
                : "bg-blue-50 border-blue-200"
              }`}
          >
            <p className="text-xs text-gray-500 mb-1">
              Next Action
            </p>

            {lead.nextActionDueAt ? (
              <>
                <p className="text-sm font-medium">
                  {lead.nextActionType || "Follow-up"}
                </p>
                <p className="text-xs text-gray-600">
                  {lead.nextActionDueAt
                    .toDate()
                    .toLocaleString()}
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
          <div className="bg-white rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500">SPOC</p>
            <p className="text-sm font-medium">
              {lead.spoc?.name || "—"}
            </p>
            {lead.spoc?.email && (
              <p className="text-xs text-gray-600">
                📧 {lead.spoc.email}
              </p>
            )}
            {lead.spoc?.mobile && (
              <p className="text-xs text-gray-600">
                📱 {lead.spoc.mobile}
              </p>
            )}
          </div>

          {/* ACTIONS */}
          <div className="bg-white rounded-xl p-4 space-y-2">
            <button
              onClick={() => setFollowUpOpen(true)}
              className="w-full py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              + Log Follow-Up
            </button>

            <button
              onClick={() => setQuoteOpen(true)}
              className="w-full py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700"
            >
              + Create Quotation
            </button>

            <button
              onClick={() => setAssignOpen(true)}
              className="w-full py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700"
            >
              Assign Team
            </button>
          </div>

          {/* ADMIN REOPEN */}
          {isClosed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <button
                onClick={async () => {
                  const reason = prompt(
                    "Reason for reopening lead"
                  );
                  if (!reason?.trim()) return;

                  await reopenLead({
                    leadId: lead.id,
                    reason,
                    user
                  });

                  setLead(l => ({
                    ...l,
                    stage: "follow_up",
                    status: "open"
                  }));
                }}
                className="w-full py-2 rounded-md bg-yellow-600 text-white hover:bg-yellow-700"
              >
                🔁 Reopen Lead
              </button>
            </div>
          )}
        </aside>

      </div>

      {/* ================= MODALS ================= */}
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
