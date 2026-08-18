"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import LeadTimeline from "@/components/leads/LeadTimeline";
import AddFollowUpModal from "@/components/leads/AddFollowUpModal";
import QuotationEditor from "@/components/leads/QuotationEditor";
import AssignLeadModal from "@/components/leads/AssignLeadModal";
import ActivityViewerModal from "@/components/leads/ActivityViewerModal";

import LeadStatusChip from "@/components/leads/LeadStatusChip";
import LeadHealthChip from "@/components/leads/LeadHealthChip";
import InitialAvatar from "@/components/ui/InitialAvatar";

import { reopenLead } from "@/lib/reopenLead";
import { updateLeadStage } from "@/lib/updateLeadStage";
import { getLeadHealth } from "@/lib/getLeadHealth";

/* =========================
   HELPERS
========================= */

function parseFirestoreDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = parseFirestoreDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function computeNextActionStatus(lead) {
  const due = parseFirestoreDate(lead?.nextActionDueAt);

  if (!due) return "none";

  const today = new Date();

  if (due < today) return "overdue";

  if (due.toDateString() === today.toDateString()) {
    return "today";
  }

  return "upcoming";
}

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function isEmail(value = "") {
  return String(value).includes("@");
}

function titleFromEmail(email = "") {
  const prefix = String(email).split("@")[0] || "";

  return prefix
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

function getUserName(user) {
  return getFirstValue(
    user?.displayName,
    user?.name,
    user?.fullName,
    user?.employeeName,
    user?.profile?.name
  );
}

function getUserEmail(user) {
  return getFirstValue(
    user?.email,
    user?.workEmail,
    user?.officialEmail,
    user?.profile?.email
  );
}

function getUserRole(user) {
  return getFirstValue(
    user?.designation,
    user?.jobTitle,
    user?.role,
    user?.profile?.designation
  );
}

async function findUserByUidOrEmail(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return null;

  try {
    const directSnap = await getDoc(doc(db, "users", cleanValue));

    if (directSnap.exists()) {
      return {
        id: directSnap.id,
        ...directSnap.data()
      };
    }
  } catch (error) {
    console.warn("Direct assigned user lookup skipped:", error);
  }

  try {
    const uidQuery = query(
      collection(db, "users"),
      where("uid", "==", cleanValue),
      limit(1)
    );

    const uidSnap = await getDocs(uidQuery);

    if (!uidSnap.empty) {
      const userDoc = uidSnap.docs[0];

      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    }
  } catch (error) {
    console.warn("UID assigned user lookup skipped:", error);
  }

  try {
    const emailQuery = query(
      collection(db, "users"),
      where("email", "==", cleanValue),
      limit(1)
    );

    const emailSnap = await getDocs(emailQuery);

    if (!emailSnap.empty) {
      const userDoc = emailSnap.docs[0];

      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    }
  } catch (error) {
    console.warn("Email assigned user lookup skipped:", error);
  }

  return null;
}

const timelineFilters = [
  { value: "all", label: "All" },
  { value: "follow_up", label: "Follow-ups" },
  { value: "quotation", label: "Quotations" },
  { value: "assigned", label: "Assignment" },
  { value: "remark", label: "Notes" }
];

/* =========================
   PAGE
========================= */

export default function AdminLeadDetailPage() {
  const params = useParams();

  const leadId = Array.isArray(params?.leadId)
    ? params.leadId[0]
    : params?.leadId;

  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.loading || false;

  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("all");

  const [selectedActivity, setSelectedActivity] = useState(null);
  const [quotationToEdit, setQuotationToEdit] = useState(null);

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const [assignedUser, setAssignedUser] = useState(null);

  const assignedLookupValue = useMemo(() => {
    return getFirstValue(
      lead?.assignedToUid,
      lead?.assignedTo,
      lead?.assignedUserUid,
      lead?.ownerUid,
      lead?.teamLeadUid,
      lead?.assignedToEmail,
      lead?.assignedUserEmail,
      lead?.ownerEmail
    );
  }, [lead]);

  /* =========================
     LOAD LEAD REALTIME
  ========================== */
  useEffect(() => {
    if (!leadId) {
      setError("Lead ID not found in URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const unsub = onSnapshot(
      doc(db, "leads", leadId),
      snap => {
        if (!snap.exists()) {
          setError("Lead not found.");
          setLead(null);
          setLoading(false);
          return;
        }

        setLead({
          id: snap.id,
          ...snap.data()
        });

        setLoading(false);
      },
      err => {
        console.error("Lead detail load error:", err);
        setError(err?.message || "Failed to load lead.");
        setLead(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  /* =========================
     ASSIGNED USER RESOLVER
  ========================== */
  useEffect(() => {
    let mounted = true;

    async function loadAssignedUser() {
      if (!assignedLookupValue) {
        setAssignedUser(null);
        return;
      }

      try {
        const foundUser = await findUserByUidOrEmail(assignedLookupValue);

        if (mounted) {
          setAssignedUser(foundUser);
        }
      } catch (error) {
        console.warn("Assigned user lookup failed:", error);

        if (mounted) {
          setAssignedUser(null);
        }
      }
    }

    loadAssignedUser();

    return () => {
      mounted = false;
    };
  }, [assignedLookupValue]);

  /* =========================
     DERIVED STATE
     IMPORTANT: keep before return blocks
  ========================== */

  const stage = lead?.stage || "new";

  const isClosed =
    stage === "closed_won" ||
    stage === "closed_lost";

  const nextActionStatus = computeNextActionStatus(lead);
  const nextActionDate = parseFirestoreDate(lead?.nextActionDueAt);
  const leadHealth = getLeadHealth(lead);

  const filteredTimeline = useMemo(() => {
    if (filter === "all") return timeline;

    if (filter === "assigned") {
      return timeline.filter(
        event =>
          event?.type === "assigned" ||
          event?.type === "assignment"
      );
    }

    if (filter === "remark") {
      return timeline.filter(
        event =>
          event?.type === "remark" ||
          event?.type === "note" ||
          !event?.type
      );
    }

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

  const customerEmail = getFirstValue(
    lead?.email,
    lead?.customerEmail,
    lead?.customer?.email,
    lead?.spoc?.email
  );

  const customerMobile = getFirstValue(
    lead?.mobile,
    lead?.phone,
    lead?.contactNumber,
    lead?.customerMobile,
    lead?.customer?.mobile,
    lead?.spoc?.mobile
  );

  const travelAgentName = getFirstValue(
    lead?.travelAgentName,
    lead?.agentName,
    lead?.agencyName,
    lead?.travelAgent?.agencyName
  );

  const destinationName = getFirstValue(
    lead?.destinationName,
    lead?.destination,
    lead?.destinationTitle
  );

  const source = getFirstValue(
    lead?.source,
    lead?.leadSource,
    lead?.channel
  );

  const assignedName = getFirstValue(
    lead?.assignedToName,
    lead?.assignedUserName,
    lead?.assignedName,
    lead?.teamLeadName,
    lead?.ownerName,
    getUserName(assignedUser),
    isEmail(assignedLookupValue) ? titleFromEmail(assignedLookupValue) : ""
  );

  const assignedEmail = getFirstValue(
    lead?.assignedToEmail,
    lead?.assignedUserEmail,
    lead?.ownerEmail,
    getUserEmail(assignedUser),
    isEmail(assignedLookupValue) ? assignedLookupValue : ""
  );

  const assignedRole = getFirstValue(
    lead?.assignedToRole,
    lead?.assignedUserRole,
    lead?.ownerRole,
    getUserRole(assignedUser)
  );

  const assignedUid = getFirstValue(
    lead?.assignedToUid,
    lead?.assignedUserUid,
    lead?.ownerUid,
    lead?.teamLeadUid,
    !isEmail(assignedLookupValue) ? assignedLookupValue : ""
  );

  const actionButtonClass =
    "w-full py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

  /* =========================
     SAFE STATES
  ========================== */

  if (authLoading || loading) {
    return (
      <main className="p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
          Loading lead details...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-sm font-semibold text-red-700">
            User session not found
          </p>

          <p className="text-xs text-red-600 mt-1">
            Please check useAuth, employee mapping, or login session.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-sm font-semibold text-red-700">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-700">
          Lead data is empty.
        </div>
      </main>
    );
  }

  /* =========================
     UI
  ========================== */

  return (
    <main className="p-6 w-full mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ================= TIMELINE PANEL ================= */}
        <section className="lg:col-span-2 space-y-4">

          {/* TIMELINE FILTERS */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Lead Timeline
                </h3>

                <p className="text-xs text-gray-500">
                  Follow-ups, quotations, notes and assignments
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
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    filter === item.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <LeadTimeline
            leadId={lead.id}
            onLoad={setTimeline}
            onSelect={setSelectedActivity}
            eventsOverride={
              timeline.length ? filteredTimeline : undefined
            }
          />
        </section>

        {/* ================= SIDE PANEL ================= */}
        <aside className="lg:sticky lg:top-24 space-y-4 self-start">

          {/* LEAD HEADER */}
          <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Lead</p>

                <h2 className="text-md font-semibold text-gray-900 truncate">
                  {lead.leadCode || "—"}
                </h2>

                <p className="text-sm text-gray-500 truncate">
                  {destinationName || "—"}
                </p>
              </div>

              <LeadStatusChip stage={stage} />
            </div>

            <div className="flex flex-wrap gap-2">
              <LeadHealthChip health={leadHealth} />

              {source && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {source}
                </span>
              )}
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="bg-white rounded-xl p-4 space-y-2 border border-gray-100">
            <p className="text-xs font-medium text-gray-500">
              Quick Actions
            </p>

            <button
              disabled={isClosed}
              onClick={() => setFollowUpOpen(true)}
              className={`${actionButtonClass} bg-blue-600 text-white hover:bg-blue-700`}
            >
              + Log Follow-Up
            </button>

            <button
              disabled={isClosed}
              onClick={() => {
                setQuotationToEdit(null);
                setQuoteOpen(true);
              }}
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
          </div>

          {/* CUSTOMER CONTACT */}
          <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100">
            <p className="text-xs font-medium text-gray-500">
              Customer Contact
            </p>

            <div className="flex items-start gap-3">
              <InitialAvatar
                name={customerName || customerEmail || "Customer"}
              />

              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {customerName || "—"}
                </p>

                {customerEmail && (
                  <p className="text-xs text-gray-500 truncate mt-1">
                    📧 {customerEmail}
                  </p>
                )}

                {customerMobile && (
                  <p className="text-xs text-gray-500 truncate mt-1">
                    📱 {customerMobile}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* TRAVEL AGENT / SPOC */}
          <div className="bg-white rounded-xl p-4 space-y-2 border border-gray-100">
            <p className="text-xs font-medium text-gray-500">
              Travel Agent / SPOC
            </p>

            <p className="text-sm font-semibold text-gray-900 truncate">
              {travelAgentName || lead.spoc?.name || "—"}
            </p>

            {lead.spoc?.name && travelAgentName && (
              <p className="text-xs text-gray-500 truncate">
                SPOC: {lead.spoc.name}
              </p>
            )}

            {lead.spoc?.email && (
              <p className="text-xs text-gray-500 truncate">
                📧 {lead.spoc.email}
              </p>
            )}

            {lead.spoc?.mobile && (
              <p className="text-xs text-gray-500">
                📱 {lead.spoc.mobile}
              </p>
            )}
          </div>

          {/* ASSIGNED TO */}
          <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-gray-500">
                Assigned To
              </p>

              {!isClosed && (
                <button
                  type="button"
                  onClick={() => setAssignOpen(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Change
                </button>
              )}
            </div>

            {assignedName || assignedEmail || assignedUid ? (
              <div className="flex items-center gap-3">
                <InitialAvatar
                  name={assignedName || assignedEmail || assignedUid || "User"}
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {assignedName || "Unassigned"}
                  </p>

                  {assignedRole && (
                    <p className="text-xs text-gray-500 truncate">
                      {assignedRole}
                    </p>
                  )}

                  {assignedEmail && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      📧 {assignedEmail}
                    </p>
                  )}

                  {!assignedEmail && assignedUid && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      ID: {assignedUid}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-700">
                  Not assigned yet
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Assign this lead to a team member for ownership and follow-up.
                </p>

                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => setAssignOpen(true)}
                    className="mt-3 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs"
                  >
                    Assign Now
                  </button>
                )}
              </div>
            )}
          </div>

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

            {nextActionDate ? (
              <>
                <p className="text-sm font-medium text-gray-900">
                  {lead.nextActionType || "Follow-up"}
                </p>

                <p className="text-xs text-gray-600">
                  {formatDateTime(nextActionDate)}
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

          {/* STAGE / HEALTH */}
          <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Health</span>
              <LeadHealthChip health={leadHealth} />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">
                Lead Stage
              </p>

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
                <option value="assigned">Assigned</option>
                <option value="follow_up">Follow Up</option>
                <option value="quoted">Quoted</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
              </select>
            </div>

            {isClosed && (
              <p className="text-xs text-gray-500">
                This lead is closed. Reopen it to make changes.
              </p>
            )}
          </div>

          {/* ADMIN REOPEN */}
          {isClosed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <button
                onClick={async () => {
                  const reason = prompt("Reason for reopening lead");

                  if (!reason?.trim()) return;

                  await reopenLead({
                    leadId: lead.id,
                    reason,
                    user
                  });
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
          initialQuotation={quotationToEdit}
          onClose={() => {
            setQuoteOpen(false);
            setQuotationToEdit(null);
          }}
        />
      )}

      {assignOpen && (
        <AssignLeadModal
          leadId={lead.id}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {selectedActivity && (
        <ActivityViewerModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onEditDraft={quotation => {
            setSelectedActivity(null);
            setQuotationToEdit(quotation);
            setQuoteOpen(true);
          }}
        />
      )}
    </main>
  );
}