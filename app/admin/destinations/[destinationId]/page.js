"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
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

  status: "draft",
  active: true
};

export default function DestinationOverviewPage() {
  const { destinationId } = useParams();
  const router = useRouter();
  const isNew = destinationId === "new";

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const dirtyRef = useRef(false);

  /* =========================
     LOAD
  ========================= */
  useEffect(() => {
    if (!destinationId || isNew) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const snap = await getDoc(
        doc(db, "destinations", destinationId)
      );

      if (snap.exists()) {
        setForm({ ...EMPTY_FORM, ...snap.data() });
      }
      setLoading(false);
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
    return () =>
      window.removeEventListener("beforeunload", handler);
  }, []);

  /* =========================
     UPDATE FIELD
  ========================= */
  const update = (key, value) => {
    dirtyRef.current = true;

    setForm(prev => ({
      ...prev,
      [key]: value
    }));

    // ✅ clear inline error for this field
    setErrors(prev => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  /* =========================
     VALIDATION
  ========================= */
  const validate = () => {
    const e = {};
    if (!form.name.trim())
      e.name = "Destination name is required";
    if (!form.code.trim())
      e.code = "Destination code is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (!validate()) return;

    const payload = {
      ...form,
      code: form.code.toUpperCase(),
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
    } else {
      await updateDoc(
        doc(db, "destinations", destinationId),
        payload
      );
      dirtyRef.current = false;
      alert("Destination saved");
    }
  };

  if (loading) return <p className="p-6">Loading…</p>;

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">
              {isNew ? "Create Destination" : "Edit Destination"}
            </h1>
            {!isNew && (
              <p className="text-xs text-gray-500">
                ID: {form.destinationId}
              </p>
            )}
          </div>

          {!isNew && (
            <a
              href={`/destinations/${destinationId}`}
              target="_blank"
              className="text-sm text-blue-600 hover:underline"
            >
              Preview ↗
            </a>
          )}
        </div>

        {/* BASIC */}
        <Surface title="Basic Information">
          <Input
            label="Destination Name"
            value={form.name}
            error={errors.name}
            onChange={v => update("name", v)}
          />

          <Input
            label="Destination Code"
            value={form.code}
            error={errors.code}
            onChange={v => update("code", v.toUpperCase())}
          />

          <Textarea
            label="Short Description"
            value={form.shortDescription}
            onChange={v => update("shortDescription", v)}
          />

          <Textarea
            label="Detailed Description"
            value={form.description}
            onChange={v => update("description", v)}
          />
        </Surface>

        {/* TRAVEL STYLES */}
        <Surface title="Travel Styles">
          <p className="text-xs text-gray-500">
            Select applicable travel styles for this destination
          </p>

          <TravelStyleChips
            value={form.travelStyles}
            onChange={styles =>
              setForm({ ...form, travelStyles: styles })
            }
          />
        </Surface>

        {/* MEDIA */}
        <Surface title="Media">
          <MediaUploader
            label="Cover Photo"
            value={form.coverPhoto}
            path={`destinations/${destinationId || "new"}/cover`}
            onChange={file => update("coverPhoto", file)}
          />

          <MediaUploader
            label="Gallery"
            multiple
            value={form.gallery}
            path={`destinations/${destinationId || "new"}/gallery`}
            onChange={files => update("gallery", files)}
          />
        </Surface>

        {/* EXPERIENCES */}
        <Surface title="Experiences">
          <ContentBlockEditor
            title="Activities"
            items={form.activities}
            basePath={`destinations/${destinationId || "new"}/activities`}
            onChange={v => update("activities", v)}
          />

          <ContentBlockEditor
            title="Attractions"
            items={form.attractions}
            basePath={`destinations/${destinationId || "new"}/attractions`}
            onChange={v => update("attractions", v)}
          />

          <ContentBlockEditor
            title="Places To Visit"
            items={form.placesToVisit}
            basePath={`destinations/${destinationId || "new"}/places`}
            onChange={v => update("placesToVisit", v)}
          />

          <ContentBlockEditor
            title="Food Culture"
            items={form.foodCulture}
            basePath={`destinations/${destinationId || "new"}/food`}
            onChange={v => update("foodCulture", v)}
          />
        </Surface>

        {/* META */}
        <Surface title="Trip Meta">
          <Input
            label="Best Time To Visit"
            value={form.bestTimeToVisit}
            onChange={v => update("bestTimeToVisit", v)}
          />

          <Input
            label="Ideal Trip Duration"
            value={form.idealTripDuration}
            onChange={v => update("idealTripDuration", v)}
          />

          <select
            className="mui-input"
            value={form.destinationType}
            onChange={e =>
              update("destinationType", e.target.value)
            }
          >
            <option value="international">International</option>
            <option value="domestic">Domestic</option>
          </select>
        </Surface>

        {/* PARTNERS */}
        <Surface title="Channels & Partners">
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
        </Surface>

        {/* STATUS */}
        <Surface title="Visibility">
          <select
            className="mui-input"
            value={form.status}
            onChange={e => update("status", e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>

          <label className="flex gap-2 items-center text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => update("active", e.target.checked)}
            />
            Active Destination
          </label>
        </Surface>

        {/* SAVE */}
        <div className="flex justify-end">
          <button
            onClick={save}
            className="
              bg-blue-600 text-white
              px-6 py-2.5 rounded-md
              shadow-mui
              transition-mui
              hover:bg-blue-700
            "
          >
            Save Destination
          </button>
        </div>
      </div>
    </main>
  );
}

/* ================= HELPERS ================= */

function Surface({ title, children }) {
  return (
    <section className="bg-white rounded-xl shadow-mui p-6 space-y-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">
        {label}
      </label>
      <input
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className={`mui-input ${error
          ? "border-red-500 focus:border-red-500 focus:ring-red-200"
          : ""
          }`}
      />
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">
        {label}
      </label>
      <textarea
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="mui-input min-h-[90px]"
      />
    </div>
  );
}
