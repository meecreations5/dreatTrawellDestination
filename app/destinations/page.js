// destinations/page.js 

import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default async function DestinationsListingPage() {
  const q = query(
    collection(db, "destinations"),
    where("status", "==", "published"),
    where("active", "==", true)
  );

  const snap = await getDocs(q);
  const destinations = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">
          Explore Destinations
        </h1>
        <p className="text-gray-600">
          Hand-picked experiences curated by experts
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {destinations.map(d => (
          <Link
            key={d.id}
            href={`/destinations/${d.id}`}
            className="rounded overflow-hidden shadow hover:shadow-lg transition"
          >
            {d.coverPhoto?.url && (
              <img
                src={d.coverPhoto.url}
                className="h-48 w-full object-cover"
              />
            )}

            <div className="p-4 space-y-2">
              <h2 className="font-semibold text-lg">
                {d.name}
              </h2>

              <p className="text-sm text-gray-600 line-clamp-2">
                {d.shortDescription || d.description}
              </p>

              <div className="flex gap-2 text-xs text-gray-500">
                {d.bestTimeToVisit && (
                  <span>{d.bestTimeToVisit}</span>
                )}
                {d.idealTripDuration && (
                  <span>• {d.idealTripDuration}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {destinations.length === 0 && (
        <p className="text-center text-gray-500">
          No destinations available yet.
        </p>
      )}
    </main>
  );
}
