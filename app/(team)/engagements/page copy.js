"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flame,
  History,
  ListChecks,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  UserPlus,
  UserRound,
  Users,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import {
  getWeeklyEngagementFocus
} from "@/lib/engagementCadenceEngine";

import {
  rescheduleEngagementTask,
  skipEngagementTask
} from "@/lib/engagementTaskService";

import EngagementForm from "@/app/(team)/engagements/travel-agent/[agentId]/EngagementForm";
import SendCommunicationModal from "@/components/engagement/SendCommunicationModal";

import CardSkeleton from "@/components/ui/CardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

/* =========================
   FILTERS
========================= */

const DEFAULT_FILTERS = {
  search: "",
  bucket: "today",
  ruleCode: "all",
  assignee: "all"
};

const OPEN_TASK_STATUSES = [
  "pending",
  "overdue"
];

/* =========================
   GENERAL HELPERS
========================= */

function normalize(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeRole(value = "") {
  return normalize(value).replace(
    /[\s-]+/g,
    "_"
  );
}

function formatLabel(value = "") {
  if (!value) return "Not Set";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, character =>
      character.toUpperCase()
    );
}

function getFirstValue(...values) {
  return (
    values.find(
      value =>
        typeof value === "string" &&
        value.trim().length > 0
    )?.trim() || ""
  );
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function getStartOfDay(value = new Date()) {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date;
}

function getEndOfDay(value = new Date()) {
  const date = new Date(value);

  date.setHours(23, 59, 59, 999);

  return date;
}

function isSameDay(first, second) {
  if (!first || !second) return false;

  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) return "Not scheduled";

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

  if (!date) return "Not scheduled";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatRelativeDue(value) {
  const date = toDate(value);

  if (!date) return "No due date";

  const now = new Date();
  const startToday = getStartOfDay(now);
  const startDue = getStartOfDay(date);

  const difference = Math.round(
    (startDue.getTime() -
      startToday.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const time = date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );

  if (difference === 0) {
    return `Today, ${time}`;
  }

  if (difference === 1) {
    return `Tomorrow, ${time}`;
  }

  if (difference === -1) {
    return `Yesterday, ${time}`;
  }

  if (difference < -1) {
    return `${Math.abs(
      difference
    )} days overdue`;
  }

  if (difference <= 7) {
    return `In ${difference} days`;
  }

  return formatDate(date);
}

function toDateTimeLocal(value) {
  const date = toDate(value) || new Date();

  const offset = date.getTimezoneOffset();

  const localDate = new Date(
    date.getTime() -
      offset * 60 * 1000
  );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function isPrivilegedUser(user) {
  if (!user) return false;

  const roles = [
    user.role,
    user.userRole,
    user.type,
    user.designation,
    user.claims?.role,
    user.customClaims?.role,
    user.dbUser?.role,
    user.profile?.role
  ].map(normalizeRole);

  return (
    user.isAdmin === true ||
    user.isSuperAdmin === true ||
    user.superAdmin === true ||
    user.claims?.admin === true ||
    user.claims?.super_admin === true ||
    user.customClaims?.admin === true ||
    user.customClaims?.super_admin ===
      true ||
    roles.includes("admin") ||
    roles.includes("super_admin")
  );
}

/* =========================
   TASK HELPERS
========================= */

function isOpenTask(task) {
  return (
    OPEN_TASK_STATUSES.includes(
      normalize(task?.status)
    ) &&
    task?.deleted !== true &&
    task?.isDeleted !== true
  );
}

function getTaskBucket(task) {
  const dueAt = toDate(task?.dueAt);

  if (!dueAt) return "upcoming";

  const today = new Date();
  const startToday = getStartOfDay(today);
  const endToday = getEndOfDay(today);

  if (dueAt < startToday) {
    return "overdue";
  }

  if (dueAt <= endToday) {
    return "today";
  }

  return "upcoming";
}

function getTaskBucketRank(task) {
  const bucket = getTaskBucket(task);

  const rank = {
    overdue: 0,
    today: 1,
    upcoming: 2
  };

  return rank[bucket] ?? 3;
}

function sortTasks(first, second) {
  const bucketDifference =
    getTaskBucketRank(first) -
    getTaskBucketRank(second);

  if (bucketDifference !== 0) {
    return bucketDifference;
  }

  const firstDue =
    toDate(first.dueAt)?.getTime() ||
    Number.MAX_SAFE_INTEGER;

  const secondDue =
    toDate(second.dueAt)?.getTime() ||
    Number.MAX_SAFE_INTEGER;

  if (firstDue !== secondDue) {
    return firstDue - secondDue;
  }

  return (
    Number(second.priority || 0) -
    Number(first.priority || 0)
  );
}

function getTaskAgentName(task) {
  return getFirstValue(
    task?.agentName,
    task?.agencyName,
    "Unknown Travel Agent"
  );
}

function getTaskAssignee(task) {
  return getFirstValue(
    task?.assignedToName,
    task?.assignedToEmail,
    "Unassigned"
  );
}

function getTaskTitle(task) {
  return getFirstValue(
    task?.title,
    task?.purpose,
    formatLabel(task?.ruleCode),
    "Agent Follow-up"
  );
}

function getTaskPriority(task) {
  return Number(task?.priority || 0);
}

function getPriorityLabel(task) {
  const priority =
    getTaskPriority(task);

  if (priority >= 95) return "Critical";
  if (priority >= 85) return "High";
  if (priority >= 60) return "Medium";

  return "Normal";
}

function getPriorityClasses(task) {
  const priority =
    getTaskPriority(task);

  if (priority >= 95) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority >= 85) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (priority >= 60) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getBucketClasses(task) {
  const bucket = getTaskBucket(task);

  if (bucket === "overdue") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (bucket === "today") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getRuleIcon(ruleCode = "") {
  const rule = normalize(ruleCode);

  if (rule.includes("payment")) {
    return AlertTriangle;
  }

  if (rule.includes("hot")) {
    return Flame;
  }

  if (
    rule.includes("quotation") ||
    rule.includes("revision")
  ) {
    return RotateCcw;
  }

  if (rule.includes("new_agent")) {
    return UserPlus;
  }

  return CalendarClock;
}

function getRecommendedChannels(task) {
  return Array.isArray(
    task?.recommendedChannels
  )
    ? task.recommendedChannels
    : [];
}

function getPrimarySpoc(agent = {}) {
  if (
    Array.isArray(agent.spocs) &&
    agent.spocs.length > 0
  ) {
    return (
      agent.spocs.find(
        spoc => spoc.isPrimary
      ) ||
      agent.spocs[0] ||
      null
    );
  }

  return null;
}

function getAgentPhone(agent = {}) {
  const spoc = getPrimarySpoc(agent);

  return getFirstValue(
    spoc?.mobile,
    spoc?.phone,
    agent.genericContact?.phone,
    agent.mobile,
    agent.phone
  );
}

function getAgentEmail(agent = {}) {
  const spoc = getPrimarySpoc(agent);

  return getFirstValue(
    spoc?.email,
    agent.genericContact?.email,
    agent.email
  );
}

function getAgentDestinationIds(
  agent = {},
  task = {}
) {
  if (
    Array.isArray(task.destinationIds) &&
    task.destinationIds.length
  ) {
    return task.destinationIds.filter(
      Boolean
    );
  }

  if (
    Array.isArray(agent.destinationIds)
  ) {
    return agent.destinationIds.filter(
      Boolean
    );
  }

  return [];
}

function getAgentDestinationName(
  agent = {},
  task = {}
) {
  return getFirstValue(
    task.destinationName,
    task.destinationNames?.[0],
    agent.destinations?.[0]?.name,
    ""
  );
}

function buildLeadFromTask(task) {
  if (
    !task?.leadId &&
    !task?.leadCode &&
    !task?.leadStage &&
    !task?.ruleCode
  ) {
    return null;
  }

  return {
    id: task.leadId || "",
    leadId: task.leadId || "",
    leadCode: task.leadCode || "",

    stage:
      task.leadStage ||
      task.leadStageCode ||
      task.ruleCode ||
      "",

    leadStage:
      task.leadStage ||
      task.leadStageCode ||
      task.ruleCode ||
      ""
  };
}

/* =========================
   ENGAGEMENT HELPERS
========================= */

function getEngagementAgentName(
  engagement
) {
  return getFirstValue(
    engagement?.agentName,
    engagement?.travelAgentName,
    engagement?.agencyName,
    "Unknown Agent"
  );
}

function getEngagementChannel(
  engagement
) {
  return getFirstValue(
    engagement?.channel,
    engagement?.activityType,
    "other"
  );
}

function getChannelLabel(channel = "") {
  const labels = {
    call: "Call",
    whatsapp: "WhatsApp",
    whatsapp_opened: "WhatsApp",
    email: "Email",
    email_sent: "Email",
    meeting: "Meeting",
    online_meeting: "Online Meeting",
    offline_meeting: "Offline Meeting",
    site_visit: "Site Visit"
  };

  return (
    labels[normalize(channel)] ||
    formatLabel(channel)
  );
}

function getChannelIcon(channel = "") {
  const normalized =
    normalize(channel);

  if (normalized.includes("call")) {
    return Phone;
  }

  if (
    normalized.includes("whatsapp")
  ) {
    return MessageCircle;
  }

  if (normalized.includes("email")) {
    return Mail;
  }

  return Activity;
}

/* =========================
   SMALL UI COMPONENTS
========================= */

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "blue"
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald:
      "bg-emerald-50 text-emerald-700",
    amber:
      "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple:
      "bg-purple-50 text-purple-700"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {value}
          </p>

          {helper && (
            <p className="mt-1 text-xs text-slate-400">
              {helper}
            </p>
          )}
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
            tones[tone] || tones.blue
          }`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function FilterTab({
  active,
  label,
  count,
  onClick,
  tone = "blue"
}) {
  const activeClasses = {
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700",
    purple:
      "border-purple-200 bg-purple-50 text-purple-700"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition
        ${
          active
            ? activeClasses[tone] ||
              activeClasses.blue
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }
      `}
    >
      {label}

      <span
        className={`
          rounded-full px-1.5 py-0.5 text-[10px]
          ${
            active
              ? "bg-white/80"
              : "bg-slate-100"
          }
        `}
      >
        {count}
      </span>
    </button>
  );
}

