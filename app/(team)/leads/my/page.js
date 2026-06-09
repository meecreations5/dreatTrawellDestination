"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  MapPin,
  UserRound
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";
import LeadFilterBar from "@/components/leads/LeadFilterBar";

/* =========================
   DEFAULT FILTERS
========================= */
const DEFAULT_FILTERS = {
  search: "",
  stage: "",
  health: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "newest"
};

/* =========================
   DATE HELPERS
========================= */
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

const formatDate = value => {
  const date = getValidDate(value);
  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const normalize = value =>
  String(value || "")
    .trim()
    .toLowerCase();

const formatStage = value => {
  if (!value) return "Not Set";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

/* =========================
   LEAD HEALTH LOGIC
========================= */
function getLeadHealth(lead) {
  const due = getValidDate(lead?.nextActionDueAt);

  if (!due) return "healthy";

  const now = new Date();

  if (due < now) return "overdue";

  if (due.toDateString() === now.toDateString()) {
    return "at_risk";
  }

  return "healthy";
}

const HEALTH_META = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle2,
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-100"
  },
  at_risk: {
    label: "Needs Attention",
    icon: Clock3,
    className:
      "bg-amber-50 text-amber-700 border-amber-100"
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    className:
      "bg-red-50 text-red-700 border-red-100"
  }
};

/* =========================
   SMALL UI COMPONENTS
========================= */
function LeadHealthBadge({ health }) {
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

function LeadInfoPill({ icon: Icon, label, value }) {
  if (!value) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
      <Icon size={13} className="text-gray-400" />
      <span className="font-medium text-gray-500">
        {label}:
      </span>
      <span className="font-semibold text-gray-800 truncate max-w-[180px]">
        {value}
      </span>
    </div>
  );
}

