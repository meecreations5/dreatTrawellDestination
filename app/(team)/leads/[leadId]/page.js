"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import Card from "@/components/ui/Card";
import CardSkeleton from "@/components/ui/CardSkeleton";
import InitialAvatar from "@/components/ui/InitialAvatar";

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

/* =========================
   HELPERS
========================= */
function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">
        {value || "—"}
      </span>
    </div>
  );
}

const timelineFilters = [
  { value: "all", label: "All" },
  { value: "follow_up", label: "Follow-ups" },
  { value: "quotation", label: "Quotations" },
  { value: "stage", label: "Stage" },
  { value: "assignment", label: "Assignment" },
  { value: "note", label: "Notes" }
];

/* =========================
   PAGE
========================= */
export default function LeadDetailPage() {
  const params = useParams();
  const leadId = Array.isArray(params?.leadId)
    ? params.leadId[0]
    : params?.leadId;

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
          setLead({
            id: snap.id,
            ...snap.data()
          });
        } else {
          setLead(null);
        }

        setLoading(false);
      },
      error => {
        console.error("Lead detail subscription failed:", error);
        setLead(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  /* =========================
     DERIVED STATE
  ========================== */
  const stage = lead?.stage || "new";

  const isClosed =
    stage === "closed_won" || stage === "closed_lost";

  const canReopen =
    isClosed &&
    ["admin", "super_admin"].includes(user?.role);

  const leadHealth = useMemo(() => getLeadHealth(lead), [lead]);

  const nextActionStatus = useMemo(
    () => getNextActionStatus(lead),
    [lead]
  );

  const nextActionAt = toDate(lead?.nextActionDueAt);

  const filteredTimeline = useMemo(() => {
    if (filter === "all") return timeline;
    return timeline.filter(event => event?.type === filter);
  }, [filter, timeline]);

  const customerName = getFirstValue(
    lead?.customerName,
    lead?.travellerName,
    lead?.guestName,
    lead?.contactName,
    lead?.customer?.name,
    lead?.spoc?.name
  );

  const customerMobile = getFirstValue(
    lead?.mobile,
    lead?.phone,
    lead?.contactNumber,
    lead?.customerMobile,
    lead?.customer?.mobile,
    lead?.spoc?.mobile
  );

  const customerEmail = getFirstValue(
    lead?.email,
    lead?.customerEmail,
    lead?.customer?.email,
    lead?.spoc?.email
  );

  const travelAgentName = getFirstValue(
    lead?.travelAgentName,
    lead?.agentName,
    lead?.agencyName,
    lead?.travelAgent?.agencyName
  );

  const assignedName = getFirstValue(
    lead?.assignedToName,
    lead?.teamLeadName,
    lead?.ownerName,
    lead?.assignedUserName
  );

  const assignedUid = getFirstValue(
    lead?.assignedTo,
    lead?.teamLeadUid,
    lead?.ownerUid,
    lead?.assignedToUid
  );

  const source = getFirstValue(
    lead?.source,
    lead?.leadSource,
    lead?.channel
  );

  const destinationName = getFirstValue(
    lead?.destinationName,
    lead?.destination,
    lead?.destinationTitle
  );

  const actionButtonClass =
    "w-full py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

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
          <CardSkeleton />
        </div>
      </main>
    );
  }

  if (!lead || !user) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <Card className="text-center py-10">
          <h2 className="text-lg font-semibold text-gray-800">
            Lead not found
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            This lead may have been deleted or you may not have access.
          </p>
        </Card>
      </main>
    );
  }

  /* =========================
     UI
  ========================== */
  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ================= LEFT PANEL ================= */}
        <div className="lg:sticky lg:top-6 self-start space-y-4">

          {/* LEAD HEADER */}
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {lead.leadCode || "Lead Details"}
                </h2>

                <p className="text-sm text-gray-500">
                  {destinationName || "No destination"}
                </p>
              </div>

              <LeadStatusChip stage={stage} />
            </div>

            <div className="flex items-center gap-2">
              <LeadHealthChip health={leadHealth} />

              {source && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {source}
                </span>
              )}
            </div>
          </Card>

          {/* STATUS + HEALTH */}
          <Card className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Status</span>
              <LeadStatusChip stage={stage} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Health</span>
              <LeadHealthChip health={leadHealth} />
            </div>

            <select
              disabled={isClosed}
              value={stage}
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
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="new">New</option>
              <option value="follow_up">Follow Up</option>
              <option value="quoted">Quoted</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>

            {isClosed && (
              <p className="text-xs text-gray-500">
                This lead is closed. Reopen it to make changes.
              </p>
            )}
          </Card>

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

            {nextActionAt ? (
              <>
                <p className="text-sm font-medium text-gray-900">
                  {lead.nextActionType || "Follow-up"}
                </p>

                <p className="text-xs text-gray-600">
                  {formatDateTime(nextActionAt)}
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

          {/* CUSTOMER / CONTACT */}
          <Card className="space-y-2">
            <p className="text-xs text-gray-500">Customer Contact</p>

            <div>
              <p className="text-sm font-medium text-gray-900">
                {customerName || "—"}
              </p>

              {customerEmail && (
                <p className="text-xs text-gray-600 mt-1">
                  📧 {customerEmail}
                </p>
              )}

              {customerMobile && (
                <p className="text-xs text-gray-600 mt-1">
                  📱 {customerMobile}
                </p>
              )}
            </div>
          </Card>

          {/* TRAVEL AGENT / SPOC */}
          <Card className="space-y-2">
            <p className="text-xs text-gray-500">Travel Agent / SPOC</p>

            <div>
              <p className="text-sm font-medium text-gray-900">
                {travelAgentName || lead.spoc?.name || "—"}
              </p>

              {lead.spoc?.name && travelAgentName && (
                <p className="text-xs text-gray-600 mt-1">
                  SPOC: {lead.spoc.name}
                </p>
              )}

              {lead.spoc?.email && (
                <p className="text-xs text-gray-600 mt-1">
                  📧 {lead.spoc.email}
                </p>
              )}

              {lead.spoc?.mobile && (
                <p className="text-xs text-gray-600 mt-1">
                  📱 {lead.spoc.mobile}
                </p>
              )}
            </div>
          </Card>

          {/* ACTIONS */}
          <Card className="space-y-2">
            <button
              disabled={isClosed}
              onClick={() => setFollowUpOpen(true)}
              className={`${actionButtonClass} bg-blue-600 text-white hover:bg-blue-700`}
            >
              + Log Follow-Up
            </button>

            <button
              disabled={isClosed}
              onClick={() => setQuoteOpen(true)}
              className={`${actionButtonClass} bg-purple-600 text-white hover:bg-purple-700`}
            >
              + Create Quotation
            </button>

            <button
              disabled={isClosed}
              onClick={() => setAssignOpen(true)}
              className={`${actionButtonClass} bg-orange-600 text-white hover:bg-orange-700`}
            >
              Assign / Change Team
            </button>
          </Card>

          {/* ASSIGNED TO */}
          <Card className="space-y-2">
            <p className="text-xs text-gray-500">Assigned To</p>

            <div className="flex items-center gap-3">
              <InitialAvatar name={assignedName || assignedUid || "User"} />

              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {assignedName || "—"}
                </p>

                {assignedUid && (
                  <p className="text-xs text-gray-500 truncate">
                    {assignedUid}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* ADMIN REOPEN */}
          {canReopen && (
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
                className="w-full bg-yellow-600 text-white py-2 rounded-md text-sm font-medium hover:bg-yellow-700"
              >
                🔁 Reopen Lead
              </button>
            </Card>
          )}
        </div>

        {/* ================= RIGHT PANEL ================= */}
        {/* ================= RIGHT PANEL ================= */}
        <div className="lg:col-span-2 space-y-4">

          {/* TIMELINE FILTERS */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Lead Timeline
                </h3>
                <p className="text-xs text-gray-500">
                  Follow-ups, quotations, stage changes and assignments
                </p>
              </div>

              <span className="text-xs text-gray-500">
                {filteredTimeline.length} record
                {filteredTimeline.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {timelineFilters.map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${filter === item.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Card>

          <LeadTimeline
            leadId={lead.id}
            onLoad={setTimeline}
            onSelect={setSelectedActivity}
            eventsOverride={
              timeline.length ? filteredTimeline : undefined
            }
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