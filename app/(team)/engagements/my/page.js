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
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Package,
  Timer,
  UserRound
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import EngagementCard from "@/components/engagement/EngagementCard";
import EngagementFilterBar from "@/components/engagement/EngagementFilterBar";
import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";

/* =========================
   DEFAULT FILTERS
========================= */
const DEFAULT_FILTERS = {
  search: "",
  travelAgent: "",
  spoc: "",
  destination: "",
  channel: "all",
  relation: "all",
  dateFrom: "",
  dateTo: ""
};

/* =========================
   DATE HELPERS
========================= */
const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const getValidDate = value => {
  if (!value) return null;

  if (value?.toDate) return value.toDate();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const msValue = value < 10000000000 ? value * 1000 : value;
    const date = new Date(msValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateLabel = value => {
  const d = getValidDate(value);

  if (!d) return "Unknown date";

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const getLocalDateKey = value => {
  const d = getValidDate(value);
  if (!d) return "unknown";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getStartOfDay = value => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
};

const getEndOfDay = value => {
  if (!value) return null;
  return new Date(`${value}T23:59:59`);
};

const normalize = value =>
  String(value || "")
    .trim()
    .toLowerCase();

/* =========================
   COMMON HELPERS
========================= */
function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   FIELD HELPERS
========================= */
const getAgentId = engagement =>
  engagement?.travelAgentId ||
  engagement?.agentId ||
  engagement?.travelAgentRefId ||
  engagement?.travelAgentDocId ||
  engagement?.agent?.id ||
  engagement?.agent?.travelAgentId ||
  engagement?.travelAgent?.id ||
  "";

const getAgentName = engagement =>
  engagement?.travelAgentName ||
  engagement?.agentName ||
  engagement?.agent?.agencyName ||
  engagement?.agent?.name ||
  engagement?.travelAgent?.agencyName ||
  engagement?.travelAgent?.name ||
  engagement?.agencyName ||
  "";

const getSpocName = engagement =>
  engagement?.spoc?.name ||
  engagement?.spocName ||
  engagement?.contactPerson ||
  engagement?.agent?.spocName ||
  engagement?.travelAgent?.spocName ||
  "";

const getDestinationName = (engagement = {}) => {
  if (Array.isArray(engagement?.destinationNames)) {
    return engagement.destinationNames.filter(Boolean).join(", ");
  }

  if (Array.isArray(engagement?.destinations)) {
    return engagement.destinations
      .map(item =>
        typeof item === "string"
          ? item
          : item?.name || item?.destinationName || ""
      )
      .filter(Boolean)
      .join(", ");
  }

  if (typeof engagement?.destinationName === "string") {
    return engagement.destinationName;
  }

  if (typeof engagement?.destination?.name === "string") {
    return engagement.destination.name;
  }

  if (typeof engagement?.destination === "string") {
    return engagement.destination;
  }

  return "";
};

const getAgentEmail = engagement =>
  engagement?.agentEmail ||
  engagement?.travelAgentEmail ||
  engagement?.email ||
  engagement?.spoc?.email ||
  engagement?.agent?.email ||
  engagement?.agent?.primaryEmail ||
  engagement?.agent?.contact?.email ||
  engagement?.travelAgent?.email ||
  "";

const getAgentPhone = engagement =>
  engagement?.agentPhone ||
  engagement?.travelAgentPhone ||
  engagement?.phone ||
  engagement?.mobile ||
  engagement?.spoc?.phone ||
  engagement?.spoc?.mobile ||
  engagement?.agent?.phone ||
  engagement?.agent?.mobile ||
  engagement?.agent?.primaryPhone ||
  engagement?.agent?.contact?.phone ||
  engagement?.travelAgent?.phone ||
  "";

const getAgentCity = engagement =>
  engagement?.agentCity ||
  engagement?.travelAgentCity ||
  engagement?.city ||
  engagement?.agent?.city ||
  engagement?.agent?.address?.city ||
  engagement?.travelAgent?.city ||
  engagement?.travelAgent?.address?.city ||
  "";

const getChannelLabel = channel => {
  const labels = {
    call: "Call",
    email: "Email",
    whatsapp: "WhatsApp",
    meeting: "Meeting",
    online_meeting: "Online Meeting",
    offline_meeting: "Offline Meeting",
    site_visit: "Site Visit",
    other: "Other"
  };

  return labels[channel] || channel || "Other";
};

/* =========================
   FOLLOW-UP HELPERS
========================= */
function getFollowUpDate(engagement = {}) {
  return (
    engagement?.nextFollowUpAt ||
    engagement?.nextActionDueAt ||
    engagement?.followUpDate ||
    engagement?.nextFollowUpDate ||
    engagement?.nextActionDate ||
    engagement?.scheduledAt ||
    engagement?.reminderAt ||
    engagement?.dueAt ||
    engagement?.tentativeMeetingDate ||
    engagement?.meetingAt ||
    engagement?.nextFollowUpAtMs ||
    engagement?.nextActionDueAtMs ||
    null
  );
}

function hasFollowUpDate(engagement = {}) {
  return Boolean(getFollowUpDate(engagement));
}

function isTodayDate(value) {
  const key = getLocalDateKey(value);
  if (!key || key === "unknown") return false;

  return key === getLocalDateKey(new Date());
}

function isOverdueDate(value) {
  const key = getLocalDateKey(value);
  if (!key || key === "unknown") return false;

  return key < getLocalDateKey(new Date());
}

function formatFollowUpDate(value) {
  const date = getValidDate(value);
  if (!date) return "No date";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatFollowUpTime(value) {
  const date = getValidDate(value);
  if (!date) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isDoneFollowUpStatus(value = "") {
  return [
    "done",
    "completed",
    "closed",
    "cancelled",
    "canceled",
    "deleted"
  ].includes(normalize(value));
}

function isPendingEngagementFollowUp(engagement = {}) {
  if (engagement?.deleted === true || engagement?.isDeleted === true) {
    return false;
  }

  const requiresFollowUp =
    engagement?.requiresFollowUp === true ||
    engagement?.followUpRequired === true ||
    engagement?.needsFollowUp === true;

  if (!requiresFollowUp) return false;

  if (
    engagement?.followUpCompleted === true ||
    engagement?.followUpDone === true ||
    engagement?.followUpCompletedAt
  ) {
    return false;
  }

  const followUpStatus =
    engagement?.followUpStatus ||
    engagement?.followUpState ||
    "";

  if (isDoneFollowUpStatus(followUpStatus)) return false;

  return hasFollowUpDate(engagement);
}

function isMissingFollowUpDate(engagement = {}) {
  if (engagement?.deleted === true || engagement?.isDeleted === true) {
    return false;
  }

  const requiresFollowUp =
    engagement?.requiresFollowUp === true ||
    engagement?.followUpRequired === true ||
    engagement?.needsFollowUp === true;

  return requiresFollowUp && !hasFollowUpDate(engagement);
}

function getFollowUpSummary(engagement = {}) {
  return (
    engagement?.nextAction ||
    engagement?.messageText ||
    engagement?.message ||
    engagement?.customRemark ||
    engagement?.outcomeLabel ||
    "Follow-up pending"
  );
}

/* =========================
   RELATION HELPERS
========================= */
function getMyRelation(engagement = {}, userUid = "") {
  const createdByMe = Boolean(userUid && engagement?.createdByUid === userUid);
  const assignedToMe = Boolean(userUid && engagement?.assignedToUid === userUid);

  if (createdByMe && assignedToMe) {
    return {
      key: "both",
      label: "Created & Assigned",
      className: "border-violet-100 bg-violet-50 text-violet-700"
    };
  }

  if (assignedToMe) {
    return {
      key: "assigned",
      label: "Assigned to Me",
      className: "border-emerald-100 bg-emerald-50 text-emerald-700"
    };
  }

  if (createdByMe) {
    return {
      key: "created",
      label: "Created by Me",
      className: "border-blue-100 bg-blue-50 text-blue-700"
    };
  }

  return {
    key: "other",
    label: "My Work",
    className: "border-gray-100 bg-gray-50 text-gray-600"
  };
}

/* =========================
   ASSET HELPERS
========================= */
function getAssetTitle(asset) {
  return getFirstValue(
    asset?.title,
    asset?.name,
    asset?.fileName,
    asset?.currentFileName,
    "Asset"
  );
}

function getAssetUrl(asset) {
  return getFirstValue(
    asset?.url,
    asset?.currentUrl,
    asset?.externalUrl,
    asset?.downloadUrl,
    asset?.fileUrl
  );
}

function getSharedAssets(engagement) {
  const assets = Array.isArray(engagement?.sharedAssets)
    ? engagement.sharedAssets
    : [];

  const normalizedAssets = assets
    .map(asset => ({
      assetId: asset?.assetId || asset?.id || asset?.documentId || "",
      title: getAssetTitle(asset),
      url: getAssetUrl(asset),
      categoryName: asset?.categoryName || "",
      assetType: asset?.assetType || asset?.documentType || "",
      usageType: asset?.usageType || "",
      currentVersion: asset?.currentVersion || asset?.version || 1
    }))
    .filter(asset => asset.assetId || asset.url || asset.title);

  const unique = new Map();

  normalizedAssets.forEach(asset => {
    const key = asset.assetId || asset.url || asset.title;
    unique.set(key, asset);
  });

  return Array.from(unique.values());
}

function getSharedAssetCount(engagement) {
  const storedCount = Number(engagement?.assetShareCount || 0);
  if (storedCount > 0) return storedCount;

  return getSharedAssets(engagement).length;
}

function getSharedAssetSearchText(engagement) {
  const assets = getSharedAssets(engagement);

  const assetText = assets
    .map(asset =>
      [
        asset.title,
        asset.categoryName,
        asset.assetType,
        asset.usageType,
        asset.url
      ]
        .map(normalize)
        .join(" ")
    )
    .join(" ");

  return [
    assetText,
    Array.isArray(engagement?.sharedAssetTitles)
      ? engagement.sharedAssetTitles.join(" ")
      : "",
    Array.isArray(engagement?.sharedAssetIds)
      ? engagement.sharedAssetIds.join(" ")
      : "",
    engagement?.assetLinksText || ""
  ]
    .map(normalize)
    .join(" ");
}

/* =========================
   ROUTES
========================= */
const getTravelAgentProfileHref = engagement => {
  const agentId = getAgentId(engagement);
  return agentId ? `/travel-agents/${agentId}` : "";
};

const getViewEngagementHref = engagement => {
  const agentId = getAgentId(engagement);
  return agentId ? `/engagements/travel-agent/${agentId}` : "/engagements";
};

const getLeadCreateHref = engagement => {
  const params = new URLSearchParams();

  const agentId = getAgentId(engagement);
  if (agentId) params.set("travelAgentId", agentId);
  if (engagement?.id) params.set("sourceEngagementId", engagement.id);

  const qs = params.toString();

  return qs ? `/leads/create?${qs}` : "/leads/create";
};

/* =========================
   PROFILE COMPLETION
========================= */
function getProfileCompletion(engagement) {
  if (
    engagement?.profileComplete === true ||
    engagement?.travelAgentProfileComplete === true ||
    engagement?.agent?.profileComplete === true ||
    engagement?.travelAgent?.profileComplete === true
  ) {
    return {
      complete: true,
      percentage: 100,
      missing: []
    };
  }

  const checks = [
    {
      label: "Agency name",
      ok: Boolean(getAgentName(engagement))
    },
    {
      label: "SPOC",
      ok: Boolean(getSpocName(engagement))
    },
    {
      label: "Phone",
      ok: Boolean(getAgentPhone(engagement))
    },
    {
      label: "Email",
      ok: Boolean(getAgentEmail(engagement))
    },
    {
      label: "City",
      ok: Boolean(getAgentCity(engagement))
    }
  ];

  const completed = checks.filter(item => item.ok).length;
  const missing = checks.filter(item => !item.ok).map(item => item.label);

  return {
    complete: completed === checks.length,
    percentage: Math.round((completed / checks.length) * 100),
    missing
  };
}

/* =========================
   MINI KPI CARD
========================= */
function MiniStatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-semibold text-gray-900">
            {value}
          </p>
          {hint && (
            <p className="mt-1 truncate text-[11px] text-gray-400">
              {hint}
            </p>
          )}
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

/* =========================
   RELATION TOGGLE
========================= */
function RelationToggle({ value, onChange, summary }) {
  const items = [
    {
      label: "All My Work",
      value: "all",
      count: summary.total
    },
    {
      label: "Created by Me",
      value: "created",
      count: summary.createdByMe
    },
    {
      label: "Assigned to Me",
      value: "assigned",
      count: summary.assignedToMe
    }
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Work View
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Switch between engagements you created and engagements assigned to you.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                value === item.value
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  value === item.value
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================
   FOLLOW-UP QUEUE
========================= */
function FollowUpQueue({ title, description, items, type = "today" }) {
  const isOverdue = type === "overdue";

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {description}
            </p>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              isOverdue
                ? "border-red-100 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {items.length}
          </span>
        </div>
      </div>

      <div className="p-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
            <CheckCircle2
              size={24}
              className="mx-auto text-emerald-600"
            />
            <p className="mt-2 text-sm font-semibold text-gray-800">
              {isOverdue ? "No overdue follow-ups" : "No follow-ups due today"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Your engagement follow-up queue is clear.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map(item => {
              const dueAt = getFollowUpDate(item);
              const agentName = getAgentName(item) || "Travel Agent";
              const destinationName = getDestinationName(item) || "—";

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                            isOverdue
                              ? "border-red-100 bg-red-50 text-red-700"
                              : "border-blue-100 bg-blue-50 text-blue-700"
                          }`}
                        >
                          {isOverdue ? (
                            <AlertTriangle size={12} />
                          ) : (
                            <CalendarDays size={12} />
                          )}
                          {isOverdue ? "Overdue" : "Today"}
                        </span>

                        {item.channel ? (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold capitalize text-gray-600">
                            {getChannelLabel(item.channel)}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 truncate text-sm font-semibold text-gray-900">
                        {agentName}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {destinationName} • {formatFollowUpDate(dueAt)}{" "}
                        {formatFollowUpTime(dueAt)}
                      </p>

                      <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                        {getFollowUpSummary(item)}
                      </p>
                    </div>

                    <Link
                      href={getViewEngagementHref(item)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      View
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}

            {items.length > 5 ? (
              <p className="text-center text-xs font-medium text-gray-500">
                +{items.length - 5} more follow-ups
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   AGENT PROFILE STATUS BAR
========================= */
function AgentProfileStatusBar({ engagement, currentUserUid }) {
  const agentName = getAgentName(engagement) || "Travel Agent";
  const spocName = getSpocName(engagement);
  const profile = getProfileCompletion(engagement);
  const profileHref = getTravelAgentProfileHref(engagement);
  const relation = getMyRelation(engagement, currentUserUid);

  return (
    <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-3 md:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <UserRound size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {profileHref ? (
                <Link
                  href={profileHref}
                  className="inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-blue-700"
                >
                  <span className="truncate">{agentName}</span>
                  <ExternalLink size={13} className="shrink-0" />
                </Link>
              ) : (
                <p className="text-sm font-semibold text-gray-900">
                  {agentName}
                </p>
              )}

              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${relation.className}`}
              >
                {relation.label}
              </span>

              {profile.complete ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 size={12} />
                  Profile Complete
                </span>
              ) : (
                <span
                  title={
                    profile.missing.length
                      ? `Missing: ${profile.missing.join(", ")}`
                      : "Profile details incomplete"
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                >
                  <AlertTriangle size={12} />
                  Profile {profile.percentage}%
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-gray-500">
              {spocName ? `SPOC: ${spocName}` : "SPOC not available"}
              {engagement?.assignedToName
                ? ` • Assigned to: ${engagement.assignedToName}`
                : ""}
            </p>
          </div>
        </div>

        {profileHref ? (
          <Link
            href={profileHref}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            View Agent Profile
            <ExternalLink size={12} />
          </Link>
        ) : (
          <span className="inline-flex w-fit items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-400">
            Agent profile link unavailable
          </span>
        )}
      </div>
    </div>
  );
}

export default function MyEngagementsPage() {
  const { user, loading } = useAuth();

  const [engagements, setEngagements] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  /* =========================
     LOAD MY / ASSIGNED ENGAGEMENTS
  ========================== */
  useEffect(() => {
    if (loading) return;

    if (!user?.uid) {
      setEngagements([]);
      setLoadingList(false);
      return;
    }

    setLoadingList(true);
    setError("");

    const createdQuery = query(
      collection(db, "engagements"),
      where("createdByUid", "==", user.uid)
    );

    const assignedQuery = query(
      collection(db, "engagements"),
      where("assignedToUid", "==", user.uid)
    );

    let createdRows = [];
    let assignedRows = [];
    let createdLoaded = false;
    let assignedLoaded = false;

    function mergeAndSetRows() {
      const map = new Map();

      [...createdRows, ...assignedRows].forEach(item => {
        if (item.deleted === true || item.isDeleted === true) return;

        const createdByMe = item.createdByUid === user.uid;
        const assignedToMe = item.assignedToUid === user.uid;

        map.set(item.id, {
          ...item,
          _createdByMe: createdByMe,
          _assignedToMe: assignedToMe
        });
      });

      const rows = Array.from(map.values()).sort((a, b) => {
        const aDate = getValidDate(a.createdAt)?.getTime?.() || 0;
        const bDate = getValidDate(b.createdAt)?.getTime?.() || 0;
        return bDate - aDate;
      });

      setEngagements(rows);

      if (createdLoaded && assignedLoaded) {
        setLoadingList(false);
      }
    }

    const unsubCreated = onSnapshot(
      createdQuery,
      snap => {
        createdRows = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        createdLoaded = true;
        mergeAndSetRows();
      },
      err => {
        console.error("Failed to load created engagements:", err);

        createdLoaded = true;
        setError(prev =>
          prev ||
          "Unable to load created engagements. Please check Firestore permissions."
        );

        mergeAndSetRows();
      }
    );

    const unsubAssigned = onSnapshot(
      assignedQuery,
      snap => {
        assignedRows = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        assignedLoaded = true;
        mergeAndSetRows();
      },
      err => {
        console.error("Failed to load assigned engagements:", err);

        assignedLoaded = true;
        setError(prev =>
          prev ||
          "Unable to load assigned engagements. Please check Firestore permissions."
        );

        mergeAndSetRows();
      }
    );

    return () => {
      unsubCreated();
      unsubAssigned();
    };
  }, [user?.uid, loading]);

  /* =========================
     ACTIVE FILTER COUNT
  ========================== */
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (["channel", "relation"].includes(key)) {
        return value && value !== "all";
      }

      return Boolean(String(value || "").trim());
    }).length;
  }, [filters]);

  /* =========================
     DATE VALIDATION
  ========================== */
  const dateRangeError = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) return "";

    const fromDate = getStartOfDay(filters.dateFrom);
    const toDate = getEndOfDay(filters.dateTo);

    if (fromDate && toDate && fromDate > toDate) {
      return "From Date cannot be later than To Date.";
    }

    return "";
  }, [filters.dateFrom, filters.dateTo]);

  /* =========================
     FILTERED LIST
  ========================== */
  const filteredEngagements = useMemo(() => {
    if (dateRangeError) return [];

    const searchText = normalize(filters.search);
    const destinationText = normalize(filters.destination);
    const spocText = normalize(filters.spoc);
    const agentText = normalize(filters.travelAgent);

    const fromDate = getStartOfDay(filters.dateFrom);
    const toDate = getEndOfDay(filters.dateTo);

    return engagements.filter(e => {
      const channel = normalize(e.channel);
      const agentName = getAgentName(e);
      const spocName = getSpocName(e);
      const destinationName = getDestinationName(e);
      const createdDate = getValidDate(e.createdAt);

      const createdByMe = e.createdByUid === user?.uid;
      const assignedToMe = e.assignedToUid === user?.uid;

      if (filters.relation === "created" && !createdByMe) {
        return false;
      }

      if (filters.relation === "assigned" && !assignedToMe) {
        return false;
      }

      if ((fromDate || toDate) && !createdDate) return false;
      if (fromDate && createdDate < fromDate) return false;
      if (toDate && createdDate > toDate) return false;

      if (
        filters.channel !== "all" &&
        channel !== normalize(filters.channel)
      ) {
        return false;
      }

      if (
        destinationText &&
        !normalize(destinationName).includes(destinationText)
      ) {
        return false;
      }

      if (spocText && !normalize(spocName).includes(spocText)) {
        return false;
      }

      if (agentText && !normalize(agentName).includes(agentText)) {
        return false;
      }

      if (searchText) {
        const searchableText = [
          e.subject,
          e.message,
          e.messageText,
          stripHtml(e.messageHtml),
          e.customRemark,
          e.outcomeCode,
          e.outcomeLabel,
          e.nextAction,
          e.status,
          e.sendStatus,
          e.channel,
          e.direction,
          e.meetingModeLabel,
          e.templateName,
          agentName,
          spocName,
          destinationName,
          e.createdByName,
          e.assignedToName,
          e.assignedToEmail,
          getSharedAssetSearchText(e)
        ]
          .map(normalize)
          .join(" ");

        if (!searchableText.includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }, [engagements, filters, dateRangeError, user?.uid]);

  /* =========================
     FOLLOW-UP LISTS
  ========================== */
  const pendingFollowUps = useMemo(() => {
    return filteredEngagements
      .filter(item => isPendingEngagementFollowUp(item))
      .sort((a, b) => {
        const aDate = getValidDate(getFollowUpDate(a))?.getTime?.() || 0;
        const bDate = getValidDate(getFollowUpDate(b))?.getTime?.() || 0;
        return aDate - bDate;
      });
  }, [filteredEngagements]);

  const todayFollowUps = useMemo(() => {
    return pendingFollowUps.filter(item =>
      isTodayDate(getFollowUpDate(item))
    );
  }, [pendingFollowUps]);

  const overdueFollowUps = useMemo(() => {
    return pendingFollowUps.filter(item =>
      isOverdueDate(getFollowUpDate(item))
    );
  }, [pendingFollowUps]);

  const missingFollowUpDateCount = useMemo(() => {
    return filteredEngagements.filter(item =>
      isMissingFollowUpDate(item)
    ).length;
  }, [filteredEngagements]);

  /* =========================
     SUMMARY
  ========================== */
  const summary = useMemo(() => {
    const today = new Date();

    const todaysCount = engagements.filter(e => {
      const d = getValidDate(e.createdAt);
      return d && isSameDay(d, today);
    }).length;

    const createdByMe = engagements.filter(
      e => e.createdByUid === user?.uid
    ).length;

    const assignedToMe = engagements.filter(
      e => e.assignedToUid === user?.uid
    ).length;

    const channelMap = filteredEngagements.reduce((acc, e) => {
      const key = e.channel || "other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topChannel = Object.entries(channelMap).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const filteredAssetCount = filteredEngagements.reduce((sum, e) => {
      return sum + getSharedAssetCount(e);
    }, 0);

    return {
      total: engagements.length,
      filtered: filteredEngagements.length,
      createdByMe,
      assignedToMe,
      today: todaysCount,
      todayFollowUps: todayFollowUps.length,
      overdueFollowUps: overdueFollowUps.length,
      missingFollowUpDate: missingFollowUpDateCount,
      topChannel: topChannel
        ? `${getChannelLabel(topChannel[0])} (${topChannel[1]})`
        : "—",
      sharedAssets: filteredAssetCount
    };
  }, [
    engagements,
    filteredEngagements,
    user?.uid,
    todayFollowUps.length,
    overdueFollowUps.length,
    missingFollowUpDateCount
  ]);

  /* =========================
     GROUP BY DATE
  ========================== */
  const groupedEngagements = useMemo(() => {
    const map = new Map();

    filteredEngagements.forEach(e => {
      const date = getValidDate(e.createdAt);
      const key = getLocalDateKey(date);
      const label = formatDateLabel(date);

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          sortTime: date?.getTime?.() || 0,
          items: []
        });
      }

      map.get(key).items.push(e);
    });

    return Array.from(map.values()).sort(
      (a, b) => b.sortTime - a.sortTime
    );
  }, [filteredEngagements]);

  /* =========================
     LOADING
  ========================== */
  if (loading || loadingList) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <div className="mb-3 h-6 w-52 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-80 animate-pulse rounded bg-gray-100" />
          </div>

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

  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto w-full space-y-6 px-4 py-6">
        {/* ================= HERO HEADER ================= */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Activity size={24} />
              </div>

              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  <Activity size={14} />
                  My Work Timeline
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  My Engagements
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">
                  View engagements created by you, assigned to you, follow-up
                  queue, shared assets, package links, destination communication
                  and travel agent profile status.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= RELATION TOGGLE ================= */}
        <RelationToggle
          value={filters.relation}
          summary={summary}
          onChange={value =>
            setFilters(prev => ({
              ...prev,
              relation: value
            }))
          }
        />

        {/* ================= KPI STRIP ================= */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStatCard
            icon={BarChart3}
            label="Total Work"
            value={summary.total}
            hint="Created or assigned to you"
          />

          <MiniStatCard
            icon={CalendarDays}
            label="Today's Follow-ups"
            value={summary.todayFollowUps}
            hint="Engagement follow-ups due today"
          />

          <MiniStatCard
            icon={Timer}
            label="Overdue"
            value={summary.overdueFollowUps}
            hint="Follow-ups past due date"
          />

          <MiniStatCard
            icon={AlertTriangle}
            label="Missing Date"
            value={summary.missingFollowUpDate}
            hint="Follow-up required but no date"
          />

          <MiniStatCard
            icon={Package}
            label="Shared Assets"
            value={summary.sharedAssets}
            hint="Assets in filtered records"
          />
        </section>

        {/* ================= FOLLOW-UP QUEUE ================= */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <FollowUpQueue
            title="Today's Follow-up Queue"
            description="Engagement follow-ups scheduled for today."
            items={todayFollowUps}
            type="today"
          />

          <FollowUpQueue
            title="Overdue Follow-up Queue"
            description="Pending engagement follow-ups that crossed their due date."
            items={overdueFollowUps}
            type="overdue"
          />
        </section>

        {/* ================= MAIN GRID ================= */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* LEFT: LIST */}
          <div className="space-y-5 xl:col-span-8 2xl:col-span-9">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {dateRangeError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {dateRangeError}
              </div>
            )}

            {!error && filteredEngagements.length === 0 && (
              <div className="rounded-3xl border border-gray-200 bg-white p-10">
                <EmptyState
                  icon="📭"
                  title="No engagements found"
                  description={
                    engagements.length === 0
                      ? "No engagements are created by you or assigned to you yet."
                      : "Try changing your work view, date range, search text, asset name or filters."
                  }
                />
              </div>
            )}

            {!error && filteredEngagements.length > 0 && (
              <div className="space-y-8">
                {groupedEngagements.map(group => (
                  <section key={group.key} className="relative">
                    {/* DATE HEADER */}
                    <div className="sticky top-0 z-10 bg-gray-50/90 py-2 backdrop-blur">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                          <p className="text-xs font-semibold text-gray-700">
                            {group.label}
                          </p>
                        </div>

                        <p className="text-xs text-gray-400">
                          {group.items.length} engagement
                          {group.items.length > 1 ? "s" : ""}
                        </p>

                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                    </div>

                    {/* TIMELINE LIST */}
                    <div className="relative mt-3">
                      <div className="absolute bottom-4 left-4 top-4 hidden w-px bg-gray-200 sm:block" />

                      <div className="space-y-3">
                        {group.items.map(e => {
                          const profile = getProfileCompletion(e);

                          return (
                            <div key={e.id} className="relative sm:pl-10">
                              <div className="absolute left-[10px] top-6 hidden h-3 w-3 rounded-full border-2 border-blue-500 bg-white sm:block" />

                              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
                                <AgentProfileStatusBar
                                  engagement={e}
                                  currentUserUid={user?.uid}
                                />

                                <EngagementCard
                                  engagement={e}
                                  agent={{
                                    id: getAgentId(e),
                                    name: getAgentName(e),
                                    agencyName: getAgentName(e),
                                    spocName: getSpocName(e),
                                    email: getAgentEmail(e),
                                    phone: getAgentPhone(e),
                                    city: getAgentCity(e),
                                    profileComplete: profile.complete,
                                    profileCompletionPercentage:
                                      profile.percentage,
                                    missingProfileFields: profile.missing
                                  }}
                                  agentProfileHref={getTravelAgentProfileHref(e)}
                                  viewEngagementHref={getViewEngagementHref(e)}
                                  leadCreateHref={getLeadCreateHref(e)}
                                  showSendCommunication={false}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: FILTER PANEL */}
          <aside className="xl:col-span-4 2xl:col-span-3">
            <div className="xl:sticky xl:top-5">
              <EngagementFilterBar
                filters={filters}
                setFilters={setFilters}
                activeFilterCount={activeFilterCount}
                onClearFilters={() => setFilters({ ...DEFAULT_FILTERS })}
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}