function LeadCard({ lead, user }) {
  const health = getLeadHealth(lead);
  const viewOnly = lead.assignedToUid !== user?.uid;

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block group"
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">

        {/* TOP */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-gray-950">
                {lead.leadCode || "Lead"}
              </p>

              {viewOnly && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  <Eye size={12} />
                  View only
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-gray-500">
              Created on {formatDate(lead.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <LeadHealthBadge health={health} />

            <div className="h-8 w-8 rounded-full border border-gray-200 bg-gray-50 text-gray-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-100 transition">
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* BODY PILLS */}
        <div className="mt-4 flex flex-wrap gap-2">
          <LeadInfoPill
            icon={MapPin}
            label="Destination"
            value={lead.destinationName}
          />

          <LeadInfoPill
            icon={Activity}
            label="Stage"
            value={formatStage(lead.stage)}
          />

          <LeadInfoPill
            icon={UserRound}
            label="Owner"
            value={lead.assignedToName}
          />

          {lead.nextActionType && (
            <LeadInfoPill
              icon={CalendarDays}
              label="Next"
              value={formatStage(lead.nextActionType)}
            />
          )}
        </div>

        {/* FOOTER */}
        {(lead.nextActionDueAt || lead.createdByName) && (
          <div className="mt-4 border-t border-gray-100 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-gray-500">
              {lead.nextActionDueAt
                ? `Next action due: ${formatDate(lead.nextActionDueAt)}`
                : "No next action due date"}
            </p>

            {lead.createdByName && (
              <p className="text-xs text-gray-400">
                Created by {lead.createdByName}
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function TeamLeadsPage() {
  const { user, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  /* =========================
     LOAD LEADS
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

    let assignedRows = new Map();
    let createdRows = new Map();

    const mergeRows = () => {
      const merged = new Map();

      createdRows.forEach((value, key) => {
        merged.set(key, value);
      });

      assignedRows.forEach((value, key) => {
        merged.set(key, value);
      });

      const rows = Array.from(merged.values()).sort((a, b) => {
        const aTime = getValidDate(a.createdAt)?.getTime?.() || 0;
        const bTime = getValidDate(b.createdAt)?.getTime?.() || 0;
        return bTime - aTime;
      });

      setLeads(rows);
      setLoading(false);
    };

    const assignedQuery = query(
      collection(db, "leads"),
      where("assignedToUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const createdQuery = query(
      collection(db, "leads"),
      where("createdByUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubAssigned = onSnapshot(
      assignedQuery,
      snap => {
        assignedRows = new Map(
          snap.docs.map(d => [
            d.id,
            {
              id: d.id,
              ...d.data()
            }
          ])
        );

        mergeRows();
      },
      err => {
        console.error("Failed to load assigned leads:", err);
        setError(
          "Unable to load assigned leads. Please check Firestore permissions or required index."
        );
        setLoading(false);
      }
    );

    const unsubCreated = onSnapshot(
      createdQuery,
      snap => {
        createdRows = new Map(
          snap.docs.map(d => [
            d.id,
            {
              id: d.id,
              ...d.data()
            }
          ])
        );

        mergeRows();
      },
      err => {
        console.error("Failed to load created leads:", err);
        setError(
          "Unable to load created leads. Please check Firestore permissions or required index."
        );
        setLoading(false);
      }
    );

    return () => {
      unsubAssigned();
      unsubCreated();
    };
  }, [user?.uid, authLoading]);

  /* =========================
     STAGE OPTIONS
  ========================== */
  const stageOptions = useMemo(() => {
    return Array.from(
      new Set(leads.map(lead => lead.stage).filter(Boolean))
    ).sort();
  }, [leads]);

  /* =========================
     ACTIVE FILTER COUNT
  ========================== */
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "sortBy") return value && value !== "newest";
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
     APPLY FILTERS
  ========================== */
  const filtered = useMemo(() => {
    if (dateRangeError) return [];

    const searchText = normalize(filters.search);
    const fromDate = getStartOfDay(filters.dateFrom);
    const toDate = getEndOfDay(filters.dateTo);

    const rows = leads.filter(lead => {
      const health = getLeadHealth(lead);
      const createdDate = getValidDate(lead.createdAt);

      if ((fromDate || toDate) && !createdDate) return false;
      if (fromDate && createdDate < fromDate) return false;
      if (toDate && createdDate > toDate) return false;

      const matchesSearch =
        !searchText ||
        [
          lead.leadCode,
          lead.destinationName,
          lead.assignedToName,
          lead.createdByName,
          lead.stage,
          lead.nextActionType,
          lead.travelAgentName,
          lead.agentName,
          lead.agencyName,
          lead.source
        ]
          .filter(Boolean)
          .some(value =>
            normalize(value).includes(searchText)
          );

      const matchesStage =
        !filters.stage || lead.stage === filters.stage;

      const matchesHealth =
        !filters.health || health === filters.health;

      return matchesSearch && matchesStage && matchesHealth;
    });

    return rows.sort((a, b) => {
      if (filters.sortBy === "oldest") {
        const aTime = getValidDate(a.createdAt)?.getTime?.() || 0;
        const bTime = getValidDate(b.createdAt)?.getTime?.() || 0;
        return aTime - bTime;
      }

      if (filters.sortBy === "leadCode") {
        return String(a.leadCode || "").localeCompare(
          String(b.leadCode || "")
        );
      }

      if (filters.sortBy === "stage") {
        return String(a.stage || "").localeCompare(
          String(b.stage || "")
        );
      }

      if (filters.sortBy === "health") {
        const order = {
          overdue: 0,
          at_risk: 1,
          healthy: 2
        };

        return (
          order[getLeadHealth(a)] - order[getLeadHealth(b)]
        );
      }

      const aTime = getValidDate(a.createdAt)?.getTime?.() || 0;
      const bTime = getValidDate(b.createdAt)?.getTime?.() || 0;
      return bTime - aTime;
    });
  }, [leads, filters, dateRangeError]);

  /* =========================
     LOADING
  ========================== */
  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ================= BANNER ================= */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/15 text-white flex items-center justify-center shrink-0">
                <Activity size={24} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 mb-3">
                  <Activity size={14} />
                  Team Lead Workspace
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  My Leads
                </h1>

                <p className="mt-1 text-sm text-blue-100 max-w-2xl leading-6">
                  View, manage and follow up on leads assigned to you or created by you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= MAIN GRID ================= */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          {/* LEFT LIST */}
          <div className="xl:col-span-8 2xl:col-span-9 space-y-5">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Lead Timeline
                </p>
                <p className="text-xs text-gray-500">
                  Showing {filtered.length} of {leads.length} leads
                </p>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  Clear all filters
                </button>
              )}
            </div>

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

            {!error && filtered.length === 0 ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-10 shadow-sm">
                <EmptyState
                  icon="📭"
                  title="No leads found"
                  description={
                    leads.length === 0
                      ? "No leads are assigned to you or created by you yet."
                      : "Try changing your search, date range, stage or health filter."
                  }
                />
              </div>
            ) : null}

            {!error && filtered.length > 0 && (
              <div className="space-y-3">
                {filtered.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    user={user}
                  />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT FILTER */}
          <aside className="xl:col-span-4 2xl:col-span-3">
            <div className="xl:sticky xl:top-5">
              <LeadFilterBar
                filters={filters}
                setFilters={setFilters}
                stageOptions={stageOptions}
                activeFilterCount={activeFilterCount}
                resultCount={filtered.length}
                onClearFilters={() =>
                  setFilters({ ...DEFAULT_FILTERS })
                }
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}