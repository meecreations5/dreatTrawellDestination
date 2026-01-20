"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import EngagementCard from "@/components/engagement/EngagementCard";
import EngagementFilterBar from "@/components/engagement/EngagementFilterBar";
import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";

/* =========================
   DATE HELPERS
========================= */
const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const formatDateLabel = date => {
  const d = new Date(date);
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

export default function MyEngagementsPage() {
  const { user, loading } = useAuth();

  const [engagements, setEngagements] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  /* =========================
     FILTER STATE
  ========================== */
  const [filters, setFilters] = useState({
    search: "",
    travelAgent: "",
    spoc: "",
    destination: "",
    channel: "all"
  });

  /* =========================
     LOAD MY ENGAGEMENTS
  ========================== */
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "engagements"),
      where("createdByUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setEngagements(rows);
      setLoadingList(false);
    });

    return () => unsub();
  }, [user]);

  /* =========================
     APPLY FILTERS
  ========================== */
  const filteredEngagements = useMemo(() => {
    return engagements.filter(e => {
      /* Channel */
      if (
        filters.channel !== "all" &&
        e.channel !== filters.channel
      ) {
        return false;
      }

      /* Search (global text search) */
      if (filters.search) {
        const haystack = JSON.stringify(e)
          .toLowerCase();
        if (
          !haystack.includes(
            filters.search.toLowerCase()
          )
        ) {
          return false;
        }
      }

      /* Destination */
      if (
        filters.destination &&
        !e.destinationName
          ?.toLowerCase()
          .includes(
            filters.destination.toLowerCase()
          )
      ) {
        return false;
      }

      /* SPOC */
      if (
        filters.spoc &&
        !e.spoc?.name
          ?.toLowerCase()
          .includes(filters.spoc.toLowerCase())
      ) {
        return false;
      }

      /* Travel Agent */
      if (filters.travelAgent) {
        const agentName =
          e.travelAgentName ||
          e.agentName ||
          e.agent?.name ||
          "";
        if (
          !agentName
            .toLowerCase()
            .includes(
              filters.travelAgent.toLowerCase()
            )
        ) {
          return false;
        }
      }

      return true;
    });
  }, [engagements, filters]);

  /* =========================
     GROUP BY DATE
  ========================== */
  const grouped = useMemo(() => {
    return filteredEngagements.reduce(
      (acc, e) => {
        const date =
          e.createdAt?.toDate?.() ||
          new Date();
        const label = formatDateLabel(date);

        if (!acc[label]) acc[label] = [];
        acc[label].push(e);
        return acc;
      },
      {}
    );
  }, [filteredEngagements]);

  /* =========================
     LOADING
  ========================== */
  if (loading || loadingList) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4 bg-gray-50 min-h-screen">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">

        <div className="px-4 py-6">
          {/* HEADER */}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              My Engagements
            </h1>
            <p className="text-sm text-gray-500">
              {filteredEngagements.length} results
            </p>
          </div>

          {/* ================= FILTER BAR ================= */}
          <EngagementFilterBar
            filters={filters}
            setFilters={setFilters}
          />


          {/* EMPTY */}
          {filteredEngagements.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No engagements found"
              description="Try adjusting your filters"
            />
          ) : (
            <div className="space-y-10">
              {Object.entries(grouped).map(
                ([dateLabel, items]) => (
                  <section key={dateLabel}>
                    {/* DATE SEPARATOR */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-medium text-gray-500">
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* LIST */}
                    <div className="bg-white">
                      {items.map(e => (
                        <EngagementCard
                          key={e.id}
                          engagement={e}
                          agent={{}}
                        />
                      ))}
                    </div>
                  </section>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
