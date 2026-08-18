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
import BottomSheetModal from "@/components/ui/BottomSheetModal";
import LeadDetailSidebar from "@/components/leads/LeadDetailSidebar";

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

  const [detailsOpen, setDetailsOpen] = useState(false);

  const isMobile =
    typeof window !== "undefined" &&
    window.innerWidth < 1024;

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
        {/* ================= LEFT PANEL ================= */}
        {!isMobile && (
          <div className="lg:sticky lg:top-6 self-start space-y-4">
            <LeadDetailSidebar
              lead={lead}
              user={user}
              isClosed={isClosed}
              leadHealth={leadHealth}
              nextActionStatus={nextActionStatus}
              nextActionAt={nextActionAt}
              onFollowUp={() => setFollowUpOpen(true)}
              onQuote={() => setQuoteOpen(true)}
              onAssign={() => setAssignOpen(true)}
              onReopen={async () => {
                const reason = prompt("Reason for reopening");
                if (!reason?.trim()) return;
                await reopenLead({ leadId: lead.id, reason, user });
              }}
            />
          </div>
        )}


        {isMobile && (
          <>
            <button
              onClick={() => setDetailsOpen(true)}
              className="w-full bg-gray-100 py-2 rounded-md text-sm"
            >
              View Lead Details
            </button>

            <BottomSheetModal
              open={detailsOpen}
              onClose={() => setDetailsOpen(false)}
              title="Lead Details"
            >
              <LeadDetailSidebar
                lead={lead}
                user={user}
                isClosed={isClosed}
                leadHealth={leadHealth}
                nextActionStatus={nextActionStatus}
                nextActionAt={nextActionAt}
                onFollowUp={() => {
                  setDetailsOpen(false);
                  setFollowUpOpen(true);
                }}
                onQuote={() => {
                  setDetailsOpen(false);
                  setQuoteOpen(true);
                }}
                onAssign={() => {
                  setDetailsOpen(false);
                  setAssignOpen(true);
                }}
                onReopen={async () => {
                  setDetailsOpen(false);
                  const reason = prompt("Reason for reopening");
                  if (!reason?.trim()) return;
                  await reopenLead({ leadId: lead.id, reason, user });
                }}
              />
            </BottomSheetModal>
          </>
        )}


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
