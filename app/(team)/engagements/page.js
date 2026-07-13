"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  PhoneCall,
  RefreshCcw,
  Search,
  Share2,
  Timer,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Workflow
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import CardSkeleton from "@/components/ui/CardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

/* =========================
   CONSTANTS
========================= */

const DEFAULT_FILTERS = {
  search: "",
  period: "30d",
  dateFrom: "",
  dateTo: "",
  channel: "all"
};

const CLOSED_TASK_STATUSES = new Set([
  "completed",
  "skipped",
  "cancelled",
  "canceled"
]);

/* =========================
   GENERIC HELPERS
========================= */

function normalize(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeStatus(value = "") {
  return normalize(value).replace(/[\s-]+/g, "_");
}

function isDeletedRecord(item = {}) {
  return item?.deleted === true || item?.isDeleted === true;
}

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

    const parsedNumber =
      new Date(milliseconds);

    return Number.isNaN(
      parsedNumber.getTime()
    )
      ? null
      : parsedNumber;
  }

  const parsed = new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function getLocalDateKey(value) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return getLocalDateKey(
    new Date()
  );
}

function isToday(value) {
  const key =
    getLocalDateKey(value);

  return Boolean(
    key &&
      key === getTodayKey()
  );
}

function isOverdue(value) {
  const key =
    getLocalDateKey(value);

  return Boolean(
    key &&
      key < getTodayKey()
  );
}

function formatDate(value) {
  const date = toDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function toDateInput(value) {
  return getLocalDateKey(value);
}

function getPeriodRange(
  period,
  dateFrom,
  dateTo
) {
  const now = new Date();

  const todayKey =
    getLocalDateKey(now);

  if (period === "all") {
    return {
      from: "",
      to: ""
    };
  }

  if (period === "custom") {
    return {
      from: dateFrom || "",
      to: dateTo || ""
    };
  }

  if (period === "today") {
    return {
      from: todayKey,
      to: todayKey
    };
  }

  if (period === "yesterday") {
    const yesterday =
      new Date(now);

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    const key =
      getLocalDateKey(
        yesterday
      );

    return {
      from: key,
      to: key
    };
  }

  if (period === "7d") {
    const start =
      new Date(now);

    start.setDate(
      start.getDate() - 6
    );

    return {
      from:
        getLocalDateKey(
          start
        ),
      to: todayKey
    };
  }

  if (period === "30d") {
    const start =
      new Date(now);

    start.setDate(
      start.getDate() - 29
    );

    return {
      from:
        getLocalDateKey(
          start
        ),
      to: todayKey
    };
  }

  if (
    period === "thisMonth"
  ) {
    const start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    return {
      from:
        getLocalDateKey(
          start
        ),
      to: todayKey
    };
  }

  return {
    from: "",
    to: ""
  };
}

function isWithinPeriod(
  value,
  period,
  dateFrom,
  dateTo
) {
  if (period === "all") {
    return true;
  }

  const key =
    getLocalDateKey(value);

  if (!key) {
    return false;
  }

  const range =
    getPeriodRange(
      period,
      dateFrom,
      dateTo
    );

  if (
    range.from &&
    key < range.from
  ) {
    return false;
  }

  if (
    range.to &&
    key > range.to
  ) {
    return false;
  }

  return true;
}

function formatLabel(value = "") {
  if (!value) {
    return "Not Set";
  }

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    );
}

function percent(part, total) {
  if (!total) {
    return 0;
  }

  return Math.round(
    (part / total) * 100
  );
}

function dedupeRows(rows = []) {
  const map = new Map();

  rows.forEach(row => {
    if (!row?.id) {
      return;
    }

    map.set(
      row.id,
      row
    );
  });

  return Array.from(
    map.values()
  );
}

/* =========================
   ENTITY HELPERS
========================= */

function getChannel(value = "") {
  const channel =
    normalize(
      value || "other"
    );

  if (
    channel.includes(
      "whatsapp"
    )
  ) {
    return "whatsapp";
  }

  if (
    channel.includes("email")
  ) {
    return "email";
  }

  if (
    channel.includes("call")
  ) {
    return "call";
  }

  if (
    channel.includes(
      "meeting"
    ) ||
    channel.includes("visit")
  ) {
    return "meeting";
  }

  return channel || "other";
}

function getChannelLabel(
  channel = ""
) {
  const labels = {
    call: "Call",
    whatsapp: "WhatsApp",
    email: "Email",
    meeting: "Meeting",
    other: "Other"
  };

  return (
    labels[
      getChannel(channel)
    ] ||
    formatLabel(channel)
  );
}

function getChannelIcon(
  channel = ""
) {
  const value =
    getChannel(channel);

  const icons = {
    call: PhoneCall,
    whatsapp: MessageCircle,
    email: Mail,
    meeting: Video,
    other: Activity
  };

  return (
    icons[value] ||
    Activity
  );
}

