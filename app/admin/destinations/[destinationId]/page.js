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
  CheckCircle2
} from "lucide-react";

import { db } from "@/lib/firebase";
import { generateDestinationId } from "@/lib/generateDestinationId";

import MediaUploader from "@/components/destination/MediaUploader";
import ContentBlockEditor from "@/components/destination/ContentBlockEditor";
import SimpleListEditor from "@/components/destination/SimpleListEditor";
import TravelStyleChips from "@/components/destination/TravelStyleChips";

/* =========================
   EMPTY FORM
========================= */
const EMPTY_FORM = {
  destinationId: "",
  name: "",
  code: "",
  shortDescription: "",
  description: "",

  bestTimeToVisit: "",
  idealTripDuration: "",
  destinationType: "international",

  travelStyles: {
    family: false,
    couple: false,
    luxury: false,
    adventure: false
  },

  coverPhoto: null,
  gallery: [],

  activities: [],
  attractions: [],
  placesToVisit: [],
  foodCulture: [],

  channels: [],
  salesPartners: [],
  bookingPartners: [],

  mediaFolder: "",

  status: "draft",
  active: true
};

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

function normalizeDestinationData(data = {}) {
  return {
    ...EMPTY_FORM,
    ...data,
    travelStyles: {
      ...EMPTY_FORM.travelStyles,
      ...(data.travelStyles || {})
    },
    gallery: Array.isArray(data.gallery) ? data.gallery : [],
    activities: Array.isArray(data.activities) ? data.activities : [],
    attractions: Array.isArray(data.attractions) ? data.attractions : [],
    placesToVisit: Array.isArray(data.placesToVisit)
      ? data.placesToVisit
      : [],
    foodCulture: Array.isArray(data.foodCulture) ? data.foodCulture : [],
    channels: Array.isArray(data.channels) ? data.channels : [],
    salesPartners: Array.isArray(data.salesPartners)
      ? data.salesPartners
      : [],
    bookingPartners: Array.isArray(data.bookingPartners)
      ? data.bookingPartners
      : []
  };
}

export default function DestinationOverviewPage() {
  const { destinationId } = useParams();
  const router = useRouter();

  const isNew = destinationId === "new";

  const [draftMediaKey] = useState(() => createDraftMediaKey());

  const [form, setForm] = useState(EMPTY_FORM);
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

        setForm(normalizeDestinationData(snap.data()));
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
     HELPERS
  ========================= */
  const clearErrors = keys => {
    setErrors(prev => {
      const copy = { ...prev };
      keys.forEach(key => delete copy[key]);
      return copy;
    });
  };

  const update = (key, value) => {
    dirtyRef.current = true;
    setSaveError("");

    setForm(prev => ({
      ...prev,
      [key]: value
    }));

    clearErrors([key]);
  };

  const handleNameChange = value => {
    dirtyRef.current = true;
    setSaveError("");

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
     COMPLETION
  ========================= */
  const completion = useMemo(() => {
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
        label: "Gallery",
        done: Array.isArray(form.gallery) && form.gallery.length > 0
      },
      {
        label: "Activities",
        done: Array.isArray(form.activities) && form.activities.length > 0
      },
      {
        label: "Attractions",
        done: Array.isArray(form.attractions) && form.attractions.length > 0
      },
      {
        label: "Places to visit",
        done:
          Array.isArray(form.placesToVisit) &&
          form.placesToVisit.length > 0
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
      missing: checks.filter(item => !item.done).slice(0, 4)
    };
  }, [form]);

  const quickStats = useMemo(() => {
    return [
      {
        label: "Gallery",
        value: form.gallery?.length || 0
      },
      {
        label: "Activities",
        value: form.activities?.length || 0
      },
      {
        label: "Attractions",
        value: form.attractions?.length || 0
      },
      {
        label: "Places",
        value: form.placesToVisit?.length || 0
      }
    ];
  }, [form]);

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

        mediaFolder: mediaBasePath,

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
          <div className="h-28 animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="h-96 animate-pulse rounded-3xl bg-white shadow-sm" />
            <div className="space-y-6">
              <div className="h-80 animate-pulse rounded-3xl bg-white shadow-sm" />
              <div className="h-80 animate-pulse rounded-3xl bg-white shadow-sm" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6 pb-28">
        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
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
                    Add destination content, travel highlights, media,
                    partner channels, and publishing settings from one place.
                  </p>

                  {!isNew && (
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      Document ID: {destinationId}
                      {form.destinationId ? ` | Business ID: ${form.destinationId}` : ""}
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
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <Eye size={16} />
                    Preview
                  </a>
                )}

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
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
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Completion
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

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Page Sections
              </p>

              <nav className="space-y-1">
                <SideLink href="#basic" label="Basic Information" />
                <SideLink href="#styles" label="Travel Styles" />
                <SideLink href="#media" label="Media" />
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
              title="Media"
              description="Upload a strong cover image and supporting gallery photos."
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <MediaUploader
                  label="Cover Photo"
                  value={form.coverPhoto}
                  path={`${mediaBasePath}/cover`}
                  onChange={file => update("coverPhoto", file)}
                />

                <MediaUploader
                  label="Gallery"
                  multiple
                  value={form.gallery}
                  path={`${mediaBasePath}/gallery`}
                  onChange={files => update("gallery", files)}
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                Tip: Use one clean hero image for cover and 4-8 images for
                gallery to make the destination page look premium.
              </div>
            </Surface>

            {/* EXPERIENCES */}
            <Surface
              id="experiences"
              icon={MapPinned}
              title="Experiences"
              description="Add rich content blocks for activities, attractions, places, and food culture."
            >
              <div className="space-y-8">
                <ContentBlockEditor
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
            </Surface>

            {/* META */}
            <Surface
              id="meta"
              icon={CalendarDays}
              title="Trip Meta"
              description="Useful trip planning details for sales team and travel agents."
            >
              <div className="grid gap-4 lg:grid-cols-3">
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

                <SelectField
                  label="Destination Type"
                  value={form.destinationType}
                  onChange={v => update("destinationType", v)}
                  options={[
                    {
                      value: "international",
                      label: "International"
                    },
                    {
                      value: "domestic",
                      label: "Domestic"
                    }
                  ]}
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
                Completion: {completion.percent}% | Status: {form.status}
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
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
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
   UI HELPERS
========================= */

function Surface({ id, icon: Icon, title, description, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6"
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
          mui-input
          bg-white
          ${error ? "border-red-500 focus:border-red-500 focus:ring-red-200" : ""}
        `}
      />

      {hint && !error && (
        <p className="text-xs text-slate-400">{hint}</p>
      )}

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
        <p className="text-sm font-semibold text-slate-900">
          {title}
        </p>
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
      : "bg-amber-100 text-amber-700";

  const activeClass = active
    ? "bg-blue-100 text-blue-700"
    : "bg-slate-100 text-slate-600";

  return (
    <>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
        {status === "published" ? "Published" : "Draft"}
      </span>

      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeClass}`}>
        {active ? "Active" : "Inactive"}
      </span>
    </>
  );
}