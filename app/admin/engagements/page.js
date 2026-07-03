"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  MapPin,
  MessageCircle,
  RefreshCcw,
  Search,
  Send,
  Share2,
  Timer,
  UserCheck,
  Users
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

/* ENGAGEMENT COMPONENTS */
import EngagementByChannelChart from "@/components/admin/dashboard/engagements/EngagementByChannelChart";
import EngagementByDestinationChart from "@/components/admin/dashboard/engagements/EngagementByDestinationChart";
import AgentEngagementOverviewTable from "@/components/admin/dashboard/engagements/AgentEngagementOverviewTable";

/* =========================
   DATE HELPERS
========================= */

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  if (typeof value === "number") {
    const msValue = value < 10000000000 ? value * 1000 : value;
    const date = new Date(msValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLocalDateKey(value) {
  const date = toDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

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

function getDateRange(period, fromDate, toDateValue) {
  const today = new Date();
  const todayKey = getLocalDateKey(today);

  if (period === "all") {
    return { from: "", to: "" };
  }

  if (period === "custom") {
    return { from: fromDate || "", to: toDateValue || "" };
  }

  if (period === "today") {
    return { from: todayKey, to: todayKey };
  }

  if (period === "yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const key = getLocalDateKey(yesterday);
    return { from: key, to: key };
  }

  if (period === "7d") {
    const start = new Date();
    start.setDate(start.getDate() - 6);

    return {
      from: getLocalDateKey(start),
      to: todayKey
    };
  }

  if (period === "thisMonth") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      from: getLocalDateKey(start),
      to: todayKey
    };
  }

  if (period === "lastMonth") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
      from: getLocalDateKey(start),
      to: getLocalDateKey(end)
    };
  }

  return { from: "", to: "" };
}

function isDateInRange(value, period, fromDate, toDateValue) {
  if (period === "all") return true;

  const dateKey = getLocalDateKey(value);
  if (!dateKey) return false;

  const range = getDateRange(period, fromDate, toDateValue);

  if (range.from && dateKey < range.from) return false;
  if (range.to && dateKey > range.to) return false;

  return true;
}

/* =========================
   DATA HELPERS
========================= */

function isDeletedRecord(item = {}) {
  return item?.isDeleted === true || item?.deleted === true;
}

function getChannel(value = "") {
  return String(value || "other").trim().toLowerCase();
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
  if (item?.destinationName) return item.destinationName;

  if (Array.isArray(item?.destinationNames) && item.destinationNames.length) {
    return item.destinationNames.filter(Boolean).join(", ");
  }

  if (item?.destinationCode) return item.destinationCode;

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
  return item?.createdAt || item?.date || item?.engagementDate || null;
}

function getSearchText(item = {}) {
  return [
    item?.agentName,
    item?.agencyName,
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
  ].includes(String(value || "").trim().toLowerCase());
}

function isDoneFollowUpStatus(value = "") {
  return [
    "done",
    "completed",
    "closed",
    "cancelled",
    "canceled",
    "deleted"
  ].includes(String(value || "").trim().toLowerCase());
}

function isPendingLeadDocumentFollowUp(item = {}) {
  if (isDeletedRecord(item)) return false;

  const status = String(item?.status || "").trim().toLowerCase();
  const stage = String(item?.stage || "").trim().toLowerCase();
  const nextActionType = String(item?.nextActionType || "")
    .trim()
    .toLowerCase();

  if (isClosedStatus(status)) return false;

  if (
    ["converted", "lost", "closed", "cancelled", "canceled"].includes(stage)
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
    item?.followUpStatus || item?.followUpState || ""
  ).trim();

  if (isDoneFollowUpStatus(followUpStatus)) return false;

  const hasFollowUpIntent =
    nextActionType === "follow_up" ||
    stage === "follow_up_pending" ||
    Boolean(item?.nextFollowUpAt) ||
    Boolean(item?.nextActionDueAt) ||
    Boolean(item?.followUpDate) ||
    Boolean(item?.nextFollowUpDate);

  return hasFollowUpIntent && hasExplicitFollowUpDate(item);
}

