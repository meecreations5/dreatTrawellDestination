"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
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
  MessageCircle,
  Package,
  TrendingUp,
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
    return engagement.destinationNames
      .filter(Boolean)
      .join(", ");
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
        <div>
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-[11px] text-gray-400 truncate">
              {hint}
            </p>
          )}
        </div>

        <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

/* =========================
   AGENT PROFILE STATUS BAR
========================= */
function AgentProfileStatusBar({ engagement }) {
  const agentName = getAgentName(engagement) || "Travel Agent";
  const spocName = getSpocName(engagement);
  const profile = getProfileCompletion(engagement);
  const profileHref = getTravelAgentProfileHref(engagement);

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
     LOAD MY ENGAGEMENTS
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

    const q = query(
      collection(db, "engagements"),
      where("createdByUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const rows = snap.docs
          .map(d => ({
            id: d.id,
            ...d.data()
          }))
          .filter(item => item.deleted !== true && item.isDeleted !== true);

        setEngagements(rows);
        setLoadingList(false);
      },
      err => {
        console.error("Failed to load engagements:", err);
        setError(
          "Unable to load engagements. Please check Firestore permissions or required index."
        );
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, [user?.uid, loading]);

  /* =========================
     ACTIVE FILTER COUNT
  ========================== */
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "channel") return value && value !== "all";
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
  }, [engagements, filters, dateRangeError]);

  /* =========================
     SUMMARY
  ========================== */
  const summary = useMemo(() => {
    const today = new Date();

    const todaysCount = engagements.filter(e => {
      const d = getValidDate(e.createdAt);
      return d && isSameDay(d, today);
    }).length;

    const channelMap = engagements.reduce((acc, e) => {
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
      today: todaysCount,
      topChannel: topChannel
        ? `${getChannelLabel(topChannel[0])} (${topChannel[1]})`
        : "—",
      sharedAssets: filteredAssetCount
    };
  }, [engagements, filteredEngagements]);

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
        <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <div className="h-6 w-52 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="h-4 w-80 bg-gray-100 rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* ================= HERO HEADER ================= */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/15 text-white flex items-center justify-center shrink-0">
                <Activity size={24} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 mb-3">
                  <Activity size={14} />
                  Team Activity Timeline
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  My Engagements
                </h1>

                <p className="mt-1 text-sm text-blue-100 max-w-2xl leading-6">
                  View your engagement history, shared assets, package links,
                  destination communication and travel agent profile status.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= KPI STRIP ================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <MiniStatCard
            icon={BarChart3}
            label="Total Engagements"
            value={summary.total}
            hint="All records created by you"
          />

          <MiniStatCard
            icon={TrendingUp}
            label="Filtered Results"
            value={summary.filtered}
            hint="Matching current filters"
          />

          <MiniStatCard
            icon={CalendarDays}
            label="Today"
            value={summary.today}
            hint="Created today"
          />

          <MiniStatCard
            icon={MessageCircle}
            label="Top Channel"
            value={summary.topChannel}
            hint="Most used channel"
          />

          <MiniStatCard
            icon={Package}
            label="Shared Assets"
            value={summary.sharedAssets}
            hint="Assets in filtered records"
          />
        </section>

        {/* ================= MAIN GRID ================= */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* LEFT: LIST */}
          <div className="xl:col-span-8 2xl:col-span-9 space-y-5">
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
                      ? "You have not created any engagements yet."
                      : "Try changing your date range, search text, asset name or filters."
                  }
                />
              </div>
            )}

            {!error && filteredEngagements.length > 0 && (
              <div className="space-y-8">
                {groupedEngagements.map(group => (
                  <section key={group.key} className="relative">
                    {/* DATE HEADER */}
                    <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur py-2">
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

                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    </div>

                    {/* TIMELINE LIST */}
                    <div className="relative mt-3">
                      <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-200 hidden sm:block" />

                      <div className="space-y-3">
                        {group.items.map(e => {
                          const profile = getProfileCompletion(e);

                          return (
                            <div key={e.id} className="relative sm:pl-10">
                              <div className="absolute left-[10px] top-6 h-3 w-3 rounded-full bg-white border-2 border-blue-500 hidden sm:block" />

                              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
                                <AgentProfileStatusBar engagement={e} />

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