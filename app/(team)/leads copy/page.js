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
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import TravelChip from "@/components/ui/TravelChip";
import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";

import LeadFilterBar from "@/components/leads/LeadFilterBar";

/* =========================
   LEAD HEALTH LOGIC
========================= */
function getLeadHealth(lead) {
  if (!lead.nextActionDueAt?.toDate) return "healthy";

  const due = lead.nextActionDueAt.toDate();
  const now = new Date();

  if (due < now) return "overdue";
  if (due.toDateString() === now.toDateString())
    return "at_risk";

  return "healthy";
}

const HEALTH_LABEL = {
  healthy: "🟢 Healthy",
  at_risk: "🟡 Needs Attention",
  overdue: "🔴 Overdue"
};

export default function TeamLeadsPage() {
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =========================
     FILTER STATE (STANDARD)
  ========================== */
  const [filters, setFilters] = useState({
    search: "",
    stage: "",
    health: ""
  });

  /* =========================
     LOAD LEADS
  ========================== */
  useEffect(() => {
    if (!user?.uid) return;

    const map = new Map();

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
        snap.docs.forEach(d =>
          map.set(d.id, {
            id: d.id,
            ...d.data()
          })
        );
        setLeads(Array.from(map.values()));
        setLoading(false);
      }
    );

    const unsubCreated = onSnapshot(
      createdQuery,
      snap => {
        snap.docs.forEach(d =>
          map.set(d.id, {
            id: d.id,
            ...d.data()
          })
        );
        setLeads(Array.from(map.values()));
        setLoading(false);
      }
    );

    return () => {
      unsubAssigned();
      unsubCreated();
    };
  }, [user]);

  /* =========================
     APPLY FILTERS
  ========================== */
  const filtered = useMemo(() => {
    return leads.filter(lead => {
      const q = filters.search.toLowerCase();

      const matchesSearch =
        !filters.search ||
        [
          lead.leadCode,
          lead.destinationName,
          lead.assignedToName,
          lead.stage
        ]
          .filter(Boolean)
          .some(v =>
            v.toLowerCase().includes(q)
          );

      const matchesStage =
        !filters.stage ||
        lead.stage === filters.stage;

      const matchesHealth =
        !filters.health ||
        getLeadHealth(lead) === filters.health;

      return (
        matchesSearch &&
        matchesStage &&
        matchesHealth
      );
    });
  }, [leads, filters]);

  /* =========================
     LOADING
  ========================== */
  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* HEADER */}
        <div className=" py-4">
          <h1 className="text-xl font-semibold text-gray-900">
            My Leads
          </h1>
          <p className="text-sm text-gray-500">
            Leads assigned to you or created by you
          </p>
        </div>

        {/* ================= FILTER BAR ================= */}
        <LeadFilterBar
          filters={filters}
          setFilters={setFilters}
        />

        {/* ================= LIST ================= */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No leads found"
            description="Try adjusting your filters"
          />
        ) : (
          <div className="space-y-4">
            {filtered.map(lead => {
              const health = getLeadHealth(lead);
              const viewOnly =
                lead.assignedToUid !== user.uid;

              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="block"
                >
                  <div className="bg-white rounded-xl shadow-card p-4 hover:shadow-md transition">
                    {/* TOP */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">
                          {lead.leadCode}
                        </p>

                        <div className="flex gap-2 mt-1">
                          <TravelChip
                            label={lead.assignedToName}
                            icon="agent"
                            color="neutral"
                          />
                          {viewOnly && (
                            <TravelChip
                              label="View only"
                              icon="eye"
                              color="warning"
                            />
                          )}
                        </div>
                      </div>

                      <span className="text-xs">
                        {HEALTH_LABEL[health]}
                      </span>
                    </div>

                    {/* CHIPS */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <TravelChip
                        label={
                          lead.destinationName
                        }
                        icon="destination"
                        color="primary"
                      />

                      <TravelChip
                        label={lead.stage.replace(
                          "_",
                          " "
                        )}
                        icon="travel"
                        color="success"
                      />

                      {lead.nextActionType && (
                        <TravelChip
                          label={`Next: ${lead.nextActionType}`}
                          icon="calendar"
                          color="warning"
                        />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
