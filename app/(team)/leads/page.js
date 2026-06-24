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
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  RefreshCcw,
  Search,
  Send,
  Target,
  Trophy,
  UserCheck,
  UserPlus,
  XCircle
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import CardSkeleton from "@/components/ui/CardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

/* =========================
   DEFAULT FILTERS
========================= */
const DEFAULT_FILTERS = {
  search: "",
  ownership: "",
  stage: "",
  health: "",
  dateFrom: "",
  dateTo: ""
};

/* =========================
   HELPERS
========================= */

const isDeletedLead = lead =>
  lead?.isDelete === true ||
  lead?.isDeleted === true ||
  lead?.deleted === true ||
  String(lead?.isDelete || "").trim().toLowerCase() === "true" ||
  String(lead?.isDeleted || "").trim().toLowerCase() === "true" ||
  String(lead?.deleted || "").trim().toLowerCase() === "true" ||
  Boolean(lead?.deletedAt);

const normalize = value =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeEmail = value =>
  String(value || "")
    .trim()
    .toLowerCase();

const getUserEmail = user =>
  normalizeEmail(user?.email || user?.workEmail || user?.officialEmail);

const getValidDate = value => {
  if (!value) return null;

  if (value?.toDate) return value.toDate();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getStartOfDay = value => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
};

const getEndOfDay = value => {
  if (!value) return null;
  return new Date(`${value}T23:59:59`);
};

const toDateInput = date => {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;

  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
};

const formatDate = value => {
  const date = getValidDate(value);
  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const formatLabel = value => {
  if (!value) return "Not Set";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const getUid = value => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    return (
      value.uid ||
      value.id ||
      value.userId ||
      value.value ||
      ""
    );
  }

  return "";
};

const valueMatchesUser = (value, user) => {
  const raw = getUid(value);
  const userEmail = getUserEmail(user);
  const normalizedRaw = normalizeEmail(raw);

  return Boolean(
    raw === user?.uid ||
      (userEmail && normalizedRaw === userEmail)
  );
};

const isLeadCreatedByUser = (lead, user) => {
  return (
    valueMatchesUser(lead.createdByUid, user) ||
    valueMatchesUser(lead.createdBy, user) ||
    valueMatchesUser(lead.createdByUser, user) ||
    valueMatchesUser(lead.createdByUserId, user) ||
    valueMatchesUser(lead.creatorUid, user) ||
    normalizeEmail(lead.createdByEmail) === getUserEmail(user) ||
    normalizeEmail(lead.creatorEmail) === getUserEmail(user)
  );
};

const isLeadAssignedToUser = (lead, user) => {
  return (
    valueMatchesUser(lead.assignedToUid, user) ||
    valueMatchesUser(lead.assignedTo, user) ||
    valueMatchesUser(lead.ownerUid, user) ||
    valueMatchesUser(lead.assignedToUser, user) ||
    valueMatchesUser(lead.accountManagerUid, user) ||
    normalizeEmail(lead.assignedToEmail) === getUserEmail(user) ||
    normalizeEmail(lead.assigneeEmail) === getUserEmail(user) ||
    normalizeEmail(lead.teamMemberEmail) === getUserEmail(user)
  );
};

const isLeadAssignedByUser = (lead, user) => {
  return (
    valueMatchesUser(lead.assignedByUid, user) ||
    valueMatchesUser(lead.assignedBy, user) ||
    valueMatchesUser(lead.assignedByUser, user) ||
    valueMatchesUser(lead.lastAssignedByUid, user) ||
    normalizeEmail(lead.assignedByEmail) === getUserEmail(user) ||
    normalizeEmail(lead.assignedByUserEmail) === getUserEmail(user)
  );
};

const getNormalizedLeadStage = lead =>
  normalize(
    lead.stage ||
    lead.status ||
    lead.leadStage ||
    lead.pipelineStage ||
    lead.dealStatus ||
    lead.outcome ||
    ""
  )
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

