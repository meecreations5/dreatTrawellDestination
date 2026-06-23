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
  Sparkles,
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

import { reopenLead } from "@/lib/reopenLead";
import { updateLeadStage } from "@/lib/updateLeadStage";
import { getLeadHealth } from "@/lib/getLeadHealth";
import { saveVendorQuote } from "@/lib/leadVendorQuotes";

/* =========================
   HELPERS
========================= */

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
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

function getNextActionStatus(lead) {
  const due = toDate(lead?.nextActionDueAt);
  if (!due) return "none";

  const now = new Date();

  if (due < now) return "overdue";

  if (due.toDateString() === now.toDateString()) {
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

function AdminMetricCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {label}
          </p>

          <p className="mt-1 truncate text-lg font-bold text-gray-950">
            {value || "—"}
          </p>

          {helper && (
            <p className="mt-1 truncate text-xs text-gray-500">
              {helper}
            </p>
          )}
        </div>

        {Icon && (
          <div className="rounded-2xl bg-gray-950 p-2.5 text-white">
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

function AdminActionButton({
  children,
  disabled,
  onClick,
  variant = "primary"
}) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    purple: "bg-purple-600 text-white hover:bg-purple-700",
    orange: "bg-orange-600 text-white hover:bg-orange-700",
    dark: "bg-gray-950 text-white hover:bg-gray-800",
    warning: "bg-yellow-600 text-white hover:bg-yellow-700"
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        w-full rounded-2xl px-4 py-3 text-sm font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-50
        ${variants[variant] || variants.primary}
      `}
    >
      {children}
    </button>
  );
}

function AdminPanelTitle({ label, title, description }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <h3 className="mt-1 text-base font-bold text-gray-950">
        {title}
      </h3>

      {description && (
        <p className="mt-1 text-xs text-gray-500">
          {description}
        </p>
      )}
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
        ${
          active
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
            ${
              active
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
      "You can create a direct quote, use manual costing, or select vendor pricing.";
    actionLabel = "Create Customer Quote";
    action = onCreateQuotation;
    tone = "purple";
  } else if (
    stage === LEAD_STAGES.QUOTE_PENDING ||
    stage === LEAD_STAGES.REQUIREMENT_COMPLETED ||
    stage === LEAD_STAGES.REVISION_REQUIRED ||
    stage === "quoted"
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

const fallbackStageOptions = [
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "follow_up", label: "Follow Up" },
  { value: "quoted", label: "Quoted" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" }
];

const closingStages = [
  LEAD_STAGES?.CONVERTED,
  LEAD_STAGES?.LOST,
  "closed_won",
  "closed_lost"
].filter(Boolean);

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

  const { user, loading: authLoading } = useAuth();

  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const [loadingLead, setLoadingLead] = useState(true);
  const [error, setError] = useState("");

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
     LOAD LEAD REALTIME
  ========================== */

  useEffect(() => {
    if (!leadId) {
      setError("Lead ID not found in URL.");
      setLoadingLead(false);
      return;
    }

    setLoadingLead(true);
    setError("");

    const unsub = onSnapshot(
      doc(db, "leads", leadId),
      snap => {
        if (!snap.exists()) {
          setError("Lead not found.");
          setLead(null);
          setLoadingLead(false);
          return;
        }

        setLead({
          id: snap.id,
          ...snap.data()
        });

        setLoadingLead(false);
      },
      err => {
        setError(err?.message || "Failed to load lead.");
        setLead(null);
        setLoadingLead(false);
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

  const loading = Boolean(authLoading || loadingLead);

  const stage = lead?.stage || LEAD_STAGES?.NEW_ENQUIRY || "new";

  const isClosed =
    isTerminalLeadStage(stage) ||
    closingStages.includes(stage);

  const stageBaseOptions =
    Array.isArray(LEAD_STAGE_OPTIONS) && LEAD_STAGE_OPTIONS.length
      ? LEAD_STAGE_OPTIONS
      : fallbackStageOptions;

  const stageLabel =
    lead?.stageLabel ||
    stageBaseOptions.find(item => item.value === stage)?.label ||
    stage;

  const stageOptions = useMemo(() => {
    if (stageBaseOptions.some(item => item.value === stage)) {
      return stageBaseOptions;
    }

    return [
      {
        value: stage,
        label: stageLabel
      },
      ...stageBaseOptions
    ];
  }, [stage, stageBaseOptions, stageLabel]);

  const nextActionStatus = getNextActionStatus(lead);
  const nextActionAt = toDate(lead?.nextActionDueAt);
  const leadHealth = useMemo(() => getLeadHealth(lead), [lead]);

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

  const travelAgentId = getFirstValue(
    lead?.travelAgentId,
    lead?.agentId,
    lead?.agencyId,
    lead?.travelAgentRefId,
    lead?.travelAgent?.id,
    lead?.travelAgent?.agentId
  );

  const travelAgentProfileHref = travelAgentId
    ? `/admin/travel-agents/${travelAgentId}`
    : "";

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
      count: "Create"
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

  const handleReopenLead = async () => {
    const reason = prompt("Reason for reopening lead");

    if (!reason?.trim()) return;

    await reopenLead({
      leadId: lead.id,
      reason,
      user
    });
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
     SAFE STATES
  ========================== */

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>

          <CardSkeleton />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-700">
            User session not found
          </p>

          <p className="mt-1 text-xs text-red-600">
            Please check useAuth, employee mapping, or login session.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-700">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-700">
          Lead data is empty.
        </div>
      </main>
    );
  }

  /* =========================
     UI
  ========================== */

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1550px] space-y-6">
        {/* ================= ADMIN COMMAND HEADER ================= */}
        <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_left,_#2563eb,_#111827_42%,_#020617_100%)] px-6 py-7 text-white">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                    Admin Lead Control
                  </span>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                    {lead.leadCode || "Lead"}
                  </span>

                  <LeadStatusChip stage={stage} />
                  <LeadHealthChip health={leadHealth} />
                </div>

                <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                  {customerName || travelAgentName || "Lead Details"}
                </h1>

                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  {destinationName || "No destination selected"}
                  {source ? ` · ${source}` : ""}
                  {assignedName || assignedEmail
                    ? ` · Assigned to ${assignedName || assignedEmail}`
                    : " · Not assigned"}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[260px] xl:grid-cols-1">
                <button
                  type="button"
                  disabled={isClosed}
                  onClick={() => setFollowUpOpen(true)}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-blue-50 disabled:opacity-50"
                >
                  + Log Follow-Up
                </button>

                <button
                  type="button"
                  disabled={isClosed}
                  onClick={openCustomerQuotationTab}
                  className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Prepare Quote
                </button>

                <button
                  type="button"
                  disabled={isClosed}
                  onClick={() => setAssignOpen(true)}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                  Assign Team
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              icon={MapPin}
              label="Destination"
              value={destinationName || "Not added"}
              helper={source || "Lead source not added"}
            />

            <AdminMetricCard
              icon={CalendarClock}
              label="Next Action"
              value={nextActionAt ? formatDateTime(nextActionAt) : "Not scheduled"}
              helper={
                nextActionStatus === "overdue"
                  ? "Overdue"
                  : nextActionStatus === "today"
                    ? "Due today"
                    : "Upcoming"
              }
            />

            <AdminMetricCard
              icon={BadgeIndianRupee}
              label="Vendor Cost"
              value={hasFinalVendor ? formatMoney(finalVendorCost) : "Pending"}
              helper={finalVendorName || "No final vendor selected"}
            />

            <AdminMetricCard
              icon={ReceiptText}
              label="Customer Quote"
              value={
                customerQuoteAmount !== null
                  ? formatMoney(customerQuoteAmount)
                  : "Not created"
              }
              helper={
                grossProfit !== null
                  ? `GP ${formatMoney(grossProfit)} · Margin ${formatPercent(marginPercent)}`
                  : "Quotation pending"
              }
            />
          </div>
        </section>

        {/* ================= WORKSPACE ================= */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_390px]">
          {/* ================= MAIN WORK AREA ================= */}
          <section className="space-y-5">
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

            {/* ADMIN TABS */}
            <div className="sticky top-20 z-20 rounded-3xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
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

            {activeTab === "activity" && (
              <div className="space-y-4">
                <Card className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <AdminPanelTitle
                      label="Activity Center"
                      title="Lead Timeline"
                      description="Follow-ups, quotations, assignments, notes and system updates"
                    />

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
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          filter === item.value
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
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
          </section>

          {/* ================= ADMIN CONTROL RAIL ================= */}
          <aside className="space-y-4 self-start xl:sticky xl:top-6">
            <Card className="overflow-hidden border-gray-200">
              <div className="bg-gray-950 p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Admin Controls
                    </p>

                    <h2 className="mt-1 text-lg font-bold">
                      Manage Lead
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      Actions are available based on current lead stage.
                    </p>
                  </div>

                  <Sparkles size={20} className="text-blue-300" />
                </div>
              </div>

              <div className="space-y-3 p-4">
                <AdminActionButton
                  disabled={isClosed}
                  onClick={() => setFollowUpOpen(true)}
                  variant="primary"
                >
                  + Log Follow-Up
                </AdminActionButton>

                <AdminActionButton
                  disabled={isClosed}
                  onClick={openCustomerQuotationTab}
                  variant="purple"
                >
                  Prepare Customer Quote
                </AdminActionButton>

                <AdminActionButton
                  disabled={isClosed}
                  onClick={() => setAssignOpen(true)}
                  variant="orange"
                >
                  Assign / Change Team
                </AdminActionButton>
              </div>
            </Card>

            <Card className="space-y-4">
              <AdminPanelTitle
                label="Stage Control"
                title="Lead Stage"
                description="Update lead pipeline stage from admin panel."
              />

              <div>
                <select
                  disabled={isClosed || stageSaving}
                  value={stage}
                  onChange={event => requestStageChange(event.target.value)}
                  className="
                    w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm
                    font-medium text-gray-800
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    disabled:bg-gray-100 disabled:text-gray-500
                  "
                >
                  {stageOptions.map(item => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                {stageSaving && (
                  <p className="mt-2 text-xs text-blue-600">
                    Updating stage...
                  </p>
                )}

                {stageError && !stageModal.open && (
                  <p className="mt-2 text-xs text-red-600">
                    {stageError}
                  </p>
                )}

                {isClosed && (
                  <p className="mt-2 text-xs text-gray-500">
                    This lead is closed. Reopen it to make changes.
                  </p>
                )}
              </div>

              {isClosed && (
                <AdminActionButton
                  onClick={handleReopenLead}
                  variant="warning"
                >
                  Reopen Lead
                </AdminActionButton>
              )}
            </Card>

            <Card className="space-y-4">
              <AdminPanelTitle
                label="Ownership"
                title="Assigned Team Member"
                description="Current owner responsible for this lead."
              />

              {assignedName || assignedEmail || assignedUid ? (
                <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <InitialAvatar
                    name={assignedName || assignedEmail || assignedUid || "User"}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {assignedName || "Unassigned"}
                    </p>

                    {assignedRole && (
                      <p className="truncate text-xs text-gray-500">
                        {assignedRole}
                      </p>
                    )}

                    {assignedEmail && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {assignedEmail}
                      </p>
                    )}

                    {!assignedEmail && assignedUid && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        ID: {assignedUid}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-800">
                    Not assigned yet
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Assign this lead to a team member for ownership and follow-up.
                  </p>
                </div>
              )}

              {!isClosed && (
                <button
                  type="button"
                  onClick={() => setAssignOpen(true)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Change Assignment
                </button>
              )}
            </Card>

            <Card className="space-y-4">
              <AdminPanelTitle
                label="Customer"
                title="Contact Details"
                description="Primary customer or traveller information."
              />

              <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <InitialAvatar
                  name={customerName || customerEmail || "Customer"}
                />

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {customerName || "—"}
                  </p>

                  {customerEmail && (
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-500">
                      <Mail size={12} />
                      {customerEmail}
                    </p>
                  )}

                  {customerMobile && (
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-500">
                      <Phone size={12} />
                      {customerMobile}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <AdminPanelTitle
                label="Partner"
                title="Travel Agent / SPOC"
                description="Agent profile and SPOC details."
              />

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
                  <p className="mt-1 text-xs text-gray-500">
                    SPOC: {lead.spoc.name}
                  </p>
                )}

                {lead.spoc?.email && (
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {lead.spoc.email}
                  </p>
                )}

                {lead.spoc?.mobile && (
                  <p className="mt-1 text-xs text-gray-500">
                    {lead.spoc.mobile}
                  </p>
                )}

                {!travelAgentProfileHref && (
                  <p className="mt-2 text-xs text-amber-600">
                    Travel agent profile link unavailable.
                  </p>
                )}
              </div>
            </Card>

            <ClientReferenceCard lead={lead} />

            <div
              className={`rounded-3xl border p-4 ${
                nextActionStatus === "overdue"
                  ? "border-red-200 bg-red-50"
                  : "border-blue-200 bg-blue-50"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Next Action
              </p>

              {nextActionAt ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {lead.nextActionType || "Follow-up"}
                  </p>

                  <p className="text-xs text-gray-600">
                    {formatDateTime(nextActionAt)}
                  </p>

                  {nextActionStatus === "overdue" && (
                    <p className="mt-1 text-xs font-semibold text-red-600">
                      Overdue
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  No next action scheduled
                </p>
              )}
            </div>
          </aside>
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
          // Firestore realtime refresh will update selected vendor state.
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