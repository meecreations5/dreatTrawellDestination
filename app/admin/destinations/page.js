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

import DestinationCard from "@/components/destination/DestinationCard";
import DestinationTable from "@/components/destination/DestinationTable";
import DestinationFilters from "@/components/destination/DestinationFilters";
import DestinationSkeleton from "@/components/destination/DestinationSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("card");

  const [filters, setFilters] = useState({
    search: "",
    bestTime: "all",
    duration: "all"
  });

  /* =========================
     REALTIME LOAD
  ========================== */
  useEffect(() => {
    const q = query(
      collection(db, "destinations"),
      where("status", "==", "published"),
      where("active", "==", true),
      orderBy("name", "asc")
    );

    const unsub = onSnapshot(q, snap => {
      setDestinations(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
      setLoading(false);
    });

    return () => unsub();
  }, []);

  /* =========================
     FILTERED DATA
  ========================== */
  const filteredDestinations = useMemo(() => {
    return destinations.filter(d => {
      // SEARCH
      if (
        filters.search &&
        !d.name
          ?.toLowerCase()
          .includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // BEST TIME
      if (
        filters.bestTime !== "all" &&
        d.bestTimeToVisit !== filters.bestTime
      ) {
        return false;
      }

      // DURATION
      if (
        filters.duration !== "all" &&
        d.idealTripDuration !== filters.duration
      ) {
        return false;
      }

      return true;
    });
  }, [destinations, filters]);

  /* =========================
     UI
  ========================== */
  return (
    <main className="p-6 w-full mx-auto space-y-4">
      {/* HEADER ROW */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Explore Destinations
        </h1>

        <Link
          href="/admin/destinations/new"
          className="
        inline-flex items-center gap-1
        text-sm px-3 py-1.5 rounded-md
        bg-blue-600 text-white
        hover:bg-blue-700 transition
      "
        >
          + Create Destination
        </Link>
      </div>



      {/* FILTER BAR */}
      <DestinationFilters
        view={view}
        setView={setView}
        filters={filters}
        setFilters={setFilters}
      />

      {/* LOADING */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <DestinationSkeleton key={i} />
          ))}
        </div>
      )}

      {/* EMPTY */}
      {!loading && filteredDestinations.length === 0 && (
        <EmptyState
          title="No destinations found"
          description="Try adjusting filters"
        />
      )}

      {/* CARD VIEW */}
      {!loading && view === "card" && (
        <div className="space-y-3">
          {filteredDestinations.map(d => (
            <DestinationCard key={d.id} destination={d} />
          ))}
        </div>
      )}

      {/* TABLE VIEW */}
      {!loading && view === "table" && (
        <DestinationTable
          destinations={filteredDestinations}
          onRowClick={id =>
            window.location.assign(`/destinations/${id}`)
          }
        />
      )}
    </main>
  );
}