const isDealWonLead = lead => {
  if (
    lead.dealWon === true ||
    lead.businessGenerated === true ||
    lead.isBusinessGenerated === true ||
    lead.converted === true ||
    lead.isConverted === true ||
    lead.bookingConfirmed === true
  ) {
    return true;
  }

  if (
    lead.dealWonAt ||
    lead.businessGeneratedAt ||
    lead.convertedAt ||
    lead.bookingConfirmedAt ||
    lead.closedWonAt
  ) {
    return true;
  }

  const stage = getNormalizedLeadStage(lead);

  return [
    "won",
    "converted",
    "booked",
    "confirmed",
    "closed_won",
    "booking_confirmed",
    "business_generated",
    "package_confirmed",
    "travel_confirmed",
    "finalized"
  ].includes(stage);
};

const isDealLostLead = lead => {
  if (
    lead.dealLost === true ||
    lead.isDealLost === true ||
    lead.lost === true
  ) {
    return true;
  }

  if (
    lead.dealLostAt ||
    lead.closedLostAt ||
    lead.cancelledAt ||
    lead.rejectedAt
  ) {
    return true;
  }

  const stage = getNormalizedLeadStage(lead);

  return [
    "lost",
    "closed_lost",
    "cancelled",
    "canceled",
    "rejected",
    "dropped",
    "not_interested",
    "dead",
    "failed"
  ].includes(stage);
};

/* =========================
   LEAD HEALTH
========================= */
function getLeadHealth(lead) {
  const due = getValidDate(
    lead?.nextActionDueAt ||
      lead?.nextFollowUpAt ||
      lead?.followUpAt ||
      lead?.nextActionDate
  );

  if (!due) return "healthy";

  const now = new Date();

  if (due < now && !isSameDay(due, now)) {
    return "overdue";
  }

  if (isSameDay(due, now)) {
    return "at_risk";
  }

  return "healthy";
}

const HEALTH_META = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-100"
  },
  at_risk: {
    label: "Needs Attention",
    icon: Clock3,
    className: "bg-amber-50 text-amber-700 border-amber-100"
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    className: "bg-red-50 text-red-700 border-red-100"
  }
};

const getLeadTitle = lead =>
  lead.leadCode ||
  lead.leadName ||
  lead.customerName ||
  lead.destinationName ||
  lead.travelAgentName ||
  lead.agentName ||
  lead.agencyName ||
  "Lead";

const getDestinationName = lead =>
  lead.destinationName ||
  lead.destination?.name ||
  lead.primaryDestination ||
  "Not Set";

const getOwnerName = lead =>
  lead.assignedToName ||
  lead.ownerName ||
  lead.accountManagerName ||
  lead.assignedToEmail ||
  lead.assignedTo ||
  "Unassigned";

