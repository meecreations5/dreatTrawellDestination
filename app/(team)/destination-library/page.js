"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Map,
  MapPin,
  Search,
  Sparkles,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";

function clean(value = "") {
  return String(value || "").trim();
}

function searchable(destination = {}) {
  return [
    destination.name,
    destination.code,
    destination.destinationId,
    destination.shortDescription,
    destination.description,
    destination.bestTimeToVisit,
    destination.idealTripDuration,
    ...(Array.isArray(destination.travelStyles) ? destination.travelStyles : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getActivityCount(destination = {}) {
  const own = Array.isArray(destination.activities) ? destination.activities.length : 0;
  const locations = Array.isArray(destination.locations) ? destination.locations : [];
  return own + locations.reduce((sum, location) => {
    return sum + (Array.isArray(location?.activities) ? location.activities.length : 0);
  }, 0);
}

function getCover(destination = {}) {
  const cover = destination.coverPhoto;
  if (typeof cover === "string") return cover;
  if (cover?.url) return cover.url;
  if (cover?.downloadURL) return cover.downloadURL;

  const media = [
    ...(Array.isArray(destination.gallery) ? destination.gallery : []),
    ...(Array.isArray(destination.mediaGallery) ? destination.mediaGallery : [])
  ];

  const first = media.find(item => {
    if (typeof item === "string") return Boolean(item);
    return item?.type !== "video" && (item?.url || item?.downloadURL || item?.src);
  });

  if (typeof first === "string") return first;
  return first?.url || first?.downloadURL || first?.src || "";
}

export default function DestinationLibraryPage() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");

    const unsubscribe = onSnapshot(
      collection(db, "destinations"),
      snapshot => {
        const rows = snapshot.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .filter(item => item.active !== false)
          .sort((a, b) => clean(a.name).localeCompare(clean(b.name)));

        setDestinations(rows);
        setLoading(false);
      },
      loadError => {
        console.error("Destination library load error:", loadError);
        setError("Unable to load destinations.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return destinations;
    return destinations.filter(destination => searchable(destination).includes(term));
  }, [destinations, search]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  <Map size={14} />
                  User Front Destination Library
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">
                  Destinations
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Quick destination reference for Travel Agent conversations, requirement discovery, Lead planning and quotation work.
                </p>
              </div>

              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search destination, code, season, duration..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-3">
            <MiniStat label="Available Destinations" value={destinations.length} icon={Globe2} />
            <MiniStat label="With Activities" value={destinations.filter(item => getActivityCount(item) > 0).length} icon={Sparkles} />
            <MiniStat label="Published" value={destinations.filter(item => item.status === "published").length} icon={CheckCircle2} />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(item => (
              <div key={item} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No destinations match your search.
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(destination => {
              const cover = getCover(destination);
              const activityCount = getActivityCount(destination);

              return (
                <button
                  type="button"
                  key={destination.id}
                  onClick={() => setSelected(destination)}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="h-40 bg-slate-100">
                    {cover ? (
                      <img src={cover} alt={destination.name || "Destination"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <MapPin size={34} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-slate-950">{destination.name || "Unnamed Destination"}</h2>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                          {destination.code || destination.destinationId || "Destination"}
                        </p>
                      </div>
                      {destination.status ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-700">
                          {destination.status}
                        </span>
                      ) : null}
                    </div>

                    <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                      {destination.shortDescription || destination.description || "Destination information available in the master."}
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <InfoPill label="Best Time" value={destination.bestTimeToVisit || "—"} />
                      <InfoPill label="Duration" value={destination.idealTripDuration || "—"} />
                      <InfoPill label="Activities" value={activityCount} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {selected ? <DestinationDrawer destination={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-semibold text-slate-950">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function DestinationDrawer({ destination, onClose }) {
  const activityCount = getActivityCount(destination);
  const locations = Array.isArray(destination.locations) ? destination.locations : [];
  const travelStyles = Array.isArray(destination.travelStyles) ? destination.travelStyles.filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-slate-950/35" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Destination Details</p>
            <h2 className="truncate text-xl font-semibold text-slate-950">{destination.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <DrawerStat icon={CalendarDays} label="Best Time" value={destination.bestTimeToVisit || "—"} />
            <DrawerStat icon={Clock3} label="Ideal Duration" value={destination.idealTripDuration || "—"} />
            <DrawerStat icon={Sparkles} label="Activities" value={activityCount} />
          </div>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Overview</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
              {destination.description || destination.shortDescription || "No destination overview has been added yet."}
            </p>
          </section>

          {travelStyles.length ? (
            <section className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Travel Styles</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {travelStyles.map(style => (
                  <span key={String(style)} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{String(style)}</span>
                ))}
              </div>
            </section>
          ) : null}

          {locations.length ? (
            <section className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Locations</h3>
              <div className="mt-3 space-y-2">
                {locations.slice(0, 12).map((location, index) => (
                  <div key={location.id || location.name || index} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-sm font-medium text-slate-700">{location.name || `Location ${index + 1}`}</span>
                    <span className="text-xs text-slate-400">{Array.isArray(location.activities) ? location.activities.length : 0} activities</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <Link
            href={`/destinations/${destination.id}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <ExternalLink size={16} />
            Open Full Destination Preview
          </Link>
        </div>
      </aside>
    </div>
  );
}

function DrawerStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <Icon size={16} className="text-blue-600" />
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