function PriorityBadge({ task }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPriorityClasses(
        task
      )}`}
    >
      {getPriorityLabel(task)}
    </span>
  );
}

function DueBadge({ task }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getBucketClasses(
        task
      )}`}
    >
      <Clock3 size={11} />
      {formatRelativeDue(task.dueAt)}
    </span>
  );
}

function ChannelPill({ channel }) {
  const normalized =
    normalize(channel);

  const config = {
    call: {
      icon: Phone,
      classes:
        "border-green-100 bg-green-50 text-green-700"
    },

    whatsapp: {
      icon: MessageCircle,
      classes:
        "border-emerald-100 bg-emerald-50 text-emerald-700"
    },

    email: {
      icon: Mail,
      classes:
        "border-blue-100 bg-blue-50 text-blue-700"
    }
  };

  const item =
    config[normalized] || {
      icon: Send,
      classes:
        "border-slate-200 bg-slate-50 text-slate-600"
    };

  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${item.classes}`}
    >
      <Icon size={11} />
      {formatLabel(channel)}
    </span>
  );
}

function SectionCard({
  title,
  description,
  right,
  children
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-xs text-slate-500">
              {description}
            </p>
          )}
        </div>

        {right}
      </div>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

/* =========================
   TASK CARD
========================= */

function EngagementTaskCard({
  task,
  agent,
  busy,
  onCall,
  onWhatsApp,
  onEmail,
  onRecord,
  onReschedule,
  onSkip
}) {
  const Icon = getRuleIcon(
    task.ruleCode
  );

  const phone =
    getAgentPhone(agent);

  const email =
    getAgentEmail(agent);

  const channels =
    getRecommendedChannels(task);

  const showCall =
    channels.length === 0 ||
    channels.includes("call");

  const showWhatsApp =
    channels.length === 0 ||
    channels.includes("whatsapp");

  const showEmail =
    channels.length === 0 ||
    channels.includes("email");

  return (
    <article
      className={`
        rounded-2xl border bg-white p-4 transition hover:shadow-sm
        ${
          getTaskBucket(task) ===
          "overdue"
            ? "border-red-200"
            : "border-slate-200"
        }
      `}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`
              flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl
              ${
                getTaskBucket(task) ===
                "overdue"
                  ? "bg-red-50 text-red-700"
                  : "bg-blue-50 text-blue-700"
              }
            `}
          >
            <Icon size={20} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-950">
                {getTaskTitle(task)}
              </h3>

              <PriorityBadge task={task} />
              <DueBadge task={task} />
            </div>

            <p className="mt-1 text-sm font-medium text-slate-700">
              {getTaskAgentName(task)}
            </p>

            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              {task.agentCode && (
                <span>
                  {task.agentCode}
                </span>
              )}

              {task.leadCode && (
                <span>
                  Lead: {task.leadCode}
                </span>
              )}

              <span>
                Assigned to:{" "}
                {getTaskAssignee(task)}
              </span>
            </div>

            {task.purpose && (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                {task.purpose}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {task.ruleCode && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {formatLabel(
                    task.ruleCode
                  )}
                </span>
              )}

              {task.frequencyLabel && (
                <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700">
                  {task.frequencyLabel}
                </span>
              )}

              {task.sequenceDay !== null &&
                task.sequenceDay !==
                  undefined && (
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                    New Agent Day{" "}
                    {task.sequenceDay}
                  </span>
                )}

              {channels.map(channel => (
                <ChannelPill
                  key={channel}
                  channel={channel}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
          {showCall && (
            <button
              type="button"
              disabled={!phone || busy}
              onClick={() =>
                onCall(task, agent)
              }
              title={
                phone
                  ? `Call ${phone}`
                  : "No phone number available"
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Phone size={14} />
              Call
            </button>
          )}

          {showWhatsApp && (
            <button
              type="button"
              disabled={!phone || busy}
              onClick={() =>
                onWhatsApp(task, agent)
              }
              title={
                phone
                  ? "Send WhatsApp"
                  : "No mobile number available"
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle
                size={14}
              />
              WhatsApp
            </button>
          )}

          {showEmail && (
            <button
              type="button"
              disabled={!email || busy}
              onClick={() =>
                onEmail(task, agent)
              }
              title={
                email
                  ? "Send Email"
                  : "No email address available"
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail size={14} />
              Email
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onRecord(task, agent)
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <CheckCircle2 size={14} />
            Record
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onReschedule(task)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <CalendarClock size={14} />
            Reschedule
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onSkip(task)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-60"
          >
            Skip
          </button>

          <Link
            href={`/engagements/travel-agent/${task.agentId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Timeline
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* =========================
   RECENT ENGAGEMENT
========================= */

function RecentEngagementItem({
  engagement
}) {
  const channel =
    getEngagementChannel(engagement);

  const Icon =
    getChannelIcon(channel);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
        <Icon size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {getEngagementAgentName(
                engagement
              )}
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              {getChannelLabel(channel)}
              {" • "}
              {formatDateTime(
                engagement.createdAt
              )}
            </p>
          </div>

          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {formatLabel(
              engagement.outcomeLabel ||
                engagement.outcomeCode ||
                engagement.status
            )}
          </span>
        </div>

        {(engagement.messageText ||
          engagement.message ||
          engagement.subject) && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
            {engagement.subject ||
              engagement.messageText ||
              engagement.message}
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================
   MODALS
========================= */

function ModalShell({
  title,
  description,
  onClose,
  children,
  size = "max-w-3xl"
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div
        className={`flex max-h-[92vh] w-full ${size} flex-col overflow-hidden rounded-2xl bg-white shadow-xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-xs text-slate-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({
  task,
  loading,
  onClose,
  onSave
}) {
  const [dueAt, setDueAt] =
    useState(
      toDateTimeLocal(task?.dueAt)
    );

  const [reason, setReason] =
    useState("");

  return (
    <ModalShell
      title="Reschedule Engagement"
      description={getTaskAgentName(
        task
      )}
      onClose={onClose}
      size="max-w-lg"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            New Date & Time
          </label>

          <input
            type="datetime-local"
            value={dueAt}
            onChange={event =>
              setDueAt(
                event.target.value
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reason
          </label>

          <textarea
            rows={3}
            value={reason}
            onChange={event =>
              setReason(
                event.target.value
              )
            }
            placeholder="Example: Agent requested a callback tomorrow."
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading || !dueAt}
            onClick={() =>
              onSave({
                dueAt,
                reason
              })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading && (
              <Loader2
                size={15}
                className="animate-spin"
              />
            )}

            Save New Date
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function SkipModal({
  task,
  loading,
  onClose,
  onSave
}) {
  const [reason, setReason] =
    useState("");

  return (
    <ModalShell
      title="Skip Engagement Task"
      description={getTaskAgentName(
        task
      )}
      onClose={onClose}
      size="max-w-lg"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Skipping closes this task without
          recording an engagement.
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Skip Reason
          </label>

          <textarea
            rows={4}
            value={reason}
            onChange={event =>
              setReason(
                event.target.value
              )
            }
            placeholder="Explain why this task is being skipped."
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              loading ||
              !reason.trim()
            }
            onClick={() =>
              onSave(reason)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {loading && (
              <Loader2
                size={15}
                className="animate-spin"
              />
            )}

            Skip Task
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* =========================
   MAIN PAGE
========================= */

export default function EngagementDashboardPage() {
  const {
    user,
    loading: authLoading
  } = useAuth();

  const canViewAllTasks =
    isPrivilegedUser(user);

  const [tasks, setTasks] =
    useState([]);

  const [agents, setAgents] =
    useState([]);

  const [
    engagements,
    setEngagements
  ] = useState([]);

  const [
    tasksLoading,
    setTasksLoading
  ] = useState(true);

  const [
    agentsLoading,
    setAgentsLoading
  ] = useState(true);

  const [error, setError] =
    useState("");

  const [filters, setFilters] =
    useState(DEFAULT_FILTERS);

  const [
    selectedTask,
    setSelectedTask
  ] = useState(null);

  const [
    selectedAgent,
    setSelectedAgent
  ] = useState(null);

  const [
    actionMode,
    setActionMode
  ] = useState("");

  const [
    actionLoading,
    setActionLoading
  ] = useState(false);

  /* =========================
     LOAD TASKS
  ========================== */

  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);
    setError("");

    const taskQuery =
      canViewAllTasks
        ? collection(
            db,
            "engagementTasks"
          )
        : query(
            collection(
              db,
              "engagementTasks"
            ),
            where(
              "assignedToUid",
              "==",
              user.uid
            )
          );

    const unsubscribe =
      onSnapshot(
        taskQuery,
        snapshot => {
          const rows =
            snapshot.docs.map(
              taskDocument => ({
                id:
                  taskDocument.id,

                ...taskDocument.data()
              })
            );

          setTasks(rows);
          setTasksLoading(false);
        },
        taskError => {
          console.error(
            "Failed to load engagement tasks:",
            taskError
          );

          setError(
            "Unable to load the engagement task queue. Check Firestore permissions."
          );

          setTasksLoading(false);
        }
      );

    return () => unsubscribe();
  }, [
    user?.uid,
    authLoading,
    canViewAllTasks
  ]);

  /* =========================
     LOAD AGENTS
  ========================== */

  useEffect(() => {
    if (authLoading || !user?.uid) {
      return;
    }

    setAgentsLoading(true);

    const unsubscribe =
      onSnapshot(
        collection(
          db,
          "travelAgents"
        ),
        snapshot => {
          setAgents(
            snapshot.docs.map(
              agentDocument => ({
                id:
                  agentDocument.id,

                ...agentDocument.data()
              })
            )
          );

          setAgentsLoading(false);
        },
        agentError => {
          console.error(
            "Failed to load travel agents:",
            agentError
          );

          setError(
            "Engagement tasks loaded, but travel-agent profiles could not be loaded."
          );

          setAgentsLoading(false);
        }
      );

    return () => unsubscribe();
  }, [
    user?.uid,
    authLoading
  ]);

  /* =========================
     LOAD RECENT ENGAGEMENTS
  ========================== */

  useEffect(() => {
    if (authLoading || !user?.uid) {
      return;
    }

    const engagementQuery =
      canViewAllTasks
        ? collection(
            db,
            "engagements"
          )
        : query(
            collection(
              db,
              "engagements"
            ),
            where(
              "createdByUid",
              "==",
              user.uid
            )
          );

    const unsubscribe =
      onSnapshot(
        engagementQuery,
        snapshot => {
          const rows =
            snapshot.docs
              .map(
                engagementDocument => ({
                  id:
                    engagementDocument.id,

                  ...engagementDocument.data()
                })
              )
              .filter(
                engagement =>
                  engagement.deleted !==
                    true &&
                  engagement.isDeleted !==
                    true
              )
              .sort(
                (first, second) => {
                  const firstTime =
                    toDate(
                      first.createdAt
                    )?.getTime() || 0;

                  const secondTime =
                    toDate(
                      second.createdAt
                    )?.getTime() || 0;

                  return (
                    secondTime -
                    firstTime
                  );
                }
              );

          setEngagements(rows);
        },
        engagementError => {
          console.warn(
            "Recent engagements could not be loaded:",
            engagementError
          );
        }
      );

    return () => unsubscribe();
  }, [
    user?.uid,
    authLoading,
    canViewAllTasks
  ]);

  /* =========================
     MAPS AND OPTIONS
  ========================== */

  const agentMap = useMemo(() => {
    const map = new Map();

    agents.forEach(agent => {
      map.set(agent.id, agent);
    });

    return map;
  }, [agents]);

  const openTasks = useMemo(() => {
    return tasks
      .filter(isOpenTask)
      .sort(sortTasks);
  }, [tasks]);

  const ruleOptions = useMemo(() => {
    return Array.from(
      new Set(
        openTasks
          .map(task => task.ruleCode)
          .filter(Boolean)
      )
    ).sort();
  }, [openTasks]);

  const assigneeOptions =
    useMemo(() => {
      return Array.from(
        new Set(
          openTasks
            .map(getTaskAssignee)
            .filter(
              name =>
                name &&
                name !== "Unassigned"
            )
        )
      ).sort();
    }, [openTasks]);

  const weeklyFocus = useMemo(
    () =>
      getWeeklyEngagementFocus(
        new Date()
      ),
    []
  );

  /* =========================
     SUMMARY
  ========================== */

  const summary = useMemo(() => {
    const todayTasks =
      openTasks.filter(
        task =>
          getTaskBucket(task) ===
          "today"
      );

    const overdueTasks =
      openTasks.filter(
        task =>
          getTaskBucket(task) ===
          "overdue"
      );

    const upcomingTasks =
      openTasks.filter(
        task =>
          getTaskBucket(task) ===
          "upcoming"
      );

    const criticalTasks =
      openTasks.filter(
        task =>
          getTaskPriority(task) >= 95
      );

    return {
      open: openTasks.length,
      today: todayTasks.length,
      overdue: overdueTasks.length,
      upcoming: upcomingTasks.length,
      critical: criticalTasks.length
    };
  }, [openTasks]);

  /* =========================
     FILTERED QUEUE
  ========================== */

  const filteredTasks =
    useMemo(() => {
      const searchText =
        normalize(filters.search);

      return openTasks.filter(task => {
        const bucket =
          getTaskBucket(task);

        if (
          filters.bucket !==
            "all" &&
          bucket !== filters.bucket
        ) {
          return false;
        }

        if (
          filters.ruleCode !==
            "all" &&
          task.ruleCode !==
            filters.ruleCode
        ) {
          return false;
        }

        if (
          filters.assignee !==
            "all" &&
          getTaskAssignee(task) !==
            filters.assignee
        ) {
          return false;
        }

        if (searchText) {
          const agent =
            agentMap.get(
              task.agentId
            ) || {};

          const searchable = [
            task.title,
            task.purpose,
            task.ruleCode,
            task.ruleGroup,
            task.agentName,
            task.agentCode,
            task.leadCode,
            task.assignedToName,
            task.assignedToEmail,
            agent.agencyName,
            getAgentPhone(agent),
            getAgentEmail(agent)
          ]
            .map(normalize)
            .join(" ");

          if (
            !searchable.includes(
              searchText
            )
          ) {
            return false;
          }
        }

        return true;
      });
    }, [
      openTasks,
      filters,
      agentMap
    ]);

  const recentEngagements =
    useMemo(
      () =>
        engagements.slice(0, 8),
      [engagements]
    );

  const channelSummary =
    useMemo(() => {
      const map = {};

      engagements
        .slice(0, 100)
        .forEach(engagement => {
          const channel =
            getEngagementChannel(
              engagement
            );

          map[channel] =
            (map[channel] || 0) + 1;
        });

      return Object.entries(map)
        .map(([label, value]) => ({
          label,
          value
        }))
        .sort(
          (first, second) =>
            second.value -
            first.value
        );
    }, [engagements]);

  /* =========================
     ACTION HELPERS
  ========================== */

  const closeAction = () => {
    if (actionLoading) return;

    setSelectedTask(null);
    setSelectedAgent(null);
    setActionMode("");
  };

  const resolveAgent = task => {
    const agent =
      agentMap.get(task.agentId);

    if (!agent) {
      alert(
        "Travel-agent profile was not found."
      );

      return null;
    }

    return agent;
  };

  const openRecord = (
    task,
    providedAgent
  ) => {
    const agent =
      providedAgent ||
      resolveAgent(task);

    if (!agent) return;

    setSelectedTask(task);
    setSelectedAgent(agent);
    setActionMode("record");
  };

  const openCommunication = (
    task,
    providedAgent,
    channel
  ) => {
    const agent =
      providedAgent ||
      resolveAgent(task);

    if (!agent) return;

    setSelectedTask({
      ...task,
      preferredActionChannel:
        channel
    });

    setSelectedAgent(agent);
    setActionMode("communication");
  };

  const callAgent = (
    task,
    providedAgent
  ) => {
    const agent =
      providedAgent ||
      resolveAgent(task);

    if (!agent) return;

    const phone =
      getAgentPhone(agent);

    if (!phone) {
      alert(
        "No phone number is available for this travel agent."
      );

      return;
    }

    window.location.href = `tel:${phone.replace(
      /[^\d+]/g,
      ""
    )}`;
  };

  const openReschedule = task => {
    setSelectedTask(task);
    setSelectedAgent(
      agentMap.get(task.agentId) ||
        null
    );
    setActionMode("reschedule");
  };

  const openSkip = task => {
    setSelectedTask(task);
    setSelectedAgent(
      agentMap.get(task.agentId) ||
        null
    );
    setActionMode("skip");
  };

  const saveReschedule =
    async ({
      dueAt,
      reason
    }) => {
      if (!selectedTask?.id) {
        return;
      }

      const date = new Date(dueAt);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        alert(
          "Please select a valid date and time."
        );

        return;
      }

      try {
        setActionLoading(true);

        await rescheduleEngagementTask({
          taskId:
            selectedTask.id,

          dueAt: date,
          reason,
          user
        });

        closeAction();
      } catch (rescheduleError) {
        console.error(
          "Failed to reschedule task:",
          rescheduleError
        );

        alert(
          rescheduleError?.message ||
            "Unable to reschedule the task."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const saveSkip =
    async reason => {
      if (!selectedTask?.id) {
        return;
      }

      try {
        setActionLoading(true);

        await skipEngagementTask({
          taskId:
            selectedTask.id,

          reason,
          user
        });

        closeAction();
      } catch (skipError) {
        console.error(
          "Failed to skip task:",
          skipError
        );

        alert(
          skipError?.message ||
            "Unable to skip the task."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const communicationSeed =
    useMemo(() => {
      if (
        actionMode !==
          "communication" ||
        !selectedTask ||
        !selectedAgent
      ) {
        return null;
      }

      const channel =
        selectedTask.preferredActionChannel ||
        "email";

      const destinationIds =
        getAgentDestinationIds(
          selectedAgent,
          selectedTask
        );

      return {
        channel,

        intentCode:
          selectedTask.suggestedIntentCode ||
          "",

        destinationIds,

        destinationRefId:
          destinationIds[0] ||
          "",

        destinationName:
          getAgentDestinationName(
            selectedAgent,
            selectedTask
          ),

        leadId:
          selectedTask.leadId ||
          "",

        leadCode:
          selectedTask.leadCode ||
          "",

        leadStage:
          selectedTask.leadStage ||
          selectedTask.ruleCode ||
          "",

        sourceTaskRuleCode:
          selectedTask.ruleCode ||
          "",

        sourceTaskRuleGroup:
          selectedTask.ruleGroup ||
          "",

        cadencePhase:
          selectedTask.cadencePhase ||
          "",

        cadenceSequenceStep:
          selectedTask.sequenceStep ??
          null,

        cadenceSequenceDay:
          selectedTask.sequenceDay ??
          null
      };
    }, [
      actionMode,
      selectedTask,
      selectedAgent
    ]);

  /* =========================
     LOADING
  ========================== */

  if (
    authLoading ||
    tasksLoading ||
    agentsLoading
  ) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
          <CardSkeleton />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>

          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    );
  }

  /* =========================
     PAGE
  ========================== */

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 shadow-sm">
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
                  <ListChecks size={24} />
                </div>

                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                    <Activity size={14} />
                    Engagement Command Centre
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight text-white">
                    Engagement Task Queue
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">
                    Prioritize overdue work,
                    active queries, quotations,
                    hot leads, payment follow-ups
                    and relationship engagement.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-white backdrop-blur lg:max-w-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                  {weeklyFocus?.day ||
                    "Today"}{" "}
                  Focus
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {weeklyFocus?.title ||
                    "Engagement Follow-up"}
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-100">
                  {weeklyFocus?.purpose ||
                    "Work through the highest-priority engagement tasks."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* KPI */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={ListChecks}
            label="Open Tasks"
            value={summary.open}
            helper={
              canViewAllTasks
                ? "All team tasks"
                : "Assigned to you"
            }
            tone="blue"
          />

          <KpiCard
            icon={CalendarDays}
            label="Due Today"
            value={summary.today}
            helper="Today's engagement queue"
            tone="amber"
          />

          <KpiCard
            icon={AlertTriangle}
            label="Overdue"
            value={summary.overdue}
            helper="Pending from earlier dates"
            tone="red"
          />

          <KpiCard
            icon={CalendarClock}
            label="Upcoming"
            value={summary.upcoming}
            helper="Scheduled after today"
            tone="purple"
          />

          <KpiCard
            icon={Flame}
            label="Critical"
            value={summary.critical}
            helper="Payment or hot leads"
            tone="emerald"
          />
        </section>

        {/* FILTER PANEL */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={filters.search}
                  onChange={event =>
                    setFilters(previous => ({
                      ...previous,

                      search:
                        event.target.value
                    }))
                  }
                  placeholder="Search agent, task, lead or assignee..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cadence Rule
              </label>

              <select
                value={filters.ruleCode}
                onChange={event =>
                  setFilters(previous => ({
                    ...previous,

                    ruleCode:
                      event.target.value
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">
                  All Cadence Rules
                </option>

                {ruleOptions.map(
                  ruleCode => (
                    <option
                      key={ruleCode}
                      value={ruleCode}
                    >
                      {formatLabel(
                        ruleCode
                      )}
                    </option>
                  )
                )}
              </select>
            </div>

            {canViewAllTasks && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assigned To
                </label>

                <select
                  value={filters.assignee}
                  onChange={event =>
                    setFilters(previous => ({
                      ...previous,

                      assignee:
                        event.target.value
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="all">
                    All Team Members
                  </option>

                  {assigneeOptions.map(
                    assignee => (
                      <option
                        key={assignee}
                        value={assignee}
                      >
                        {assignee}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setFilters(
                    DEFAULT_FILTERS
                  )
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw size={15} />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <FilterTab
              active={
                filters.bucket ===
                "today"
              }
              label="Today"
              count={summary.today}
              tone="amber"
              onClick={() =>
                setFilters(previous => ({
                  ...previous,
                  bucket: "today"
                }))
              }
            />

            <FilterTab
              active={
                filters.bucket ===
                "overdue"
              }
              label="Overdue"
              count={summary.overdue}
              tone="red"
              onClick={() =>
                setFilters(previous => ({
                  ...previous,
                  bucket: "overdue"
                }))
              }
            />

            <FilterTab
              active={
                filters.bucket ===
                "upcoming"
              }
              label="Upcoming"
              count={summary.upcoming}
              tone="purple"
              onClick={() =>
                setFilters(previous => ({
                  ...previous,
                  bucket: "upcoming"
                }))
              }
            />

            <FilterTab
              active={
                filters.bucket ===
                "all"
              }
              label="All Open"
              count={summary.open}
              onClick={() =>
                setFilters(previous => ({
                  ...previous,
                  bucket: "all"
                }))
              }
            />
          </div>
        </section>

        {/* MAIN LAYOUT */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* TASK QUEUE */}
          <div className="xl:col-span-8">
            <SectionCard
              title="Action Queue"
              description={`Showing ${filteredTasks.length} of ${openTasks.length} open tasks`}
              right={
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {formatLabel(
                    filters.bucket
                  )}
                </span>
              }
            >
              {filteredTasks.length ===
              0 ? (
                <EmptyState
                  icon="✅"
                  title="No engagement tasks found"
                  description={
                    filters.bucket ===
                    "today"
                      ? "There are no pending tasks due today."
                      : "Try changing the queue filter or search."
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map(task => {
                    const agent =
                      agentMap.get(
                        task.agentId
                      ) || {};

                    return (
                      <EngagementTaskCard
                        key={task.id}
                        task={task}
                        agent={agent}
                        busy={
                          actionLoading &&
                          selectedTask?.id ===
                            task.id
                        }
                        onCall={callAgent}
                        onWhatsApp={(
                          selectedTaskItem,
                          selectedAgentItem
                        ) =>
                          openCommunication(
                            selectedTaskItem,
                            selectedAgentItem,
                            "whatsapp"
                          )
                        }
                        onEmail={(
                          selectedTaskItem,
                          selectedAgentItem
                        ) =>
                          openCommunication(
                            selectedTaskItem,
                            selectedAgentItem,
                            "email"
                          )
                        }
                        onRecord={
                          openRecord
                        }
                        onReschedule={
                          openReschedule
                        }
                        onSkip={
                          openSkip
                        }
                      />
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-5 xl:col-span-4">
            <SectionCard
              title="Today's Operating Focus"
              description="Recommended engagement rhythm"
            >
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
                    <BarChart3 size={18} />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      {weeklyFocus?.day}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {weeklyFocus?.title}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {weeklyFocus?.purpose}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  "Payment Pending",
                  "Hot Lead",
                  "Active Query",
                  "Revision Pending",
                  "Active Quotation"
                ].map(
                  (label, index) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-slate-700 shadow-sm">
                          {index + 1}
                        </span>

                        <span className="text-xs font-medium text-slate-700">
                          {label}
                        </span>
                      </div>

                      <ChevronRight
                        size={14}
                        className="text-slate-400"
                      />
                    </div>
                  )
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Recent Activity"
              description="Latest recorded engagements"
            >
              {recentEngagements.length ===
              0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                  <History className="mx-auto h-7 w-7 text-slate-300" />

                  <p className="mt-2 text-sm font-medium text-slate-700">
                    No engagement history
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentEngagements
                    .slice(0, 5)
                    .map(engagement => (
                      <RecentEngagementItem
                        key={
                          engagement.id
                        }
                        engagement={
                          engagement
                        }
                      />
                    ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Channel Activity"
              description="Latest 100 engagement records"
            >
              {channelSummary.length ===
              0 ? (
                <p className="text-sm text-slate-500">
                  No channel data available.
                </p>
              ) : (
                <div className="space-y-3">
                  {channelSummary.map(
                    item => {
                      const maximum =
                        Math.max(
                          ...channelSummary.map(
                            row =>
                              row.value
                          )
                        );

                      const percentage =
                        maximum > 0
                          ? Math.round(
                              (item.value /
                                maximum) *
                                100
                            )
                          : 0;

                      return (
                        <div
                          key={item.label}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-slate-600">
                              {getChannelLabel(
                                item.label
                              )}
                            </span>

                            <span className="font-semibold text-slate-900">
                              {item.value}
                            </span>
                          </div>

                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${percentage}%`
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </SectionCard>
          </div>
        </section>
      </div>

      {/* RECORD ENGAGEMENT */}
      {actionMode === "record" &&
        selectedTask &&
        selectedAgent && (
          <ModalShell
            title="Record Engagement"
            description={`${getTaskTitle(
              selectedTask
            )} • ${getTaskAgentName(
              selectedTask
            )}`}
            onClose={closeAction}
            size="max-w-4xl"
          >
            <EngagementForm
              agent={selectedAgent}
              sourceTask={
                selectedTask
              }
              sourceTaskId={
                selectedTask.id
              }
              lead={buildLeadFromTask(
                selectedTask
              )}
              onSaved={() => {
                setSelectedTask(null);
                setSelectedAgent(null);
                setActionMode("");
              }}
              onClose={closeAction}
            />
          </ModalShell>
        )}

      {/* SEND COMMUNICATION */}
      {actionMode ===
        "communication" &&
        selectedTask &&
        selectedAgent &&
        communicationSeed && (
          <SendCommunicationModal
            engagement={
              communicationSeed
            }
            agent={selectedAgent}
            sourceTask={
              selectedTask
            }
            sourceTaskId={
              selectedTask.id
            }
            lead={buildLeadFromTask(
              selectedTask
            )}
            onSent={() => {
              setSelectedTask(null);
              setSelectedAgent(null);
              setActionMode("");
            }}
            onClose={closeAction}
          />
        )}

      {/* RESCHEDULE */}
      {actionMode ===
        "reschedule" &&
        selectedTask && (
          <RescheduleModal
            task={selectedTask}
            loading={actionLoading}
            onClose={closeAction}
            onSave={saveReschedule}
          />
        )}

      {/* SKIP */}
      {actionMode === "skip" &&
        selectedTask && (
          <SkipModal
            task={selectedTask}
            loading={actionLoading}
            onClose={closeAction}
            onSave={saveSkip}
          />
        )}
    </main>
  );
}