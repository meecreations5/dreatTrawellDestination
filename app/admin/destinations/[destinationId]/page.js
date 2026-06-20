"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import {
  ArrowLeft,
  Eye,
  Save,
  Globe2,
  ImageIcon,
  MapPinned,
  CalendarDays,
  Users,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Youtube,
  MapPin,
  Layers3,
  GripVertical
} from "lucide-react";

import { db } from "@/lib/firebase";
import { generateDestinationId } from "@/lib/generateDestinationId";

import {
  DESTINATION_TYPES,
  LOCATION_TYPES
} from "@/lib/destinationConstants";

import {
  DESTINATION_FORM_DEFAULTS,
  normalizeDestinationForm,
  createEmptyLocation
} from "@/lib/destinationSchema";

import {
  createYouTubeMediaItem,
  normalizeMediaGallery,
  extractYouTubeId
} from "@/lib/destinationMediaUtils";

import MediaUploader from "@/components/destination/MediaUploader";
import ContentBlockEditor from "@/components/destination/ContentBlockEditor";
import SimpleListEditor from "@/components/destination/SimpleListEditor";
import TravelStyleChips from "@/components/destination/TravelStyleChips";
import AdvancedActivityEditor from "@/components/destination/AdvancedActivityEditor";

/* =========================
   HELPERS
========================= */

function createDraftMediaKey() {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return `draft-${Date.now()}`;
}

function normalizeCode(value = "") {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);
}

function makeCodeFromName(value = "") {
  return normalizeCode(value.trim().replace(/\s+/g, "-"));
}

function reorderItems(items = [], fromIndex, toIndex) {
  const copy = [...items];

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= copy.length ||
    toIndex >= copy.length
  ) {
    return copy;
  }

  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);

  return copy.map((item, index) => ({
    ...item,
    order: index + 1
  }));
}

