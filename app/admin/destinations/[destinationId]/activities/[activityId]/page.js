// admin/destinations/[destinatioId]/activities/[activityId]/page.js

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { canAccess } from "@/lib/rolePermissions";

const EMPTY = {
  name: "",
  area: "",
  shortDescription: "",
  suitableFor: {
    family: false,
    couple: false,
    kids: false,
    all: false
  },
  duration: "",
  bestTime: "",
  environment: "",
  priceRange: "",
  salesTags: {
    familyTrip: false,
    honeymoon: false,
    luxuryTravel: false,
    shortStay: false,
    firstTimeVisitor: false,
    mustDo: false
  },
  eventDetails: null,
  active: true
};

export default function ActivityEditor() {
  const { destinationId, activityId } = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const category =
    search.get("category") || "attraction";
  const isNew = activityId === "new";

  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (isNew) return;

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "destinationActivities", activityId));
        if (snap.exists()) setForm(snap.data());
        else setSaveError("Activity not found.");
      } catch (error) {
        setSaveError(`Unable to load activity: ${error?.message || "Unknown error"}`);
      }
    };
    load();
  }, [activityId, isNew]);

  const save = async () => {
    if (saving) return;
    if (!canAccess(user, isNew ? "destinations.create" : "destinations.edit")) {
      setSaveError("Your role does not have permission to save this activity.");
      return;
    }
    if (!form.name?.trim()) {
      setSaveError("Activity name is required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        category,
        destinationId,
        updatedAt: serverTimestamp()
      };
      if (isNew) {
        await addDoc(collection(db, "destinationActivities"), {
          ...payload,
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, "destinationActivities", activityId), payload);
      }
      router.push(`/admin/destinations/${destinationId}/activities`);
    } catch (error) {
      console.error("Unable to save destination activity", error);
      setSaveError(error?.code === "permission-denied"
        ? "Firestore rules denied this update. Ask an administrator to verify database permissions."
        : `Unable to save activity: ${error?.message || "Please try again."}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-red-600 capitalize">
        {isNew ? "Add" : "Edit"} {category}
      </h1>

      <input
        className="border p-2 w-full mt-4"
        placeholder="Name"
        value={form.name}
        onChange={e =>
          setForm({ ...form, name: e.target.value })
        }
      />

      <input
        className="border p-2 w-full mt-2"
        placeholder="Area / Location"
        value={form.area}
        onChange={e =>
          setForm({ ...form, area: e.target.value })
        }
      />

      <textarea
        className="border p-2 w-full mt-2"
        placeholder="Short description"
        rows={2}
        value={form.shortDescription}
        onChange={e =>
          setForm({
            ...form,
            shortDescription: e.target.value
          })
        }
      />

      {saveError ? <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{saveError}</p> : null}
      <button
        onClick={save}
        disabled={saving}
        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}