function isPendingEngagementDocumentFollowUp(item = {}) {
  if (isDeletedRecord(item)) return false;

  const requiresFollowUp =
    item?.requiresFollowUp === true ||
    item?.followUpRequired === true ||
    item?.needsFollowUp === true;

  if (!requiresFollowUp) return false;

  if (
    item?.followUpCompleted === true ||
    item?.followUpDone === true ||
    item?.followUpCompletedAt
  ) {
    return false;
  }

  const followUpStatus = String(
    item?.followUpStatus || item?.followUpState || ""
  ).trim();

  if (isDoneFollowUpStatus(followUpStatus)) return false;

  return hasExplicitFollowUpDate(item);
}

function isMissingEngagementFollowUpDate(item = {}) {
  if (isDeletedRecord(item)) return false;

  const requiresFollowUp =
    item?.requiresFollowUp === true ||
    item?.followUpRequired === true ||
    item?.needsFollowUp === true;

  return requiresFollowUp && !hasExplicitFollowUpDate(item);
}

function getFollowUpSummary(item = {}, sourceType = "lead") {
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

function getFollowUpHref(item = {}, sourceType = "lead") {
  if (sourceType === "lead") return `/admin/leads/${item.id}`;
  return `/admin/engagements/${item.id}`;
}

/* =========================
   INTELLIGENCE HELPERS
========================= */

function getLeadStage(lead = {}) {
  return String(lead?.stage || lead?.status || "").trim().toLowerCase();
}

function isWonLead(lead = {}) {
  const stage = getLeadStage(lead);
  const status = String(lead?.status || "").trim().toLowerCase();

  return (
    ["converted", "won", "deal_won"].includes(stage) ||
    ["converted", "won"].includes(status)
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
  return item?.outcomeLabel || item?.outcomeCode || item?.status || "Unknown";
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
  return item?.assignedToEmail || item?.createdByEmail || item?.assignedTo || "";
}

function getInitials(name = "") {
  return (
    String(name || "U")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function getLastEngagementAt(items = []) {
  let last = null;

  items.forEach(item => {
    const date = toDate(getCreatedDate(item));
    if (date && (!last || date > last)) last = date;
  });

  return last;
}

function getDaysSince(value) {
  const date = toDate(value);
  if (!date) return null;

  const today = new Date();
  const diffMs = today.getTime() - date.getTime();

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getAgentWarmthStatus(agentEngagements = [], linkedLeads = []) {
  const lastEngagementAt = getLastEngagementAt(agentEngagements);
  const days = getDaysSince(lastEngagementAt);

  const hasLead = linkedLeads.length > 0;
  const hasFollowUp = agentEngagements.some(item =>
    isPendingEngagementDocumentFollowUp(item)
  );

  if (days === null) return "dormant";
  if (days <= 7 && (hasLead || hasFollowUp)) return "hot";
  if (days <= 30) return "warm";
  if (days <= 60) return "cold";

  return "dormant";
}

function getAssetCount(item = {}) {
  return (
    Number(item?.assetShareCount || 0) ||
    (Array.isArray(item?.sharedAssetIds) ? item.sharedAssetIds.length : 0) ||
    (Array.isArray(item?.sharedAssets) ? item.sharedAssets.length : 0) ||
    0
  );
}

function getAssetTitles(item = {}) {
  const titles = [];

  if (Array.isArray(item?.sharedAssetTitles)) {
    titles.push(...item.sharedAssetTitles.filter(Boolean));
  }

  if (Array.isArray(item?.sharedAssets)) {
    item.sharedAssets.forEach(asset => {
      if (typeof asset === "string") titles.push(asset);
      if (asset?.title) titles.push(asset.title);
      if (asset?.name) titles.push(asset.name);
    });
  }

  return titles;
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/* =========================
   UI COMPONENTS
========================= */

function CommandMetric({ label, value, icon: Icon, tone = "slate" }) {
  const tones = {
    slate: "text-slate-200",
    blue: "text-sky-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    red: "text-red-300"
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3  backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
        <Icon className="h-4 w-4" />
        {label}
      </div>

      <p className={`mt-2 text-2xl font-bold ${tones[tone] || tones.slate}`}>
        {value}
      </p>
    </div>
  );
}

function QuickDateButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700 "
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, helper, icon: Icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    red: "bg-red-50 text-red-700 border-red-200"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
            tones[tone] || tones.slate
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ActionCard({ label, value, helper, icon: Icon, tone = "blue", onClick }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };

  const iconTones = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        tones[tone] || tones.blue
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
          <p className="mt-3 text-3xl font-bold">{value}</p>
          <p className="mt-3 text-xs font-medium opacity-80">{helper}</p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            iconTones[tone] || iconTones.blue
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </button>
  );
}

function HealthCard({ label, value, helper, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700"
  };

  const iconTones = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.blue}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
          <p className="mt-3 text-3xl font-bold">{value}</p>
          <p className="mt-3 text-xs font-medium opacity-80">{helper}</p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            iconTones[tone] || iconTones.blue
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FunnelCard({ label, value, helper, percentValue, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    violet: "bg-violet-600",
    red: "bg-red-600"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs font-semibold text-slate-500">{percentValue}%</p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tones[tone] || tones.blue}`}
          style={{ width: `${Math.min(percentValue, 100)}%` }}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children, rightContent = null }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white ">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>

            {description ? (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>

        {rightContent}
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
}

function SmallRankList({ items = [], emptyText = "No data available." }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {item.label}
            </p>
            {item.helper ? (
              <p className="mt-0.5 text-xs text-slate-500">{item.helper}</p>
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

function FollowUpStatusBadge({ overdue }) {
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

function FollowUpItemCard({ item }) {
  const overdue = isOverdueDate(item.dueAt);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4  transition hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FollowUpStatusBadge overdue={overdue} />

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
            <span>{item.destinationName}</span>
            <span>•</span>
            <span>{item.assignedToName}</span>
            <span>•</span>
            <span>{formatDate(item.dueAt)}</span>
            <span>{formatTime(item.dueAt)}</span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
            {item.summary}
          </p>
        </div>

        <Link
          href={item.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          View
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function FollowUpQueue({ title, description, icon: Icon, items, emptyText }) {
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
          {items.slice(0, 6).map(item => (
            <FollowUpItemCard key={`${item.sourceType}-${item.id}`} item={item} />
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

function TeamEngagementPerformanceTable({ rows = [] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Team Member</th>
            <th className="px-4 py-3 text-center">Engagements</th>
            <th className="px-4 py-3 text-center">Calls</th>
            <th className="px-4 py-3 text-center">WhatsApp</th>
            <th className="px-4 py-3 text-center">Emails</th>
            <th className="px-4 py-3 text-center">Meetings</th>
            <th className="px-4 py-3 text-center">Leads</th>
            <th className="px-4 py-3 text-center">Today</th>
            <th className="px-4 py-3 text-center">Overdue</th>
            <th className="px-4 py-3 text-center">Conversion</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length ? (
            rows.map(row => (
              <tr key={row.key} className="hover:bg-slate-50/70">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      {getInitials(row.name)}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.email || "Email not available"}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 text-center font-semibold text-slate-900">
                  {row.engagements}
                </td>
                <td className="px-4 py-4 text-center">{row.calls}</td>
                <td className="px-4 py-4 text-center">{row.whatsapp}</td>
                <td className="px-4 py-4 text-center">{row.emails}</td>
                <td className="px-4 py-4 text-center">{row.meetings}</td>
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
              <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                No team performance data available.
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
          {[1, 2, 3, 4, 5].map(item => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
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
  const { user, loading, error } = useAuth("admin");

  const [engagements, setEngagements] = useState([]);
  const [leads, setLeads] = useState([]);

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30d");
  const [fromDate, setFromDate] = useState("");
  const [toDateValue, setToDateValue] = useState("");
  const [channel, setChannel] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [followUpSource, setFollowUpSource] = useState("all");

  /* ================= AUTH ================= */

  useEffect(() => {
    if (!loading && error === "ROLE_MISMATCH") {
      router.replace("/dashboard");
    }

    if (!loading && error === "USER_NOT_REGISTERED") {
      router.replace("/admin/login");
    }
  }, [loading, error, router]);

  /* ================= DATA LOAD ================= */

  useEffect(() => {
    if (!user) return;

    const unsubEngagements = onSnapshot(
      collection(db, "engagements"),
      snap => {
        setEngagements(
          snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        );
      },
      err => {
        console.error("Engagements load error:", err);
      }
    );

    const unsubLeads = onSnapshot(
      collection(db, "leads"),
      snap => {
        setLeads(
          snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        );
      },
      err => {
        console.error("Leads load error:", err);
      }
    );

    return () => {
      unsubEngagements();
      unsubLeads();
    };
  }, [user]);

  /* ================= NORMALIZED DATA ================= */

  const activeEngagements = useMemo(() => {
    return engagements.filter(item => !isDeletedRecord(item));
  }, [engagements]);

  const activeLeads = useMemo(() => {
    return leads.filter(item => !isDeletedRecord(item));
  }, [leads]);

  const assignedOptions = useMemo(() => {
    const map = new Map();

    [...activeEngagements, ...activeLeads].forEach(item => {
      const key = getAssignedKey(item);
      const label = getAssignedName(item);

      if (key && !map.has(key)) {
        map.set(key, label);
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeEngagements, activeLeads]);

  const channelOptions = useMemo(() => {
    const set = new Set();

    [...activeEngagements, ...activeLeads].forEach(item => {
      const value = getChannel(getRecordChannel(item));
      if (value) set.add(value);
    });

    return Array.from(set).sort();
  }, [activeEngagements, activeLeads]);

  const filteredEngagements = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return activeEngagements.filter(item => {
      const matchesSearch = searchValue
        ? getSearchText(item).includes(searchValue)
        : true;

      const matchesChannel =
        channel === "all" ? true : getChannel(getRecordChannel(item)) === channel;

      const matchesAssigned =
        assignedTo === "all" ? true : getAssignedKey(item) === assignedTo;

      const matchesDate = isDateInRange(
        getCreatedDate(item),
        period,
        fromDate,
        toDateValue
      );

      return matchesSearch && matchesChannel && matchesAssigned && matchesDate;
    });
  }, [
    activeEngagements,
    search,
    channel,
    assignedTo,
    period,
    fromDate,
    toDateValue
  ]);

  const filteredLeads = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return activeLeads.filter(item => {
      const matchesSearch = searchValue
        ? getSearchText(item).includes(searchValue)
        : true;

      const matchesChannel =
        channel === "all" ? true : getChannel(getRecordChannel(item)) === channel;

      const matchesAssigned =
        assignedTo === "all" ? true : getAssignedKey(item) === assignedTo;

      const matchesDate = isDateInRange(
        getCreatedDate(item),
        period,
        fromDate,
        toDateValue
      );

      return matchesSearch && matchesChannel && matchesAssigned && matchesDate;
    });
  }, [activeLeads, search, channel, assignedTo, period, fromDate, toDateValue]);

  const followUpItems = useMemo(() => {
    const leadItems = activeLeads
      .filter(item => isPendingLeadDocumentFollowUp(item))
      .map(item => {
        const dueAt = getFollowUpDate(item);

        return {
          id: item.id,
          sourceType: "lead",
          agentName: getAgentName(item),
          destinationName: getDestinationName(item),
          assignedToName: getAssignedName(item),
          assignedKey: getAssignedKey(item),
          channel: getChannel(getRecordChannel(item)),
          dueAt,
          summary: getFollowUpSummary(item, "lead"),
          href: getFollowUpHref(item, "lead"),
          searchText: getSearchText(item)
        };
      });

    const engagementItems = activeEngagements
      .filter(item => isPendingEngagementDocumentFollowUp(item))
      .map(item => {
        const dueAt = getFollowUpDate(item);

        return {
          id: item.id,
          sourceType: "engagement",
          agentName: getAgentName(item),
          destinationName: getDestinationName(item),
          assignedToName: getAssignedName(item),
          assignedKey: getAssignedKey(item),
          channel: getChannel(getRecordChannel(item)),
          dueAt,
          summary: getFollowUpSummary(item, "engagement"),
          href: getFollowUpHref(item, "engagement"),
          searchText: getSearchText(item)
        };
      });

    return [...leadItems, ...engagementItems]
      .filter(item => toDate(item.dueAt))
      .sort((a, b) => {
        const aDate = toDate(a.dueAt)?.getTime() || 0;
        const bDate = toDate(b.dueAt)?.getTime() || 0;
        return aDate - bDate;
      });
  }, [activeLeads, activeEngagements]);

  const filteredFollowUpItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return followUpItems.filter(item => {
      const matchesSearch = searchValue ? item.searchText.includes(searchValue) : true;
      const matchesChannel = channel === "all" ? true : item.channel === channel;
      const matchesAssigned = assignedTo === "all" ? true : item.assignedKey === assignedTo;

      const matchesSource =
        followUpSource === "all" ? true : item.sourceType === followUpSource;

      return matchesSearch && matchesChannel && matchesAssigned && matchesSource;
    });
  }, [followUpItems, search, channel, assignedTo, followUpSource]);

  const todaysFollowUpItems = useMemo(() => {
    return filteredFollowUpItems.filter(item => isTodayDate(item.dueAt));
  }, [filteredFollowUpItems]);

  const overdueFollowUpItems = useMemo(() => {
    return filteredFollowUpItems.filter(item => isOverdueDate(item.dueAt));
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
        if (agentName && agentName !== "Unknown Agent") {
          agentSet.add(agentName);
        }
      }

      const destinationIds = Array.isArray(item?.destinationIds)
        ? item.destinationIds
        : [];

      const destinationNames = Array.isArray(item?.destinationNames)
        ? item.destinationNames
        : [];

      destinationIds.forEach(id => {
        if (id) destinationSet.add(id);
      });

      destinationNames.forEach(name => {
        if (name) destinationSet.add(name);
      });

      if (item?.destinationName) {
        destinationSet.add(item.destinationName);
      }

      const itemChannel = getChannel(getRecordChannel(item));
      channelMap[itemChannel] = (channelMap[itemChannel] || 0) + 1;

      const date = toDate(getCreatedDate(item));
      if (date && (!lastEngagementDate || date > lastEngagementDate)) {
        lastEngagementDate = date;
      }
    });

    const linkedLeadCount = filteredLeads.filter(lead => {
      return (
        lead?.engagementId ||
        lead?.createdFromEngagement === true ||
        String(lead?.source || "").toLowerCase() === "engagement"
      );
    }).length;

    const leadFollowUpsToday = todaysFollowUpItems.filter(
      item => item.sourceType === "lead"
    ).length;

    const engagementFollowUpsToday = todaysFollowUpItems.filter(
      item => item.sourceType === "engagement"
    ).length;

    const overdueLeadFollowUps = overdueFollowUpItems.filter(
      item => item.sourceType === "lead"
    ).length;

    const overdueEngagementFollowUps = overdueFollowUpItems.filter(
      item => item.sourceType === "engagement"
    ).length;

    const missingFollowUpDate = activeEngagements.filter(item =>
      isMissingEngagementFollowUpDate(item)
    ).length;

    const assetShareCount = filteredEngagements.reduce((sum, item) => {
      return sum + getAssetCount(item);
    }, 0);

    const engagementsWithAssets = filteredEngagements.filter(item => {
      return (
        item?.hasSharedAssets === true ||
        getAssetCount(item) > 0
      );
    }).length;

    return {
      total: filteredEngagements.length,
      agents: agentSet.size,
      destinations: destinationSet.size,
      lastEngagementDate,
      linkedLeadCount,
      leadFollowUpsToday,
      engagementFollowUpsToday,
      todaysFollowUps: todaysFollowUpItems.length,
      overdueFollowUps: overdueFollowUpItems.length,
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

  const engagementHealth = useMemo(() => {
    const total = filteredEngagements.length;

    const followUpRequired = filteredEngagements.filter(item => {
      return (
        item?.requiresFollowUp === true ||
        item?.followUpRequired === true ||
        item?.needsFollowUp === true
      );
    }).length;

    const noNextAction = filteredEngagements.filter(item =>
      isMissingEngagementFollowUpDate(item)
    ).length;

    const overdue = filteredEngagements.filter(item => {
      return (
        isPendingEngagementDocumentFollowUp(item) &&
        isOverdueDate(getFollowUpDate(item))
      );
    }).length;

    const noLeadCreated = filteredEngagements.filter(item => {
      return !item?.leadId;
    }).length;

    const healthy = Math.max(0, total - followUpRequired - overdue - noNextAction);

    return {
      healthy,
      followUpRequired,
      noNextAction,
      overdue,
      noLeadCreated
    };
  }, [filteredEngagements]);

  const conversionFunnel = useMemo(() => {
    const totalEngagements = filteredEngagements.length;

    const leadsFromEngagement = filteredLeads.filter(lead => {
      return (
        lead?.engagementId ||
        lead?.createdFromEngagement === true ||
        String(lead?.source || "").toLowerCase() === "engagement"
      );
    });

    const quotedLeads = leadsFromEngagement.filter(lead => isQuoteLead(lead));
    const convertedLeads = leadsFromEngagement.filter(lead => isWonLead(lead));

    return {
      totalEngagements,
      leadsCreated: leadsFromEngagement.length,
      quotedLeads: quotedLeads.length,
      convertedLeads: convertedLeads.length,
      leadCreationRate: percent(leadsFromEngagement.length, totalEngagements),
      quoteRate: percent(quotedLeads.length, leadsFromEngagement.length),
      conversionRate: percent(convertedLeads.length, leadsFromEngagement.length)
    };
  }, [filteredEngagements, filteredLeads]);

  const agentWarmth = useMemo(() => {
    const agentMap = new Map();

    filteredEngagements.forEach(item => {
      const key = item?.agentId || getAgentName(item);
      if (!key) return;

      if (!agentMap.has(key)) {
        agentMap.set(key, {
          key,
          name: getAgentName(item),
          engagements: []
        });
      }

      agentMap.get(key).engagements.push(item);
    });

    const rows = Array.from(agentMap.values()).map(agent => {
      const linkedLeads = filteredLeads.filter(lead => {
        return lead?.agentId === agent.key || getAgentName(lead) === agent.name;
      });

      const lastEngagementAt = getLastEngagementAt(agent.engagements);
      const status = getAgentWarmthStatus(agent.engagements, linkedLeads);

      return {
        ...agent,
        linkedLeads,
        lastEngagementAt,
        status
      };
    });

    return {
      hot: rows.filter(item => item.status === "hot").length,
      warm: rows.filter(item => item.status === "warm").length,
      cold: rows.filter(item => item.status === "cold").length,
      dormant: rows.filter(item => item.status === "dormant").length,
      rows
    };
  }, [filteredEngagements, filteredLeads]);

  const outcomePerformance = useMemo(() => {
    const map = new Map();

    filteredEngagements.forEach(item => {
      const label = getEngagementOutcome(item);

      if (!map.has(label)) {
        map.set(label, {
          label,
          value: 0
        });
      }

      map.get(label).value += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filteredEngagements]);

  const assetPerformance = useMemo(() => {
    const assetMap = new Map();

    let engagementsWithAssets = 0;
    let totalAssetReferences = 0;
    let leadsAfterAssetShare = 0;

    filteredEngagements.forEach(item => {
      const count = getAssetCount(item);

      if (count > 0 || item?.hasSharedAssets === true) {
        engagementsWithAssets += 1;
        totalAssetReferences += count;

        const hasLead = filteredLeads.some(lead => {
          return (
            lead?.engagementId === item?.id ||
            (
              String(lead?.source || "").toLowerCase() === "engagement" &&
              (
                lead?.agentId === item?.agentId ||
                getAgentName(lead) === getAgentName(item)
              )
            )
          );
        });

        if (hasLead) leadsAfterAssetShare += 1;
      }

      getAssetTitles(item).forEach(title => {
        if (!assetMap.has(title)) {
          assetMap.set(title, {
            label: title,
            value: 0
          });
        }

        assetMap.get(title).value += 1;
      });
    });

    return {
      engagementsWithAssets,
      totalAssetReferences,
      leadsAfterAssetShare,
      assetLeadRate: percent(leadsAfterAssetShare, engagementsWithAssets),
      topAssets: Array.from(assetMap.values()).sort((a, b) => b.value - a.value)
    };
  }, [filteredEngagements, filteredLeads]);

  const teamEngagementRows = useMemo(() => {
    const teamMap = new Map();

    filteredEngagements.forEach(item => {
      const key = getTeamKey(item);

      if (!teamMap.has(key)) {
        teamMap.set(key, {
          key,
          name: getTeamName(item),
          email: getTeamEmail(item),
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

      const row = teamMap.get(key);
      const channelValue = getChannel(getRecordChannel(item));

      row.engagements += 1;

      if (channelValue === "call") row.calls += 1;
      if (channelValue === "whatsapp") row.whatsapp += 1;
      if (channelValue === "email") row.emails += 1;

      if (
        item?.isOfflineMeeting === true ||
        item?.isOnlineMeeting === true ||
        item?.meetingAt ||
        item?.meetingMode
      ) {
        row.meetings += 1;
      }

      if (isPendingEngagementDocumentFollowUp(item)) {
        const dueAt = getFollowUpDate(item);

        if (isTodayDate(dueAt)) row.todayFollowUps += 1;
        if (isOverdueDate(dueAt)) row.overdueFollowUps += 1;
      }
    });

    filteredLeads.forEach(lead => {
      const key = getTeamKey(lead);

      if (!teamMap.has(key)) {
        teamMap.set(key, {
          key,
          name: getTeamName(lead),
          email: getTeamEmail(lead),
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

      if (
        lead?.engagementId ||
        lead?.createdFromEngagement === true ||
        String(lead?.source || "").toLowerCase() === "engagement"
      ) {
        teamMap.get(key).leads += 1;
      }
    });

    return Array.from(teamMap.values())
      .map(row => ({
        ...row,
        conversionRate: percent(row.leads, row.engagements)
      }))
      .sort((a, b) => b.engagements - a.engagements);
  }, [filteredEngagements, filteredLeads]);

  const mostUsedChannel = useMemo(() => {
    const entries = Object.entries(metrics.channelMap || {});
    if (!entries.length) return "—";

    return entries.sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  }, [metrics.channelMap]);

  function applyQuickDate(value) {
    setPeriod(value);
    setFromDate("");
    setToDateValue("");
  }

  function resetFilters() {
    setSearch("");
    setPeriod("30d");
    setFromDate("");
    setToDateValue("");
    setChannel("all");
    setAssignedTo("all");
    setFollowUpSource("all");
  }

  if (loading || user === undefined) {
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
        <section className="overflow-hidden rounded-3xl bg-slate-950 ">
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

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
                <CommandMetric
                  label="Engagements"
                  value={metrics.total}
                  icon={Activity}
                  tone="slate"
                />

                <CommandMetric
                  label="Agents"
                  value={metrics.agents}
                  icon={Users}
                  tone="blue"
                />

                <CommandMetric
                  label="Today"
                  value={metrics.todaysFollowUps}
                  icon={CalendarDays}
                  tone="amber"
                />

                <CommandMetric
                  label="Overdue"
                  value={metrics.overdueFollowUps}
                  icon={AlertTriangle}
                  tone={metrics.overdueFollowUps > 0 ? "red" : "emerald"}
                />
              </div>
            </div>

            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="flex items-center gap-2 text-sm text-slate-300">
                  <Filter className="h-4 w-4" />
                  Use quick filters and action cards to instantly narrow down the engagement dashboard.
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
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK DATE FILTERS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            Quick Date Filters
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <QuickDateButton
              label="Today"
              active={period === "today"}
              onClick={() => applyQuickDate("today")}
            />

            <QuickDateButton
              label="Yesterday"
              active={period === "yesterday"}
              onClick={() => applyQuickDate("yesterday")}
            />

            <QuickDateButton
              label="Last 7 Days"
              active={period === "7d"}
              onClick={() => applyQuickDate("7d")}
            />

            <QuickDateButton
              label="This Month"
              active={period === "thisMonth"}
              onClick={() => applyQuickDate("thisMonth")}
            />

            <QuickDateButton
              label="Last Month"
              active={period === "lastMonth"}
              onClick={() => applyQuickDate("lastMonth")}
            />

            <QuickDateButton
              label="Clear Date"
              active={period === "all"}
              onClick={() => applyQuickDate("all")}
            />
          </div>
        </section>

        {/* FILTER PANEL */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 ">
          <div className="rounded-2xl border border-slate-100 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
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
                value={channel}
                onChange={event => setChannel(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              >
                <option value="all">All Channels</option>
                {channelOptions.map(item => (
                  <option key={item} value={item}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>

              <select
                value={assignedTo}
                onChange={event => setAssignedTo(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              >
                <option value="all">All Assigned</option>
                {assignedOptions.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={followUpSource}
                onChange={event => setFollowUpSource(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              >
                <option value="all">All Follow-ups</option>
                <option value="lead">Lead Follow-ups</option>
                <option value="engagement">Engagement Follow-ups</option>
              </select>

              <input
                type="date"
                value={fromDate}
                onChange={event => {
                  setFromDate(event.target.value);
                  setPeriod("custom");
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />

              <input
                type="date"
                value={toDateValue}
                onChange={event => {
                  setToDateValue(event.target.value);
                  setPeriod("custom");
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>
        </section>

        {/* ACTION CENTER */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Today&apos;s Action Center
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Click any card to focus your dashboard view.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <ActionCard
              label="Today's Follow-ups"
              value={metrics.todaysFollowUps}
              helper={`Leads ${metrics.leadFollowUpsToday} • Engagements ${metrics.engagementFollowUpsToday}`}
              icon={CalendarDays}
              tone="blue"
              onClick={() => setFollowUpSource("all")}
            />

            <ActionCard
              label="Overdue Follow-ups"
              value={metrics.overdueFollowUps}
              helper="Needs urgent attention."
              icon={Timer}
              tone="amber"
              onClick={() => setFollowUpSource("all")}
            />

            <ActionCard
              label="Missing Follow-up Date"
              value={metrics.missingFollowUpDate}
              helper="Requires follow-up but no date."
              icon={AlertTriangle}
              tone="red"
              onClick={() => setFollowUpSource("engagement")}
            />

            <ActionCard
              label="Leads From Engagement"
              value={metrics.linkedLeadCount}
              helper="Created from engagement flow."
              icon={Users}
              tone="violet"
              onClick={() => setFollowUpSource("lead")}
            />

            <ActionCard
              label="Shared Assets"
              value={metrics.engagementsWithAssets}
              helper={`${metrics.assetShareCount} total asset references.`}
              icon={Send}
              tone="emerald"
              onClick={() => setFollowUpSource("all")}
            />
          </div>
        </section>

        {/* ENGAGEMENT HEALTH */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Engagement Health
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Understand where engagement attention is needed before agents go cold.
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
        <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Engagement Conversion Funnel
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Track how outreach activity converts into leads, quotations, and won business.
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
                  {assetPerformance.engagementsWithAssets} asset-sharing engagements.
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Top Channel
            </p>
            <p className="mt-2 text-lg font-bold capitalize text-slate-900">
              {mostUsedChannel}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Follow-up Source
            </p>
            <p className="mt-2 text-lg font-bold capitalize text-slate-900">
              {followUpSource === "all" ? "All" : followUpSource}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Assigned Filter
            </p>
            <p className="mt-2 truncate text-lg font-bold text-slate-900">
              {assignedTo === "all"
                ? "All Team"
                : assignedOptions.find(item => item.value === assignedTo)?.label ||
                  "Selected"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
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