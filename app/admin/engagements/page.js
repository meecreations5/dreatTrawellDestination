"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  MapPin,
  ListChecks,
  MessageCircle,
  PhoneCall,
  RotateCcw,
  Search,
  Share2,
  Timer,
  UserCheck,
  UserPlus,
  Users,
  Workflow,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";
import { filterRecordsByAccess } from "@/lib/rolePermissions";
import {
  getMembersForTeam,
  getTeamOptionLabel,
  resolveDirectoryIdentity,
  teamMatchesScope
} from "@/lib/teamDirectory";
import { normalizeTravelAgentStatus } from "@/lib/travelAgentStatus";
import { ENGAGEMENT_OUTCOME_OPTIONS } from "@/lib/engagementIntentMap";
import { isSuccessfulEngagementConnection } from "@/lib/engagementProductivity";

/* ENGAGEMENT COMPONENTS */
import AgentEngagementOverviewTable from "@/components/admin/dashboard/engagements/AgentEngagementOverviewTable";
import AdminProductivityPulseSummary from "@/components/productivity/AdminProductivityPulseSummary";

const engagementChartLoading = () => (
  <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
    Loading chart…
  </div>
);

const EngagementByChannelChart = dynamic(
  () => import("@/components/admin/dashboard/engagements/EngagementByChannelChart"),
  { ssr: false, loading: engagementChartLoading }
);
const EngagementByDestinationChart = dynamic(
  () => import("@/components/admin/dashboard/engagements/EngagementByDestinationChart"),
  { ssr: false, loading: engagementChartLoading }
);

