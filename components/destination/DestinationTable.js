"use client";

import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

import DestinationStatusChip from "@/components/destination/DestinationStatusChip";

export default function DestinationTable({
  destinations,
  onRowClick
}) {
  const { user } = useAuth();

  const publishDraft = async id => {
    await updateDoc(doc(db, "destinations", id), {
      status: "published"
    });
  };

  const toggleActive = async (id, active) => {
    await updateDoc(doc(db, "destinations", id), {
      active: !active
    });
  };

  const deleteDestination = async id => {
    const ok = window.confirm(
      "This will permanently delete the destination. Continue?"
    );
    if (!ok) return;

    await deleteDoc(doc(db, "destinations", id));
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr className="border-b border-gray-100">
            <th className="p-3 text-left">
              Destination
            </th>
            <th className="p-3">
              Status
            </th>
            <th className="p-3">
              Best Time
            </th>
            <th className="p-3">
              Duration
            </th>
            <th className="p-3">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {destinations.map(d => (
            <tr
              key={d.id}
              onClick={() => onRowClick(d.id)}
              className="border-b border-gray-100 hover:bg-gray-50/40 cursor-pointer"
            >
              {/* NAME */}
              <td className="p-3 font-medium">
                {d.name}
              </td>

              {/* STATUS */}
              <td className="p-3">
                <DestinationStatusChip
                  status={d.status}
                  active={d.active}
                />
              </td>

              {/* BEST TIME */}
              <td className="p-3 text-xs">
                {d.bestTimeToVisit || "—"}
              </td>

              {/* DURATION */}
              <td className="p-3 text-xs">
                {d.idealTripDuration || "—"}
              </td>

              {/* ACTIONS */}
              <td
                className="p-3"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/admin/destinations/${d.id}`}
                    className="text-xs border px-2 py-1 rounded-md"
                  >
                    Edit
                  </Link>

                  {d.status === "draft" && (
                    <button
                      onClick={() => publishDraft(d.id)}
                      className="text-xs border border-green-300 text-green-700 px-2 py-1 rounded-md"
                    >
                      Publish
                    </button>
                  )}

                  <button
                    onClick={() => toggleActive(d.id, d.active)}
                    className={`text-xs border px-2 py-1 rounded-md
        ${d.active
                        ? "border-red-300 text-red-700"
                        : "border-blue-300 text-blue-700"
                      }
      `}
                  >
                    {d.active ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    onClick={() => deleteDestination(d.id)}
                    className="text-xs border border-red-400 text-red-700 px-2 py-1 rounded-md"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
