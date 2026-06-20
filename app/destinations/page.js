"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Clock3,
  Globe2,
  ImageIcon,
  MapPinned,
  Search,
  Sparkles
} from "lucide-react";

import { db } from "@/lib/firebase";

/* =========================
   HELPERS
========================= */

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getCoverUrl(destination) {
  return (
    destination.coverPhoto?.url ||
    destination.coverPhoto ||
    destination.gallery?.[0]?.url ||
    destination.mediaGallery?.find(item => item.type === "image")?.url ||
    ""
  );
}

function getActivityCount(destination) {
  if (destination.hasSubLocations) {
    return (destination.locations || []).reduce(
      (sum, location) => sum + (location.activities?.length || 0),
      0
    );
  }

  return destination.activities?.length || 0;
}

function getLocationCount(destination) {
  return Array.isArray(destination.locations)
    ? destination.locations.length
    : 0;
}

function getTravelStyleLabels(travelStyles = {}) {
  return Object.entries(travelStyles)
    .filter(([, active]) => Boolean(active))
    .map(([key]) =>
      key
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase())
    );
}

export default function DestinationsListingPage() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    destinationType: "all"
  });

  /* =========================
     LOAD PUBLIC DESTINATIONS
  ========================== */
  useEffect(() => {
    const load = async () => {
      if (!db) {
        setLoadError("Firebase is not initialized.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError("");

        const q = query(
          collection(db, "destinations"),
          where("status", "==", "published"),
          where("active", "==", true)
        );

        const snap = await getDocs(q);

        const list = snap.docs
          .map(d => ({
            id: d.id,
            ...d.data()
          }))
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""))
          );

        setDestinations(list);
      } catch (err) {
        console.error("Failed to load destinations", err);
        setLoadError("Unable to load destinations. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* =========================
     FILTERED DATA
  ========================== */
  const filteredDestinations = useMemo(() => {
    const search = normalizeText(filters.search);

    return destinations.filter(destination => {
      const searchable = normalizeText(
        [
          destination.name,
          destination.code,
          destination.destinationId,
          destination.shortDescription,
          destination.description,
          destination.bestTimeToVisit,
          destination.idealTripDuration,
          destination.destinationType
        ].join(" ")
      );

      if (search && !searchable.includes(search)) {
        return false;
      }

      if (
        filters.destinationType !== "all" &&
        destination.destinationType !== filters.destinationType
      ) {
        return false;
      }

      return true;
    });
  }, [destinations, filters]);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-emerald-50" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-xs font-semibold text-blue-700">
            <Sparkles size={14} />
            Curated by Dream Trawell
          </div>

          <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Explore Destinations
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Hand-picked travel experiences, curated destinations, and memorable
            journeys designed by our destination experts.
          </p>

          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={filters.search}
                onChange={e =>
                  setFilters(prev => ({
                    ...prev,
                    search: e.target.value
                  }))
                }
                placeholder="Search destinations, season, duration..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none shadow-sm transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <select
              value={filters.destinationType}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  destinationType: e.target.value
                }))
              }
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-sm transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Destinations</option>
              <option value="domestic">Domestic</option>
              <option value="international">International</option>
            </select>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {filteredDestinations.length}
            </span>{" "}
            destination{filteredDestinations.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* LOADING */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(item => (
              <DestinationPublicSkeleton key={item} />
            ))}
          </div>
        )}

        {/* ERROR */}
        {!loading && loadError && (
          <div className="mx-auto max-w-2xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle size={22} />
            </div>

            <h2 className="text-lg font-semibold text-slate-950">
              Unable to load destinations
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {loadError}
            </p>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !loadError && filteredDestinations.length === 0 && (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <MapPinned size={22} />
            </div>

            <h2 className="text-lg font-semibold text-slate-950">
              No destinations available yet
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Try searching again or check back soon for new destinations.
            </p>
          </div>
        )}

        {/* DESTINATION GRID */}
        {!loading && !loadError && filteredDestinations.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredDestinations.map(destination => (
              <PublicDestinationCard
                key={destination.id}
                destination={destination}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* =========================
   CARD
========================= */

function PublicDestinationCard({ destination }) {
  const coverUrl = getCoverUrl(destination);
  const activityCount = getActivityCount(destination);
  const locationCount = getLocationCount(destination);
  const styleLabels = getTravelStyleLabels(destination.travelStyles).slice(0, 3);

  return (
    <Link
      href={`/destinations/${destination.id}`}
      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
    >
      <div className="relative h-56 overflow-hidden bg-slate-100">
        {coverUrl ? (
          <img
            src={coverUrl}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            alt={destination.name || "Destination"}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <ImageIcon size={36} />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 to-transparent" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {destination.destinationType && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold capitalize text-slate-800 backdrop-blur">
              {destination.destinationType}
            </span>
          )}

          {destination.hasSubLocations && (
            <span className="rounded-full bg-blue-600/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              Multi-location
            </span>
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="line-clamp-1 text-xl font-semibold text-white">
            {destination.name}
          </h2>

          {destination.code && (
            <p className="mt-1 text-xs font-medium text-white/80">
              {destination.code}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="line-clamp-2 text-sm leading-6 text-slate-600">
          {destination.shortDescription ||
            destination.description ||
            "Explore curated experiences for this destination."}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <InfoMiniCard
            icon={CalendarDays}
            label="Best Time"
            value={destination.bestTimeToVisit || "Flexible"}
          />

          <InfoMiniCard
            icon={Clock3}
            label="Duration"
            value={destination.idealTripDuration || "Custom"}
          />

          <InfoMiniCard
            icon={MapPinned}
            label={destination.hasSubLocations ? "Locations" : "Activities"}
            value={
              destination.hasSubLocations
                ? `${locationCount || 0}`
                : `${activityCount || 0}`
            }
          />

          <InfoMiniCard
            icon={Globe2}
            label="Type"
            value={
              destination.hasSubLocations
                ? "Location-wise"
                : "Destination"
            }
          />
        </div>

        {styleLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {styleLabels.map(style => (
              <span
                key={style}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {style}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm font-semibold text-slate-950">
            View Destination
          </span>

          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
            <ArrowRight size={17} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function InfoMiniCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        <Icon size={14} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="line-clamp-1 text-xs font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function DestinationPublicSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-56 animate-pulse bg-slate-200" />

      <div className="space-y-4 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />

        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(item => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}