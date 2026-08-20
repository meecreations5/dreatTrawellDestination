import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function DestinationCard({ destination }) {
  const { id, status, active } = destination;

  const handleDelete = async e => {
    e.preventDefault();
    e.stopPropagation();

    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete this destination?"
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "destinations", id));
      alert("Destination deleted successfully");
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete destination");
    }
  };

  return (
    <div className="relative bg-white rounded-lg border border-gray-200 hover:shadow-sm transition">
      
      {/* STATUS LABELS */}
      <div className="absolute top-3 right-3 flex gap-2 text-[11px] font-medium">
        <span
          className={`px-2 py-0.5 rounded-full ${
            status === "published"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {status === "published" ? "Published" : "Draft"}
        </span>

        <span
          className={`px-2 py-0.5 rounded-full ${
            active
              ? "bg-blue-100 text-blue-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* VIEW */}
      <Link href={`/admin/destinations/${id}`} className="block">
        <div className="flex gap-4 p-4">
          <div className="w-24 h-20 rounded-md overflow-hidden bg-gray-100">
            {destination.coverPhoto?.url ? (
              <img
                src={destination.coverPhoto.url}
                alt={destination.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-sm font-semibold truncate">
              {destination.name}
            </h3>

            <p className="text-xs text-gray-600 line-clamp-2">
              {destination.shortDescription ||
                destination.description ||
                "—"}
            </p>
          </div>
        </div>
      </Link>

      {/* ACTIONS */}
      <div className="flex justify-end gap-2 px-4 pb-3">
        <Link
          href={`/admin/destinations/${id}`}
          className="text-xs px-3 py-1 border rounded-md hover:bg-gray-100"
        >
          Edit
        </Link>

        <button
          onClick={handleDelete}
          className="text-xs px-3 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
