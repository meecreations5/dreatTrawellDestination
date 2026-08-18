// admin/destinations/[destinatioId]/activities/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const TABS = ["attraction", "experience", "event"];

export default function ActivitiesPage() {
  const { destinationId } = useParams();
  const [tab, setTab] = useState("attraction");
  const [items, setItems] = useState([]);

  const load = async () => {
    const q = query(
      collection(db, "destinationActivities"),
      where("destinationId", "==", destinationId),
      where("category", "==", tab)
    );
    const snap = await getDocs(q);
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, [tab]);

  const toggleActive = async (id, active) => {
    await updateDoc(doc(db, "destinationActivities", id), {
      active: !active
    });
    load();
  };

  return (
    <main className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-red-600">
        Activities — {destinationId}
      </h1>

      {/* TABS */}
      <div className="flex gap-2 mt-4">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded capitalize ${
              tab === t ? "bg-blue-600 text-white" : "border"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Link
        href={`/admin/destinations/${destinationId}/activities/new?category=${tab}`}
        className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        + Add {tab}
      </Link>

      {/* LIST */}
      <div className="mt-6 space-y-3">
        {items.map(i => (
          <div
            key={i.id}
            className="bg-white p-4 rounded shadow flex justify-between"
          >
            <div>
              <p className="font-semibold">{i.name}</p>
              <p className="text-xs text-gray-500">
                {i.duration} • {i.priceRange} • {i.bestTime}
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <Link
                href={`/admin/destinations/${destinationId}/activities/${i.id}`}
                className="text-blue-600 text-sm"
              >
                Edit
              </Link>

              <button
                onClick={() => toggleActive(i.id, i.active)}
                className="text-sm text-red-600"
              >
                {i.active ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