/* =========================
   UI COMPONENTS
========================= */
function KpiCard({ icon: Icon, label, value, helper, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4  hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>

          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {value}
          </p>

          {helper && (
            <p className="mt-1 text-xs text-gray-400 leading-5">
              {helper}
            </p>
          )}
        </div>

        <div
          className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
            toneClass[tone] || toneClass.blue
          }`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white  overflow-hidden">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-500">
            {subtitle}
          </p>
        )}
      </div>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function ProgressRow({ label, value, total }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-700 truncate">
          {label}
        </p>

        <p className="text-xs font-semibold text-gray-900">
          {value}
        </p>
      </div>

      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function EmptyMiniState({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      <p className="text-sm font-medium text-gray-700">
        {title}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Data will appear here once leads are available.
      </p>
    </div>
  );
}

function HealthBadge({ health }) {
  const meta = HEALTH_META[health] || HEALTH_META.healthy;
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function OwnershipBadges({ lead, user }) {
  const createdByMe = isLeadCreatedByUser(lead, user);
  const assignedToMe = isLeadAssignedToUser(lead, user);
  const assignedByMe = isLeadAssignedByUser(lead, user);

  return (
    <>
      {createdByMe && (
        <span className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
          Created by me
        </span>
      )}

      {assignedToMe && (
        <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
          Assigned to me
        </span>
      )}

      {assignedByMe && (
        <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
          Assigned by me
        </span>
      )}
    </>
  );
}

function DealBadge({ lead }) {
  if (isDealWonLead(lead)) {
    return (
      <span className="rounded-full bg-purple-50 border border-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
        Deal Won
      </span>
    );
  }

  if (isDealLostLead(lead)) {
    return (
      <span className="rounded-full bg-red-50 border border-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        Deal Lost
      </span>
    );
  }

  return null;
}

function RecentLeadItem({ lead, user }) {
  const health = getLeadHealth(lead);

  return (
    <Link href={`/leads/${lead.id}`} className="block group">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-200 hover: transition">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Target size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-950 truncate">
                    {getLeadTitle(lead)}
                  </p>

                  <DealBadge lead={lead} />
                </div>

                <p className="mt-0.5 text-xs text-gray-500">
                  Created on {formatDate(lead.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <HealthBadge health={health} />

                <div className="h-8 w-8 rounded-full border border-gray-200 bg-gray-50 text-gray-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-100 transition">
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <OwnershipBadges lead={lead} user={user} />

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {formatLabel(lead.stage)}
              </span>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {getDestinationName(lead)}
              </span>

              <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
                Owner: {getOwnerName(lead)}
              </span>

              {lead.nextActionType && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Next: {formatLabel(lead.nextActionType)}
                </span>
              )}
            </div>

            {(lead.nextActionDueAt || lead.nextFollowUpAt) && (
              <p className="mt-3 text-xs text-gray-500">
                Next action due:{" "}
                {formatDate(lead.nextActionDueAt || lead.nextFollowUpAt)}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* =========================
   MAIN PAGE
========================= */
export default function LeadDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  /* =========================
     LOAD LEADS
     UID + email fallback.
     No orderBy here to avoid Firestore composite index requirement.
     Sorting is handled after mergeRows().
     Deleted leads are removed using isDelete / deleted / isDeleted / deletedAt.
  ========================== */
  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid) {
      setLeads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const userEmail = getUserEmail(user);
    const querySpecs = [];

    const addQuerySpec = (group, field, value, label) => {
      const cleanValue = String(value || "").trim();
      if (!cleanValue) return;

      querySpecs.push({
        key: `${group}:${field}:${cleanValue}`,
        group,
        field,
        value: cleanValue,
        label
      });
    };

    addQuerySpec("assigned", "assignedToUid", user.uid, "assigned leads");
    addQuerySpec("assigned", "assignedTo", user.uid, "assigned leads");
    addQuerySpec("assigned", "ownerUid", user.uid, "assigned leads");
    addQuerySpec("assigned", "accountManagerUid", user.uid, "assigned leads");

    addQuerySpec("created", "createdByUid", user.uid, "created leads");
    addQuerySpec("created", "createdBy", user.uid, "created leads");
    addQuerySpec("created", "createdByUserId", user.uid, "created leads");
    addQuerySpec("created", "creatorUid", user.uid, "created leads");

    addQuerySpec("assignedBy", "assignedByUid", user.uid, "leads assigned by you");
    addQuerySpec("assignedBy", "assignedBy", user.uid, "leads assigned by you");
    addQuerySpec("assignedBy", "lastAssignedByUid", user.uid, "leads assigned by you");

    if (userEmail) {
      addQuerySpec("assigned", "assignedToEmail", userEmail, "assigned leads");
      addQuerySpec("assigned", "assignedTo", userEmail, "assigned leads");
      addQuerySpec("assigned", "assigneeEmail", userEmail, "assigned leads");
      addQuerySpec("assigned", "teamMemberEmail", userEmail, "assigned leads");

      addQuerySpec("created", "createdByEmail", userEmail, "created leads");
      addQuerySpec("created", "createdBy", userEmail, "created leads");
      addQuerySpec("created", "creatorEmail", userEmail, "created leads");

      addQuerySpec("assignedBy", "assignedByEmail", userEmail, "leads assigned by you");
      addQuerySpec("assignedBy", "assignedBy", userEmail, "leads assigned by you");
      addQuerySpec("assignedBy", "assignedByUserEmail", userEmail, "leads assigned by you");
    }

    const uniqueQuerySpecs = Array.from(
      new Map(querySpecs.map(item => [item.key, item])).values()
    );

    const sourceRows = new Map();
    const loadedSources = new Set();

    const mapActiveDocs = snap => {
      return new Map(
        snap.docs
          .map(d => {
            const lead = {
              id: d.id,
              ...d.data()
            };

            return [d.id, lead];
          })
          .filter(([, lead]) => !isDeletedLead(lead))
      );
    };

    const mergeRows = () => {
      const merged = new Map();

      sourceRows.forEach(rowsMap => {
        rowsMap.forEach((value, key) => {
          if (!isDeletedLead(value)) {
            merged.set(key, value);
          }
        });
      });

      const rows = Array.from(merged.values())
        .filter(lead => {
          if (isDeletedLead(lead)) return false;

          return (
            isLeadCreatedByUser(lead, user) ||
            isLeadAssignedToUser(lead, user) ||
            isLeadAssignedByUser(lead, user)
          );
        })
        .sort((a, b) => {
          const aTime = getValidDate(a.createdAt)?.getTime?.() || 0;
          const bTime = getValidDate(b.createdAt)?.getTime?.() || 0;
          return bTime - aTime;
        });

      setLeads(rows);

      if (loadedSources.size >= uniqueQuerySpecs.length) {
        setLoading(false);
      }
    };

    if (!uniqueQuerySpecs.length) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const unsubs = uniqueQuerySpecs.map(spec => {
      const leadQuery = query(
        collection(db, "leads"),
        where(spec.field, "==", spec.value)
      );

      return onSnapshot(
        leadQuery,
        snap => {
          sourceRows.set(spec.key, mapActiveDocs(snap));
          loadedSources.add(spec.key);
          mergeRows();
        },
        err => {
          console.error(`Failed to load ${spec.label}:`, err);
          setError(`Unable to load ${spec.label}. Please check Firestore permissions.`);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user, authLoading]);

  /* =========================
     FILTER OPTIONS
  ========================== */
  const stageOptions = useMemo(() => {
    return Array.from(
      new Set(leads.map(lead => lead.stage).filter(Boolean))
    ).sort();
  }, [leads]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value =>
      Boolean(String(value || "").trim())
    ).length;
  }, [filters]);

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
     FILTERED LEADS
  ========================== */
  const filteredLeads = useMemo(() => {
    if (dateRangeError) return [];

    const searchText = normalize(filters.search);
    const fromDate = getStartOfDay(filters.dateFrom);
    const toDate = getEndOfDay(filters.dateTo);

    return leads.filter(lead => {
      const createdDate = getValidDate(lead.createdAt);
      const health = getLeadHealth(lead);

      const createdByMe = isLeadCreatedByUser(lead, user);
      const assignedToMe = isLeadAssignedToUser(lead, user);
      const assignedByMe = isLeadAssignedByUser(lead, user);
      const dealWon = isDealWonLead(lead);
      const dealLost = isDealLostLead(lead);

      if ((fromDate || toDate) && !createdDate) return false;
      if (fromDate && createdDate < fromDate) return false;
      if (toDate && createdDate > toDate) return false;

      if (filters.ownership === "created_by_me" && !createdByMe) {
        return false;
      }

      if (filters.ownership === "assigned_to_me" && !assignedToMe) {
        return false;
      }

      if (filters.ownership === "assigned_by_me" && !assignedByMe) {
        return false;
      }

      if (filters.ownership === "deal_won" && !dealWon) {
        return false;
      }

      if (filters.ownership === "deal_lost" && !dealLost) {
        return false;
      }

      if (filters.stage && lead.stage !== filters.stage) {
        return false;
      }

      if (filters.health && health !== filters.health) {
        return false;
      }

      if (searchText) {
        const searchableText = [
          lead.leadCode,
          lead.leadName,
          lead.customerName,
          lead.customerEmail,
          lead.customerMobile,
          lead.destinationName,
          lead.assignedToName,
          lead.assignedToEmail,
          lead.createdByName,
          lead.createdByEmail,
          lead.assignedByName,
          lead.assignedByEmail,
          lead.stage,
          lead.status,
          lead.nextActionType,
          lead.travelAgentName,
          lead.agentName,
          lead.agencyName,
          lead.source
        ]
          .map(normalize)
          .join(" ");

        if (!searchableText.includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }, [leads, filters, dateRangeError, user]);

  /* =========================
     SUMMARY
  ========================== */
  const summary = useMemo(() => {
    const today = new Date();

    let todayCount = 0;
    let healthyCount = 0;
    let atRiskCount = 0;
    let overdueCount = 0;

    let createdByMeCount = 0;
    let assignedToMeCount = 0;
    let assignedByMeCount = 0;
    let dealWonCount = 0;
    let dealLostCount = 0;

    const stageMap = {};
    const healthMap = {};
    const destinationMap = {};
    const ownerMap = {};
    const sourceMap = {};

    filteredLeads.forEach(lead => {
      const createdDate = getValidDate(lead.createdAt);

      if (createdDate && isSameDay(createdDate, today)) {
        todayCount += 1;
      }

      const health = getLeadHealth(lead);

      if (health === "healthy") healthyCount += 1;
      if (health === "at_risk") atRiskCount += 1;
      if (health === "overdue") overdueCount += 1;

      if (isLeadCreatedByUser(lead, user)) createdByMeCount += 1;
      if (isLeadAssignedToUser(lead, user)) assignedToMeCount += 1;
      if (isLeadAssignedByUser(lead, user)) assignedByMeCount += 1;

      if (isDealWonLead(lead)) dealWonCount += 1;
      if (isDealLostLead(lead)) dealLostCount += 1;

      const stage = lead.stage || "not_set";
      stageMap[stage] = (stageMap[stage] || 0) + 1;

      healthMap[health] = (healthMap[health] || 0) + 1;

      const destination = getDestinationName(lead);
      destinationMap[destination] =
        (destinationMap[destination] || 0) + 1;

      const owner = getOwnerName(lead);
      ownerMap[owner] = (ownerMap[owner] || 0) + 1;

      const source = lead.source || "Not Set";
      sourceMap[source] = (sourceMap[source] || 0) + 1;
    });

    const toSorted = obj =>
      Object.entries(obj)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    const wonRate =
      filteredLeads.length > 0
        ? Math.round((dealWonCount / filteredLeads.length) * 100)
        : 0;

    const lostRate =
      filteredLeads.length > 0
        ? Math.round((dealLostCount / filteredLeads.length) * 100)
        : 0;

    return {
      total: filteredLeads.length,
      today: todayCount,
      createdByMe: createdByMeCount,
      assignedToMe: assignedToMeCount,
      assignedByMe: assignedByMeCount,
      dealWon: dealWonCount,
      dealLost: dealLostCount,
      wonRate,
      lostRate,
      healthy: healthyCount,
      atRisk: atRiskCount,
      overdue: overdueCount,
      stageRows: toSorted(stageMap),
      healthRows: toSorted(healthMap),
      destinationRows: toSorted(destinationMap).slice(0, 5),
      ownerRows: toSorted(ownerMap).slice(0, 5),
      sourceRows: toSorted(sourceMap).slice(0, 5)
    };
  }, [filteredLeads, user]);

  const recentLeads = useMemo(() => {
    return filteredLeads.slice(0, 6);
  }, [filteredLeads]);

  /* =========================
     FILTER ACTIONS
  ========================== */
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const setDateRange = type => {
    const today = new Date();

    if (type === "today") {
      const date = toDateInput(today);

      setFilters(prev => ({
        ...prev,
        dateFrom: date,
        dateTo: date
      }));
    }

    if (type === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const date = toDateInput(yesterday);

      setFilters(prev => ({
        ...prev,
        dateFrom: date,
        dateTo: date
      }));
    }

    if (type === "last7") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);

      setFilters(prev => ({
        ...prev,
        dateFrom: toDateInput(from),
        dateTo: toDateInput(today)
      }));
    }

    if (type === "thisMonth") {
      const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

      setFilters(prev => ({
        ...prev,
        dateFrom: toDateInput(firstDay),
        dateTo: toDateInput(today)
      }));
    }
  };

  /* =========================
     LOADING
  ========================== */
  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-9xl mx-auto px-4 py-6 space-y-4">
          <CardSkeleton />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <CardSkeleton />
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
      <div className="max-w-9xl mx-auto px-4 py-6 space-y-6">
        {/* ================= BANNER ================= */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700  overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/15 text-white flex items-center justify-center shrink-0">
                <BarChart3 size={24} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 mb-3">
                  <Target size={14} />
                  Lead Analytics
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Lead Dashboard
                </h1>

                <p className="mt-1 text-sm text-blue-100 max-w-3xl leading-6">
                  Track your total leads, created leads, assigned leads,
                  delegated leads, won deals, lost deals and follow-up health
                  from one dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= FILTER PANEL ================= */}
        <section className="rounded-3xl border border-gray-200 bg-white p-4 ">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3">
            <div className="xl:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Search
              </label>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  value={filters.search}
                  onChange={e =>
                    updateFilter("search", e.target.value)
                  }
                  placeholder="Lead code, destination, owner..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Ownership
              </label>

              <select
                value={filters.ownership}
                onChange={e =>
                  updateFilter("ownership", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">All User Leads</option>
                <option value="created_by_me">Created By Me</option>
                <option value="assigned_to_me">Assigned To Me</option>
                <option value="assigned_by_me">Assigned By Me</option>
                <option value="deal_won">Deal Won</option>
                <option value="deal_lost">Deal Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Stage
              </label>

              <select
                value={filters.stage}
                onChange={e =>
                  updateFilter("stage", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">All Stages</option>

                {stageOptions.map(stage => (
                  <option key={stage} value={stage}>
                    {formatLabel(stage)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Health
              </label>

              <select
                value={filters.health}
                onChange={e =>
                  updateFilter("health", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">All Health</option>
                <option value="healthy">Healthy</option>
                <option value="at_risk">Needs Attention</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                From Date
              </label>

              <input
                type="date"
                value={filters.dateFrom}
                onChange={e =>
                  updateFilter("dateFrom", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                To Date
              </label>

              <input
                type="date"
                value={filters.dateTo}
                onChange={e =>
                  updateFilter("dateTo", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                <RefreshCcw size={15} />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDateRange("today")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setDateRange("yesterday")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              Yesterday
            </button>

            <button
              type="button"
              onClick={() => setDateRange("last7")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={() => setDateRange("thisMonth")}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-700"
            >
              This Month
            </button>

            {activeFilterCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <Filter size={13} />
                {activeFilterCount} active filter
                {activeFilterCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </section>

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

        {/* ================= MAIN KPI GRID ================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          <KpiCard
            icon={Target}
            label="Total User Leads"
            value={summary.total}
            helper="Created, assigned or assigned by you"
            tone="blue"
          />

          <KpiCard
            icon={UserPlus}
            label="Created By Me"
            value={summary.createdByMe}
            helper="Leads originally created by you"
            tone="emerald"
          />

          <KpiCard
            icon={UserCheck}
            label="Assigned To Me"
            value={summary.assignedToMe}
            helper="Leads currently assigned to you"
            tone="purple"
          />

          <KpiCard
            icon={Send}
            label="Assigned By Me"
            value={summary.assignedByMe}
            helper="Leads delegated by you"
            tone="slate"
          />

          <KpiCard
            icon={Trophy}
            label="Deal Won"
            value={summary.dealWon}
            helper={`${summary.wonRate}% of selected leads`}
            tone="emerald"
          />

          <KpiCard
            icon={XCircle}
            label="Deal Lost"
            value={summary.dealLost}
            helper={`${summary.lostRate}% of selected leads`}
            tone="red"
          />
        </section>

        {/* ================= HEALTH KPI GRID ================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            icon={CalendarDays}
            label="Created Today"
            value={summary.today}
            helper="New leads today"
            tone="blue"
          />

          <KpiCard
            icon={CheckCircle2}
            label="Healthy"
            value={summary.healthy}
            helper="No immediate risk"
            tone="emerald"
          />

          <KpiCard
            icon={Clock3}
            label="Needs Attention"
            value={summary.atRisk}
            helper="Follow-up due today"
            tone="amber"
          />

          <KpiCard
            icon={AlertTriangle}
            label="Overdue"
            value={summary.overdue}
            helper="Past due follow-ups"
            tone="red"
          />
        </section>

        {/* ================= INSIGHTS GRID ================= */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-4">
            <SectionCard
              title="Pipeline by Stage"
              subtitle="Lead distribution across stages"
            >
              {summary.stageRows.length === 0 ? (
                <EmptyMiniState title="No stage data" />
              ) : (
                <div className="space-y-4">
                  {summary.stageRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={formatLabel(row.label)}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="xl:col-span-4">
            <SectionCard
              title="Lead Health"
              subtitle="Follow-up and risk status"
            >
              {summary.healthRows.length === 0 ? (
                <EmptyMiniState title="No health data" />
              ) : (
                <div className="space-y-4">
                  {summary.healthRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={
                        HEALTH_META[row.label]?.label ||
                        formatLabel(row.label)
                      }
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="xl:col-span-4">
            <SectionCard
              title="Top Destinations"
              subtitle="Most active destinations"
            >
              {summary.destinationRows.length === 0 ? (
                <EmptyMiniState title="No destination data" />
              ) : (
                <div className="space-y-4">
                  {summary.destinationRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </section>

        {/* ================= LOWER GRID ================= */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-4 space-y-5">
            <SectionCard
              title="Lead Owners"
              subtitle="Assigned lead ownership"
            >
              {summary.ownerRows.length === 0 ? (
                <EmptyMiniState title="No owner data" />
              ) : (
                <div className="space-y-4">
                  {summary.ownerRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Lead Sources"
              subtitle="Lead source distribution"
            >
              {summary.sourceRows.length === 0 ? (
                <EmptyMiniState title="No source data" />
              ) : (
                <div className="space-y-4">
                  {summary.sourceRows.map(row => (
                    <ProgressRow
                      key={row.label}
                      label={formatLabel(row.label)}
                      value={row.value}
                      total={summary.total}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="xl:col-span-8">
            <SectionCard
              title="Recent Leads"
              subtitle="Latest leads based on selected filters"
            >
              {recentLeads.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No leads found"
                  description="Try changing your filters or date range."
                />
              ) : (
                <div className="space-y-3">
                  {recentLeads.map(lead => (
                    <RecentLeadItem
                      key={lead.id}
                      lead={lead}
                      user={user}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </section>
      </div>
    </main>
  );
}