function getAgentName(item = {}) {
  return (
    item?.agentName ||
    item?.travelAgentName ||
    item?.agencyName ||
    item?.agent?.agencyName ||
    item?.agent?.name ||
    "Unknown Agent"
  );
}

function getDestinationName(
  item = {}
) {
  if (item?.destinationName) {
    return item.destinationName;
  }

  if (
    Array.isArray(
      item?.destinationNames
    ) &&
    item.destinationNames.length
  ) {
    return item.destinationNames
      .filter(Boolean)
      .join(", ");
  }

  if (
    item?.destination?.name
  ) {
    return item.destination.name;
  }

  if (
    item?.destinationCode
  ) {
    return item.destinationCode;
  }

  return "Not Set";
}

function getSpocName(item = {}) {
  return (
    item?.spoc?.name ||
    item?.spocName ||
    item?.contactPerson ||
    ""
  );
}

function getOutcome(item = {}) {
  return (
    item?.outcomeLabel ||
    item?.outcomeCode ||
    item?.result ||
    item?.status ||
    "Not Set"
  );
}

function getCreatedAt(item = {}) {
  return (
    item?.createdAt ||
    item?.date ||
    item?.engagementDate ||
    null
  );
}

function getSearchText(item = {}) {
  return [
    item?.subject,
    item?.message,
    item?.messageText,
    item?.remarks,
    item?.note,
    item?.leadCode,
    item?.customerName,
    item?.customerMobile,
    item?.customerEmail,
    item?.agentCode,
    item?.ruleCode,
    item?.title,
    item?.purpose,
    item?.status,
    item?.stage,
    item?.outcomeCode,
    item?.outcomeLabel,
    getAgentName(item),
    getSpocName(item),
    getDestinationName(item),
    item?.createdByName,
    item?.assignedToName
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSearch(
  item,
  search
) {
  const value =
    normalize(search);

  return (
    !value ||
    getSearchText(
      item
    ).includes(value)
  );
}

function getLeadStage(
  lead = {}
) {
  return normalizeStatus(
    lead?.stage ||
      lead?.status ||
      ""
  );
}

function isWonLead(lead = {}) {
  return [
    "converted",
    "won",
    "deal_won"
  ].includes(
    getLeadStage(lead)
  );
}

function isHotLead(lead = {}) {
  return [
    "hot",
    "hot_lead",
    "priority_hot"
  ].includes(
    getLeadStage(lead)
  );
}

function isPaymentPendingLead(
  lead = {}
) {
  return [
    "payment_pending",
    "payment_due",
    "awaiting_payment"
  ].includes(
    getLeadStage(lead)
  );
}

function isRevisionPendingLead(
  lead = {}
) {
  return [
    "revision_required",
    "revision_pending",
    "revision_requested",
    "revised_quote_pending"
  ].includes(
    getLeadStage(lead)
  );
}

function isQuoteSentLead(
  lead = {}
) {
  return [
    "quote_sent",
    "quotation_sent",
    "final_quote_sent",
    "revised_quote_sent"
      ].includes(getLeadStage(lead));
}

function isActiveLead(lead = {}) {
  return ![
    "converted",
    "won",
    "deal_won",
    "lost",
    "closed",
    "cancelled",
    "canceled"
  ].includes(getLeadStage(lead));
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
  const value = [
    item?.outcomeCode,
    item?.outcomeLabel,
    item?.status,
    item?.result,
    item?.response,
    item?.agentResponse
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const negativeSignals = [
    "no response",
    "not connected",
    "call not connected",
    "busy",
    "wrong number",
    "invalid contact",
    "not reachable",
    "unreachable",
    "switched off",
    "declined"
  ];

  return !negativeSignals.some(signal =>
    value.includes(signal)
  );
}

function getAgentKey(item = {}) {
  return (
    item?.agentId ||
    item?.travelAgentId ||
    getAgentName(item)
  );
}

function getAgentSegment(agent = {}) {
  return normalizeStatus(
    agent?.engagementSegment ||
      agent?.relationshipStage ||
      agent?.lifecycleStatus ||
      "unclassified"
  );
}

function getTaskStatus(task = {}) {
  return normalizeStatus(
    task?.status ||
      task?.completionStatus ||
      "pending"
  );
}

function isOpenTask(task = {}) {
  if (isDeletedRecord(task)) {
    return false;
  }

  return !CLOSED_TASK_STATUSES.has(
    getTaskStatus(task)
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
  const dueAt =
    getTaskDueAt(task);

  if (!toDate(dueAt)) {
    return "upcoming";
  }

  if (isOverdue(dueAt)) {
    return "overdue";
  }

  if (isToday(dueAt)) {
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
    formatLabel(
      task?.ruleCode ||
        "Agent follow-up"
    )
  );
}

/* =========================
   UI COMPONENTS
========================= */

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
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
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
            tones[tone] ||
            tones.blue
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  rightContent
}) {
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

        {rightContent || null}
      </div>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function ProgressRow({
  label,
  value,
  total
}) {
  const width =
    percent(value, total);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs font-medium text-slate-700">
          {label}
        </p>

        <p className="text-xs font-bold text-slate-900">
          {value}
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{
            width: `${Math.min(
              width,
              100
            )}%`
          }}
        />
      </div>
    </div>
  );
}

function EmptyMiniState({
  title,
  description
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {description ||
          "Data will appear here after activity is recorded."}
      </p>
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
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
        active
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
  const status =
    getTaskStatus(task);

  const bucket =
    getTaskBucket(task);

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
  tasks,
  bucket,
  onBucketChange,
  counts
}) {
  return (
    <SectionCard
      icon={ListChecks}
      title="My Engagement Task Queue"
      description="Cadence actions, lead follow-ups and relationship tasks assigned to you."
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
          active={
            bucket === "today"
          }
          tone="amber"
          onClick={() =>
            onBucketChange("today")
          }
        />

        <TaskBucketButton
          label="Overdue"
          count={counts.overdue}
          active={
            bucket === "overdue"
          }
          tone="red"
          onClick={() =>
            onBucketChange(
              "overdue"
            )
          }
        />

        <TaskBucketButton
          label="Upcoming"
          count={counts.upcoming}
          active={
            bucket === "upcoming"
          }
          tone="blue"
          onClick={() =>
            onBucketChange(
              "upcoming"
            )
          }
        />

        <TaskBucketButton
          label="Completed Today"
          count={
            counts.completedToday
          }
          active={
            bucket === "completed"
          }
          tone="emerald"
          onClick={() =>
            onBucketChange(
              "completed"
            )
          }
        />

        <TaskBucketButton
          label="Skipped"
          count={counts.skipped}
          active={
            bucket === "skipped"
          }
          tone="slate"
          onClick={() =>
            onBucketChange(
              "skipped"
            )
          }
        />

        <TaskBucketButton
          label="All Open"
          count={counts.open}
          active={
            bucket === "all"
          }
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
                className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                      {getTaskTitle(
                        task
                      )}
                    </h3>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {getAgentName(
                        task
                      )}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>
                        {formatLabel(
                          task?.ruleCode
                        )}
                      </span>

                      <span>
                        {formatDateTime(
                          getTaskDueAt(
                            task
                          )
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
                    task
                      .recommendedChannels
                      .length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {task.recommendedChannels.map(
                          channel => (
                            <span
                              key={
                                channel
                              }
                              className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium capitalize text-slate-600"
                            >
                              {channel}
                                                      </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {task?.leadId ? (
                    <Link
                      href={`/leads/${task.leadId}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      View Lead
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}

                  {task?.agentId ? (
                    <Link
                      href={`/travel-agents/${task.agentId}`}
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
              +{tasks.length - 12} more tasks match this view
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />

          <p className="mt-3 text-sm font-semibold text-slate-900">
            No tasks found in this queue.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function RecentEngagementItem({ engagement }) {
  const Icon = getChannelIcon(engagement?.channel);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">
                {engagement?.subject || getAgentName(engagement)}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {getChannelLabel(engagement?.channel)} •{" "}
                {formatDateTime(getCreatedAt(engagement))}
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {formatLabel(getOutcome(engagement))}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {getAgentName(engagement)}
            </span>

            {getSpocName(engagement) ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                SPOC: {getSpocName(engagement)}
              </span>
            ) : null}

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {getDestinationName(engagement)}
            </span>
          </div>

          {engagement?.message || engagement?.messageText ? (
            <p className="mt-3 line-clamp-2 text-sm text-slate-500">
              {engagement?.message || engagement?.messageText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6">
        <CardSkeleton />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => (
            <CardSkeleton key={item} />
          ))}
        </div>

        <CardSkeleton />
        <CardSkeleton />
      </div>
    </main>
  );
}

/* =========================
   MAIN PAGE
========================= */

export default function TeamEngagementDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [engagements, setEngagements] = useState([]);
  const [leads, setLeads] = useState([]);
  const [travelAgents, setTravelAgents] = useState([]);
  const [engagementTasks, setEngagementTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [taskBucket, setTaskBucket] = useState("today");

  /* =========================
     USER-SCOPED REALTIME DATA
  ========================== */

  useEffect(() => {
    if (authLoading) return;

    const uid = user?.uid || user?.id || "";
    const email = user?.email || "";

    if (!uid) {
      setEngagements([]);
      setLeads([]);
      setTravelAgents([]);
      setEngagementTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const readiness = {
      engagements: false,
      leads: false,
      agents: false,
      tasks: false
    };

    function markReady(key) {
      readiness[key] = true;

      if (Object.values(readiness).every(Boolean)) {
        setLoading(false);
      }
    }

    function subscribeMerged(queryRefs, setter, readyKey, label) {
      const buckets = queryRefs.map(() => new Map());
      const completedIndexes = new Set();

      function emitMerged() {
        const merged = [];

        buckets.forEach(bucket => {
          bucket.forEach(row => merged.push(row));
        });

        setter(dedupeRows(merged));
      }

      function markQueryComplete(index) {
        completedIndexes.add(index);

        if (completedIndexes.size === queryRefs.length) {
          markReady(readyKey);
        }
      }

      const unsubscribers = queryRefs.map((queryRef, index) => {
        return onSnapshot(
          queryRef,
          snapshot => {
            const bucket = new Map();

            snapshot.docs.forEach(documentSnapshot => {
              bucket.set(documentSnapshot.id, {
                id: documentSnapshot.id,
                ...documentSnapshot.data()
              });
            });

            buckets[index] = bucket;
            emitMerged();
            markQueryComplete(index);
          },
          snapshotError => {
            console.error(`${label} load error:`, snapshotError);
            markQueryComplete(index);

            setError(previous => {
              if (previous) return previous;

              return `Some ${label.toLowerCase()} data could not be loaded. Check Firestore rules and indexes.`;
            });
          }
        );
      });

      return () => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
      };
    }

    const engagementQueries = [
      query(
        collection(db, "engagements"),
        where("createdByUid", "==", uid)
      )
    ];

    const leadQueries = [
      query(
        collection(db, "leads"),
        where("assignedToUid", "==", uid)
      ),
      query(
        collection(db, "leads"),
        where("createdByUid", "==", uid)
      )
    ];

    const agentQueries = [
      query(
        collection(db, "travelAgents"),
        where("assignedToUid", "==", uid)
      ),
      query(
        collection(db, "travelAgents"),
        where("accountManagerUid", "==", uid)
      )
    ];

    const taskQueries = [
      query(
        collection(db, "engagementTasks"),
        where("assignedToUid", "==", uid)
      )
    ];

    if (email) {
      leadQueries.push(
        query(
          collection(db, "leads"),
          where("assignedToEmail", "==", email)
        )
      );

      agentQueries.push(
        query(
          collection(db, "travelAgents"),
          where("assignedToEmail", "==", email)
        )
      );

      taskQueries.push(
        query(
          collection(db, "engagementTasks"),
          where("assignedToEmail", "==", email)
        )
      );
    }

    const unsubscribeEngagements = subscribeMerged(
      engagementQueries,
      setEngagements,
      "engagements",
      "Engagements"
    );

    const unsubscribeLeads = subscribeMerged(
      leadQueries,
      setLeads,
      "leads",
      "Leads"
    );

    const unsubscribeAgents = subscribeMerged(
      agentQueries,
      setTravelAgents,
      "agents",
      "Travel agents"
    );

    const unsubscribeTasks = subscribeMerged(
      taskQueries,
      setEngagementTasks,
      "tasks",
      "Engagement tasks"
    );

    return () => {
      unsubscribeEngagements();
      unsubscribeLeads();
      unsubscribeAgents();
      unsubscribeTasks();
    };
  }, [user?.uid, user?.id, user?.email, authLoading]);

  /* =========================
     CLEAN DATA
  ========================== */

  const activeEngagements = useMemo(() => {
    return engagements
      .filter(item => !isDeletedRecord(item))
      .sort((a, b) => {
        return (
          (toDate(getCreatedAt(b))?.getTime() || 0) -
          (toDate(getCreatedAt(a))?.getTime() || 0)
        );
      });
  }, [engagements]);

  const activeLeads = useMemo(() => {
    return leads.filter(item => !isDeletedRecord(item));
  }, [leads]);

  const activeTravelAgents = useMemo(() => {
    return travelAgents.filter(item => !isDeletedRecord(item));
  }, [travelAgents]);

  const activeTasks = useMemo(() => {
    return engagementTasks.filter(item => !isDeletedRecord(item));
  }, [engagementTasks]);

  const channelOptions = useMemo(() => {
    const set = new Set();

    activeEngagements.forEach(item => {
      set.add(getChannel(item?.channel));
    });

    return Array.from(set)
      .filter(Boolean)
      .sort();
  }, [activeEngagements]);

  const filteredEngagements = useMemo(() => {
    return activeEngagements.filter(item => {
      const matchesChannel =
        filters.channel === "all" ||
        getChannel(item?.channel) === filters.channel;

      const matchesDate = isWithinPeriod(
        getCreatedAt(item),
        filters.period,
        filters.dateFrom,
        filters.dateTo
      );

      return (
        matchesSearch(item, filters.search) &&
        matchesChannel &&
        matchesDate
      );
    });
  }, [activeEngagements, filters]);

  const scopedLeads = useMemo(() => {
    return activeLeads.filter(item => {
      return matchesSearch(item, filters.search);
    });
  }, [activeLeads, filters.search]);

  const scopedAgents = useMemo(() => {
    return activeTravelAgents.filter(item => {
      return matchesSearch(item, filters.search);
    });
  }, [activeTravelAgents, filters.search]);

  const scopedTasks = useMemo(() => {
    return activeTasks.filter(item => {
      const matchesTaskChannel =
        filters.channel === "all" ||
        (Array.isArray(item?.recommendedChannels) &&
          item.recommendedChannels
            .map(getChannel)
            .includes(filters.channel));

      return (
        matchesSearch(item, filters.search) &&
        matchesTaskChannel
      );
    });
  }, [activeTasks, filters.search, filters.channel]);

  /* =========================
     TASK METRICS
  ========================== */

  const taskMetrics = useMemo(() => {
    const open = scopedTasks.filter(isOpenTask);
        return {
      open: open.length,

      today: open.filter(
        item =>
          getTaskBucket(item) ===
          "today"
      ).length,

      overdue: open.filter(
        item =>
          getTaskBucket(item) ===
          "overdue"
      ).length,

      upcoming: open.filter(
        item =>
          getTaskBucket(item) ===
          "upcoming"
      ).length,

      completedToday:
        scopedTasks.filter(item => {
          return (
            getTaskStatus(item) ===
              "completed" &&
            isToday(
              item?.completedAt
            )
          );
        }).length,

      skipped:
        scopedTasks.filter(
          item =>
            getTaskStatus(item) ===
            "skipped"
        ).length
    };
  }, [scopedTasks]);

  const visibleTaskQueue =
    useMemo(() => {
      const rows =
        scopedTasks.filter(task => {
          const status =
            getTaskStatus(task);

          if (
            taskBucket ===
            "completed"
          ) {
            return (
              status ===
                "completed" &&
              isToday(
                task?.completedAt
              )
            );
          }

          if (
            taskBucket ===
            "skipped"
          ) {
            return (
              status === "skipped"
            );
          }

          if (
            taskBucket === "all"
          ) {
            return isOpenTask(
              task
            );
          }

          return (
            isOpenTask(task) &&
            getTaskBucket(task) ===
              taskBucket
          );
        });

      return rows.sort(
        (a, b) => {
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
        }
      );
    }, [
      scopedTasks,
      taskBucket
    ]);

  /* =========================
     TODAY SNAPSHOT
  ========================== */

  const todaySnapshot =
    useMemo(() => {
      const successfulHistory =
        activeEngagements
          .filter(
            isSuccessfulConnection
          )
          .filter(item =>
            toDate(
              getCreatedAt(item)
            )
          )
          .sort((a, b) => {
            return (
              (
                toDate(
                  getCreatedAt(a)
                )?.getTime() || 0
              ) -
              (
                toDate(
                  getCreatedAt(b)
                )?.getTime() || 0
              )
            );
          });

      const firstConnectionByAgent =
        new Map();

      successfulHistory.forEach(
        item => {
          const key =
            getAgentKey(item);

          if (
            !key ||
            firstConnectionByAgent.has(
              key
            )
          ) {
            return;
          }

          firstConnectionByAgent.set(
            key,
            item
          );
        }
      );

      const successfulToday =
        activeEngagements
          .filter(item =>
            isToday(
              getCreatedAt(item)
            )
          )
          .filter(
            isSuccessfulConnection
          )
          .filter(item =>
            matchesSearch(
              item,
              filters.search
            )
          )
          .filter(item => {
            return (
              filters.channel ===
                "all" ||
              getChannel(
                item?.channel
              ) ===
                filters.channel
            );
          });

      const uniqueToday =
        new Map();

      successfulToday.forEach(
        item => {
          const key =
            getAgentKey(item);

          if (
            !key ||
            uniqueToday.has(key)
          ) {
            return;
          }

          uniqueToday.set(
            key,
            item
          );
        }
      );

      const firstConnectedTodayKeys =
        new Set();

      firstConnectionByAgent.forEach(
        (item, key) => {
          if (
            isToday(
              getCreatedAt(item)
            )
          ) {
            firstConnectedTodayKeys.add(
              key
            );
          }
        }
      );

      const queriesReceivedToday =
        scopedLeads.filter(
          lead => {
            return isToday(
              lead?.createdAt
            );
          }
        ).length;

      const quotesSharedToday =
        scopedLeads.filter(
          lead => {
            return (
              isQuoteSentLead(
                lead
              ) &&
              isToday(
                getLeadActivityDate(
                  lead
                )
              )
            );
          }
        ).length;

      const convertedToday =
        scopedLeads.filter(
          lead => {
            return (
              isWonLead(lead) &&
              isToday(
                getLeadActivityDate(
                  lead
                )
              )
            );
          }
        ).length;

      return {
        firstConnections:
          Array.from(
            uniqueToday.keys()
          ).filter(key =>
            firstConnectedTodayKeys.has(
              key
            )
          ).length,

        uniqueAgentsConnected:
          uniqueToday.size,

        existingFollowUps:
          Array.from(
            uniqueToday.keys()
          ).filter(
            key =>
              !firstConnectedTodayKeys.has(
                key
              )
          ).length,

        queriesReceivedToday,
        quotesSharedToday,
        convertedToday,

        completedTasksToday:
          taskMetrics.completedToday,

        overdueTasks:
          taskMetrics.overdue
      };
    }, [
      activeEngagements,
      scopedLeads,
      taskMetrics.completedToday,
      taskMetrics.overdue,
      filters.search,
      filters.channel
    ]);

  /* =========================
     LEAD ACTIONS
  ========================== */

  const leadActions =
    useMemo(() => {
      return {
        activeQueries:
          scopedLeads.filter(
            isActiveLead
          ).length,

        hotLeads:
          scopedLeads.filter(
            isHotLead
          ).length,

        paymentPending:
          scopedLeads.filter(
            isPaymentPendingLead
          ).length,

        revisionPending:
          scopedLeads.filter(
            isRevisionPendingLead
          ).length,

        quoteSent:
          scopedLeads.filter(
            isQuoteSentLead
          ).length
      };
    }, [scopedLeads]);

  /* =========================
     ANALYTICS
  ========================== */

  const summary =
    useMemo(() => {
      const channelMap =
        new Map();

      const destinationMap =
        new Map();

      const outcomeMap =
        new Map();

      const agentMap =
        new Map();

      filteredEngagements.forEach(
        item => {
          const channel =
            getChannel(
              item?.channel
            );

          const destination =
            getDestinationName(
              item
            );

          const outcome =
            getOutcome(item);

          const agent =
            getAgentName(item);

          channelMap.set(
            channel,
            (
              channelMap.get(
                channel
              ) || 0
            ) + 1
          );

          destinationMap.set(
            destination,
            (
              destinationMap.get(
                destination
              ) || 0
            ) + 1
          );

          outcomeMap.set(
            outcome,
            (
              outcomeMap.get(
                outcome
              ) || 0
            ) + 1
          );

          agentMap.set(
            agent,
            (
              agentMap.get(
                agent
              ) || 0
            ) + 1
          );
        }
      );

      function toRows(
        map,
        limit = 6
      ) {
        return Array.from(
          map.entries()
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
          .slice(0, limit);
      }

      const assetShares =
        filteredEngagements.reduce(
          (sum, item) => {
            const count =
              Number(
                item?.assetShareCount ||
                  0
              ) ||
              (
                Array.isArray(
                  item?.sharedAssetIds
                )
                  ? item
                      .sharedAssetIds
                      .length
                  : 0
              ) ||
              (
                Array.isArray(
                  item?.sharedAssets
                )
                  ? item
                      .sharedAssets
                      .length
                  : 0
              ) ||
              0;

            return sum + count;
          },
          0
        );

      return {
        total:
          filteredEngagements.length,

        uniqueAgents:
          new Set(
            filteredEngagements.map(
              getAgentKey
            )
          ).size,

        channelRows:
          toRows(channelMap),

        destinationRows:
          toRows(
            destinationMap
          ),

        outcomeRows:
          toRows(outcomeMap),

        agentRows:
          toRows(agentMap),

        assetShares,

        lastEngagement:
          filteredEngagements[0] ||
          null
      };
    }, [filteredEngagements]);

  const agentPortfolio =
    useMemo(() => {
      const counts = {
        total:
          scopedAgents.length,

        newAgent: 0,
        regular: 0,
        warm: 0,
        inactive: 0,
        cold: 0,
        unclassified: 0
      };

      scopedAgents.forEach(
        agent => {
          const segment =
            getAgentSegment(agent);

          if (
            segment ===
              "new_agent" ||
            segment === "new"
          ) {
            counts.newAgent += 1;
          } else if (
            segment ===
              "regular_business" ||
            segment === "regular"
          ) {
            counts.regular += 1;
          } else if (
            segment ===
              "warm_irregular" ||
            segment === "warm"
          ) {
            counts.warm += 1;
          } else if (
            segment ===
            "inactive"
          ) {
            counts.inactive += 1;
          } else if (
            segment === "cold"
          ) {
            counts.cold += 1;
          } else {
            counts.unclassified += 1;
          }
        }
      );

      return counts;
    }, [scopedAgents]);

  const recentEngagements =
    useMemo(() => {
      return filteredEngagements.slice(
        0,
        8
      );
    }, [filteredEngagements]);

  /* =========================
     FILTER ACTIONS
  ========================== */

  function updateFilter(
    key,
    value
  ) {
    setFilters(previous => ({
      ...previous,
      [key]: value
    }));
  }

  function applyQuickDate(
    period
  ) {
    setFilters(previous => ({
      ...previous,
      period,
      dateFrom: "",
      dateTo: ""
    }));
  }

  function applyCustomDate(
    key,
    value
  ) {
    setFilters(previous => ({
      ...previous,
      period: "custom",
      [key]: value
    }));
  }

  function resetFilters() {
    setFilters(
      DEFAULT_FILTERS
    );

    setTaskBucket("today");
  }

  const dateRangeError =
    useMemo(() => {
      if (
        !filters.dateFrom ||
        !filters.dateTo
      ) {
        return "";
      }

      return (
        filters.dateFrom >
        filters.dateTo
          ? "From Date cannot be later than To Date."
          : ""
      );
    }, [
      filters.dateFrom,
      filters.dateTo
    ]);

  if (
    authLoading ||
    loading
  ) {
    return <LoadingState />;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          Please sign in to view the engagement dashboard.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">

        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl bg-slate-950 ">
          <div className="p-5 text-white sm:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  <BarChart3 className="h-3.5 w-3.5" />

                  Team Engagement Workspace
                </div>

                <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">
                  My Engagement Dashboard
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Manage your assigned agents, cadence tasks, active queries,
                  follow-ups and engagement performance from one workspace.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[620px]">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs text-slate-300">
                    Engagements
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    {summary.total}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs text-slate-300">
                    Agents Today
                  </p>

                  <p className="mt-2 text-2xl font-bold text-sky-300">
                    {
                      todaySnapshot
                        .uniqueAgentsConnected
                    }
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs text-slate-300">
                    Tasks Today
                  </p>

                  <p className="mt-2 text-2xl font-bold text-amber-300">
                    {
                      taskMetrics.today
                    }
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs text-slate-300">
                    Overdue
                  </p>

                  <p className="mt-2 text-2xl font-bold text-red-300">
                    {
                      taskMetrics.overdue
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm text-slate-300">
                <Filter className="h-4 w-4" />

                The dashboard only shows records assigned to or created by you.
              </p>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/employee-dashboard"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK DATES */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
          <div className="flex flex-wrap gap-2">
            {[
              [
                "today",
                "Today"
              ],
              [
                "yesterday",
                "Yesterday"
              ],
              [
                "7d",
                "Last 7 Days"
              ],
              [
                "30d",
                "Last 30 Days"
              ],
              [
                "thisMonth",
                "This Month"
              ],
              [
                "all",
                "All Time"
              ]
            ].map(
              ([
                value,
                label
              ]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    applyQuickDate(
                      value
                    )
                  }
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    filters.period ===
                    value
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </section>

        {/* FILTERS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={
                  filters.search
                }
                onChange={event =>
                  updateFilter(
                    "search",
                    event.target.value
                  )
                }
                placeholder="Search agent, destination, lead, task or outcome..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </div>
                        <select
              value={filters.channel}
              onChange={event =>
                updateFilter(
                  "channel",
                  event.target.value
                )
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">
                All Channels
              </option>

              {channelOptions.map(
                channel => (
                  <option
                    key={channel}
                    value={channel}
                  >
                    {getChannelLabel(
                      channel
                    )}
                  </option>
                )
              )}
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={event =>
                applyCustomDate(
                  "dateFrom",
                  event.target.value
                )
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={event =>
                applyCustomDate(
                  "dateTo",
                  event.target.value
                )
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        {dateRangeError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dateRangeError}
          </div>
        ) : null}

        {/* TODAY SNAPSHOT */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Today&apos;s Activity Snapshot
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Your calls, queries, quotation movement and task completion today.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <MetricCard
              icon={UserPlus}
              label="New Connections"
              value={
                todaySnapshot.firstConnections
              }
              helper="Agents connected by you for the first time."
              tone="violet"
            />

            <MetricCard
              icon={PhoneCall}
              label="Agents Connected"
              value={
                todaySnapshot
                  .uniqueAgentsConnected
              }
              helper="Unique agents successfully reached today."
              tone="blue"
            />

            <MetricCard
              icon={Users}
              label="Existing Follow-ups"
              value={
                todaySnapshot.existingFollowUps
              }
              helper="Existing agents contacted today."
              tone="emerald"
            />

            <MetricCard
              icon={MessageCircle}
              label="Queries Received"
              value={
                todaySnapshot
                  .queriesReceivedToday
              }
              helper="Lead records created today."
              tone="blue"
            />

            <MetricCard
              icon={FileText}
              label="Quotes Shared"
              value={
                todaySnapshot
                  .quotesSharedToday
              }
              helper="Queries moved to quote-sent today."
              tone="amber"
            />

            <MetricCard
              icon={CheckCircle2}
              label="Tasks Completed"
              value={
                todaySnapshot
                  .completedTasksToday
              }
              helper="Cadence tasks completed today."
              tone="emerald"
            />

            <MetricCard
              icon={CircleDollarSign}
              label="Converted"
              value={
                todaySnapshot.convertedToday
              }
              helper="Queries converted or won today."
              tone="emerald"
            />

            <MetricCard
              icon={AlertTriangle}
              label="Overdue Tasks"
              value={
                todaySnapshot.overdueTasks
              }
              helper="Pending tasks beyond due date."
              tone="red"
            />
          </div>
        </section>

        {/* PRIORITY ACTIONS */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={Activity}
            label="Active Queries"
            value={
              leadActions.activeQueries
            }
            helper="Open assigned query opportunities."
            tone="blue"
          />

          <MetricCard
            icon={Flame}
            label="Hot Leads"
            value={
              leadActions.hotLeads
            }
            helper="Daily call and WhatsApp focus."
            tone="red"
          />

          <MetricCard
            icon={CircleDollarSign}
            label="Payment Pending"
            value={
              leadActions.paymentPending
            }
            helper="Revenue-critical payment follow-ups."
            tone="amber"
          />

          <MetricCard
            icon={Workflow}
            label="Revision Pending"
            value={
              leadActions.revisionPending
            }
            helper="Revised quotation actions pending."
            tone="violet"
          />

          <MetricCard
            icon={FileText}
            label="Quote Sent"
            value={
              leadActions.quoteSent
            }
            helper="Queries awaiting decision after quotation."
            tone="emerald"
          />
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

        {/* PORTFOLIO */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            icon={Users}
            title="My Agent Portfolio"
            description="Relationship segments for agents assigned to you."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard
                icon={Users}
                label="Total Agents"
                value={
                  agentPortfolio.total
                }
                tone="slate"
              />

              <MetricCard
                icon={UserPlus}
                label="New Agents"
                value={
                  agentPortfolio.newAgent
                }
                tone="violet"
              />

              <MetricCard
                icon={CheckCircle2}
                label="Regular Business"
                value={
                  agentPortfolio.regular
                }
                tone="emerald"
              />

              <MetricCard
                icon={Activity}
                label="Warm Irregular"
                value={
                  agentPortfolio.warm
                }
                tone="blue"
              />

              <MetricCard
                icon={Clock3}
                label="Inactive"
                value={
                  agentPortfolio.inactive
                }
                tone="amber"
              />

              <MetricCard
                icon={AlertTriangle}
                label="Cold"
                value={
                  agentPortfolio.cold
                }
                tone="red"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={Share2}
            title="Engagement Summary"
            description="Filtered outreach coverage and shared assets."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                icon={Activity}
                label="Engagements"
                value={summary.total}
                tone="blue"
              />

              <MetricCard
                icon={UserCheck}
                label="Agents Covered"
                value={
                  summary.uniqueAgents
                }
                tone="emerald"
              />

              <MetricCard
                icon={Share2}
                label="Asset Shares"
                value={
                  summary.assetShares
                }
                tone="amber"
              />

              <MetricCard
                icon={Clock3}
                label="Last Activity"
                value={formatDate(
                  summary.lastEngagement
                    ?.createdAt
                )}
                tone="slate"
              />
            </div>
          </SectionCard>
        </section>

        {/* ANALYTICS */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SectionCard
            icon={MessageCircle}
            title="Channel Breakdown"
            description="Your activity by communication channel."
          >
            {summary.channelRows
              .length ? (
              <div className="space-y-4">
                {summary.channelRows.map(
                  row => (
                    <ProgressRow
                      key={row.label}
                      label={getChannelLabel(
                        row.label
                      )}
                      value={row.value}
                      total={summary.total}
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyMiniState title="No channel data" />
            )}
          </SectionCard>

          <SectionCard
            icon={MapPin}
            title="Top Destinations"
            description="Most discussed destinations in your activity."
          >
            {summary.destinationRows
              .length ? (
              <div className="space-y-4">
                {summary.destinationRows.map(
                  row => (
                    <ProgressRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      total={summary.total}
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyMiniState title="No destination data" />
            )}
          </SectionCard>

          <SectionCard
            icon={BarChart3}
            title="Outcome Summary"
            description="Most common engagement outcomes."
          >
            {summary.outcomeRows
              .length ? (
              <div className="space-y-4">
                {summary.outcomeRows.map(
                  row => (
                    <ProgressRow
                      key={row.label}
                      label={formatLabel(
                        row.label
                      )}
                      value={row.value}
                      total={summary.total}
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyMiniState title="No outcome data" />
            )}
          </SectionCard>
        </section>

        {/* RECENT ENGAGEMENTS */}
        <SectionCard
          icon={Activity}
          title="Recent Engagements"
          description="Latest activity based on your selected filters."
          rightContent={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {
                filteredEngagements.length
              }{" "}
              records
            </span>
          }
        >
          {recentEngagements.length ? (
            <div className="space-y-3">
              {recentEngagements.map(
                engagement => (
                  <RecentEngagementItem
                    key={engagement.id}
                    engagement={
                      engagement
                    }
                  />
                )
              )}
            </div>
          ) : (
            <EmptyState
              icon="📭"
              title="No engagements found"
              description="Change the filters or record a new engagement."
            />
          )}
        </SectionCard>
      </div>
    </main>
  );
}