export default function DestinationOverviewPage() {
  const { destinationId } = useParams();
  const router = useRouter();

  const isNew = destinationId === "new";

  const [draftMediaKey] = useState(() => createDraftMediaKey());

  const [form, setForm] = useState(DESTINATION_FORM_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const dirtyRef = useRef(false);

  const mediaBasePath = useMemo(() => {
    if (form.mediaFolder) return form.mediaFolder;

    if (isNew) {
      return `destinations/_drafts/${draftMediaKey}`;
    }

    return `destinations/${destinationId}`;
  }, [form.mediaFolder, isNew, draftMediaKey, destinationId]);

  /* =========================
     LOAD
  ========================= */
  useEffect(() => {
    if (!destinationId || isNew) {
      setForm(normalizeDestinationForm(DESTINATION_FORM_DEFAULTS));
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const snap = await getDoc(doc(db, "destinations", destinationId));

        if (!snap.exists()) {
          setLoadError("Destination not found.");
          return;
        }

        setForm(normalizeDestinationForm(snap.data()));
      } catch (error) {
        console.error(error);
        setLoadError("Unable to load destination. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [destinationId, isNew]);

  /* =========================
     UNSAVED WARNING
  ========================= */
  useEffect(() => {
    const handler = e => {
      if (!dirtyRef.current) return;

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, []);

  /* =========================
     UPDATE HELPERS
  ========================= */
  const clearErrors = keys => {
    setErrors(prev => {
      const copy = { ...prev };
      keys.forEach(key => delete copy[key]);
      return copy;
    });
  };

  const markDirty = () => {
    dirtyRef.current = true;
    setSaveError("");
  };

  const update = (key, value) => {
    markDirty();

    setForm(prev => ({
      ...prev,
      [key]: value
    }));

    clearErrors([key]);
  };

  const updateMany = patch => {
    markDirty();

    setForm(prev => ({
      ...prev,
      ...patch
    }));

    clearErrors(Object.keys(patch));
  };

  const handleNameChange = value => {
    markDirty();

    setForm(prev => {
      const next = {
        ...prev,
        name: value
      };

      if (!prev.code?.trim()) {
        next.code = makeCodeFromName(value);
      }

      return next;
    });

    clearErrors(["name", "code"]);
  };

  const handleCodeChange = value => {
    update("code", normalizeCode(value));
  };

  /* =========================
     LOCATIONS
  ========================= */
  const addLocation = () => {
    const next = createEmptyLocation();

    update("locations", [
      ...(form.locations || []),
      {
        ...next,
        order: (form.locations || []).length + 1
      }
    ]);
  };

  const updateLocation = (locationId, patch) => {
    update(
      "locations",
      (form.locations || []).map(location =>
        location.id === locationId
          ? {
              ...location,
              ...patch
            }
          : location
      )
    );
  };

  const deleteLocation = locationId => {
    const confirmed = window.confirm(
      "Delete this location and all its activities/content?"
    );

    if (!confirmed) return;

    update(
      "locations",
      (form.locations || [])
        .filter(location => location.id !== locationId)
        .map((location, index) => ({
          ...location,
          order: index + 1
        }))
    );
  };

  const moveLocation = (index, direction) => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    update("locations", reorderItems(form.locations || [], index, nextIndex));
  };

  const handleActivityStructureChange = hasSubLocations => {
    const patch = {
      hasSubLocations
    };

    if (hasSubLocations && !(form.locations || []).length) {
      patch.locations = [
        {
          ...createEmptyLocation(),
          order: 1
        }
      ];
    }

    updateMany(patch);
  };

  /* =========================
     COMPLETION
  ========================= */
  const completion = useMemo(() => {
    const galleryCount =
      (Array.isArray(form.gallery) ? form.gallery.length : 0) +
      (Array.isArray(form.mediaGallery) ? form.mediaGallery.length : 0);

    const totalActivities = form.hasSubLocations
      ? (form.locations || []).reduce(
          (sum, location) => sum + (location.activities?.length || 0),
          0
        )
      : form.activities?.length || 0;

    const checks = [
      {
        label: "Destination name",
        done: Boolean(form.name?.trim())
      },
      {
        label: "Destination code",
        done: Boolean(form.code?.trim())
      },
      {
        label: "Short description",
        done: Boolean(form.shortDescription?.trim())
      },
      {
        label: "Detailed description",
        done: Boolean(form.description?.trim())
      },
      {
        label: "Cover photo",
        done: Boolean(form.coverPhoto)
      },
      {
        label: "Gallery / YouTube media",
        done: galleryCount > 0
      },
      {
        label: form.hasSubLocations ? "Locations added" : "Activities added",
        done: form.hasSubLocations
          ? (form.locations || []).length > 0
          : totalActivities > 0
      },
      {
        label: "Best time to visit",
        done: Boolean(form.bestTimeToVisit?.trim())
      },
      {
        label: "Ideal trip duration",
        done: Boolean(form.idealTripDuration?.trim())
      }
    ];

    const completed = checks.filter(item => item.done).length;

    return {
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
      missing: checks.filter(item => !item.done).slice(0, 4),
      totalActivities,
      galleryCount
    };
  }, [form]);

  const quickStats = useMemo(() => {
    return [
      {
        label: "Locations",
        value: form.locations?.length || 0
      },
      {
        label: "Activities",
        value: completion.totalActivities || 0
      },
      {
        label: "Gallery",
        value: form.gallery?.length || 0
      },
      {
        label: "Videos",
        value:
          form.mediaGallery?.filter(
            item => item.type === "video" && item.source === "youtube"
          )?.length || 0
      }
    ];
  }, [form, completion.totalActivities]);

  /* =========================
     VALIDATION
  ========================= */
  const validate = () => {
    const e = {};

    if (!form.name?.trim()) {
      e.name = "Destination name is required";
    }

    if (!form.code?.trim()) {
      e.code = "Destination code is required";
    } else if (normalizeCode(form.code).length < 2) {
      e.code = "Destination code must be at least 2 characters";
    }

    if (form.hasSubLocations && !(form.locations || []).length) {
      e.locations = "Add at least one city / island / region.";
    }

    setErrors(e);

    if (Object.keys(e).length > 0) {
      const firstError = Object.keys(e)[0];
      const el = document.querySelector(`[data-field="${firstError}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return Object.keys(e).length === 0;
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (saving) return;
    if (!validate()) return;

    try {
      setSaving(true);
      setSaveError("");

      const payload = {
        ...form,

        name: form.name.trim(),
        code: normalizeCode(form.code),
        shortDescription: form.shortDescription?.trim() || "",
        description: form.description?.trim() || "",
        bestTimeToVisit: form.bestTimeToVisit?.trim() || "",
        idealTripDuration: form.idealTripDuration?.trim() || "",

        locationLabel: form.locationLabel || "Locations",

        locations: Array.isArray(form.locations)
          ? form.locations.map((location, index) => ({
              ...location,
              order: index + 1,
              name: location.name?.trim() || "",
              type: location.type || "city",

              activities: Array.isArray(location.activities)
                ? location.activities
                : [],

              attractions: Array.isArray(location.attractions)
                ? location.attractions
                : [],

              placesToVisit: Array.isArray(location.placesToVisit)
                ? location.placesToVisit
                : [],

              foodCulture: Array.isArray(location.foodCulture)
                ? location.foodCulture
                : [],

              mediaGallery: normalizeMediaGallery(location.mediaGallery || [])
            }))
          : [],

        mediaFolder: mediaBasePath,
        mediaGallery: normalizeMediaGallery(form.mediaGallery || []),

        updatedAt: serverTimestamp()
      };

      if (isNew) {
        const businessId = await generateDestinationId();

        const ref = await addDoc(collection(db, "destinations"), {
          ...payload,
          destinationId: businessId,
          createdAt: serverTimestamp()
        });

        dirtyRef.current = false;
        router.replace(`/admin/destinations/${ref.id}`);
        return;
      }

      await updateDoc(doc(db, "destinations", destinationId), payload);

      dirtyRef.current = false;

      setForm(prev => ({
        ...prev,
        ...payload
      }));
    } catch (error) {
      console.error(error);
      setSaveError("Unable to save destination. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-28 animate-pulse rounded-3xl bg-white " />
          <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
            <div className="h-96 animate-pulse rounded-3xl bg-white " />
            <div className="space-y-6">
              <div className="h-80 animate-pulse rounded-3xl bg-white " />
              <div className="h-80 animate-pulse rounded-3xl bg-white " />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-8 text-center ">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={22} />
          </div>

          <h1 className="text-xl font-semibold text-slate-900">
            {loadError}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Please go back and select a valid destination.
          </p>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6 pb-28">
        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white ">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600  transition hover:border-slate-300 hover:text-slate-900"
                  aria-label="Go back"
                >
                  <ArrowLeft size={18} />
                </button>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      Destination Management
                    </span>

                    <StatusPill status={form.status} active={form.active} />
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">
                    {isNew ? "Create Destination" : "Edit Destination"}
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Manage destination profile, media, locations, activities,
                    partners, and visibility.
                  </p>

                  {!isNew && (
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      Document ID: {destinationId}
                      {form.destinationId
                        ? ` | Business ID: ${form.destinationId}`
                        : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!isNew && (
                  <a
                    href={`/destinations/${destinationId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700  transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <Eye size={16} />
                    Preview
                  </a>
                )}

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white  transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Destination"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {quickStats.map(item => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-xs font-medium text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {saveError && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} />
            {saveError}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
          {/* LEFT SUMMARY */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 ">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Readiness
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    {completion.percent}%
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Sparkles size={22} />
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {completion.completed} of {completion.total} important fields
                completed.
              </p>

              {completion.missing.length > 0 && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                  <p className="mb-2 text-xs font-semibold text-amber-800">
                    Missing recommended fields
                  </p>

                  <div className="space-y-2">
                    {completion.missing.map(item => (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 text-xs text-amber-700"
                      >
                        <AlertCircle size={13} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 ">
              <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sections
              </p>

              <nav className="space-y-1">
                <SideLink href="#basic" label="Basic Information" />
                <SideLink href="#styles" label="Travel Styles" />
                <SideLink href="#media" label="Media Gallery" />
                <SideLink href="#structure" label="Activity Structure" />
                <SideLink href="#experiences" label="Experiences" />
                <SideLink href="#meta" label="Trip Meta" />
                <SideLink href="#partners" label="Channels & Partners" />
                <SideLink href="#visibility" label="Visibility" />
              </nav>
            </section>
          </aside>

          {/* FORM */}
          <div className="space-y-6">
            {/* BASIC */}
            <Surface
              id="basic"
              icon={Globe2}
              title="Basic Information"
              description="This information appears on destination listing, detail pages, and quotation content."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Destination Name"
                  required
                  value={form.name}
                  error={errors.name}
                  placeholder="Example: Bali"
                  dataField="name"
                  onChange={handleNameChange}
                />

                <Input
                  label="Destination Code"
                  required
                  value={form.code}
                  error={errors.code}
                  placeholder="Example: BALI"
                  dataField="code"
                  hint="Use short uppercase code. Example: DXB, BALI, THAILAND."
                  onChange={handleCodeChange}
                />
              </div>

              <Textarea
                label="Short Description"
                value={form.shortDescription}
                placeholder="A short hook for cards and listing pages."
                maxLength={180}
                onChange={v => update("shortDescription", v)}
              />

              <Textarea
                label="Detailed Description"
                value={form.description}
                placeholder="Describe the destination, experience, audience, and travel highlights."
                minHeight="min-h-[150px]"
                onChange={v => update("description", v)}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <SelectField
                  label="Destination Type"
                  value={form.destinationType}
                  onChange={v => update("destinationType", v)}
                  options={DESTINATION_TYPES}
                />

                <Input
                  label="Location Label"
                  value={form.locationLabel}
                  placeholder="Example: Cities, Islands, Regions"
                  hint="Used only when location-wise structure is enabled."
                  onChange={v => update("locationLabel", v)}
                />
              </div>
            </Surface>

            {/* TRAVEL STYLES */}
            <Surface
              id="styles"
              icon={Sparkles}
              title="Travel Styles"
              description="Select the travel themes that match this destination."
            >
              <TravelStyleChips
                value={form.travelStyles}
                onChange={styles => update("travelStyles", styles)}
              />
            </Surface>

            {/* MEDIA */}
            <Surface
              id="media"
              icon={ImageIcon}
              title="Media Gallery"
              description="Add cover photo, multiple photos, and YouTube videos for sales and public pages."
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <MediaUploader
                  label="Cover Photo"
                  value={form.coverPhoto}
                  path={`${mediaBasePath}/cover`}
                  onChange={file => update("coverPhoto", file)}
                />

                <MediaUploader
                  label="Photo Gallery"
                  multiple
                  value={form.gallery}
                  path={`${mediaBasePath}/gallery`}
                  onChange={files => update("gallery", files)}
                />
              </div>

              <YouTubeGalleryEditor
                value={form.mediaGallery || []}
                onChange={items => update("mediaGallery", items)}
              />
            </Surface>

            {/* ACTIVITY STRUCTURE */}
            <Surface
              id="structure"
              icon={Layers3}
              title="Activity Structure"
              description="Choose whether activities are managed directly under destination or under city / island / region."
            >
              <ActivityStructureSelector
                hasSubLocations={form.hasSubLocations}
                onChange={handleActivityStructureChange}
              />

              {errors.locations && (
                <p
                  data-field="locations"
                  className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
                >
                  <AlertCircle size={15} />
                  {errors.locations}
                </p>
              )}
            </Surface>

            {/* EXPERIENCES */}
            <Surface
              id="experiences"
              icon={MapPinned}
              title={
                form.hasSubLocations
                  ? `${form.locationLabel || "Locations"} & Experiences`
                  : "Destination Experiences"
              }
              description={
                form.hasSubLocations
                  ? "Manage city, island, or region-wise content."
                  : "Manage destination-level activities, attractions, places, and food culture."
              }
            >
              {form.hasSubLocations ? (
                <LocationManager
                  locations={form.locations || []}
                  locationLabel={form.locationLabel || "Locations"}
                  mediaBasePath={mediaBasePath}
                  onAdd={addLocation}
                  onUpdate={updateLocation}
                  onDelete={deleteLocation}
                  onMove={moveLocation}
                />
              ) : (
                <div className="space-y-8">
                  <AdvancedActivityEditor
                    title="Activities"
                    items={form.activities}
                    basePath={`${mediaBasePath}/activities`}
                    onChange={v => update("activities", v)}
                  />

                  <ContentBlockEditor
                    title="Attractions"
                    items={form.attractions}
                    basePath={`${mediaBasePath}/attractions`}
                    onChange={v => update("attractions", v)}
                  />

                  <ContentBlockEditor
                    title="Places To Visit"
                    items={form.placesToVisit}
                    basePath={`${mediaBasePath}/places`}
                    onChange={v => update("placesToVisit", v)}
                  />

                  <ContentBlockEditor
                    title="Food Culture"
                    items={form.foodCulture}
                    basePath={`${mediaBasePath}/food`}
                    onChange={v => update("foodCulture", v)}
                  />
                </div>
              )}
            </Surface>

            {/* META */}
            <Surface
              id="meta"
              icon={CalendarDays}
              title="Trip Meta"
              description="Useful trip planning details for sales team and travel agents."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Best Time To Visit"
                  value={form.bestTimeToVisit}
                  placeholder="Example: October to March"
                  onChange={v => update("bestTimeToVisit", v)}
                />

                <Input
                  label="Ideal Trip Duration"
                  value={form.idealTripDuration}
                  placeholder="Example: 5 Nights / 6 Days"
                  onChange={v => update("idealTripDuration", v)}
                />
              </div>
            </Surface>

            {/* PARTNERS */}
            <Surface
              id="partners"
              icon={Users}
              title="Channels & Partners"
              description="Maintain useful channel, sales partner, and booking partner details."
            >
              <div className="space-y-8">
                <SimpleListEditor
                  title="Channels"
                  items={form.channels}
                  onChange={v => update("channels", v)}
                  fields={[
                    { key: "label", label: "Label" },
                    { key: "type", label: "Type" },
                    { key: "url", label: "URL" }
                  ]}
                />

                <SimpleListEditor
                  title="Sales Partners"
                  items={form.salesPartners}
                  onChange={v => update("salesPartners", v)}
                  fields={[
                    { key: "name", label: "Name" },
                    { key: "email", label: "Email" },
                    { key: "phone", label: "Phone" }
                  ]}
                />

                <SimpleListEditor
                  title="Booking Partners"
                  items={form.bookingPartners}
                  onChange={v => update("bookingPartners", v)}
                  fields={[
                    { key: "name", label: "Platform" },
                    { key: "website", label: "Website" }
                  ]}
                />
              </div>
            </Surface>

            {/* VISIBILITY */}
            <Surface
              id="visibility"
              icon={ShieldCheck}
              title="Visibility"
              description="Control whether this destination is visible and active."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <SelectField
                  label="Publishing Status"
                  value={form.status}
                  onChange={v => update("status", v)}
                  options={[
                    {
                      value: "draft",
                      label: "Draft"
                    },
                    {
                      value: "published",
                      label: "Published"
                    },
                    {
                      value: "archived",
                      label: "Archived"
                    }
                  ]}
                />

                <ToggleCard
                  checked={form.active}
                  title="Active Destination"
                  description="Inactive destinations can be hidden from public and sales-facing pages."
                  onChange={checked => update("active", checked)}
                />
              </div>
            </Surface>
          </div>
        </div>
      </div>

      {/* STICKY SAVE BAR */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 sm:flex">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                {isNew ? "Create destination record" : "Save destination changes"}
              </p>
              <p className="text-xs text-slate-500">
                Readiness: {completion.percent}% | Structure:{" "}
                {form.hasSubLocations ? "Location-wise" : "Destination-level"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white  transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Destination"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/* =========================
   ACTIVITY STRUCTURE
========================= */

function ActivityStructureSelector({ hasSubLocations, onChange }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`
          rounded-2xl border p-4 text-left transition
          ${
            !hasSubLocations
              ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
              : "border-slate-200 bg-white hover:border-slate-300"
          }
        `}
      >
        <div className="flex items-start gap-3">
          <div
            className={`
              flex h-10 w-10 items-center justify-center rounded-2xl
              ${!hasSubLocations ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}
            `}
          >
            <Globe2 size={19} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              Destination-level activities
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Best for Maldives, Dubai, Singapore, or single-city destinations.
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange(true)}
        className={`
          rounded-2xl border p-4 text-left transition
          ${
            hasSubLocations
              ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
              : "border-slate-200 bg-white hover:border-slate-300"
          }
        `}
      >
        <div className="flex items-start gap-3">
          <div
            className={`
              flex h-10 w-10 items-center justify-center rounded-2xl
              ${hasSubLocations ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}
            `}
          >
            <MapPin size={19} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              City / island / region-wise
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Best for Thailand, Europe, Vietnam, Japan, or multi-location trips.
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

/* =========================
   LOCATION MANAGER
========================= */

function LocationManager({
  locations,
  locationLabel,
  mediaBasePath,
  onAdd,
  onUpdate,
  onDelete,
  onMove
}) {
  if (!locations.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 ">
          <MapPin size={22} />
        </div>

        <h3 className="text-base font-semibold text-slate-950">
          No {locationLabel?.toLowerCase() || "locations"} added
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Add city, island, region, or resort area to manage experiences
          separately.
        </p>

        <button
          type="button"
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white  transition hover:bg-blue-700"
        >
          <Plus size={16} />
          Add {locationLabel || "Location"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            {locationLabel || "Locations"}
          </h3>
          <p className="text-xs text-slate-500">
            Add city, island, region, or resort-wise content.
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white  transition hover:bg-blue-700"
        >
          <Plus size={16} />
          Add {locationLabel || "Location"}
        </button>
      </div>

      <div className="space-y-5">
        {locations.map((location, index) => (
          <LocationCard
            key={location.id}
            location={location}
            index={index}
            total={locations.length}
            mediaBasePath={mediaBasePath}
            onUpdate={patch => onUpdate(location.id, patch)}
            onDelete={() => onDelete(location.id)}
            onMove={direction => onMove(index, direction)}
          />
        ))}
      </div>
    </div>
  );
}

function LocationCard({
  location,
  index,
  total,
  mediaBasePath,
  onUpdate,
  onDelete,
  onMove
}) {
  const [open, setOpen] = useState(index === 0);

  const locationPath = `${mediaBasePath}/locations/${location.id}`;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white ">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 ">
            <GripVertical size={17} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-950">
                {location.name?.trim() || `Location ${index + 1}`}
              </h3>

              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-blue-700">
                {String(location.type || "city").replace(/_/g, " ")}
              </span>

              {!location.active && (
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Inactive
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {location.recommendedNights
                ? `${location.recommendedNights} night(s)`
                : "Recommended nights not set"}{" "}
              | {location.activities?.length || 0} activities |{" "}
              {location.attractions?.length || 0} attractions
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove("up")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Up
          </button>

          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove("down")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Down
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-white text-red-600 transition hover:bg-red-50"
            aria-label="Delete location"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-6 p-4 lg:p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <Input
              label="Location Name"
              value={location.name}
              placeholder="Example: Bangkok"
              onChange={v => onUpdate({ name: v })}
            />

            <SelectField
              label="Location Type"
              value={location.type || "city"}
              onChange={v => onUpdate({ type: v })}
              options={LOCATION_TYPES}
            />

            <Input
              label="Recommended Nights"
              value={location.recommendedNights}
              placeholder="Example: 2"
              onChange={v => onUpdate({ recommendedNights: v })}
            />
          </div>

          <Textarea
            label="Short Description"
            value={location.shortDescription}
            placeholder="Short city / island / region description."
            onChange={v => onUpdate({ shortDescription: v })}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <MediaUploader
              label="Location Cover Photo"
              value={location.coverPhoto}
              path={`${locationPath}/cover`}
              onChange={file => onUpdate({ coverPhoto: file })}
            />

            <MediaUploader
              label="Location Gallery"
              multiple
              value={location.gallery || []}
              path={`${locationPath}/gallery`}
              onChange={files => onUpdate({ gallery: files })}
            />
          </div>

          <AdvancedActivityEditor
            title="Activities"
            items={location.activities || []}
            basePath={`${locationPath}/activities`}
            onChange={v => onUpdate({ activities: v })}
          />

          <ContentBlockEditor
            title="Attractions"
            items={location.attractions || []}
            basePath={`${locationPath}/attractions`}
            onChange={v => onUpdate({ attractions: v })}
          />

          <ContentBlockEditor
            title="Places To Visit"
            items={location.placesToVisit || []}
            basePath={`${locationPath}/places`}
            onChange={v => onUpdate({ placesToVisit: v })}
          />

          <ContentBlockEditor
            title="Food Culture"
            items={location.foodCulture || []}
            basePath={`${locationPath}/food`}
            onChange={v => onUpdate({ foodCulture: v })}
          />

          <Textarea
            label="Transfer Notes"
            value={location.transferNotes}
            placeholder="Example: Airport to hotel takes approx 45-60 minutes."
            onChange={v => onUpdate({ transferNotes: v })}
          />

          <Textarea
            label="Internal Notes"
            value={location.internalNotes}
            placeholder="Internal sales or operations notes."
            onChange={v => onUpdate({ internalNotes: v })}
          />

          <ToggleCard
            checked={location.active ?? true}
            title="Active Location"
            description="Inactive locations can be hidden from package and quotation selection."
            onChange={checked => onUpdate({ active: checked })}
          />
        </div>
      )}
    </div>
  );
}

/* =========================
   YOUTUBE GALLERY
========================= */

function YouTubeGalleryEditor({ value = [], onChange }) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");

  const youtubeItems = useMemo(() => {
    return normalizeMediaGallery(value).filter(
      item => item.type === "video" && item.source === "youtube"
    );
  }, [value]);

  const addYouTube = () => {
    const id = extractYouTubeId(youtubeUrl);

    if (!id) {
      alert("Please enter a valid YouTube URL.");
      return;
    }

    const newItem = createYouTubeMediaItem(youtubeUrl, {
      title,
      order: value.length + 1
    });

    onChange(normalizeMediaGallery([...(value || []), newItem]));

    setYoutubeUrl("");
    setTitle("");
  };

  const removeItem = id => {
    onChange(normalizeMediaGallery(value.filter(item => item.id !== id)));
  };

  const updateItem = (id, patch) => {
    onChange(
      normalizeMediaGallery(
        value.map(item =>
          item.id === id
            ? {
                ...item,
                ...patch,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      )
    );
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <Youtube size={20} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            YouTube Video Gallery
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Add destination videos without uploading heavy video files.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <input
          value={youtubeUrl}
          onChange={e => setYoutubeUrl(e.target.value)}
          placeholder="YouTube URL"
          className="mui-input bg-white"
        />

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Video title"
          className="mui-input bg-white"
        />

        <button
          type="button"
          onClick={addYouTube}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white  transition hover:bg-red-700"
        >
          <Plus size={16} />
          Add Video
        </button>
      </div>

      {youtubeItems.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {youtubeItems.map(item => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white "
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title || "YouTube video"}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-400">
                  <Youtube size={32} />
                </div>
              )}

              <div className="space-y-3 p-4">
                <Input
                  label="Video Title"
                  value={item.title}
                  onChange={v => updateItem(item.id, { title: v })}
                />

                <Textarea
                  label="Caption"
                  value={item.caption}
                  onChange={v => updateItem(item.id, { caption: v })}
                />

                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={item.featured}
                      onChange={e =>
                        updateItem(item.id, {
                          featured: e.target.checked
                        })
                      }
                    />
                    Featured
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={e =>
                        updateItem(item.id, {
                          active: e.target.checked
                        })
                      }
                    />
                    Active
                  </label>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */

function Surface({ id, icon: Icon, title, description, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-8 rounded-3xl border border-slate-200 bg-white p-5  lg:p-6"
    >
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon size={20} />
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  placeholder,
  hint,
  required,
  dataField
}) {
  return (
    <div className="space-y-1.5" data-field={dataField}>
      <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`
          mui-input bg-white
          ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : ""
          }
        `}
      />

      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}

      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertCircle size={13} />
          {error}
        </p>
      )}
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  minHeight = "min-h-[100px]"
}) {
  const count = value?.length || 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-slate-700">
          {label}
        </label>

        {maxLength && (
          <span className="text-[11px] text-slate-400">
            {count}/{maxLength}
          </span>
        )}
      </div>

      <textarea
        value={value ?? ""}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        className={`mui-input ${minHeight} resize-y bg-white leading-relaxed`}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options = [] }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">
        {label}
      </label>

      <select
        className="mui-input bg-white"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleCard({ checked, title, description, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}

function SideLink({ href, label }) {
  return (
    <a
      href={href}
      className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
    >
      {label}
    </a>
  );
}

function StatusPill({ status, active }) {
  const statusClass =
    status === "published"
      ? "bg-emerald-100 text-emerald-700"
      : status === "archived"
        ? "bg-slate-200 text-slate-700"
        : "bg-amber-100 text-amber-700";

  const activeClass = active
    ? "bg-blue-100 text-blue-700"
    : "bg-slate-100 text-slate-600";

  return (
    <>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}
      >
        {status || "draft"}
      </span>

      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${activeClass}`}
      >
        {active ? "Active" : "Inactive"}
      </span>
    </>
  );
}