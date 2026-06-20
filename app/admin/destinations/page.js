"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Globe2,
  Grid3X3,
  List,
  MapPinned,
  Plus,
  Search,
  SlidersHorizontal
} from "lucide-react";

import { db } from "@/lib/firebase";

import DestinationCard from "@/components/destination/DestinationCard";
import DestinationTable from "@/components/destination/DestinationTable";
import DestinationSkeleton from "@/components/destination/DestinationSkeleton";
import EmptyState from "@/components/ui/EmptyState";

/* =========================
   HELPERS
========================= */

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getDestinationActivityCount(destination) {
  if (destination.hasSubLocations) {
    return (destination.locations || []).reduce(
      (sum, location) => sum + (location.activities?.length || 0),
      0
    );
  }

  return destination.activities?.length || 0;
}

function getDestinationLocationCount(destination) {
  return Array.isArray(destination.locations)
    ? destination.locations.length
    : 0;
}

function getMediaCount(destination) {
  const galleryCount = Array.isArray(destination.gallery)
    ? destination.gallery.length
    : 0;

  const mediaGalleryCount = Array.isArray(destination.mediaGallery)
    ? destination.mediaGallery.length
    : 0;

  return galleryCount + mediaGalleryCount;
}

function getReadinessScore(destination) {
  const activityCount = getDestinationActivityCount(destination);
  const mediaCount = getMediaCount(destination);

  const checks = [
    Boolean(destination.name),
    Boolean(destination.code),
    Boolean(destination.shortDescription),
    Boolean(destination.description),
    Boolean(destination.coverPhoto),
    mediaCount > 0,
    activityCount > 0,
    Boolean(destination.bestTimeToVisit),
    Boolean(destination.idealTripDuration)
  ];

  const done = checks.filter(Boolean).length;

  return Math.round((done / checks.length) * 100);
}

