"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

import {
  Activity,
  BadgeIndianRupee,
  CalendarClock,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
  Wallet
} from "lucide-react";

import {
  LEAD_STAGE_OPTIONS,
  LEAD_STAGES,
  isTerminalLeadStage
} from "@/lib/leadStages";

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
import ClientReferenceCard from "@/components/leads/ClientReferenceCard";
import LeadStageCloseModal from "@/components/leads/LeadStageCloseModal";

import LeadStatusChip from "@/components/leads/LeadStatusChip";
import LeadHealthChip from "@/components/leads/LeadHealthChip";

import LeadVendorsTab from "@/components/vendors/LeadVendorsTab";
import VendorQuoteForm from "@/components/vendors/VendorQuoteForm";
import VendorFollowUpModal from "@/components/vendors/VendorFollowUpModal";
import VendorQuotesSidePanel from "@/components/vendors/VendorQuotesSidePanel";
import CustomerQuotationTab from "@/components/leads/CustomerQuotationTab";
import QuotationHistory from "@/components/leads/QuotationHistory";
import LeadPaymentsTab from "@/components/payments/LeadPaymentsTab";

import { updateLeadStage } from "@/lib/updateLeadStage";
import { reopenLead } from "@/lib/reopenLead";
import { getLeadHealth } from "@/lib/getLeadHealth";
import { getNextActionStatus } from "@/lib/getNextActionStatus";
import { saveVendorQuote } from "@/lib/leadVendorQuotes";

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

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getNumericValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(number);
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number.toFixed(1)}%`;
}

function isEmail(value = "") {
  return String(value || "").includes("@");
}

function titleFromEmail(email = "") {
  const prefix = String(email || "").split("@")[0] || "";

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
  } catch {
    // Skip direct lookup failure.
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
  } catch {
    // Skip UID lookup failure.
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
  } catch {
    // Skip email lookup failure.
  }

  return null;
}

/* =========================
   SMALL UI COMPONENTS
========================= */

function InfoPill({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {Icon && <Icon size={13} />}
        {label}
      </div>

      <p className="mt-1 text-sm font-semibold text-gray-900 truncate">
        {value || "—"}
      </p>
    </div>
  );
}

function TabButton({ active, icon: Icon, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 rounded-2xl px-4 py-3
        text-sm font-semibold border transition
        ${active
          ? "bg-gray-950 text-white border-gray-950 shadow-sm"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }
      `}
    >
      {Icon && <Icon size={16} />}
      <span>{label}</span>

      {typeof count !== "undefined" && count !== null && count !== "" && (
        <span
          className={`
            rounded-full px-2 py-0.5 text-[11px]
            ${active
              ? "bg-white/15 text-white"
              : "bg-gray-100 text-gray-600"
            }
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function NextBestActionCard({
  stage,
  isClosed,
  hasFinalVendor,
  hasAssignedUser,
  setActiveTab,
  onFollowUp,
  onAssign,
  onCreateQuotation
}) {
  let title = "Review lead activity";
  let description =
    "Check latest follow-ups, quotations and notes before taking the next action.";
  let actionLabel = "Open Activity";
  let action = () => setActiveTab("activity");
  let tone = "blue";

  if (isClosed) {
    title = "Lead is closed";
    description =
      "This lead is already closed. Reopen it only if further action is required.";
    actionLabel = "View Activity";
    action = () => setActiveTab("activity");
    tone = "slate";
  } else if (!hasAssignedUser) {
    title = "Assign this lead";
    description =
      "This lead does not have a clear owner yet. Assign it before follow-up.";
    actionLabel = "Assign Now";
    action = onAssign;
    tone = "orange";
  } else if (!hasFinalVendor) {
    title = "Prepare customer quotation";
    description =
      "You can create a direct quote, use manual cost, or select any vendor pricing.";
    actionLabel = "Create Customer Quote";
    action = onCreateQuotation;
    tone = "purple";
  } else if (
    stage === LEAD_STAGES.QUOTE_PENDING ||
    stage === LEAD_STAGES.REQUIREMENT_COMPLETED ||
    stage === LEAD_STAGES.REVISION_REQUIRED
  ) {
    title = "Prepare customer quotation";
    description =
      "Vendor cost is available. Enter selling price and review margin.";
    actionLabel = "Prepare Customer Quote";
    action = onCreateQuotation;
    tone = "green";
  } else if (stage === LEAD_STAGES.QUOTE_SENT) {
    title = "Follow up on quotation";
    description =
      "Quotation has been sent. Log the next follow-up with the customer or travel agent.";
    actionLabel = "Log Follow-up";
    action = onFollowUp;
    tone = "blue";
  }

  const toneClasses =
    tone === "green"
      ? "from-green-50 to-emerald-50 border-green-100 text-green-700"
      : tone === "orange"
        ? "from-orange-50 to-amber-50 border-orange-100 text-orange-700"
        : tone === "purple"
          ? "from-purple-50 to-blue-50 border-purple-100 text-purple-700"
          : tone === "slate"
            ? "from-slate-50 to-gray-50 border-gray-200 text-gray-700"
            : "from-blue-50 to-sky-50 border-blue-100 text-blue-700";

  return (
    <div className={`rounded-3xl border bg-gradient-to-r p-5 ${toneClasses}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            Next Best Action
          </p>

          <h3 className="mt-1 text-base font-semibold text-gray-950">
            {title}
          </h3>

          <p className="mt-1 text-sm text-gray-600">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={action}
          className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-950 shadow-sm hover:bg-gray-50"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

/* =========================
   CONSTANTS
========================= */

const closingStages = [
  LEAD_STAGES.CONVERTED,
  LEAD_STAGES.LOST
];

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

export default function LeadDetailPage() {
  const params = useParams();

  const leadId = Array.isArray(params?.leadId)
    ? params.leadId[0]
    : params?.leadId;

  const { user } = useAuth();

  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("activity");
  const [filter, setFilter] = useState("all");

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState(null);
  const [quotationToEdit, setQuotationToEdit] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);

  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState("");
  const [stageModal, setStageModal] = useState({
    open: false,
    newStage: ""
  });

  const [activeVendorQuoteRequest, setActiveVendorQuoteRequest] =
    useState(null);

  const [activeVendorQuotesRequest, setActiveVendorQuotesRequest] =
    useState(null);

  const [activeVendorFollowUpRequest, setActiveVendorFollowUpRequest] =
    useState(null);

  const [savingVendorQuote, setSavingVendorQuote] = useState(false);
  const [vendorQuoteError, setVendorQuoteError] = useState("");

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
      () => {
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

      const foundUser = await findUserByUidOrEmail(assignedLookupValue);

      if (mounted) {
        setAssignedUser(foundUser);
      }
    }

    loadAssignedUser();

    return () => {
      mounted = false;
    };
  }, [assignedLookupValue]);

  /* =========================
     DERIVED STATE
  ========================== */

  const stage = lead?.stage || LEAD_STAGES.NEW_ENQUIRY;

  const isClosed = isTerminalLeadStage(stage);

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

  const travelAgentId = getFirstValue(
    lead?.travelAgentId,
    lead?.agentId,
    lead?.agencyId,
    lead?.travelAgentRefId,
    lead?.travelAgent?.id,
    lead?.travelAgent?.agentId
  );

  const travelAgentProfileHref = travelAgentId
    ? `/travel-agents/${travelAgentId}`
    : "";

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

  const hasAssignedUser = Boolean(
    assignedUid ||
    assignedEmail ||
    assignedName ||
    lead?.assignedTo ||
    lead?.ownerUid
  );

  const finalVendorCost = getNumericValue(
    lead?.selectedVendorCost,
    lead?.finalVendorCost,
    lead?.latestSelectedVendorCost,
    lead?.latestVendorCost
  );

  const finalVendorName = getFirstValue(
    lead?.selectedVendorName,
    lead?.finalVendorName,
    lead?.latestSelectedVendorName
  );

  const finalVendorQuoteId = getFirstValue(
    lead?.selectedVendorQuoteId,
    lead?.finalVendorQuoteId,
    lead?.latestSelectedVendorQuoteId
  );

  const hasFinalVendor =
    finalVendorCost !== null &&
    Boolean(finalVendorQuoteId || finalVendorName);

  const customerQuoteAmount = getNumericValue(
    lead?.latestCustomerQuoteAmount,
    lead?.finalCustomerQuoteAmount,
    lead?.latestQuotationAmount,
    lead?.finalQuotationAmount
  );

  const grossProfit = getNumericValue(
    lead?.latestGrossProfit,
    lead?.finalGrossProfit
  );

  const marginPercent = getNumericValue(
    lead?.latestMarginPercent,
    lead?.finalMarginPercent
  );

  const quotationCount = Number(
    lead?.latestQuotationRevision ||
    lead?.quotationRevision ||
    0
  );

  const vendorPricingStatus = hasFinalVendor
    ? "Final"
    : "Pending";

  const openCustomerQuotationTab = () => {
    setQuotationToEdit(null);
    setActiveTab("quotation");
  };

  const leadTabItems = [
    {
      value: "activity",
      label: "Activity",
      icon: Activity,
      count: filteredTimeline.length
    },
    {
      value: "vendor",
      label: "Vendor Costing",
      icon: BadgeIndianRupee,
      count: vendorPricingStatus
    },
    {
      value: "quotation",
      label: "Customer Quote",
      icon: ReceiptText,
      count: "Available"
    },
    {
      value: "quotation_history",
      label: "Quote History",
      icon: ReceiptText,
      count: quotationCount
    },
    {
      value: "payments",
      label: "Payments",
      icon: Wallet,
      count: lead?.customerPaymentStatus
        ? "Active"
        : "Pending"
    }
  ];

  const actionButtonClass =
    "w-full py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

  /* =========================
     ACTIONS
  ========================== */

  const requestStageChange = async newStage => {
    setStageError("");

    if (!newStage || newStage === stage) return;

    if (closingStages.includes(newStage)) {
      setStageModal({
        open: true,
        newStage
      });
      return;
    }

    try {
      setStageSaving(true);

      await updateLeadStage({
        leadId: lead.id,
        newStage,
        remark: "",
        user
      });
    } catch (error) {
      setStageError(error?.message || "Failed to update lead stage.");
    } finally {
      setStageSaving(false);
    }
  };

  const confirmClosingStage = async payload => {
    setStageError("");

    try {
      setStageSaving(true);

      await updateLeadStage({
        leadId: lead.id,
        newStage: stageModal.newStage,
        remark: payload?.remark || "",
        lostReason: payload?.lostReason || "",
        user
      });

      setStageModal({
        open: false,
        newStage: ""
      });
    } catch (error) {
      setStageError(error?.message || "Failed to update lead stage.");
    } finally {
      setStageSaving(false);
    }
  };

  const handleVendorQuoteSubmit = async formPayload => {
    if (!activeVendorQuoteRequest) return;

    setSavingVendorQuote(true);
    setVendorQuoteError("");

    try {
      await saveVendorQuote({
        leadId: lead.id,
        vendorRequestId:
          activeVendorQuoteRequest.id ||
          activeVendorQuoteRequest.vendorRequestId,
        form: formPayload,
        user
      });

      setActiveVendorQuoteRequest(null);
    } catch (error) {
      setVendorQuoteError(
        error?.message || "Failed to save vendor quote."
      );
    } finally {
      setSavingVendorQuote(false);
    }
  };

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

  return (
    <main className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ================= LEFT PANEL ================= */}
        <div className="lg:sticky lg:top-6 self-start space-y-4">
          <Card className="space-y-4 overflow-hidden">
            <div className="rounded-2xl bg-gradient-to-r from-slate-950 to-blue-950 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-300">
                    {lead.leadCode || "Lead Details"}
                  </p>

                  <h2 className="mt-1 font-semibold truncate">
                    {destinationName || "No destination"}
                  </h2>
                </div>

                <LeadStatusChip stage={stage} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <LeadHealthChip health={leadHealth} />

                {source && (
                  <span className="text-xs bg-white/10 text-white px-2.5 py-1 rounded-full">
                    {source}
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
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
              onClick={openCustomerQuotationTab}
              className={`${actionButtonClass} bg-purple-600 text-white hover:bg-purple-700`}
            >
              Prepare Customer Quote
            </button>

            <button
              disabled={isClosed}
              onClick={() => setAssignOpen(true)}
              className={`${actionButtonClass} bg-orange-600 text-white hover:bg-orange-700`}
            >
              Assign / Change Team
            </button>
          </Card>

          <ClientReferenceCard lead={lead} />

          <Card className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
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
                  <p className="text-xs text-gray-500 truncate mt-1 flex items-center gap-1">
                    <Mail size={12} />
                    {customerEmail}
                  </p>
                )}

                {customerMobile && (
                  <p className="text-xs text-gray-500 truncate mt-1 flex items-center gap-1">
                    <Phone size={12} />
                    {customerMobile}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Travel Agent / SPOC
              </p>

              {travelAgentProfileHref && (
                <Link
                  href={travelAgentProfileHref}
                  className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap"
                >
                  View Profile
                </Link>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              {travelAgentProfileHref ? (
                <Link
                  href={travelAgentProfileHref}
                  className="text-sm font-semibold text-blue-700 hover:underline"
                >
                  {travelAgentName || lead.spoc?.name || "View Travel Agent"}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-gray-900">
                  {travelAgentName || lead.spoc?.name || "—"}
                </p>
              )}

              {lead.spoc?.name && travelAgentName && (
                <p className="text-xs text-gray-500 mt-1">
                  SPOC: {lead.spoc.name}
                </p>
              )}

              {lead.spoc?.email && (
                <p className="text-xs text-gray-500 truncate mt-1">
                  {lead.spoc.email}
                </p>
              )}

              {lead.spoc?.mobile && (
                <p className="text-xs text-gray-500 mt-1">
                  {lead.spoc.mobile}
                </p>
              )}

              {!travelAgentProfileHref && (
                <p className="text-xs text-amber-600 mt-2">
                  Travel agent profile link unavailable.
                </p>
              )}
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
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
                      {assignedEmail}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-700">
                  Not assigned yet
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Assign this lead to a team member.
                </p>

                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => setAssignOpen(true)}
                    className="mt-3 bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs"
                  >
                    Assign Now
                  </button>
                )}
              </div>
            )}
          </Card>

          <div
            className={`rounded-2xl p-4 border ${nextActionStatus === "overdue"
              ? "bg-red-50 border-red-200"
              : "bg-blue-50 border-blue-200"
              }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
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
                    Overdue
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400">
                No next action scheduled
              </p>
            )}
          </div>

          <Card className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Health
              </span>

              <LeadHealthChip health={leadHealth} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Lead Stage
              </p>

              <select
                disabled={isClosed || stageSaving}
                value={stage}
                onChange={event => requestStageChange(event.target.value)}
                className="
                  w-full border border-gray-200 rounded-xl
                  px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:bg-gray-100 disabled:text-gray-500
                "
              >
                {LEAD_STAGE_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              {stageSaving && (
                <p className="text-xs text-blue-600 mt-2">
                  Updating stage...
                </p>
              )}

              {stageError && !stageModal.open && (
                <p className="text-xs text-red-600 mt-2">
                  {stageError}
                </p>
              )}
            </div>

            {isClosed && (
              <p className="text-xs text-gray-500">
                This lead is closed. Reopen it to make changes.
              </p>
            )}
          </Card>

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
                className="w-full bg-yellow-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-yellow-700"
              >
                Reopen Lead
              </button>
            </Card>
          )}
        </div>

        {/* ================= RIGHT PANEL ================= */}
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {lead.leadCode || "Lead"}
                    </span>

                    <LeadStatusChip stage={stage} />
                    <LeadHealthChip health={leadHealth} />
                  </div>

                  <h1 className="mt-3 text-2xl font-bold tracking-tight">
                    {customerName || travelAgentName || "Lead Details"}
                  </h1>

                  <p className="mt-1 text-sm text-slate-300">
                    {destinationName || "No destination selected"}
                    {source ? ` · ${source}` : ""}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 min-w-[260px]">
                  <button
                    disabled={isClosed}
                    onClick={() => setFollowUpOpen(true)}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-blue-50 disabled:opacity-50"
                  >
                    + Follow-up
                  </button>

                  <button
                    disabled={isClosed}
                    onClick={openCustomerQuotationTab}
                    className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    Prepare Quote
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4">
              <InfoPill
                icon={MapPin}
                label="Destination"
                value={destinationName || "Not added"}
              />

              <InfoPill
                icon={CalendarClock}
                label="Next Action"
                value={nextActionAt ? formatDateTime(nextActionAt) : "Not scheduled"}
              />

              <InfoPill
                icon={UserRound}
                label="Assigned To"
                value={assignedName || assignedEmail || "Unassigned"}
              />

              <InfoPill
                icon={ClipboardList}
                label="Stage"
                value={lead.stageLabel || stage}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 border-t border-gray-100">
              <InfoPill
                icon={BadgeIndianRupee}
                label="Vendor Cost"
                value={hasFinalVendor ? formatMoney(finalVendorCost) : "Optional"}
              />

              <InfoPill
                icon={ReceiptText}
                label="Customer Quote"
                value={
                  customerQuoteAmount !== null
                    ? formatMoney(customerQuoteAmount)
                    : "Not created"
                }
              />

              <InfoPill
                icon={BadgeIndianRupee}
                label="Gross Profit"
                value={
                  grossProfit !== null
                    ? formatMoney(grossProfit)
                    : "—"
                }
              />

              <InfoPill
                icon={Activity}
                label="Margin"
                value={
                  marginPercent !== null
                    ? formatPercent(marginPercent)
                    : "—"
                }
              />
            </div>
          </div>

          <NextBestActionCard
            stage={stage}
            isClosed={isClosed}
            hasFinalVendor={hasFinalVendor}
            hasAssignedUser={hasAssignedUser}
            setActiveTab={setActiveTab}
            onFollowUp={() => setFollowUpOpen(true)}
            onAssign={() => setAssignOpen(true)}
            onCreateQuotation={openCustomerQuotationTab}
          />

          {/* TABS */}
          <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
              {leadTabItems.map(tab => (
                <TabButton
                  key={tab.value}
                  active={activeTab === tab.value}
                  icon={tab.icon}
                  label={tab.label}
                  count={tab.count}
                  onClick={() => setActiveTab(tab.value)}
                />
              ))}
            </div>
          </div>

          {/* TAB CONTENT */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              <Card className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Lead Activity
                    </h3>

                    <p className="text-xs text-gray-500">
                      Follow-ups, quotations, notes and assignments
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
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
                        ? "bg-gray-950 text-white border-gray-950"
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
          )}

          {activeTab === "vendor" && (
            <LeadVendorsTab
              lead={lead}
              onAddQuote={request => {
                setActiveVendorQuoteRequest(request);
                setVendorQuoteError("");
              }}
              onViewQuotes={request => setActiveVendorQuotesRequest(request)}
              onFollowUp={request => setActiveVendorFollowUpRequest(request)}
            />
          )}

          {activeTab === "quotation" && (
            <CustomerQuotationTab
              lead={lead}
              onCreateQuotation={pricingSnapshot => {
                setQuotationToEdit({
                  pricingSnapshot,

                  quotationPricingMode: pricingSnapshot.quotationPricingMode,
                  vendorQuoteFinalized: pricingSnapshot.vendorQuoteFinalized,

                  selectedVendorCost: pricingSnapshot.selectedVendorCost,
                  selectedVendorCurrency: pricingSnapshot.selectedVendorCurrency,
                  selectedVendorName: pricingSnapshot.selectedVendorName,
                  selectedVendorQuoteId: pricingSnapshot.selectedVendorQuoteId,
                  selectedVendorRequestId: pricingSnapshot.selectedVendorRequestId,

                  customerQuoteAmount: pricingSnapshot.customerQuoteAmount,
                  customerQuoteCurrency: pricingSnapshot.customerQuoteCurrency,

                  grossProfit: pricingSnapshot.grossProfit,
                  marginPercent: pricingSnapshot.marginPercent,
                  markupPercent: pricingSnapshot.markupPercent
                });

                setQuoteOpen(true);
              }}
            />
          )}

          {activeTab === "quotation_history" && (
            <QuotationHistory
              lead={lead}
              onEditDraft={quotation => {
                setQuotationToEdit(quotation);
                setQuoteOpen(true);
              }}
              onCreateRevision={quotation => {
                setQuotationToEdit(quotation);
                setQuoteOpen(true);
              }}
            />
          )}
          {activeTab === "payments" && (
            <LeadPaymentsTab lead={lead} />
          )}
        </div>
      </div>

      {/* ================= MODALS / PANELS ================= */}

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
          lead={lead}
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

      <LeadStageCloseModal
        open={stageModal.open}
        newStage={stageModal.newStage}
        saving={stageSaving}
        error={stageError}
        onClose={() => {
          setStageModal({
            open: false,
            newStage: ""
          });
          setStageError("");
        }}
        onConfirm={confirmClosingStage}
      />

      {activeVendorQuoteRequest && (
        <VendorQuoteForm
          vendorRequest={activeVendorQuoteRequest}
          saving={savingVendorQuote}
          error={vendorQuoteError}
          onCancel={() => {
            setActiveVendorQuoteRequest(null);
            setVendorQuoteError("");
          }}
          onSubmit={handleVendorQuoteSubmit}
        />
      )}

      <VendorQuotesSidePanel
        open={Boolean(activeVendorQuotesRequest)}
        lead={lead}
        leadId={lead.id}
        vendorRequest={activeVendorQuotesRequest}
        onClose={() => setActiveVendorQuotesRequest(null)}
        onSelected={() => {
          // Keep panel open after final quote selection.
          // Firestore realtime refresh will update the quote state.
        }}
      />

      <VendorFollowUpModal
        open={Boolean(activeVendorFollowUpRequest)}
        lead={lead}
        leadId={lead.id}
        vendorRequest={activeVendorFollowUpRequest}
        onClose={() => setActiveVendorFollowUpRequest(null)}
        onSaved={() => setActiveVendorFollowUpRequest(null)}
      />
    </main>
  );
}