/* =========================
   DATE HELPERS
========================= */

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "number") {
    const milliseconds =
      value < 10000000000
        ? value * 1000
        : value;

    const date = new Date(milliseconds);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function getLocalDateKey(value) {
  const date = toDate(value);

  if (!date) return "";

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return getLocalDateKey(new Date());
}

function isTodayDate(value) {
  const dateKey = getLocalDateKey(value);

  if (!dateKey) return false;

  return dateKey === getTodayKey();
}

function isOverdueDate(value) {
  const dateKey = getLocalDateKey(value);

  if (!dateKey) return false;

  return dateKey < getTodayKey();
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

function formatTime(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDateRange(
  period,
  fromDate,
  toDateValue
) {
  const today = new Date();
  const todayKey = getLocalDateKey(today);

  if (period === "all") {
    return {
      from: "",
      to: ""
    };
  }

  if (period === "custom") {
    return {
      from: fromDate || "",
      to: toDateValue || ""
    };
  }

  if (period === "today") {
    return {
      from: todayKey,
      to: todayKey
    };
  }

  if (period === "yesterday") {
    const yesterday = new Date();

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    const key = getLocalDateKey(yesterday);

    return {
      from: key,
      to: key
    };
  }

  if (period === "7d") {
    const start = new Date();

    start.setDate(
      start.getDate() - 6
    );

    return {
      from: getLocalDateKey(start),
      to: todayKey
    };
  }

  if (period === "30d") {
    const start = new Date();

    start.setDate(
      start.getDate() - 29
    );

    return {
      from: getLocalDateKey(start),
      to: todayKey
    };
  }

  if (period === "thisMonth") {
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    return {
      from: getLocalDateKey(start),
      to: todayKey
    };
  }

  if (period === "lastMonth") {
    const start = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );

    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      0
    );

    return {
      from: getLocalDateKey(start),
      to: getLocalDateKey(end)
    };
  }

  return {
    from: "",
    to: ""
  };
}

function isDateInRange(
  value,
  period,
  fromDate,
  toDateValue
) {
  if (period === "all") {
    return true;
  }

  const dateKey = getLocalDateKey(value);

  if (!dateKey) return false;

  const range = getDateRange(
    period,
    fromDate,
    toDateValue
  );

  if (
    range.from &&
    dateKey < range.from
  ) {
    return false;
  }

  if (
    range.to &&
    dateKey > range.to
  ) {
    return false;
  }

  return true;
}

function isDateBeforeRange(
  value,
  period,
  fromDate,
  toDateValue
) {
  if (period === "all") return false;

  const dateKey = getLocalDateKey(value);
  if (!dateKey) return false;

  const range = getDateRange(
    period,
    fromDate,
    toDateValue
  );

  return Boolean(
    range.from &&
    dateKey < range.from
  );
}

/* =========================
   DATA HELPERS
========================= */

function isDeletedRecord(item = {}) {
  return (
    item?.isDeleted === true ||
    item?.deleted === true
  );
}

function getChannel(value = "") {
  const channel = String(
    value || "other"
  )
    .trim()
    .toLowerCase();

  if (channel.includes("whatsapp")) {
    return "whatsapp";
  }

  if (channel.includes("email")) {
    return "email";
  }

  if (channel.includes("call")) {
    return "call";
  }

  if (
    channel.includes("meeting") ||
    channel.includes("visit")
  ) {
    return "meeting";
  }

  return channel || "other";
}

function getAgentName(item = {}) {
  return (
    item?.agentName ||
    item?.agencyName ||
    item?.travelAgentName ||
    item?.agent?.name ||
    item?.agent?.agencyName ||
    "Unknown Agent"
  );
}

function getDestinationName(item = {}) {
  if (item?.destinationName) {
    return item.destinationName;
  }

  if (
    Array.isArray(item?.destinationNames) &&
    item.destinationNames.length
  ) {
    return item.destinationNames
      .filter(Boolean)
      .join(", ");
  }

  if (item?.destinationCode) {
    return item.destinationCode;
  }

  return "—";
}

function getAssignedName(item = {}) {
  return (
    item?.assignedToName ||
    item?.assignedToEmail ||
    item?.assignedTo ||
    item?.createdByName ||
    "Unassigned"
  );
}

function getAssignedKey(item = {}) {
  return (
    item?.assignedToUid ||
    item?.assignedToEmail ||
    item?.assignedTo ||
    item?.assignedToName ||
    "unassigned"
  );
}

function getRecordChannel(item = {}) {
  return (
    item?.channel ||
    item?.lastFollowUpChannel ||
    item?.clientReferenceSource ||
    item?.source ||
    "other"
  );
}

function getCreatedDate(item = {}) {
  return (
    item?.createdAt ||
    item?.date ||
    item?.engagementDate ||
    null
  );
}

function getSearchText(item = {}) {
  return [
    item?.agentName,
    item?.agencyName,
    item?.agentCode,
    item?.genericContact?.phone,
    item?.genericContact?.email,
    item?.engagementSegment,
    item?.cadenceRuleCode,
    item?.ruleCode,
    item?.ruleGroup,
    item?.travelAgentName,
    item?.customerName,
    item?.customerEmail,
    item?.customerMobile,
    item?.leadCode,
    item?.channel,
    item?.lastFollowUpChannel,
    item?.clientReferenceSource,
    item?.type,
    item?.title,
    item?.subject,
    item?.destinationName,
    item?.destinationCode,
    item?.destinationNames?.join?.(" "),
    item?.destinationIds?.join?.(" "),
    item?.assignedToName,
    item?.assignedToEmail,
    item?.createdByName,
    item?.createdBy,
    item?.remarks,
    item?.note,
    item?.message,
    item?.messageText,
    item?.outcomeLabel,
    item?.outcomeCode,
    item?.lastFollowUpSummary,
    item?.lastActivitySummary
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/* =========================
   ADMIN DASHBOARD HELPERS
========================= */

const OPEN_TASK_STATUSES = new Set([
  "pending",
  "overdue",
  "open",
  "scheduled"
]);

const CLOSED_TASK_STATUSES = new Set([
  "completed",
  "skipped",
  "cancelled",
  "canceled"
]);

function normalizeStatus(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getTaskStatus(task = {}) {
  return normalizeStatus(
    task?.status ||
    task?.completionStatus ||
    "pending"
  );
}

function isOpenEngagementTask(task = {}) {
  if (isDeletedRecord(task)) {
    return false;
  }

  const status = getTaskStatus(task);

  return (
    OPEN_TASK_STATUSES.has(status) ||
    !CLOSED_TASK_STATUSES.has(status)
  );
}

function getTaskDueAt(task = {}) {
  return (
    task?.dueAt ||
    task?.nextEngagementAt ||
    task?.scheduledAt ||
    null
  );
}

function getTaskBucket(task = {}) {
  const dueAt = getTaskDueAt(task);

  if (!toDate(dueAt)) {
    return "upcoming";
  }

  if (isOverdueDate(dueAt)) {
    return "overdue";
  }

  if (isTodayDate(dueAt)) {
    return "today";
  }

  return "upcoming";
}

function getTaskPriorityLabel(task = {}) {
  const priority = Number(
    task?.priority || 0
  );

  if (priority >= 95) {
    return "Critical";
  }

  if (priority >= 85) {
    return "High";
  }

  if (priority >= 60) {
    return "Medium";
  }

  return "Normal";
}

function getTaskTitle(task = {}) {
  return (
    task?.title ||
    task?.purpose ||
    String(
      task?.ruleCode ||
      "Agent follow-up"
    )
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        value => value.toUpperCase()
      )
  );
}

function getAgentKey(item = {}) {
  return (
    item?.agentId ||
    item?.travelAgentId ||
    getAgentName(item)
  );
}

function getAgentCreatedDate(agent = {}) {
  return (
    agent?.createdAt ||
    agent?.addedAt ||
    agent?.createdOn ||
    agent?.created_at ||
    agent?.registeredAt ||
    null
  );
}

function getAgentIdentityKeys(agent = {}) {
  return [
    agent?.id,
    agent?.agentId,
    agent?.travelAgentId,
    agent?.agencyId,
    getAgentName(agent)
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function getLeadActivityDate(lead = {}) {
  return (
    lead?.convertedAt ||
    lead?.wonAt ||
    lead?.paymentReceivedAt ||
    lead?.quoteSentAt ||
    lead?.quotationSentAt ||
    lead?.lastQuotationSentAt ||
    lead?.stageChangedAt ||
    lead?.updatedAt ||
    lead?.createdAt ||
    null
  );
}

function isSuccessfulConnection(item = {}) {
  return isSuccessfulEngagementConnection(item);
}

function isHotLead(lead = {}) {
  return [
    "hot_lead",
    "hot",
    "priority_hot"
  ].includes(getLeadStage(lead));
}

function isPaymentPendingLead(lead = {}) {
  return [
    "payment_pending",
    "payment_due",
    "awaiting_payment"
  ].includes(getLeadStage(lead));
}

function isRevisionPendingLead(lead = {}) {
  return [
    "revision_required",
    "revision_pending",
    "revised_quote_pending",
    "revision_requested"
  ].includes(getLeadStage(lead));
}

function isQuoteSentLead(lead = {}) {
  return [
    "quote_sent",
    "quotation_sent",
    "final_quote_sent",
    "revised_quote_sent"
  ].includes(getLeadStage(lead));
}

function isActiveQueryLead(lead = {}) {
  const stage = getLeadStage(lead);

  return ![
    "converted",
    "won",
    "deal_won",
    "lost",
    "closed",
    "cancelled",
    "canceled"
  ].includes(stage);
}

function getPrimarySpoc(agent = {}) {
  if (
    !Array.isArray(agent?.spocs) ||
    !agent.spocs.length
  ) {
    return null;
  }

  return (
    agent.spocs.find(
      item => item?.isPrimary
    ) ||
    agent.spocs[0] ||
    null
  );
}

function hasAgentPhone(agent = {}) {
  const spoc = getPrimarySpoc(agent);

  return Boolean(
    spoc?.mobile ||
    spoc?.phone ||
    agent?.genericContact?.phone ||
    agent?.mobile ||
    agent?.phone
  );
}

function hasAgentEmail(agent = {}) {
  const spoc = getPrimarySpoc(agent);

  return Boolean(
    spoc?.email ||
    agent?.genericContact?.email ||
    agent?.email
  );
}

function getOperationalIdentity(item = {}, userLookup) {
  return resolveDirectoryIdentity(
    {
      uid:
        item?.performedByUid ||
        item?.loggedByUid ||
        item?.createdByUid ||
        item?.createdByUserId ||
        item?.userUid ||
        item?.employeeUid ||
        item?.assignedToUid ||
        "",
      email:
        item?.performedByEmail ||
        item?.loggedByEmail ||
        item?.createdByEmail ||
        item?.userEmail ||
        item?.employeeEmail ||
        item?.assignedToEmail ||
        "",
      name:
        item?.performedByName ||
        item?.loggedByName ||
        item?.createdByName ||
        item?.userName ||
        item?.employeeName ||
        item?.assignedToName ||
        ""
    },
    userLookup
  );
}

function getCreatorIdentity(item = {}, userLookup) {
  return resolveDirectoryIdentity(
    {
      uid: item?.createdByUid || item?.creatorUid || item?.createdByUserId || item?.ownerUid || "",
      email: item?.createdByEmail || item?.creatorEmail || item?.ownerEmail || "",
      name: item?.createdByName || item?.creatorName || item?.createdByUserName || item?.ownerName || ""
    },
    userLookup
  );
}

function matchesAssignedFilter(item = {}, assignedTo = "all", userLookup) {
  if (assignedTo === "all") return true;
  return getOperationalIdentity(item, userLookup).key === assignedTo;
}

function matchesTeamFilter(item = {}, team = "all", userLookup, identityGetter = getOperationalIdentity) {
  if (!team || team === "all") return true;
  const identity = identityGetter(item, userLookup);
  return !identity?.isUnmapped && teamMatchesScope(identity?.team, team);
}

function getAssignedIdentity(item = {}, userLookup) {
  return resolveDirectoryIdentity(
    {
      uid:
        item?.assignedToUid ||
        item?.assignedUserUid ||
        item?.assigneeUid ||
        item?.ownerUid ||
        "",
      email:
        item?.assignedToEmail ||
        item?.assignedUserEmail ||
        item?.assigneeEmail ||
        item?.ownerEmail ||
        "",
      name:
        item?.assignedToName ||
        item?.assignedUserName ||
        item?.assigneeName ||
        item?.ownerName ||
        ""
    },
    userLookup
  );
}

function matchesSearchFilter(
  item = {},
  search = ""
) {
  const value = String(search || "")
    .trim()
    .toLowerCase();

  return (
    !value ||
    getSearchText(item).includes(value)
  );
}

function formatRuleLabel(value = "") {
  return String(
    value || "General follow-up"
  )
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(
      /\b\w/g,
      character => character.toUpperCase()
    );
}

/* =========================
   FOLLOW-UP HELPERS
========================= */

function hasExplicitFollowUpDate(item = {}) {
  return Boolean(
    item?.nextFollowUpAt ||
    item?.nextActionDueAt ||
    item?.followUpDate ||
    item?.nextFollowUpDate ||
    item?.nextActionDate ||
    item?.scheduledAt ||
    item?.reminderAt ||
    item?.dueAt ||
    item?.tentativeMeetingDate ||
    item?.meetingAt ||
    item?.nextFollowUpAtMs ||
    item?.nextActionDueAtMs
  );
}

function getFollowUpDate(item = {}) {
  return (
    item?.nextFollowUpAt ||
    item?.nextActionDueAt ||
    item?.followUpDate ||
    item?.nextFollowUpDate ||
    item?.nextActionDate ||
    item?.scheduledAt ||
    item?.reminderAt ||
    item?.dueAt ||
    item?.tentativeMeetingDate ||
    item?.meetingAt ||
    item?.nextFollowUpAtMs ||
    item?.nextActionDueAtMs ||
    null
  );
}

function isClosedStatus(value = "") {
  return [
    "closed",
    "completed",
    "converted",
    "won",
    "lost",
    "cancelled",
    "canceled",
    "deleted"
  ].includes(
    String(value || "")
      .trim()
      .toLowerCase()
  );
}

function isDoneFollowUpStatus(value = "") {
  return [
    "done",
    "completed",
    "closed",
    "cancelled",
    "canceled",
    "deleted"
  ].includes(
    String(value || "")
      .trim()
      .toLowerCase()
  );
}

function isPendingLeadDocumentFollowUp(
  item = {}
) {
  if (isDeletedRecord(item)) {
    return false;
  }

  const status = String(
    item?.status || ""
  )
    .trim()
    .toLowerCase();

  const stage = String(
    item?.stage || ""
  )
    .trim()
    .toLowerCase();

  const nextActionType = String(
    item?.nextActionType || ""
  )
    .trim()
    .toLowerCase();

  if (isClosedStatus(status)) {
    return false;
  }

  if (
    [
      "converted",
      "lost",
      "closed",
      "cancelled",
      "canceled"
    ].includes(stage)
  ) {
    return false;
  }

  if (
    item?.followUpCompleted === true ||
    item?.followUpDone === true ||
    item?.followUpCompletedAt
  ) {
    return false;
  }

  const followUpStatus = String(
    item?.followUpStatus ||
    item?.followUpState ||
    ""
  ).trim();

  if (
    isDoneFollowUpStatus(
      followUpStatus
    )
  ) {
    return false;
  }

  const hasFollowUpIntent =
    nextActionType === "follow_up" ||
    stage === "follow_up_pending" ||
    Boolean(item?.nextFollowUpAt) ||
    Boolean(item?.nextActionDueAt) ||
    Boolean(item?.followUpDate) ||
    Boolean(item?.nextFollowUpDate);

  return (
    hasFollowUpIntent &&
    hasExplicitFollowUpDate(item)
  );
}

function isPendingEngagementDocumentFollowUp(
  item = {}
) {
  if (isDeletedRecord(item)) {
    return false;
  }

  const requiresFollowUp =
    item?.requiresFollowUp === true ||
    item?.followUpRequired === true ||
    item?.needsFollowUp === true;

  if (!requiresFollowUp) {
    return false;
  }

  if (
    item?.followUpCompleted === true ||
    item?.followUpDone === true ||
    item?.followUpCompletedAt
  ) {
    return false;
  }

  const followUpStatus = String(
    item?.followUpStatus ||
    item?.followUpState ||
    ""
  ).trim();

  if (
    isDoneFollowUpStatus(
      followUpStatus
    )
  ) {
    return false;
  }

  return hasExplicitFollowUpDate(item);
}

function isMissingEngagementFollowUpDate(
  item = {}
) {
  if (isDeletedRecord(item)) {
    return false;
  }

  const requiresFollowUp =
    item?.requiresFollowUp === true ||
    item?.followUpRequired === true ||
    item?.needsFollowUp === true;

  return (
    requiresFollowUp &&
    !hasExplicitFollowUpDate(item)
  );
}

function getFollowUpSummary(
  item = {},
  sourceType = "lead"
) {
  if (sourceType === "lead") {
    return (
      item?.lastFollowUpSummary ||
      item?.lastActivitySummary ||
      item?.stageLabel ||
      item?.nextActionType ||
      "Follow-up pending"
    );
  }

  return (
    item?.messageText ||
    item?.message ||
    item?.customRemark ||
    item?.outcomeLabel ||
    "Engagement follow-up pending"
  );
}

function getFollowUpHref(
  item = {},
  sourceType = "lead"
) {
  if (sourceType === "lead") {
    return `/admin/leads/${item.id}`;
  }

  return `/admin/engagements/${item.id}`;
}

/* =========================
   INTELLIGENCE HELPERS
========================= */

function getLeadStage(lead = {}) {
  return String(
    lead?.stage ||
    lead?.status ||
    ""
  )
    .trim()
    .toLowerCase();
}

function isWonLead(lead = {}) {
  const stage = getLeadStage(lead);

  const status = String(
    lead?.status || ""
  )
    .trim()
    .toLowerCase();

  return (
    [
      "converted",
      "won",
      "deal_won"
    ].includes(stage) ||
    [
      "converted",
      "won"
    ].includes(status)
  );
}

function isQuoteLead(lead = {}) {
  const stage = getLeadStage(lead);

  return [
    "quote_sent",
    "quotation_sent",
    "quote_pending",
    "quotation_pending",
    "payment_pending",
    "converted",
    "won"
  ].includes(stage);
}

function getEngagementOutcome(item = {}) {
  return (
    item?.outcomeLabel ||
    item?.outcomeCode ||
    item?.status ||
    "Unknown"
  );
}

function getTeamKey(item = {}) {
  return (
    item?.assignedToUid ||
    item?.assignedToEmail ||
    item?.createdByUid ||
    item?.createdByEmail ||
    "unassigned"
  );
}

function getTeamName(item = {}) {
  return (
    item?.assignedToName ||
    item?.createdByName ||
    item?.assignedToEmail ||
    item?.createdByEmail ||
    "Unassigned"
  );
}

function getTeamEmail(item = {}) {
  return (
    item?.assignedToEmail ||
    item?.createdByEmail ||
    item?.assignedTo ||
    ""
  );
}

function getInitials(name = "") {
  return (
    String(name || "U")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        part =>
          part[0]?.toUpperCase()
      )
      .join("") ||
    "U"
  );
}

function getLastEngagementAt(items = []) {
  let last = null;

  items.forEach(item => {
    const date = toDate(
      getCreatedDate(item)
    );

    if (
      date &&
      (!last || date > last)
    ) {
      last = date;
    }
  });

  return last;
}

function getDaysSince(value) {
  const date = toDate(value);

  if (!date) return null;

  const today = new Date();

  const difference =
    today.getTime() -
    date.getTime();

  return Math.floor(
    difference /
    (
      1000 *
      60 *
      60 *
      24
    )
  );
}

function getAgentWarmthStatus(
  agentEngagements = [],
  linkedLeads = []
) {
  const lastEngagementAt =
    getLastEngagementAt(
      agentEngagements
    );

  const days = getDaysSince(
    lastEngagementAt
  );

  const hasLead =
    linkedLeads.length > 0;

  const hasFollowUp =
    agentEngagements.some(item =>
      isPendingEngagementDocumentFollowUp(
        item
      )
    );

  if (days === null) {
    return "dormant";
  }

  if (
    days <= 7 &&
    (hasLead || hasFollowUp)
  ) {
    return "hot";
  }

  if (days <= 30) {
    return "warm";
  }

  if (days <= 60) {
    return "cold";
  }

  return "dormant";
}

function getAssetCount(item = {}) {
  return (
    Number(
      item?.assetShareCount || 0
    ) ||
    (
      Array.isArray(
        item?.sharedAssetIds
      )
        ? item.sharedAssetIds.length
        : 0
    ) ||
    (
      Array.isArray(
        item?.sharedAssets
      )
        ? item.sharedAssets.length
        : 0
    ) ||
    0
  );
}

function getAssetTitles(item = {}) {
  const titles = [];

  if (
    Array.isArray(
      item?.sharedAssetTitles
    )
  ) {
    titles.push(
      ...item.sharedAssetTitles.filter(
        Boolean
      )
    );
  }

  if (
    Array.isArray(
      item?.sharedAssets
    )
  ) {
    item.sharedAssets.forEach(
      asset => {
        if (
          typeof asset === "string"
        ) {
          titles.push(asset);
        }

        if (asset?.title) {
          titles.push(asset.title);
        }

        if (asset?.name) {
          titles.push(asset.name);
        }
      }
    );
  }

  return titles;
}

function percent(part, total) {
  if (!total) return 0;

  return Math.round(
    (part / total) * 100
  );
}

/* =========================
   UI COMPONENTS
========================= */

function CommandMetric({
  label,
  value,
  icon: Icon,
  tone = "slate"
}) {
  const tones = {
    slate: "text-slate-200",
    blue: "text-sky-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    red: "text-red-300"
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
        <Icon className="h-4 w-4" />
        {label}
      </div>

      <p
        className={`mt-2 text-2xl font-bold ${tones[tone] ||
          tones.slate
          }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({ label, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
    >
      {label}
      <X size={12} />
    </button>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "slate"
}) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-50 text-slate-700",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700",
    red:
      "border-red-200 bg-red-50 text-red-700"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          {helper ? (
            <p className="mt-2 text-xs text-slate-500">
              {helper}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tones[tone] ||
            tones.slate
            }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue",
  onClick
}) {
  const tones = {
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700"
  };

  const iconTones = {
    blue:
      "bg-blue-100 text-blue-700",
    amber:
      "bg-amber-100 text-amber-700",
    red:
      "bg-red-100 text-red-700",
    violet:
      "bg-violet-100 text-violet-700",
    emerald:
      "bg-emerald-100 text-emerald-700"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tones[tone] ||
        tones.blue
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </p>

          <p className="mt-3 text-3xl font-bold">
            {value}
          </p>

          <p className="mt-3 text-xs font-medium opacity-80">
            {helper}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconTones[tone] ||
            iconTones.blue
            }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </button>
  );
}

function HealthCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue"
}) {
  const tones = {
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700"
  };

  const iconTones = {
    blue:
      "bg-blue-100 text-blue-700",
    emerald:
      "bg-emerald-100 text-emerald-700",
    amber:
      "bg-amber-100 text-amber-700",
    red:
      "bg-red-100 text-red-700",
    violet:
      "bg-violet-100 text-violet-700",
    slate:
      "bg-slate-100 text-slate-700"
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${tones[tone] ||
        tones.blue
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </p>

          <p className="mt-3 text-3xl font-bold">
            {value}
          </p>

          <p className="mt-3 text-xs font-medium opacity-80">
            {helper}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconTones[tone] ||
            iconTones.blue
            }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FunnelCard({
  label,
  value,
  helper,
  percentValue,
  tone = "blue"
}) {
  const tones = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    violet: "bg-violet-600",
    red: "bg-red-600"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold text-slate-900">
          {value}
        </p>

        <p className="text-xs font-semibold text-slate-500">
          {percentValue}%
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tones[tone] ||
            tones.blue
            }`}
          style={{
            width: `${Math.min(
              percentValue,
              100
            )}%`
          }}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  rightContent = null
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {title}
            </h2>

            {description ? (
              <p className="mt-0.5 text-xs text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {rightContent}
      </div>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function SmallRankList({
  items = [],
  emptyText = "No data available."
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items
        .slice(0, 6)
        .map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {item.label}
              </p>

              {item.helper ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {item.helper}
                </p>
              ) : null}
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {item.value}
            </span>
          </div>
        ))}
    </div>
  );
}

function FollowUpStatusBadge({
  overdue
}) {
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
        <AlertTriangle className="h-3 w-3" />
        Overdue
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200">
      <CalendarDays className="h-3 w-3" />
      Today
    </span>
  );
}

function FollowUpItemCard({
  item
}) {
  const overdue = isOverdueDate(
    item.dueAt
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FollowUpStatusBadge
              overdue={overdue}
            />

            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold capitalize text-slate-700">
              {item.sourceType}
            </span>

            {item.channel ? (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold capitalize text-emerald-700 ring-1 ring-emerald-100">
                {item.channel}
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 truncate text-sm font-semibold text-slate-900">
            {item.agentName}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>
              {item.destinationName}
            </span>

            <span>•</span>

            <span>
              {item.assignedToName}
            </span>

            <span>•</span>

            <span>
              {formatDate(
                item.dueAt
              )}
            </span>

            <span>
              {formatTime(
                item.dueAt
              )}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
            {item.summary}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {item.sourceType === "engagement" && item.agentId ? (
            <Link
              href={`/admin/meetings?agentId=${encodeURIComponent(item.agentId)}&engagementId=${encodeURIComponent(item.id)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Meeting
            </Link>
          ) : null}

          <Link
            href={item.href}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            View
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FollowUpQueue({
  title,
  description,
  icon: Icon,
  items,
  emptyText
}) {
  return (
    <SectionCard
      icon={Icon}
      title={title}
      description={description}
      rightContent={
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {items.length} items
        </span>
      }
    >
      {items.length ? (
        <div className="space-y-3">
          {items
            .slice(0, 6)
            .map(item => (
              <FollowUpItemCard
                key={`${item.sourceType}-${item.id}`}
                item={item}
              />
            ))}

          {items.length > 6 ? (
            <p className="text-center text-xs font-medium text-slate-500">
              +{items.length - 6} more follow-ups
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />

          <p className="mt-2 text-sm font-semibold text-slate-900">
            {emptyText}
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function TeamEngagementPerformanceTable({
  rows = []
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">
              Team Member
            </th>

            <th className="px-4 py-3 text-center">
              Engagements
            </th>

            <th className="px-4 py-3 text-center">
              Calls
            </th>

            <th className="px-4 py-3 text-center">
              WhatsApp
            </th>

            <th className="px-4 py-3 text-center">
              Emails
            </th>

            <th className="px-4 py-3 text-center">
              Meetings
            </th>

            <th className="px-4 py-3 text-center">
              Leads
            </th>

            <th className="px-4 py-3 text-center">
              Today
            </th>

            <th className="px-4 py-3 text-center">
              Overdue
            </th>

            <th className="px-4 py-3 text-center">
              Conversion
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length ? (
            rows.map(row => (
              <tr
                key={row.key}
                className="hover:bg-slate-50/70"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      {getInitials(
                        row.name
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {row.email ||
                          "Email not available"}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 text-center font-semibold text-slate-900">
                  {row.engagements}
                </td>

                <td className="px-4 py-4 text-center">
                  {row.calls}
                </td>

                <td className="px-4 py-4 text-center">
                  {row.whatsapp}
                </td>

                <td className="px-4 py-4 text-center">
                  {row.emails}
                </td>

                <td className="px-4 py-4 text-center">
                  {row.meetings}
                </td>

                <td className="px-4 py-4 text-center font-semibold text-blue-700">
                  {row.leads}
                </td>

                <td className="px-4 py-4 text-center font-semibold text-amber-700">
                  {row.todayFollowUps}
                </td>

                <td className="px-4 py-4 text-center font-semibold text-red-700">
                  {row.overdueFollowUps}
                </td>

                <td className="px-4 py-4 text-center font-bold text-emerald-700">
                  {row.conversionRate}%
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={10}
                className="px-4 py-10 text-center text-sm text-slate-500"
              >
                No team performance data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BusinessMetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue"
}) {
  const tones = {
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>

          {helper ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {helper}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tones[tone] ||
            tones.blue
            }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TaskBucketButton({
  active,
  label,
  count,
  onClick,
  tone = "blue"
}) {
  const activeTones = {
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate:
      "border-slate-200 bg-slate-100 text-slate-700"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${active
          ? activeTones[tone] ||
          activeTones.blue
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
    >
      {label}

      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">
        {count}
      </span>
    </button>
  );
}

function TaskStatusBadge({
  task
}) {
  const bucket = getTaskBucket(task);
  const status = getTaskStatus(task);

  if (status === "completed") {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
        Completed
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
        Skipped
      </span>
    );
  }

  if (bucket === "overdue") {
    return (
      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
        Overdue
      </span>
    );
  }

  if (bucket === "today") {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
        Due Today
      </span>
    );
  }

  return (
    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
      Upcoming
    </span>
  );
}

function EngagementTaskQueue({
  tasks = [],
  bucket = "today",
  onBucketChange,
  counts
}) {
  return (
    <SectionCard
      icon={ListChecks}
      title="Engagement Task Queue"
      description="Automatic cadence tasks, lead follow-ups and relationship actions for the full team."
      rightContent={
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {tasks.length} visible
        </span>
      }
    >
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <TaskBucketButton
          label="Today"
          count={counts.today}
          active={bucket === "today"}
          tone="amber"
          onClick={() =>
            onBucketChange("today")
          }
        />

        <TaskBucketButton
          label="Overdue"
          count={counts.overdue}
          active={bucket === "overdue"}
          tone="red"
          onClick={() =>
            onBucketChange("overdue")
          }
        />

        <TaskBucketButton
          label="Upcoming"
          count={counts.upcoming}
          active={bucket === "upcoming"}
          tone="blue"
          onClick={() =>
            onBucketChange("upcoming")
          }
        />

        <TaskBucketButton
          label="Completed in Period"
          count={counts.completedInPeriod}
          active={bucket === "completed"}
          tone="emerald"
          onClick={() =>
            onBucketChange("completed")
          }
        />

        <TaskBucketButton
          label="Skipped"
          count={counts.skipped}
          active={bucket === "skipped"}
          tone="slate"
          onClick={() =>
            onBucketChange("skipped")
          }
        />

        <TaskBucketButton
          label="All Open"
          count={counts.open}
          active={bucket === "all"}
          onClick={() =>
            onBucketChange("all")
          }
        />
      </div>

      {tasks.length ? (
        <div className="space-y-3">
          {tasks
            .slice(0, 12)
            .map(task => (
              <div
                key={task.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TaskStatusBadge
                        task={task}
                      />

                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                        {getTaskPriorityLabel(
                          task
                        )}
                      </span>

                      {task?.sequenceDay !==
                        null &&
                        task?.sequenceDay !==
                        undefined ? (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          New Agent Day{" "}
                          {task.sequenceDay}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-sm font-semibold text-slate-950">
                      {getTaskTitle(task)}
                    </h3>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {getAgentName(task)}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>
                        {formatRuleLabel(
                          task?.ruleCode
                        )}
                      </span>

                      <span>
                        {getAssignedName(
                          task
                        )}
                      </span>

                      <span>
                        {formatDateTime(
                          getTaskDueAt(task)
                        )}
                      </span>

                      {task?.leadCode ? (
                        <span>
                          Lead:{" "}
                          {task.leadCode}
                        </span>
                      ) : null}
                    </div>

                    {task?.purpose ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                        {task.purpose}
                      </p>
                    ) : null}

                    {Array.isArray(
                      task?.recommendedChannels
                    ) &&
                      task.recommendedChannels
                        .length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {task.recommendedChannels.map(
                          item => (
                            <span
                              key={item}
                              className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium capitalize text-slate-600"
                            >
                              {item}
                            </span>
                          )
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {task?.leadId ? (
                      <Link
                        href={`/admin/leads/${task.leadId}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        View Lead

                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}

                    {task?.agentId ? (
                      <Link
                        href={`/admin/travel-agents/${task.agentId}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        View Agent

                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

          {tasks.length > 12 ? (
            <p className="text-center text-xs font-medium text-slate-500">
              +{tasks.length - 12} more
              tasks match this view
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />

          <p className="mt-3 text-sm font-semibold text-slate-900">
            No tasks found in this
            queue.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function ConnectedTeamTable({
  rows = []
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[1240px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">
              Team Member
            </th>

            <th className="px-4 py-3 text-center">
              New Called
            </th>

            <th className="px-4 py-3 text-center">
              New Connected
            </th>

            <th className="px-4 py-3 text-center">
              Existing Contacted
            </th>

            <th className="px-4 py-3 text-center">
              Unique Contacted
            </th>

            <th className="px-4 py-3 text-center">
              Calls
            </th>

            <th className="px-4 py-3 text-center">
              Meetings
            </th>

            <th className="px-4 py-3 text-center">
              Invalid No.
            </th>

            <th className="px-4 py-3 text-center">
              Business Shut
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length ? (
            rows.map(row => (
              <tr
                key={row.key}
                className="hover:bg-slate-50/70"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                      {getInitials(
                        row.name
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {row.email ||
                          "Email not available"}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 text-center font-bold text-blue-700">
                  {row.newAgentsCalled}
                </td>

                <td className="px-4 py-4 text-center font-bold text-violet-700">
                  {row.newAgentsContacted}
                </td>

                <td className="px-4 py-4 text-center font-bold text-emerald-700">
                  {row.existingAgentsContacted}
                </td>

                <td className="px-4 py-4 text-center font-bold text-blue-700">
                  {row.uniqueAgentsContacted}
                </td>

                <td className="px-4 py-4 text-center font-bold text-slate-800">
                  {row.calls}
                </td>

                <td className="px-4 py-4 text-center font-bold text-slate-800">
                  {row.meetings}
                </td>

                <td className="px-4 py-4 text-center font-bold text-red-600">
                  {row.invalidNumber}
                </td>

                <td className="px-4 py-4 text-center font-bold text-amber-700">
                  {row.businessShutDown}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={9}
                className="px-4 py-10 text-center text-sm text-slate-500"
              >
                No team activity found for the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="space-y-5">
        <div className="h-56 animate-pulse rounded-3xl bg-slate-300" />

        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map(
            item => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl bg-slate-200"
              />
            )
          )}
        </div>
      </div>
    </main>
  );
}

/* =========================
   MAIN PAGE
========================= */

export default function AdminEngagementDashboard() {
  const router = useRouter();

  const {
    user,
    loading,
    error
  } = useAuth("admin");

  const {
    scope,
    teamDirectory,
    userLookup
  } = useAdminScope();

  const [
    engagements,
    setEngagements
  ] = useState([]);

  const [
    leads,
    setLeads
  ] = useState([]);

  const [
    travelAgents,
    setTravelAgents
  ] = useState([]);

  const [
    engagementTasks,
    setEngagementTasks
  ] = useState([]);

  const [
    search,
    setSearch
  ] = useState("");

  const [
    period,
    setPeriod
  ] = useState("30d");

  const [
    fromDate,
    setFromDate
  ] = useState("");

  const [
    toDateValue,
    setToDateValue
  ] = useState("");

  const [
    channel,
    setChannel
  ] = useState("all");

  const [team, setTeam] = useState("all");

  const [
    assignedTo,
    setAssignedTo
  ] = useState("all");

  const [agentSegment, setAgentSegment] = useState("all");
  const [outcome, setOutcome] = useState("all");

  useEffect(() => {
    setPeriod(scope.dateRange || "30d");
    setFromDate(scope.dateFrom || "");
    setToDateValue(scope.dateTo || "");
    setTeam(scope.team || "all");
    setAssignedTo("all");
  }, [scope.dateRange, scope.dateFrom, scope.dateTo, scope.team]);

  const [
    followUpSource,
    setFollowUpSource
  ] = useState("all");

  const [
    taskBucket,
    setTaskBucket
  ] = useState("today");

  /* ================= AUTH ================= */

  useEffect(() => {
    if (
      !loading &&
      error === "ROLE_MISMATCH"
    ) {
      router.replace(
        "/dashboard"
      );
    }

    if (
      !loading &&
      error ===
      "USER_NOT_REGISTERED"
    ) {
      router.replace(
        "/login"
      );
    }
  }, [
    loading,
    error,
    router
  ]);

  /* ================= DATA LOAD ================= */

  useEffect(() => {
    if (!user) return;

    const unsubEngagements =
      onSnapshot(
        collection(
          db,
          "engagements"
        ),
        snapshot => {
          setEngagements(
            snapshot.docs.map(
              engagementDocument => ({
                id:
                  engagementDocument.id,
                ...engagementDocument.data()
              })
            )
          );
        },
        snapshotError => {
          console.error(
            "Engagements load error:",
            snapshotError
          );
        }
      );

    const unsubLeads =
      onSnapshot(
        collection(
          db,
          "leads"
        ),
        snapshot => {
          setLeads(
            snapshot.docs.map(
              leadDocument => ({
                id: leadDocument.id,
                ...leadDocument.data()
              })
            )
          );
        },
        snapshotError => {
          console.error(
            "Leads load error:",
            snapshotError
          );
        }
      );

    const unsubTravelAgents =
      onSnapshot(
        collection(
          db,
          "travelAgents"
        ),
        snapshot => {
          setTravelAgents(
            snapshot.docs.map(
              agentDocument => ({
                id: agentDocument.id,
                ...agentDocument.data()
              })
            )
          );
        },
        snapshotError => {
          console.error(
            "Travel agents load error:",
            snapshotError
          );
        }
      );

    const unsubEngagementTasks =
      onSnapshot(
        collection(
          db,
          "engagementTasks"
        ),
        snapshot => {
          setEngagementTasks(
            snapshot.docs.map(
              taskDocument => ({
                id: taskDocument.id,
                ...taskDocument.data()
              })
            )
          );
        },
        snapshotError => {
          console.error(
            "Engagement tasks load error:",
            snapshotError
          );
        }
      );



    return () => {
      unsubEngagements();
      unsubLeads();
      unsubTravelAgents();
      unsubEngagementTasks();
    };
  }, [user]);

  /* ================= NORMALIZED DATA ================= */

  const activeEngagements =
    useMemo(() => {
      return filterRecordsByAccess(
        engagements.filter(item => !isDeletedRecord(item)),
        user,
        "engagements.view",
        "engagement",
        { userLookup }
      );
    }, [engagements, user, userLookup]);

  const activeLeads =
    useMemo(() => {
      return filterRecordsByAccess(
        leads.filter(item => !isDeletedRecord(item)),
        user,
        "leads.view",
        "lead",
        { userLookup }
      );
    }, [leads, user, userLookup]);

  const activeTravelAgents =
    useMemo(() => {
      return filterRecordsByAccess(
        travelAgents.filter(item => !isDeletedRecord(item)),
        user,
        "travel_agents.view",
        "travel_agent",
        { userLookup }
      );
    }, [travelAgents, user, userLookup]);

  const activeEngagementTasks =
    useMemo(() => {
      return filterRecordsByAccess(
        engagementTasks.filter(item => !isDeletedRecord(item)),
        user,
        "engagements.view",
        "engagement",
        { userLookup }
      );
    }, [engagementTasks, user, userLookup]);


  const assignedOptions = useMemo(() => {
    return getMembersForTeam(teamDirectory, team).map(member => ({
      value: member.key,
      label: member.label,
      email: member.email,
      team: member.team
    }));
  }, [teamDirectory, team]);

  const outcomeOptions = useMemo(() => {
    const values = new Map(
      ENGAGEMENT_OUTCOME_OPTIONS.map(option => [option.key, option.label])
    );

    // Keep legacy outcome values filterable without letting them dictate the
    // primary filter vocabulary.
    activeEngagements.forEach(item => {
      const raw = item?.outcomeCode || item?.outcomeLabel || item?.outcome || "";
      const value = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (!value || values.has(value)) return;
      values.set(value, String(item?.outcomeLabel || raw || value).trim());
    });

    return Array.from(values.entries()).map(([value, label]) => ({ value, label }));
  }, [activeEngagements]);

  const channelOptions = useMemo(() => {
    const preferred = ["call", "whatsapp", "email", "meeting"];
    const seen = new Set(preferred);
    activeEngagements.forEach(item => {
      const value = getChannel(getRecordChannel(item));
      if (value) seen.add(value);
    });
    return [...preferred, ...Array.from(seen).filter(item => !preferred.includes(item)).sort()];
  }, [activeEngagements]);

  const agentRelationshipIndex = useMemo(() => {
    const aliasMap = new Map();

    activeTravelAgents.forEach(agent => {
      const keys = getAgentIdentityKeys(agent);
      const canonicalKey = keys[0] || "";
      if (!canonicalKey) return;

      keys.forEach(key => {
        aliasMap.set(key, canonicalKey);
      });
    });

    const resolveAgentKey = item => {
      const candidates = [
        item?.agentId,
        item?.travelAgentId,
        item?.agencyId,
        item?.travelAgent?.id,
        item?.agent?.id,
        getAgentName(item)
      ]
        .map(value => String(value || "").trim())
        .filter(Boolean);

      for (const candidate of candidates) {
        const canonical = aliasMap.get(candidate);
        if (canonical) return canonical;
      }

      return candidates[0] || "";
    };

    const firstActivityByAgent = new Map();
    const firstActivityByPerformerAgent = new Map();
    const firstCallByAgent = new Map();
    const firstSuccessfulByAgent = new Map();
    const firstCallByPerformerAgent = new Map();
    const firstSuccessfulByPerformerAgent = new Map();
    const engagedAgentKeys = new Set();

    const chronological = activeEngagements
      .map(item => ({
        item,
        date: toDate(getCreatedDate(item)),
        agentKey: resolveAgentKey(item),
        performer: getOperationalIdentity(item, userLookup)
      }))
      .filter(row => row.date && row.agentKey)
      .sort((a, b) => {
        const diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        return String(a.item?.id || "").localeCompare(String(b.item?.id || ""));
      });

    chronological.forEach(row => {
      const { item, date, agentKey, performer } = row;
      const performerKey = performer?.key || "legacy_unmapped";
      const performerAgentKey = `${performerKey}::${agentKey}`;
      const channelValue = getChannel(getRecordChannel(item));

      engagedAgentKeys.add(agentKey);

      if (!firstActivityByAgent.has(agentKey)) {
        firstActivityByAgent.set(agentKey, { item, date, performerKey });
      }

      if (!firstActivityByPerformerAgent.has(performerAgentKey)) {
        firstActivityByPerformerAgent.set(performerAgentKey, { item, date });
      }

      if (channelValue === "call") {
        if (!firstCallByAgent.has(agentKey)) {
          firstCallByAgent.set(agentKey, { item, date, performerKey });
        }

        if (!firstCallByPerformerAgent.has(performerAgentKey)) {
          firstCallByPerformerAgent.set(performerAgentKey, { item, date });
        }
      }

      if (channelValue === "call" && isSuccessfulConnection(item)) {
        if (!firstSuccessfulByAgent.has(agentKey)) {
          firstSuccessfulByAgent.set(agentKey, { item, date, performerKey });
        }

        if (!firstSuccessfulByPerformerAgent.has(performerAgentKey)) {
          firstSuccessfulByPerformerAgent.set(performerAgentKey, { item, date });
        }
      }
    });

    return {
      aliasMap,
      resolveAgentKey,
      firstActivityByAgent,
      firstActivityByPerformerAgent,
      firstCallByAgent,
      firstSuccessfulByAgent,
      firstCallByPerformerAgent,
      firstSuccessfulByPerformerAgent,
      engagedAgentKeys
    };
  }, [activeTravelAgents, activeEngagements, userLookup]);

  const segmentAgentIds = useMemo(() => {
    const set = new Set();

    activeTravelAgents.forEach(agent => {
      const keys = getAgentIdentityKeys(agent);
      const canonicalKey = keys[0] || "";
      if (!canonicalKey) return;

      const performerAgentKey = assignedTo !== "all"
        ? `${assignedTo}::${canonicalKey}`
        : "";
      const firstActivity = performerAgentKey
        ? agentRelationshipIndex.firstActivityByPerformerAgent.get(performerAgentKey)
        : agentRelationshipIndex.firstActivityByAgent.get(canonicalKey);
      const hasContact = performerAgentKey
        ? Boolean(firstActivity)
        : agentRelationshipIndex.engagedAgentKeys.has(canonicalKey);
      const firstContactInPeriod = firstActivity
        ? isDateInRange(firstActivity.date, period, fromDate, toDateValue)
        : false;
      const firstContactBeforePeriod = firstActivity
        ? isDateBeforeRange(firstActivity.date, period, fromDate, toDateValue)
        : false;
      const status = normalizeTravelAgentStatus(agent.status, agent.active);

      const matches =
        agentSegment === "all" ||
        (agentSegment === "new" && firstContactInPeriod) ||
        (agentSegment === "existing" && firstContactBeforePeriod) ||
        (agentSegment === "never_contacted" && !hasContact) ||
        (agentSegment === "contacted" && hasContact) ||
        (agentSegment === "invalid_closed" &&
          ["invalid_number", "business_shut_down", "wrong_details", "do_not_contact", "blacklisted"].includes(status));

      if (matches) {
        keys.forEach(key => set.add(key));
        set.add(canonicalKey);
      }
    });

    return set;
  }, [
    activeTravelAgents,
    agentRelationshipIndex,
    agentSegment,
    assignedTo,
    period,
    fromDate,
    toDateValue
  ]);

  const filteredEngagements =
    useMemo(() => {
      const searchValue = search
        .trim()
        .toLowerCase();

      return activeEngagements.filter(
        item => {
          const matchesSearch =
            searchValue
              ? getSearchText(
                item
              ).includes(
                searchValue
              )
              : true;

          const matchesChannel =
            channel === "all"
              ? true
              : getChannel(
                getRecordChannel(
                  item
                )
              ) === channel;

          const identity = getOperationalIdentity(item, userLookup);
          const matchesAssigned = assignedTo === "all" || identity.key === assignedTo;
          const matchesTeam =
            team === "all" ||
            (!identity.isUnmapped && teamMatchesScope(identity.team, team));
          const outcomeValue = String(
            item?.outcomeCode || item?.outcomeLabel || item?.outcome || item?.status || ""
          ).trim().toLowerCase().replace(/[\s-]+/g, "_");
          const matchesOutcome = outcome === "all" || outcomeValue === outcome;
          const agentKey = agentRelationshipIndex.resolveAgentKey(item);
          const matchesSegment =
            agentSegment === "all" ||
            (agentKey && segmentAgentIds.has(agentKey));

          const matchesDate =
            isDateInRange(
              getCreatedDate(item),
              period,
              fromDate,
              toDateValue
            );

          return (
            matchesSearch &&
            matchesChannel &&
            matchesAssigned &&
            matchesTeam &&
            matchesOutcome &&
            matchesSegment &&
            matchesDate
          );
        }
      );
    }, [
      activeEngagements,
      search,
      channel,
      assignedTo,
      team,
      outcome,
      agentSegment,
      segmentAgentIds,
      agentRelationshipIndex,
      userLookup,
      period,
      fromDate,
      toDateValue
    ]);
  const filteredLeads = useMemo(() => {
    return activeLeads.filter(item => {
      const creator = getCreatorIdentity(item, userLookup);
      const matchesTeam =
        team === "all" ||
        (!creator.isUnmapped && teamMatchesScope(creator.team, team));
      const matchesDate = isDateInRange(
        getCreatedDate(item),
        period,
        fromDate,
        toDateValue
      );

      return matchesTeam && matchesDate;
    });
  }, [activeLeads, team, userLookup, period, fromDate, toDateValue]);

  const filteredTravelAgents = useMemo(() => {
    return activeTravelAgents.filter(agent => {
      if (!matchesSearchFilter(agent, search)) return false;

      const creator = getCreatorIdentity(agent, userLookup);
      if (team !== "all" && (creator.isUnmapped || !teamMatchesScope(creator.team, team))) {
        return false;
      }

      const matchesSegment =
        agentSegment === "all" ||
        getAgentIdentityKeys(agent).some(key => segmentAgentIds.has(key));

      return matchesSegment;
    });
  }, [
    activeTravelAgents,
    search,
    team,
    agentSegment,
    segmentAgentIds,
    userLookup
  ]);

  const filteredEngagementTasks =
    useMemo(() => {
      return activeEngagementTasks.filter(
        task => {
          const matchesChannel =
            channel === "all" ||
            (
              Array.isArray(
                task?.recommendedChannels
              ) &&
              task.recommendedChannels
                .map(getChannel)
                .includes(channel)
            );

          const identity = getOperationalIdentity(task, userLookup);
          const matchesTeam =
            team === "all" ||
            (!identity.isUnmapped && teamMatchesScope(identity.team, team));
          const agentKey = agentRelationshipIndex.resolveAgentKey(task);
          const matchesSegment =
            agentSegment === "all" ||
            (agentKey && segmentAgentIds.has(agentKey));

          return (
            matchesSearchFilter(task, search) &&
            matchesAssignedFilter(task, assignedTo, userLookup) &&
            matchesTeam &&
            matchesSegment &&
            matchesChannel
          );
        }
      );
    }, [
      activeEngagementTasks,
      search,
      assignedTo,
      team,
      channel,
      agentSegment,
      segmentAgentIds,
      agentRelationshipIndex,
      userLookup
    ]);

  const taskMetrics = useMemo(() => {
    const openTasks =
      filteredEngagementTasks.filter(
        isOpenEngagementTask
      );

    return {
      open: openTasks.length,

      today: openTasks.filter(
        item =>
          getTaskBucket(item) ===
          "today"
      ).length,

      overdue: openTasks.filter(
        item =>
          getTaskBucket(item) ===
          "overdue"
      ).length,

      upcoming: openTasks.filter(
        item =>
          getTaskBucket(item) ===
          "upcoming"
      ).length,

      completedInPeriod:
        filteredEngagementTasks.filter(
          item => {
            return (
              getTaskStatus(item) === "completed" &&
              isDateInRange(item?.completedAt, period, fromDate, toDateValue)
            );
          }
        ).length,

      skipped:
        filteredEngagementTasks.filter(
          item =>
            getTaskStatus(item) ===
            "skipped"
        ).length
    };
  }, [filteredEngagementTasks, period, fromDate, toDateValue]);

  const visibleTaskQueue =
    useMemo(() => {
      const rows =
        filteredEngagementTasks.filter(
          task => {
            const status =
              getTaskStatus(task);

            if (taskBucket === "completed") {
              return (
                status === "completed" &&
                isDateInRange(task?.completedAt, period, fromDate, toDateValue)
              );
            }

            if (
              taskBucket === "skipped"
            ) {
              return (
                status === "skipped"
              );
            }

            if (
              taskBucket === "all"
            ) {
              return isOpenEngagementTask(
                task
              );
            }

            return (
              isOpenEngagementTask(
                task
              ) &&
              getTaskBucket(task) ===
              taskBucket
            );
          }
        );

      return rows.sort((a, b) => {
        const aDate =
          toDate(
            getTaskDueAt(a)
          )?.getTime() ||
          Number.MAX_SAFE_INTEGER;

        const bDate =
          toDate(
            getTaskDueAt(b)
          )?.getTime() ||
          Number.MAX_SAFE_INTEGER;

        if (aDate !== bDate) {
          return aDate - bDate;
        }

        return (
          Number(
            b?.priority || 0
          ) -
          Number(
            a?.priority || 0
          )
        );
      });
    }, [
      filteredEngagementTasks,
      taskBucket,
      period,
      fromDate,
      toDateValue
    ]);

  const connectionIntelligence = useMemo(() => {
    // Relationship definition:
    // - New Agent Called = this performer is calling the Travel Agent for the
    //   first time in the selected period. The agent may have existed in the
    //   CRM for months before that first call.
    // - New Agent Connected = this performer's first successful connection
    //   with the Travel Agent happened in the selected period.
    // - Existing Agent Contacted = the performer had already connected
    //   successfully with that Travel Agent before the selected period.
    // This mirrors the Team Engagement dashboard instead of using the Travel
    // Agent profile creation date as the relationship definition.
    const companyConnectedAgentIds = new Set();
    const companyNewCalledAgentIds = new Set();
    const companyNewConnectedAgentIds = new Set();
    const companyExistingConnectedAgentIds = new Set();
    const companyInvalidAgentIds = new Set();
    const companyBusinessShutAgentIds = new Set();
    const companyWrongDetailsAgentIds = new Set();
    const teamMap = new Map();

    const ensureTeamRow = identity => {
      const teamKey = identity?.key || "legacy_unmapped";
      if (!teamMap.has(teamKey)) {
        teamMap.set(teamKey, {
          key: teamKey,
          name: identity?.name || "Legacy / Unmapped",
          email: identity?.email || "",
          isUnmapped: Boolean(identity?.isUnmapped),
          connectedAgentIds: new Set(),
          newCalledAgentIds: new Set(),
          newConnectedAgentIds: new Set(),
          existingConnectedAgentIds: new Set(),
          invalidAgentIds: new Set(),
          businessShutAgentIds: new Set(),
          calls: 0,
          meetings: 0
        });
      }
      return teamMap.get(teamKey);
    };

    filteredEngagements.forEach(item => {
      const identity = getOperationalIdentity(item, userLookup);
      const row = ensureTeamRow(identity);
      const performerKey = identity?.key || "legacy_unmapped";
      const agentKey = agentRelationshipIndex.resolveAgentKey(item);
      const performerAgentKey = agentKey ? `${performerKey}::${agentKey}` : "";
      const recordChannel = getChannel(getRecordChannel(item));
      const outcomeValue = String(
        item?.outcomeCode || item?.outcomeLabel || item?.outcome || item?.status || ""
      ).trim().toLowerCase().replace(/[\s-]+/g, "_");

      if (recordChannel === "call") row.calls += 1;
      if (recordChannel === "meeting") row.meetings += 1;

      if (agentKey && recordChannel === "call" && performerAgentKey) {
        const firstCall = agentRelationshipIndex.firstCallByPerformerAgent.get(performerAgentKey);
        if (
          firstCall &&
          isDateInRange(firstCall.date, period, fromDate, toDateValue)
        ) {
          companyNewCalledAgentIds.add(agentKey);
          row.newCalledAgentIds.add(agentKey);
        }
      }

      if (agentKey && outcomeValue === "invalid_number") {
        row.invalidAgentIds.add(agentKey);
        companyInvalidAgentIds.add(agentKey);
      }
      if (agentKey && ["business_shut_down", "not_in_business"].includes(outcomeValue)) {
        row.businessShutAgentIds.add(agentKey);
        companyBusinessShutAgentIds.add(agentKey);
      }
      if (agentKey && outcomeValue === "wrong_details") {
        companyWrongDetailsAgentIds.add(agentKey);
      }

      if (
        !agentKey ||
        recordChannel !== "call" ||
        !isSuccessfulConnection(item)
      ) return;

      companyConnectedAgentIds.add(agentKey);
      row.connectedAgentIds.add(agentKey);

      const firstSuccessful = performerAgentKey
        ? agentRelationshipIndex.firstSuccessfulByPerformerAgent.get(performerAgentKey)
        : null;

      if (
        firstSuccessful &&
        isDateInRange(firstSuccessful.date, period, fromDate, toDateValue)
      ) {
        companyNewConnectedAgentIds.add(agentKey);
        row.newConnectedAgentIds.add(agentKey);
      } else if (
        firstSuccessful &&
        isDateBeforeRange(firstSuccessful.date, period, fromDate, toDateValue)
      ) {
        companyExistingConnectedAgentIds.add(agentKey);
        row.existingConnectedAgentIds.add(agentKey);
      }
    });

    // If the same agent is a first-time relationship for one selected team
    // member but a repeat relationship for another, the company snapshot
    // prioritizes New for that period so the same agent is not presented in
    // both company-level buckets. Team rows retain each member's own history.
    companyNewConnectedAgentIds.forEach(agentKey => {
      companyExistingConnectedAgentIds.delete(agentKey);
    });

    const teamRows = Array.from(teamMap.values())
      .map(row => ({
        key: row.key,
        name: row.name,
        email: row.email,
        isUnmapped: row.isUnmapped,
        newAgentsCalled: row.newCalledAgentIds.size,
        newAgentsContacted: row.newConnectedAgentIds.size,
        existingAgentsContacted: row.existingConnectedAgentIds.size,
        uniqueAgentsContacted: row.connectedAgentIds.size,
        calls: row.calls,
        meetings: row.meetings,
        invalidNumber: row.invalidAgentIds.size,
        businessShutDown: row.businessShutAgentIds.size
      }))
      .filter(row =>
        row.uniqueAgentsContacted > 0 ||
        row.calls > 0 ||
        row.meetings > 0 ||
        row.invalidNumber > 0 ||
        row.businessShutDown > 0
      )
      .sort((a, b) =>
        b.newAgentsContacted - a.newAgentsContacted ||
        b.uniqueAgentsContacted - a.uniqueAgentsContacted ||
        b.calls - a.calls ||
        a.name.localeCompare(b.name)
      );

    return {
      newAgentsCalled: companyNewCalledAgentIds.size,
      newAgentsConnected: companyNewConnectedAgentIds.size,
      totalAgentsConnected: companyConnectedAgentIds.size,
      existingAgentsConnected: companyExistingConnectedAgentIds.size,
      invalidNumber: companyInvalidAgentIds.size,
      businessShutDown: companyBusinessShutAgentIds.size,
      wrongDetails: companyWrongDetailsAgentIds.size,
      teamRows
    };
  }, [
    filteredEngagements,
    agentRelationshipIndex,
    period,
    fromDate,
    toDateValue,
    userLookup
  ]);

  const engagementActivitySummary = useMemo(() => {
    const summary = {
      calls: 0,
      whatsapp: 0,
      emails: 0,
      meetings: 0
    };

    filteredEngagements.forEach(item => {
      const recordChannel = getChannel(getRecordChannel(item));
      if (recordChannel === "call") summary.calls += 1;
      else if (recordChannel === "whatsapp") summary.whatsapp += 1;
      else if (recordChannel === "email") summary.emails += 1;
      else if (recordChannel === "meeting") summary.meetings += 1;
    });

    return summary;
  }, [filteredEngagements]);


  const businessPulse = useMemo(() => {
    // Business snapshot follows the GLOBAL reporting scope only. Page-specific
    // engagement filters (performer/channel/outcome/agent segment/search) must
    // not silently change lead/revenue counters because those filters describe
    // outreach activity, not lead ownership.
    const teamScopedLeads = activeLeads.filter(lead => {
      const creator = getCreatorIdentity(lead, userLookup);
      return (
        team === "all" ||
        (!creator.isUnmapped && teamMatchesScope(creator.team, team))
      );
    });

    const periodLeads = teamScopedLeads.filter(lead =>
      isDateInRange(getCreatedDate(lead), period, fromDate, toDateValue)
    );

    const periodAgents = activeTravelAgents.filter(agent => {
      const creator = getCreatorIdentity(agent, userLookup);
      const matchesTeam =
        team === "all" ||
        (!creator.isUnmapped && teamMatchesScope(creator.team, team));
      return matchesTeam && isDateInRange(getAgentCreatedDate(agent), period, fromDate, toDateValue);
    });

    return {
      newAgentProfiles: periodAgents.length,
      queriesReceived: periodLeads.length,
      quotesShared: teamScopedLeads.filter(lead =>
        isQuoteSentLead(lead) &&
        isDateInRange(getLeadActivityDate(lead), period, fromDate, toDateValue)
      ).length,
      converted: teamScopedLeads.filter(lead =>
        isWonLead(lead) &&
        isDateInRange(getLeadActivityDate(lead), period, fromDate, toDateValue)
      ).length,
      activeQueries: periodLeads.filter(isActiveQueryLead).length,
      hotLeads: periodLeads.filter(isHotLead).length,
      paymentPending: periodLeads.filter(isPaymentPendingLead).length,
      revisionPending: periodLeads.filter(isRevisionPendingLead).length,
      quoteSent: periodLeads.filter(isQuoteSentLead).length
    };
  }, [
    activeLeads,
    activeTravelAgents,
    team,
    userLookup,
    period,
    fromDate,
    toDateValue
  ]);

  const agentPortfolio =
    useMemo(() => {
      const segmentCount =
        value => {
          return filteredTravelAgents.filter(
            agent => {
              return (
                normalizeStatus(
                  agent?.engagementSegment ||
                  agent?.relationshipStage ||
                  agent?.lifecycleStatus
                ) === value
              );
            }
          ).length;
        };

      return {
        total:
          filteredTravelAgents.length,

        newAgents:
          segmentCount(
            "new_agent"
          ),

        regular:
          segmentCount(
            "regular_business"
          ),

        warm:
          segmentCount(
            "warm_irregular"
          ),

        inactive:
          segmentCount(
            "inactive"
          ),

        cold:
          segmentCount(
            "cold"
          )
      };
    }, [filteredTravelAgents]);

  const newAgentOnboarding =
    useMemo(() => {
      const rows =
        filteredTravelAgents.filter(
          agent => {
            return (
              normalizeStatus(
                agent?.engagementSegment
              ) === "new_agent" &&
              agent?.newAgentSequenceActive !==
              false
            );
          }
        );

      const byDay =
        new Map();

      rows.forEach(agent => {
        const day =
          agent?.newAgentSequenceDay;

        const label =
          day === null ||
            day === undefined
            ? "Not Started"
            : `Day ${day}`;

        byDay.set(
          label,
          (
            byDay.get(label) || 0
          ) + 1
        );
      });

      return {
        total: rows.length,

        rows: Array.from(
          byDay.entries()
        )
          .map(
            ([
              label,
              value
            ]) => ({
              label,
              value
            })
          )
          .sort(
            (a, b) =>
              b.value - a.value
          )
      };
    }, [filteredTravelAgents]);

  const dataQuality =
    useMemo(() => {
      return {
        missingPrimarySpoc:
          filteredTravelAgents.filter(
            agent =>
              !getPrimarySpoc(
                agent
              )
          ).length,

        missingPhone:
          filteredTravelAgents.filter(
            agent =>
              !hasAgentPhone(
                agent
              )
          ).length,

        missingEmail:
          filteredTravelAgents.filter(
            agent =>
              !hasAgentEmail(
                agent
              )
          ).length,

        unassigned:
          filteredTravelAgents.filter(
            agent =>
              getAssignedKey(
                agent
              ) === "unassigned"
          ).length,

        cadenceDisabled:
          filteredTravelAgents.filter(
            agent =>
              agent?.cadenceAutoManaged ===
              false
          ).length,

        missingNextTask:
          filteredTravelAgents.filter(
            agent => {
              return (
                agent?.cadenceAutoManaged !==
                false &&
                !agent?.nextEngagementTaskId
              );
            }
          ).length,

        invalidNumberStatus:
          filteredTravelAgents.filter(
            agent =>
              normalizeTravelAgentStatus(agent?.status || agent?.agentStatus, agent?.active) ===
              "invalid_number"
          ).length,

        businessShutDownStatus:
          filteredTravelAgents.filter(
            agent =>
              normalizeTravelAgentStatus(agent?.status || agent?.agentStatus, agent?.active) ===
              "business_shut_down"
          ).length
      };
    }, [filteredTravelAgents]);

  const followUpItems =
    useMemo(() => {
      const leadItems =
        activeLeads
          .filter(item =>
            isPendingLeadDocumentFollowUp(
              item
            )
          )
          .map(item => {
            const dueAt =
              getFollowUpDate(item);

            return {
              id: item.id,
              sourceType: "lead",
              agentName:
                getAgentName(item),
              destinationName:
                getDestinationName(
                  item
                ),
              assignedToName:
                getAssignedName(
                  item
                ),
              assignedKey:
                getAssignedKey(
                  item
                ),
              assignedIdentity:
                getAssignedIdentity(
                  item,
                  userLookup
                ),
              channel: getChannel(
                getRecordChannel(
                  item
                )
              ),
              dueAt,
              summary:
                getFollowUpSummary(
                  item,
                  "lead"
                ),
              href:
                getFollowUpHref(
                  item,
                  "lead"
                ),
              searchText:
                getSearchText(item)
            };
          });

      const engagementItems =
        activeEngagements
          .filter(item =>
            isPendingEngagementDocumentFollowUp(
              item
            )
          )
          .map(item => {
            const dueAt =
              getFollowUpDate(item);

            return {
              id: item.id,
              sourceType:
                "engagement",
              agentId:
                item?.travelAgentId || item?.agentId || item?.agencyId || "",
              agentName:
                getAgentName(item),
              destinationName:
                getDestinationName(
                  item
                ),
              assignedToName:
                getAssignedName(
                  item
                ),
              assignedKey:
                getAssignedKey(
                  item
                ),
              assignedIdentity:
                getAssignedIdentity(
                  item,
                  userLookup
                ),
              channel: getChannel(
                getRecordChannel(
                  item
                )
              ),
              dueAt,
              summary:
                getFollowUpSummary(
                  item,
                  "engagement"
                ),
              href:
                getFollowUpHref(
                  item,
                  "engagement"
                ),
              searchText:
                getSearchText(item)
            };
          });

      return [
        ...leadItems,
        ...engagementItems
      ]
        .filter(item =>
          toDate(item.dueAt)
        )
        .sort((a, b) => {
          const aDate =
            toDate(
              a.dueAt
            )?.getTime() || 0;

          const bDate =
            toDate(
              b.dueAt
            )?.getTime() || 0;

          return aDate - bDate;
        });
    }, [
      activeLeads,
      activeEngagements,
      userLookup
    ]);
  const filteredFollowUpItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return followUpItems.filter(item => {
      const matchesSearch = searchValue
        ? item.searchText.includes(searchValue)
        : true;

      const matchesChannel =
        channel === "all"
          ? true
          : item.channel === channel;

      const matchesAssigned =
        assignedTo === "all"
          ? true
          : item?.assignedIdentity?.key === assignedTo;

      const matchesTeam =
        team === "all"
          ? true
          : String(item?.assignedIdentity?.team || "").trim().toLowerCase() ===
            String(team).trim().toLowerCase();

      const matchesSource =
        followUpSource === "all"
          ? true
          : item.sourceType === followUpSource;

      return (
        matchesSearch &&
        matchesChannel &&
        matchesAssigned &&
        matchesTeam &&
        matchesSource
      );
    });
  }, [
    followUpItems,
    search,
    channel,
    assignedTo,
    team,
    followUpSource
  ]);

  const todaysFollowUpItems = useMemo(() => {
    return filteredFollowUpItems.filter(item =>
      isTodayDate(item.dueAt)
    );
  }, [filteredFollowUpItems]);

  const overdueFollowUpItems = useMemo(() => {
    return filteredFollowUpItems.filter(item =>
      isOverdueDate(item.dueAt)
    );
  }, [filteredFollowUpItems]);

  const metrics = useMemo(() => {
    const agentSet = new Set();
    const destinationSet = new Set();
    const channelMap = {};

    let lastEngagementDate = null;

    filteredEngagements.forEach(item => {
      if (item?.agentId) {
        agentSet.add(item.agentId);
      } else {
        const agentName = getAgentName(item);

        if (
          agentName &&
          agentName !== "Unknown Agent"
        ) {
          agentSet.add(agentName);
        }
      }

      const destinationIds =
        Array.isArray(
          item?.destinationIds
        )
          ? item.destinationIds
          : [];

      const destinationNames =
        Array.isArray(
          item?.destinationNames
        )
          ? item.destinationNames
          : [];

      destinationIds.forEach(id => {
        if (id) {
          destinationSet.add(id);
        }
      });

      destinationNames.forEach(name => {
        if (name) {
          destinationSet.add(name);
        }
      });

      if (item?.destinationName) {
        destinationSet.add(
          item.destinationName
        );
      }

      const itemChannel = getChannel(
        getRecordChannel(item)
      );

      channelMap[itemChannel] =
        (
          channelMap[itemChannel] || 0
        ) + 1;

      const date = toDate(
        getCreatedDate(item)
      );

      if (
        date &&
        (
          !lastEngagementDate ||
          date > lastEngagementDate
        )
      ) {
        lastEngagementDate = date;
      }
    });

    const linkedLeadCount =
      filteredLeads.filter(lead => {
        return (
          lead?.engagementId ||
          lead?.createdFromEngagement ===
          true ||
          String(
            lead?.source || ""
          ).toLowerCase() ===
          "engagement"
        );
      }).length;

    const leadFollowUpsToday =
      todaysFollowUpItems.filter(
        item =>
          item.sourceType === "lead"
      ).length;

    const engagementFollowUpsToday =
      todaysFollowUpItems.filter(
        item =>
          item.sourceType ===
          "engagement"
      ).length;

    const overdueLeadFollowUps =
      overdueFollowUpItems.filter(
        item =>
          item.sourceType === "lead"
      ).length;

    const overdueEngagementFollowUps =
      overdueFollowUpItems.filter(
        item =>
          item.sourceType ===
          "engagement"
      ).length;

    const missingFollowUpDate =
      activeEngagements.filter(item =>
        isMissingEngagementFollowUpDate(
          item
        )
      ).length;

    const assetShareCount =
      filteredEngagements.reduce(
        (sum, item) => {
          return (
            sum +
            getAssetCount(item)
          );
        },
        0
      );

    const engagementsWithAssets =
      filteredEngagements.filter(item => {
        return (
          item?.hasSharedAssets ===
          true ||
          getAssetCount(item) > 0
        );
      }).length;

    return {
      total:
        filteredEngagements.length,

      agents:
        agentSet.size,

      destinations:
        destinationSet.size,

      lastEngagementDate,
      linkedLeadCount,
      leadFollowUpsToday,
      engagementFollowUpsToday,

      todaysFollowUps:
        todaysFollowUpItems.length,

      overdueFollowUps:
        overdueFollowUpItems.length,

      overdueLeadFollowUps,
      overdueEngagementFollowUps,
      missingFollowUpDate,
      assetShareCount,
      engagementsWithAssets,
      channelMap
    };
  }, [
    filteredEngagements,
    filteredLeads,
    activeEngagements,
    todaysFollowUpItems,
    overdueFollowUpItems
  ]);

  const engagementHealth =
    useMemo(() => {
      const followUpRequired =
        filteredEngagements.filter(
          item => {
            return (
              item?.requiresFollowUp ===
              true ||
              item?.followUpRequired ===
              true ||
              item?.needsFollowUp ===
              true
            );
          }
        ).length;

      const noNextAction =
        filteredEngagements.filter(
          item =>
            isMissingEngagementFollowUpDate(
              item
            )
        ).length;

      const overdue =
        filteredEngagements.filter(
          item => {
            return (
              isPendingEngagementDocumentFollowUp(
                item
              ) &&
              isOverdueDate(
                getFollowUpDate(item)
              )
            );
          }
        ).length;

      const noLeadCreated =
        filteredEngagements.filter(
          item => !item?.leadId
        ).length;

      const healthy =
        filteredEngagements.filter(
          item => {
            const requiresFollowUp =
              item?.requiresFollowUp ===
              true ||
              item?.followUpRequired ===
              true ||
              item?.needsFollowUp ===
              true;

            const hasDate =
              hasExplicitFollowUpDate(
                item
              );

            const isOverdue =
              requiresFollowUp &&
              hasDate &&
              isOverdueDate(
                getFollowUpDate(item)
              );

            return (
              !requiresFollowUp &&
              !isOverdue
            );
          }
        ).length;

      return {
        healthy,
        followUpRequired,
        noNextAction,
        overdue,
        noLeadCreated
      };
    }, [filteredEngagements]);

  const conversionFunnel =
    useMemo(() => {
      const totalEngagements =
        filteredEngagements.length;

      const filteredEngagementIds =
        new Set(
          filteredEngagements.map(
            item => item.id
          )
        );

      const filteredAgentIds =
        new Set(
          filteredEngagements
            .map(
              item => item?.agentId
            )
            .filter(Boolean)
        );

      const leadsFromEngagement =
        activeLeads.filter(lead => {
          const linkedEngagementId =
            lead?.engagementId ||
            lead?.sourceEngagementId ||
            "";

          const isEngagementSource =
            Boolean(
              linkedEngagementId
            ) ||
            lead?.createdFromEngagement ===
            true ||
            String(
              lead?.source || ""
            ).toLowerCase() ===
            "engagement";

          if (
            !isEngagementSource
          ) {
            return false;
          }

          if (
            linkedEngagementId &&
            filteredEngagementIds.has(
              linkedEngagementId
            )
          ) {
            return true;
          }

          return Boolean(
            lead?.agentId &&
            filteredAgentIds.has(
              lead.agentId
            )
          );
        });

      const quotedLeads =
        leadsFromEngagement.filter(
          lead =>
            isQuoteLead(lead)
        );

      const convertedLeads =
        leadsFromEngagement.filter(
          lead =>
            isWonLead(lead)
        );

      return {
        totalEngagements,

        leadsCreated:
          leadsFromEngagement.length,

        quotedLeads:
          quotedLeads.length,

        convertedLeads:
          convertedLeads.length,

        leadCreationRate: percent(
          leadsFromEngagement.length,
          totalEngagements
        ),

        quoteRate: percent(
          quotedLeads.length,
          leadsFromEngagement.length
        ),

        conversionRate: percent(
          convertedLeads.length,
          leadsFromEngagement.length
        )
      };
    }, [
      filteredEngagements,
      activeLeads
    ]);

  const agentWarmth =
    useMemo(() => {
      const agentMap =
        new Map();

      activeEngagements.forEach(
        item => {
          const key =
            item?.agentId ||
            getAgentName(item);

          if (!key) return;

          if (
            !agentMap.has(key)
          ) {
            agentMap.set(key, {
              key,
              name:
                getAgentName(item),
              engagements: []
            });
          }

          agentMap
            .get(key)
            .engagements.push(
              item
            );
        }
      );

      const rows =
        Array.from(
          agentMap.values()
        ).map(agent => {
          const linkedLeads =
            activeLeads.filter(
              lead => {
                return (
                  lead?.agentId ===
                  agent.key ||
                  getAgentName(
                    lead
                  ) === agent.name
                );
              }
            );

          const lastEngagementAt =
            getLastEngagementAt(
              agent.engagements
            );

          const status =
            getAgentWarmthStatus(
              agent.engagements,
              linkedLeads
            );

          return {
            ...agent,
            linkedLeads,
            lastEngagementAt,
            status
          };
        });

      return {
        hot: rows.filter(
          item =>
            item.status === "hot"
        ).length,

        warm: rows.filter(
          item =>
            item.status === "warm"
        ).length,

        cold: rows.filter(
          item =>
            item.status === "cold"
        ).length,

        dormant: rows.filter(
          item =>
            item.status ===
            "dormant"
        ).length,

        rows
      };
    }, [
      activeEngagements,
      activeLeads
    ]);

  const outcomePerformance =
    useMemo(() => {
      const map =
        new Map();

      filteredEngagements.forEach(
        item => {
          const label =
            getEngagementOutcome(
              item
            );

          if (
            !map.has(label)
          ) {
            map.set(label, {
              label,
              value: 0
            });
          }

          map.get(label).value += 1;
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.value - a.value
      );
    }, [filteredEngagements]);

  const assetPerformance =
    useMemo(() => {
      const assetMap =
        new Map();

      let engagementsWithAssets =
        0;

      let totalAssetReferences =
        0;

      let leadsAfterAssetShare =
        0;

      filteredEngagements.forEach(
        item => {
          const count =
            getAssetCount(item);

          if (
            count > 0 ||
            item?.hasSharedAssets ===
            true
          ) {
            engagementsWithAssets +=
              1;

            totalAssetReferences +=
              count;

            const hasLead =
              filteredLeads.some(
                lead => {
                  return (
                    lead?.engagementId ===
                    item?.id ||
                    (
                      String(
                        lead?.source ||
                        ""
                      ).toLowerCase() ===
                      "engagement" &&
                      (
                        lead?.agentId ===
                        item?.agentId ||
                        getAgentName(
                          lead
                        ) ===
                        getAgentName(
                          item
                        )
                      )
                    )
                  );
                }
              );

            if (hasLead) {
              leadsAfterAssetShare +=
                1;
            }
          }

          getAssetTitles(
            item
          ).forEach(title => {
            if (
              !assetMap.has(
                title
              )
            ) {
              assetMap.set(
                title,
                {
                  label: title,
                  value: 0
                }
              );
            }

            assetMap.get(
              title
            ).value += 1;
          });
        }
      );

      return {
        engagementsWithAssets,
        totalAssetReferences,
        leadsAfterAssetShare,

        assetLeadRate: percent(
          leadsAfterAssetShare,
          engagementsWithAssets
        ),

        topAssets:
          Array.from(
            assetMap.values()
          ).sort(
            (a, b) =>
              b.value - a.value
          )
      };
    }, [
      filteredEngagements,
      filteredLeads
    ]);

  const teamEngagementRows = useMemo(() => {
    const teamMap = new Map();

    const ensure = identity => {
      const key = identity?.key || "legacy-unmapped";
      if (!teamMap.has(key)) {
        teamMap.set(key, {
          key,
          name: identity?.name || "Legacy / Unmapped",
          email: identity?.email || "",
          team: identity?.team || "",
          isUnmapped: identity?.isUnmapped === true,
          engagements: 0,
          calls: 0,
          whatsapp: 0,
          emails: 0,
          meetings: 0,
          leads: 0,
          todayFollowUps: 0,
          overdueFollowUps: 0
        });
      }
      return teamMap.get(key);
    };

    // Keep every active staff member visible, even with zero activity.
    getMembersForTeam(teamDirectory, team)
      .filter(member => assignedTo === "all" || member.key === assignedTo)
      .forEach(member => ensure({ ...member, isUnmapped: false }));

    filteredEngagements.forEach(item => {
      const row = ensure(getOperationalIdentity(item, userLookup));
      const channelValue = getChannel(getRecordChannel(item));
      row.engagements += 1;
      if (channelValue === "call") row.calls += 1;
      if (channelValue === "whatsapp") row.whatsapp += 1;
      if (channelValue === "email") row.emails += 1;
      if (
        item?.isOfflineMeeting === true ||
        item?.isOnlineMeeting === true ||
        item?.meetingAt ||
        item?.meetingMode ||
        channelValue === "meeting"
      ) row.meetings += 1;

      if (isPendingEngagementDocumentFollowUp(item)) {
        const dueAt = getFollowUpDate(item);
        if (isTodayDate(dueAt)) row.todayFollowUps += 1;
        if (isOverdueDate(dueAt)) row.overdueFollowUps += 1;
      }
    });

    filteredLeads.forEach(lead => {
      const fromEngagement =
        lead?.engagementId ||
        lead?.createdFromEngagement === true ||
        String(lead?.source || "").toLowerCase() === "engagement";
      if (!fromEngagement) return;
      ensure(getOperationalIdentity(lead, userLookup)).leads += 1;
    });

    return Array.from(teamMap.values())
      .map(row => ({
        ...row,
        conversionRate: percent(row.leads, row.engagements)
      }))
      .sort((a, b) => {
        if (a.isUnmapped !== b.isUnmapped) return a.isUnmapped ? 1 : -1;
        if (b.engagements !== a.engagements) return b.engagements - a.engagements;
        return a.name.localeCompare(b.name);
      });
  }, [
    filteredEngagements,
    filteredLeads,
    teamDirectory,
    team,
    assignedTo,
    userLookup
  ]);

  const mostUsedChannel =
    useMemo(() => {
      const entries =
        Object.entries(
          metrics.channelMap || {}
        );

      if (!entries.length) {
        return "—";
      }

      return (
        entries.sort(
          (a, b) =>
            b[1] - a[1]
        )[0]?.[0] ||
        "—"
      );
    }, [metrics.channelMap]);

  function resetFilters() {
    setSearch("");
    setChannel("all");
    setAssignedTo("all");
    setAgentSegment("all");
    setOutcome("all");
    setFollowUpSource("all");
    setTaskBucket("today");
  }

  if (
    loading ||
    user === undefined
  ) {
    return <LoadingState />;
  }

  if (!user) {
    return (
      <main className="min-h-screen p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          Access denied
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1700px] space-y-6">

        {/* COMMAND HEADER */}
        <section className="overflow-hidden rounded-3xl bg-slate-950">
          <div className="px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Admin Engagement Dashboard
                </div>

                <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">
                  Engagement Command Center
                </h1>

                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                  Monitor outreach flow, agent communication, follow-up health,
                  destination interest, asset sharing, team performance, and lead
                  creation from engagement activity in one place.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[640px]">
                <CommandMetric
                  label="Engagements"
                  value={metrics.total}
                  icon={Activity}
                  tone="slate"
                />

                <CommandMetric
                  label="New Agents Reached"
                  value={connectionIntelligence.newAgentsConnected}
                  icon={UserPlus}
                  tone="blue"
                />

                <CommandMetric
                  label="Tasks Today"
                  value={taskMetrics.today}
                  icon={CalendarDays}
                  tone="amber"
                />

                <CommandMetric
                  label="Overdue Tasks"
                  value={taskMetrics.overdue}
                  icon={AlertTriangle}
                  tone={
                    taskMetrics.overdue > 0
                      ? "red"
                      : "emerald"
                  }
                />
              </div>
            </div>

            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="flex items-center gap-2 text-sm text-slate-300">
                  <Filter className="h-4 w-4" />
                  Use quick filters and action cards to instantly narrow down
                  the engagement dashboard.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/admin/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Link>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Clear Page Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <AdminProductivityPulseSummary />

        {/* FILTER PANEL */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Engagement Filters</p>
              <p className="mt-1 text-xs text-slate-500">
                Date = Activity Date. Performer = the Users-table member who logged/performed the activity. Acquisition uses Agent Created By.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {filteredEngagements.length} engagement records in scope
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search agent, destination, lead, remark..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <select
              value={assignedTo}
              onChange={event => setAssignedTo(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Activity Performers</option>
              {assignedOptions.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={agentSegment}
              onChange={event => setAgentSegment(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Agent Segments</option>
              <option value="new">New / First Contact</option>
              <option value="existing">Existing / Repeat Contact</option>
              <option value="never_contacted">Never Contacted</option>
              <option value="contacted">Contacted</option>
              <option value="invalid_closed">Invalid / Closed</option>
            </select>

            <select
              value={channel}
              onChange={event => setChannel(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Channels</option>
              {channelOptions.map(item => (
                <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>
              ))}
            </select>

            <select
              value={outcome}
              onChange={event => setOutcome(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Outcomes</option>
              {outcomeOptions.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

          </div>

          {(search || assignedTo !== "all" || agentSegment !== "all" || channel !== "all" || outcome !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {assignedTo !== "all" && (
                <FilterChip
                  label={`Performer: ${assignedOptions.find(item => item.value === assignedTo)?.label || "Selected"}`}
                  onClear={() => setAssignedTo("all")}
                />
              )}
              {agentSegment !== "all" && <FilterChip label={`Segment: ${agentSegment.replace(/_/g, " ")}`} onClear={() => setAgentSegment("all")} />}
              {channel !== "all" && <FilterChip label={`Channel: ${channel}`} onClear={() => setChannel("all")} />}
              {outcome !== "all" && <FilterChip label={`Outcome: ${outcomeOptions.find(item => item.value === outcome)?.label || outcome}`} onClear={() => setOutcome("all")} />}
              {search && <FilterChip label="Search active" onClear={() => setSearch("")} />}

              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={13} />
                Clear All
              </button>
            </div>
          )}
        </section>

        {/* SELECTED PERIOD BUSINESS SNAPSHOT */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {period === "today" ? "Today's Business Snapshot" : "Selected Period Business Snapshot"}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Business flow is shown as Agent Added → Agent Contacted → Lead Generated → Quote Sent → Converted. Contact metrics use the engagement filters; lead and quotation metrics use the Global Date + Team scope.
              </p>
            </div>

            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Live Admin View
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <BusinessMetricCard
              label="New Agents Added"
              value={businessPulse.newAgentProfiles}
              helper="Travel-agent profiles created in this period."
              icon={BriefcaseBusiness}
              tone="slate"
            />

            <BusinessMetricCard
              label="New Agents Called"
              value={connectionIntelligence.newAgentsCalled}
              helper="Unique agents whose first call by the team member happened in this period."
              icon={PhoneCall}
              tone="blue"
            />

            <BusinessMetricCard
              label="New Agents Connected"
              value={connectionIntelligence.newAgentsConnected}
              helper="Unique agents successfully connected by the team member for the first time in this period."
              icon={UserPlus}
              tone="violet"
            />

            <BusinessMetricCard
              label="Existing Agents Contacted"
              value={connectionIntelligence.existingAgentsConnected}
              helper="Unique agents successfully contacted again after a prior connection."
              icon={UserCheck}
              tone="emerald"
            />

            <BusinessMetricCard
              label="Total Unique Contacted"
              value={connectionIntelligence.totalAgentsConnected}
              helper="Deduplicated unique travel agents reached in this period."
              icon={PhoneCall}
              tone="blue"
            />

            <BusinessMetricCard
              label="Leads Generated"
              value={businessPulse.queriesReceived}
              helper="Lead records created in this period."
              icon={MessageCircle}
              tone="blue"
            />

            <BusinessMetricCard
              label="Quotes Sent"
              value={businessPulse.quotesShared}
              helper="Leads where a quotation was sent in this period."
              icon={FileText}
              tone="amber"
            />

            <BusinessMetricCard
              label="Converted"
              value={businessPulse.converted}
              helper="Leads converted or won in this period."
              icon={CircleDollarSign}
              tone="emerald"
            />
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Activity & Invalid Outcomes
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Activity counts may include repeat touches. Invalid figures are unique affected agents in the selected engagement scope.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              <BusinessMetricCard
                label="Calls Made"
                value={engagementActivitySummary.calls}
                helper="All call activities, including repeat calls."
                icon={PhoneCall}
                tone="blue"
              />

              <BusinessMetricCard
                label="WhatsApp"
                value={engagementActivitySummary.whatsapp}
                helper="WhatsApp engagement activities logged."
                icon={MessageCircle}
                tone="emerald"
              />

              <BusinessMetricCard
                label="Meetings"
                value={engagementActivitySummary.meetings}
                helper="Meeting engagement records logged in this period."
                icon={CalendarClock}
                tone="violet"
              />

              <BusinessMetricCard
                label="Completed Tasks"
                value={taskMetrics.completedInPeriod}
                helper="Cadence tasks completed in this period."
                icon={CheckCircle2}
                tone="emerald"
              />

              <BusinessMetricCard
                label="Invalid Number"
                value={connectionIntelligence.invalidNumber}
                helper="Unique agents marked Invalid Number in this period."
                icon={AlertTriangle}
                tone="red"
              />

              <BusinessMetricCard
                label="Business Shut Down"
                value={connectionIntelligence.businessShutDown}
                helper="Unique agents marked Business Shut Down in this period."
                icon={BriefcaseBusiness}
                tone="amber"
              />

              <BusinessMetricCard
                label="Wrong Details"
                value={connectionIntelligence.wrongDetails}
                helper="Unique agents reported with wrong details in this period."
                icon={AlertTriangle}
                tone="red"
              />
            </div>
          </div>
        </section>

        {/* ACTION CENTER */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Priority Business Action Center
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Focus the team on revenue-critical tasks before routine
              relationship calls.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <ActionCard
              label="Tasks Due Today"
              value={taskMetrics.today}
              helper="Automatic cadence and lead tasks due today."
              icon={CalendarDays}
              tone="blue"
              onClick={() =>
                setTaskBucket("today")
              }
            />

            <ActionCard
              label="Overdue Tasks"
              value={taskMetrics.overdue}
              helper="Pending actions beyond their due date."
              icon={Timer}
              tone="red"
              onClick={() =>
                setTaskBucket("overdue")
              }
            />

            <ActionCard
              label="Payment Pending"
              value={
                businessPulse
                  .paymentPending
              }
              helper="Highest-priority revenue follow-ups."
              icon={CircleDollarSign}
              tone="amber"
              onClick={() => {
                setSearch(
                  "payment pending"
                );

                setTaskBucket("all");
              }}
            />

            <ActionCard
              label="Hot Leads"
              value={
                businessPulse.hotLeads
              }
              helper="Daily call and WhatsApp attention required."
              icon={Flame}
              tone="red"
              onClick={() => {
                setSearch("hot lead");
                setTaskBucket("all");
              }}
            />

            <ActionCard
              label="Revision Pending"
              value={
                businessPulse
                  .revisionPending
              }
              helper="Revised quotation follow-ups pending."
              icon={Workflow}
              tone="violet"
              onClick={() => {
                setSearch("revision");
                setTaskBucket("all");
              }}
            />

            <ActionCard
              label="Active Queries"
              value={
                businessPulse
                  .activeQueries
              }
              helper="Open lead opportunities across the team."
              icon={MessageCircle}
              tone="emerald"
              onClick={() =>
                setFollowUpSource(
                  "lead"
                )
              }
            />
          </div>
        </section>

        {/* TASK QUEUE */}
        <EngagementTaskQueue
          tasks={visibleTaskQueue}
          bucket={taskBucket}
          onBucketChange={
            setTaskBucket
          }
          counts={taskMetrics}
        />

        {/* NEW AGENT CONNECTION INTELLIGENCE */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SectionCard
              icon={UserCheck}
              title={period === "today" ? "Today's Team Agent Activity" : "Team Agent Activity"}
              description="Relationship-based activity. New means the team member is contacting that Travel Agent for the first time, even if the agent profile already existed in the CRM. Existing means the team member had connected with that agent before the selected period."
              rightContent={
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {connectionIntelligence.totalAgentsConnected} company-wide unique
                </span>
              }
            >
              <ConnectedTeamTable
                rows={
                  connectionIntelligence
                    .teamRows
                }
              />
            </SectionCard>
          </div>

          <SectionCard
            icon={UserPlus}
            title="New-Agent Onboarding"
            description="Current Day 0 to Day 10 sequence position."
          >
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Active Sequences
              </p>

              <p className="mt-2 text-3xl font-bold text-violet-800">
                {newAgentOnboarding.total}
              </p>

              <p className="mt-2 text-xs text-violet-700">
                Agents currently moving through the onboarding cadence.
              </p>
            </div>

            <div className="mt-4">
              <SmallRankList
                items={
                  newAgentOnboarding.rows
                }
                emptyText="No active new-agent sequence found."
              />
            </div>
          </SectionCard>
        </section>

        {/* AGENT PORTFOLIO AND DATA QUALITY */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            icon={Users}
            title="Agent Portfolio"
            description="Relationship segments from the travel-agent master."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <HealthCard
                label="Total Agents"
                value={agentPortfolio.total}
                helper="Visible agent profiles."
                icon={Users}
                tone="slate"
              />

              <HealthCard
                label="New Agents"
                value={
                  agentPortfolio
                    .newAgents
                }
                helper="Onboarding cadence."
                icon={UserPlus}
                tone="violet"
              />

              <HealthCard
                label="Regular Business"
                value={
                  agentPortfolio.regular
                }
                helper="High-frequency relationship."
                icon={CheckCircle2}
                tone="emerald"
              />

              <HealthCard
                label="Warm Irregular"
                value={agentPortfolio.warm}
                helper="Weekly campaign and query push."
                icon={Activity}
                tone="blue"
              />

              <HealthCard
                label="Inactive"
                value={
                  agentPortfolio.inactive
                }
                helper="Reactivation required."
                icon={Clock3}
                tone="amber"
              />

              <HealthCard
                label="Cold"
                value={agentPortfolio.cold}
                helper="Low recent response."
                icon={AlertTriangle}
                tone="red"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={AlertTriangle}
            title="Agent Data Quality & Cadence Risks"
            description="Profile gaps that reduce successful calling and automatic task creation."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HealthCard
                label="Invalid Number (Current)"
                value={dataQuality.invalidNumberStatus}
                helper="Travel agents currently marked Invalid Number."
                icon={AlertTriangle}
                tone="red"
              />

              <HealthCard
                label="Business Shut (Current)"
                value={dataQuality.businessShutDownStatus}
                helper="Travel agents currently marked Business Shut Down."
                icon={BriefcaseBusiness}
                tone="red"
              />

              <HealthCard
                label="Missing SPOC"
                value={
                  dataQuality
                    .missingPrimarySpoc
                }
                helper="No primary contact."
                icon={UserCheck}
                tone="red"
              />

              <HealthCard
                label="Missing Phone"
                value={
                  dataQuality.missingPhone
                }
                helper="Cannot call or WhatsApp."
                icon={PhoneCall}
                tone="amber"
              />

              <HealthCard
                label="Missing Email"
                value={
                  dataQuality.missingEmail
                }
                helper="Email communication unavailable."
                icon={MessageCircle}
                tone="amber"
              />

              <HealthCard
                label="Unassigned"
                value={
                  dataQuality.unassigned
                }
                helper="No relationship owner."
                icon={Users}
                tone="violet"
              />

              <HealthCard
                label="Cadence Disabled"
                value={
                  dataQuality
                    .cadenceDisabled
                }
                helper="Automatic follow-up stopped."
                icon={Workflow}
                tone="red"
              />

              <HealthCard
                label="Missing Next Task"
                value={
                  dataQuality
                    .missingNextTask
                }
                helper="Cadence enabled but no task."
                icon={ListChecks}
                tone="red"
              />
            </div>
          </SectionCard>
        </section>

        {/* ENGAGEMENT HEALTH */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Engagement Health
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Understand where engagement attention is needed before agents go
              cold.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <HealthCard
              label="Healthy"
              value={engagementHealth.healthy}
              helper="No pending risk detected."
              icon={CheckCircle2}
              tone="emerald"
            />

            <HealthCard
              label="Follow-up Required"
              value={engagementHealth.followUpRequired}
              helper="Next action expected."
              icon={CalendarDays}
              tone="blue"
            />

            <HealthCard
              label="No Next Action"
              value={engagementHealth.noNextAction}
              helper="Follow-up required but no date."
              icon={AlertTriangle}
              tone="red"
            />

            <HealthCard
              label="Overdue"
              value={engagementHealth.overdue}
              helper="Follow-up date has passed."
              icon={Clock3}
              tone="amber"
            />

            <HealthCard
              label="No Lead Created"
              value={engagementHealth.noLeadCreated}
              helper="Engagements without lead linkage."
              icon={Users}
              tone="violet"
            />
          </div>
        </section>

        {/* CONVERSION FUNNEL */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Engagement Conversion Funnel
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Track how outreach activity converts into leads, quotations, and
              won business.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FunnelCard
              label="Engagements"
              value={conversionFunnel.totalEngagements}
              helper="Total filtered engagement activity."
              percentValue={100}
              tone="blue"
            />

            <FunnelCard
              label="Leads Created"
              value={conversionFunnel.leadsCreated}
              helper={`${conversionFunnel.leadCreationRate}% of engagements created leads.`}
              percentValue={conversionFunnel.leadCreationRate}
              tone="violet"
            />

            <FunnelCard
              label="Quoted Leads"
              value={conversionFunnel.quotedLeads}
              helper={`${conversionFunnel.quoteRate}% of engagement leads moved to quote.`}
              percentValue={conversionFunnel.quoteRate}
              tone="amber"
            />

            <FunnelCard
              label="Converted Leads"
              value={conversionFunnel.convertedLeads}
              helper={`${conversionFunnel.conversionRate}% converted from engagement leads.`}
              percentValue={conversionFunnel.conversionRate}
              tone="emerald"
            />
          </div>
        </section>

        {/* AGENT WARMTH / OUTCOME / ASSET */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SectionCard
            icon={Users}
            title="Agent Warmth"
            description="Relationship temperature based on recent engagement and lead activity."
          >
            <div className="grid grid-cols-2 gap-3">
              <HealthCard
                label="Hot"
                value={agentWarmth.hot}
                helper="Active in 7 days."
                icon={CheckCircle2}
                tone="emerald"
              />

              <HealthCard
                label="Warm"
                value={agentWarmth.warm}
                helper="Active in 30 days."
                icon={Activity}
                tone="blue"
              />

              <HealthCard
                label="Cold"
                value={agentWarmth.cold}
                helper="No recent activity."
                icon={Clock3}
                tone="amber"
              />

              <HealthCard
                label="Dormant"
                value={agentWarmth.dormant}
                helper="60+ days inactive."
                icon={AlertTriangle}
                tone="red"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={BarChart3}
            title="Outcome Performance"
            description="Most common outcomes from logged engagement activity."
          >
            <SmallRankList
              items={outcomePerformance}
              emptyText="No outcome data available."
            />
          </SectionCard>

          <SectionCard
            icon={Share2}
            title="Asset Performance"
            description="Understand whether shared assets are supporting lead creation."
          >
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Asset Share Impact
                </p>

                <p className="mt-2 text-2xl font-bold text-emerald-800">
                  {assetPerformance.assetLeadRate}%
                </p>

                <p className="mt-2 text-xs text-emerald-700">
                  {assetPerformance.leadsAfterAssetShare} leads from{" "}
                  {assetPerformance.engagementsWithAssets} asset-sharing
                  engagements.
                </p>
              </div>

              <SmallRankList
                items={assetPerformance.topAssets}
                emptyText="No shared asset data available."
              />
            </div>
          </SectionCard>
        </section>

        {/* FOLLOW-UP QUEUE */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <FollowUpQueue
            icon={CalendarDays}
            title="Today’s Follow-up Queue"
            description="Follow-ups lined up for today from leads and engagements."
            items={todaysFollowUpItems}
            emptyText="No follow-ups due today."
          />

          <FollowUpQueue
            icon={Timer}
            title="Overdue Follow-up Queue"
            description="Pending follow-ups that crossed their due date."
            items={overdueFollowUpItems}
            emptyText="No overdue follow-ups."
          />
        </section>

        {/* KPI STRIP */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Engagements"
            value={metrics.total}
            helper="Filtered engagement records."
            icon={MessageCircle}
            tone="blue"
          />

          <StatCard
            label="Agents Engaged"
            value={metrics.agents}
            helper="Unique agent coverage."
            icon={Users}
            tone="emerald"
          />

          <StatCard
            label="Destinations"
            value={metrics.destinations}
            helper="Destination interest signals."
            icon={MapPin}
            tone="violet"
          />

          <StatCard
            label="Asset Shares"
            value={metrics.assetShareCount}
            helper="Total assets shared in engagement."
            icon={Share2}
            tone="amber"
          />

          <StatCard
            label="Last Engagement"
            value={formatDate(metrics.lastEngagementDate)}
            helper={formatDateTime(metrics.lastEngagementDate)}
            icon={Clock3}
            tone="slate"
          />
        </section>

        {/* INSIGHT STRIP */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Top Channel
            </p>

            <p className="mt-2 text-lg font-bold capitalize text-slate-900">
              {mostUsedChannel}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Agent Segment
            </p>

            <p className="mt-2 text-lg font-bold capitalize text-slate-900">
              {agentSegment === "all" ? "All Agents" : agentSegment.replace(/_/g, " ")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Activity Performed By
            </p>

            <p className="mt-2 truncate text-lg font-bold text-slate-900">
              {assignedTo === "all"
                ? team === "all" ? "All Activity Performers" : `All Performers - ${getTeamOptionLabel(team)}`
                : assignedOptions.find(item => item.value === assignedTo)?.label || "Selected"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Date Filter
            </p>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {period === "all"
                ? "All time"
                : period === "today"
                  ? "Today"
                  : period === "yesterday"
                    ? "Yesterday"
                    : period === "7d"
                      ? "Last 7 days"
                      : period === "30d"
                        ? "Last 30 days"
                        : period === "thisMonth"
                          ? "This month"
                          : period === "lastMonth"
                            ? "Last month"
                            : "Custom"}
            </p>
          </div>
        </section>

        {/* CHARTS */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            icon={MessageCircle}
            title="Engagement by Channel"
            description="Distribution of outreach activity by communication channel."
          >
            <EngagementByChannelChart engagements={filteredEngagements} />
          </SectionCard>

          <SectionCard
            icon={MapPin}
            title="Engagement by Destination"
            description="Destination-wise engagement visibility and demand signals."
          >
            <EngagementByDestinationChart engagements={filteredEngagements} />
          </SectionCard>
        </section>

        {/* TEAM ENGAGEMENT PERFORMANCE */}
        <SectionCard
          icon={UserCheck}
          title="Team Engagement Performance"
          description="Engagement activity, channel usage, lead creation, and follow-up health by team member."
          rightContent={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {teamEngagementRows.length} members
            </span>
          }
        >
          <TeamEngagementPerformanceTable rows={teamEngagementRows} />
        </SectionCard>

        {/* AGENT VISIBILITY */}
        <SectionCard
          icon={Users}
          title="Agent Engagement Overview"
          description="Agent-wise activity, communication visibility, and lead linkage."
          rightContent={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {filteredEngagements.length} records
            </span>
          }
        >
          <div className="overflow-x-auto">
            <AgentEngagementOverviewTable
              engagements={filteredEngagements}
              leads={filteredLeads}
            />
          </div>
        </SectionCard>
      </div>
    </main>
  );
}