"use client";

import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function TravelAgentStatusToggle({
  agentId,
  currentStatus,
  onChange
}) {
  const [updating, setUpdating] = useState(false);

  const isActive = currentStatus === "active";

  const toggleStatus = async () => {
    if (updating) return;

    const confirmMsg = isActive
      ? "Disable this travel agent?"
      : "Enable this travel agent?";

    if (!window.confirm(confirmMsg)) return;

    try {
      setUpdating(true);

      const newStatus = isActive ? "inactive" : "active";

      await updateDoc(doc(db, "travelAgents", agentId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      onChange?.(newStatus);
    } catch (err) {
      console.error("Status update failed", err);
      alert("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <button
      onClick={toggleStatus}
      disabled={updating}
      className={`text-xs px-3 py-1 rounded border transition ${
        isActive
          ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
          : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
      } ${updating ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {updating
        ? "Updating..."
        : isActive
        ? "Active"
        : "Inactive"}
    </button>
  );
}
