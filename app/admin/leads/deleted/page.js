"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  XCircle
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

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

function getTime(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) return "Not available";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function money(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
}

function cleanText(value, fallback = "Not available") {
  return String(value || "").trim() || fallback;
}

function getLeadDisplayName(lead) {
  return (
    cleanText(lead?.leadCode, "") ||
    cleanText(lead?.customerName, "") ||
    cleanText(lead?.agentName, "") ||
    lead?.id ||
    "Deleted Lead"
  );
}

function getStageBadgeClass(stage = "") {
  const key = String(stage || "").toLowerCase();

  if (key === "converted") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (key === "lost") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  if (key === "quote_sent") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getUserName(user) {
  return (
    cleanText(user?.displayName, "") ||
    cleanText(user?.name, "") ||
    cleanText(user?.fullName, "") ||
    cleanText(user?.email, "") ||
    "System"
  );
}

/* =========================
   PAGE
========================= */

export default function DeletedLeadsPage() {
  const { user, loading: authLoading } = useAuth(true);

  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");

  const [syncingDeletedFlag, setSyncingDeletedFlag] = useState(false);

  /* =========================
     LOAD DELETED LEADS
     Uses deleted === true because old records have:
     deleted: true
     isDeleted: false
  ========================= */

  useEffect(() => {
    if (authLoading || !user) return;

    setLoadingLeads(true);
    setError("");

    const q = query(
      collection(db, "leads"),
      where("deleted", "==", true)
    );

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const bTime = getTime(b.deletedAt || b.updatedAt || b.createdAt);
            const aTime = getTime(a.deletedAt || a.updatedAt || a.createdAt);
            return bTime - aTime;
          });

        setLeads(rows);
        setLoadingLeads(false);
      },
      err => {
        console.error("Deleted leads load error:", err);
        setError("Unable to load deleted leads.");
        setLoadingLeads(false);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  /* =========================
     SYNC isDeleted FALSE -> TRUE
  ========================= */

  const syncIsDeletedFlag = async () => {
    const confirmSync = window.confirm(
      "This will update all leads where deleted = true and isDeleted is not true. Continue?"
    );

    if (!confirmSync) return;

    try {
      setSyncingDeletedFlag(true);

      const q = query(
        collection(db, "leads"),
        where("deleted", "==", true)
      );

      const snapshot = await getDocs(q);

      const leadsToUpdate = snapshot.docs.filter(docSnap => {
        const data = docSnap.data();
        return data?.isDeleted !== true;
      });

      if (leadsToUpdate.length === 0) {
        alert("All deleted leads are already synced.");
        return;
      }

      const batchSize = 450;

      for (let i = 0; i < leadsToUpdate.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = leadsToUpdate.slice(i, i + batchSize);

        chunk.forEach(docSnap => {
          batch.update(doc(db, "leads", docSnap.id), {
            deleted: true,
            isDeleted: true,

            updatedAt: serverTimestamp(),
            updatedByUid: user?.uid || "",
            updatedByName: getUserName(user)
          });
        });

        await batch.commit();
      }

      alert(`${leadsToUpdate.length} deleted lead records synced successfully.`);
    } catch (err) {
      console.error("Sync isDeleted flag error:", err);
      alert("Unable to sync deleted lead records.");
    } finally {
      setSyncingDeletedFlag(false);
    }
  };

  /* =========================
     DERIVED FILTERS
  ========================= */

  const notSyncedCount = useMemo(() => {
    return leads.filter(lead => lead?.isDeleted !== true).length;
  }, [leads]);

  const stages = useMemo(() => {
    const unique = new Set();

    leads.forEach(lead => {
      if (lead?.stage) unique.add(lead.stage);
    });

    return Array.from(unique).sort();
  }, [leads]);

  const assignees = useMemo(() => {
    const unique = new Map();

    leads.forEach(lead => {
      const uid =
        cleanText(lead?.assignedToUid, "") ||
        cleanText(lead?.assignedToEmail, "") ||
        cleanText(lead?.assignedTo, "");

      if (!uid) return;

      unique.set(uid, {
        value: uid,
        label:
          cleanText(lead?.assignedToName, "") ||
          cleanText(lead?.assignedToEmail, "") ||
          cleanText(lead?.assignedTo, "Unassigned")
      });
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();

    return leads.filter(lead => {
      const searchable = [
        lead?.leadCode,
        lead?.customerName,
        lead?.customerEmail,
        lead?.customerMobile,
        lead?.agentName,
        lead?.agencyName,
        lead?.travelAgentName,
        lead?.destinationName,
        lead?.deletedByName,
        lead?.assignedToName,
        lead?.assignedToEmail
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || searchable.includes(q);

      const matchesStage =
        stageFilter === "all" || lead?.stage === stageFilter;

      const assignedKey =
        cleanText(lead?.assignedToUid, "") ||
        cleanText(lead?.assignedToEmail, "") ||
        cleanText(lead?.assignedTo, "");

      const matchesAssigned =
        assignedFilter === "all" || assignedKey === assignedFilter;

      return matchesSearch && matchesStage && matchesAssigned;
    });
  }, [leads, search, stageFilter, assignedFilter]);

  const stats = useMemo(() => {
    const converted = leads.filter(
      lead => String(lead?.stage || "").toLowerCase() === "converted"
    ).length;

    const lost = leads.filter(
      lead => String(lead?.stage || "").toLowerCase() === "lost"
    ).length;

    const totalGrossProfit = leads.reduce(
      (sum, lead) =>
        sum + Number(lead?.latestGrossProfit || lead?.actualGrossProfit || 0),
      0
    );

    return {
      totalDeleted: leads.length,
      converted,
      lost,
      totalGrossProfit
    };
  }, [leads]);

  /* =========================
     LOADING
  ========================= */

  if (authLoading || loadingLeads) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-24 animate-pulse rounded-3xl bg-white" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(item => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-3xl bg-white"
              />
            ))}
          </div>

          <div className="h-96 animate-pulse rounded-3xl bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-rose-50 via-white to-slate-50 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <Link
                  href="/admin/leads"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Leads
                </Link>

                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
                    <Trash2 className="h-3.5 w-3.5" />
                    Deleted Leads
                  </div>

                  <h1 className="mt-3 text-2xl font-bold text-slate-950 md:text-3xl">
                    Deleted Leads Records
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    Showing records from Firebase where{" "}
                    <span className="font-semibold text-slate-900">
                      deleted = true
                    </span>
                    . Use sync to update old records where{" "}
                    <span className="font-semibold text-slate-900">
                      isDeleted = false
                    </span>
                    .
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-rose-100 bg-white px-6 py-4 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Total Deleted
                </p>

                <p className="mt-1 text-4xl font-black text-rose-600">
                  {stats.totalDeleted}
                </p>

                <button
                  type="button"
                  onClick={syncIsDeletedFlag}
                  disabled={syncingDeletedFlag || notSyncedCount === 0}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      syncingDeletedFlag ? "animate-spin" : ""
                    }`}
                  />
                  {syncingDeletedFlag
                    ? "Syncing..."
                    : notSyncedCount > 0
                    ? `Sync isDeleted (${notSyncedCount})`
                    : "Already Synced"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* KPI */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Deleted Records
                </p>
                <p className="mt-2 text-3xl font-black text-slate-950">
                  {stats.totalDeleted}
                </p>
              </div>

              <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
                <Trash2 className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Need Sync
                </p>
                <p className="mt-2 text-3xl font-black text-amber-600">
                  {notSyncedCount}
                </p>
              </div>

              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <RefreshCw className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Converted
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-600">
                  {stats.converted}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Gross Profit
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {money(stats.totalGrossProfit)}
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <IndianRupee className="h-6 w-6" />
              </div>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <section className="sticky top-4 z-10 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_240px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by lead code, customer, agent, destination, deleted by..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
            >
              <option value="all">All Stages</option>

              {stages.map(stage => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>

            <select
              value={assignedFilter}
              onChange={e => setAssignedFilter(e.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
            >
              <option value="all">All Assignees</option>

              {assignees.map(assignee => (
                <option key={assignee.value} value={assignee.value}>
                  {assignee.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing{" "}
              <span className="font-bold text-slate-900">
                {filteredLeads.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-900">{leads.length}</span>{" "}
              deleted leads
            </span>

            {(search || stageFilter !== "all" || assignedFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStageFilter("all");
                  setAssignedFilter("all");
                }}
                className="rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-200"
              >
                Clear Filters
              </button>
            )}
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* EMPTY */}
        {!error && filteredLeads.length === 0 && (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Trash2 className="h-7 w-7" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-950">
              No deleted leads found
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              There are no records matching deleted = true for the selected
              filters.
            </p>
          </section>
        )}

        {/* LIST */}
        {filteredLeads.length > 0 && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_120px] md:gap-4">
              <span>Lead</span>
              <span>Customer / Agent</span>
              <span>Destination</span>
              <span>Deleted Info</span>
              <span>Commercials</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredLeads.map(lead => {
                const isSynced = lead?.isDeleted === true;

                return (
                  <article
                    key={lead.id}
                    className="grid gap-4 p-5 transition hover:bg-slate-50 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_120px] md:items-center"
                  >
                    {/* LEAD */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStageBadgeClass(
                            lead?.stage
                          )}`}
                        >
                          {cleanText(
                            lead?.stageLabel || lead?.stage,
                            "No stage"
                          )}
                        </span>

                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                          Deleted
                        </span>

                        {isSynced ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            isDeleted synced
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            isDeleted false
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-950">
                          {getLeadDisplayName(lead)}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          ID: {lead.id}
                        </p>
                      </div>
                    </div>

                    {/* CUSTOMER */}
                    <div className="space-y-1 text-sm">
                      <p className="font-bold text-slate-900">
                        {cleanText(lead?.customerName)}
                      </p>

                      <p className="text-xs text-slate-500">
                        {cleanText(
                          lead?.agentName ||
                            lead?.agencyName ||
                            lead?.travelAgentName
                        )}
                      </p>

                      <p className="text-xs text-slate-500">
                        {cleanText(lead?.customerMobile, "")}
                      </p>
                    </div>

                    {/* DESTINATION */}
                    <div className="space-y-1 text-sm">
                      <p className="font-bold text-slate-900">
                        {cleanText(lead?.destinationName)}
                      </p>

                      <p className="text-xs text-slate-500">
                        {cleanText(lead?.destinationCode, "")}
                      </p>
                    </div>

                    {/* DELETED INFO */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <UserRound className="mt-0.5 h-4 w-4 text-slate-400" />

                        <div>
                          <p className="font-bold text-slate-900">
                            {cleanText(lead?.deletedByName)}
                          </p>

                          <p className="text-xs text-slate-500">Deleted by</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />

                        <div>
                          <p className="font-semibold text-slate-700">
                            {formatDateTime(lead?.deletedAt)}
                          </p>

                          <p className="text-xs text-slate-500">Deleted at</p>
                        </div>
                      </div>
                    </div>

                    {/* COMMERCIALS */}
                    <div className="space-y-1 text-sm">
                      <p className="font-black text-slate-950">
                        {money(
                          lead?.latestQuotationAmount ||
                            lead?.latestCustomerQuoteAmount ||
                            lead?.totalReceivableAmount ||
                            0
                        )}
                      </p>

                      <p className="text-xs text-slate-500">
                        Gross Profit:{" "}
                        <span className="font-bold text-emerald-700">
                          {money(
                            lead?.latestGrossProfit ||
                              lead?.actualGrossProfit ||
                              0
                          )}
                        </span>
                      </p>

                      <p className="text-xs text-slate-500">
                        Vendor: {cleanText(lead?.latestVendorName, "No vendor")}
                      </p>
                    </div>

                    {/* ACTION */}
                    <div className="flex justify-start md:justify-end">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        View
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}