function createUniqueOptions(destinations, key) {
  return Array.from(
    new Set(
      destinations
        .map(item => item?.[key])
        .filter(Boolean)
        .map(String)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export default function DestinationsPage() {
  const router = useRouter();

  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("card");

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    destinationType: "all",
    activityStructure: "all",
    bestTime: "all",
    duration: "all",
    readiness: "all"
  });

  /* =========================
     REALTIME LOAD
  ========================== */
  useEffect(() => {
    setLoading(true);
    setLoadError("");

    const q = query(
      collection(db, "destinations"),
      orderBy("name", "asc")
    );

    const unsub = onSnapshot(
      q,
      snap => {
        setDestinations(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );

        setLoading(false);
      },
      error => {
        console.error("Unable to load destinations:", error);
        setLoadError("Unable to load destinations. Please try again.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  /* =========================
     FILTER OPTIONS
  ========================== */
  const bestTimeOptions = useMemo(
    () => createUniqueOptions(destinations, "bestTimeToVisit"),
    [destinations]
  );

  const durationOptions = useMemo(
    () => createUniqueOptions(destinations, "idealTripDuration"),
    [destinations]
  );

  /* =========================
     FILTERED DATA
  ========================== */
  const filteredDestinations = useMemo(() => {
    const search = normalizeText(filters.search);

    return destinations.filter(destination => {
      const searchableText = normalizeText(
        [
          destination.name,
          destination.code,
          destination.destinationId,
          destination.shortDescription,
          destination.destinationType,
          destination.bestTimeToVisit,
          destination.idealTripDuration
        ].join(" ")
      );

      if (search && !searchableText.includes(search)) {
        return false;
      }

      if (filters.status !== "all") {
        if (filters.status === "active" && destination.active === false) {
          return false;
        }

        if (filters.status === "inactive" && destination.active !== false) {
          return false;
        }

        if (
          ["draft", "published", "archived"].includes(filters.status) &&
          destination.status !== filters.status
        ) {
          return false;
        }
      }

      if (
        filters.destinationType !== "all" &&
        destination.destinationType !== filters.destinationType
      ) {
        return false;
      }

      if (filters.activityStructure !== "all") {
        const structure = destination.hasSubLocations
          ? "location_wise"
          : "destination_level";

        if (structure !== filters.activityStructure) {
          return false;
        }
      }

      if (
        filters.bestTime !== "all" &&
        destination.bestTimeToVisit !== filters.bestTime
      ) {
        return false;
      }

      if (
        filters.duration !== "all" &&
        destination.idealTripDuration !== filters.duration
      ) {
        return false;
      }

      if (filters.readiness !== "all") {
        const score = getReadinessScore(destination);

        if (filters.readiness === "ready" && score < 80) {
          return false;
        }

        if (filters.readiness === "incomplete" && score >= 80) {
          return false;
        }
      }

      return true;
    });
  }, [destinations, filters]);

  /* =========================
     SUMMARY
  ========================== */
  const summary = useMemo(() => {
    const total = destinations.length;
    const published = destinations.filter(d => d.status === "published").length;
    const draft = destinations.filter(d => d.status === "draft").length;
    const inactive = destinations.filter(d => d.active === false).length;
    const locationWise = destinations.filter(d => d.hasSubLocations).length;
    const incomplete = destinations.filter(d => getReadinessScore(d) < 80).length;

    return {
      total,
      published,
      draft,
      inactive,
      locationWise,
      incomplete
    };
  }, [destinations]);

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      destinationType: "all",
      activityStructure: "all",
      bestTime: "all",
      duration: "all",
      readiness: "all"
    });
  };

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  <MapPinned size={14} />
                  Destination Management
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">
                  Explore Destinations
                </h1>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Manage destination content, media, locations, activities,
                  pricing readiness, and publishing status.
                </p>
              </div>

              <Link
                href="/admin/destinations/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={16} />
                Create Destination
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6">
            <SummaryCard
              icon={Globe2}
              label="Total"
              value={summary.total}
            />

            <SummaryCard
              icon={CheckCircle2}
              label="Published"
              value={summary.published}
            />

            <SummaryCard
              icon={FileText}
              label="Draft"
              value={summary.draft}
            />

            <SummaryCard
              icon={AlertCircle}
              label="Inactive"
              value={summary.inactive}
            />

            <SummaryCard
              icon={MapPinned}
              label="Location-wise"
              value={summary.locationWise}
            />

            <SummaryCard
              icon={SlidersHorizontal}
              label="Incomplete"
              value={summary.incomplete}
            />
          </div>
        </section>

        {/* ERROR */}
        {loadError && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} />
            {loadError}
          </div>
        )}

        {/* STICKY FILTER BAR */}
        <section className="sticky top-4 z-20 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(6,minmax(130px,1fr))_auto]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={filters.search}
                onChange={e =>
                  setFilters(prev => ({
                    ...prev,
                    search: e.target.value
                  }))
                }
                placeholder="Search name, code, ID, description..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <FilterSelect
              value={filters.status}
              onChange={value =>
                setFilters(prev => ({
                  ...prev,
                  status: value
                }))
              }
              options={[
                { value: "all", label: "All Status" },
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
                { value: "archived", label: "Archived" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" }
              ]}
            />

            <FilterSelect
              value={filters.destinationType}
              onChange={value =>
                setFilters(prev => ({
                  ...prev,
                  destinationType: value
                }))
              }
              options={[
                { value: "all", label: "All Types" },
                { value: "domestic", label: "Domestic" },
                { value: "international", label: "International" }
              ]}
            />

            <FilterSelect
              value={filters.activityStructure}
              onChange={value =>
                setFilters(prev => ({
                  ...prev,
                  activityStructure: value
                }))
              }
              options={[
                { value: "all", label: "All Structure" },
                { value: "destination_level", label: "Destination-level" },
                { value: "location_wise", label: "Location-wise" }
              ]}
            />

            <FilterSelect
              value={filters.bestTime}
              onChange={value =>
                setFilters(prev => ({
                  ...prev,
                  bestTime: value
                }))
              }
              options={[
                { value: "all", label: "Best Time" },
                ...bestTimeOptions.map(item => ({
                  value: item,
                  label: item
                }))
              ]}
            />

            <FilterSelect
              value={filters.duration}
              onChange={value =>
                setFilters(prev => ({
                  ...prev,
                  duration: value
                }))
              }
              options={[
                { value: "all", label: "Duration" },
                ...durationOptions.map(item => ({
                  value: item,
                  label: item
                }))
              ]}
            />

            <FilterSelect
              value={filters.readiness}
              onChange={value =>
                setFilters(prev => ({
                  ...prev,
                  readiness: value
                }))
              }
              options={[
                { value: "all", label: "Readiness" },
                { value: "ready", label: "Ready 80%+" },
                { value: "incomplete", label: "Incomplete" }
              ]}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView("card")}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                  view === "card"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:text-slate-900"
                }`}
                aria-label="Card view"
              >
                <Grid3X3 size={17} />
              </button>

              <button
                type="button"
                onClick={() => setView("table")}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                  view === "table"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:text-slate-900"
                }`}
                aria-label="Table view"
              >
                <List size={18} />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {filteredDestinations.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">
                {destinations.length}
              </span>{" "}
              destinations
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="text-left text-xs font-semibold text-blue-700 transition hover:text-blue-800"
            >
              Clear filters
            </button>
          </div>
        </section>

        {/* LOADING */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <DestinationSkeleton key={i} />
            ))}
          </div>
        )}

        {/* EMPTY */}
        {!loading && filteredDestinations.length === 0 && (
          <EmptyState
            title="No destinations found"
            description="Try adjusting filters or create a new destination."
          />
        )}

        {/* CARD VIEW */}
        {!loading && view === "card" && filteredDestinations.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredDestinations.map(destination => (
              <DestinationCard
                key={destination.id}
                destination={destination}
              />
            ))}
          </div>
        )}

        {/* TABLE VIEW */}
        {!loading && view === "table" && filteredDestinations.length > 0 && (
          <DestinationTable
            destinations={filteredDestinations}
            onRowClick={id =>
              router.push(`/admin/destinations/${id}`)
            }
          />
        )}
      </div>
    </main>
  );
}

/* =========================
   UI HELPERS
========================= */

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options = [] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}