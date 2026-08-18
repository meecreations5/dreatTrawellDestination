"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { cancelPendingAgentTasks } from "@/lib/engagementTaskService";
import {
  TRAVEL_AGENT_STATUS_OPTIONS,
  getTravelAgentStatusMeta,
  normalizeTravelAgentStatus
} from "@/lib/travelAgentStatus";

const TONE_CLASS = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700"
};

export default function TravelAgentStatusToggle({
  agentId,
  currentStatus,
  currentActive,
  onChange
}) {
  const { user } = useAuth();
  const normalizedStatus = normalizeTravelAgentStatus(
    currentStatus,
    currentActive
  );

  const [selectedStatus, setSelectedStatus] = useState(normalizedStatus);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSelectedStatus(normalizedStatus);
  }, [normalizedStatus]);

  const meta = useMemo(
    () => getTravelAgentStatusMeta(selectedStatus),
    [selectedStatus]
  );

  const updateStatus = async nextStatus => {
    if (updating || !agentId || nextStatus === selectedStatus) return;

    const nextMeta = getTravelAgentStatusMeta(nextStatus);
    const previousStatus = selectedStatus;

    try {
      setUpdating(true);
      setMessage("");
      setSelectedStatus(nextStatus);

      await updateDoc(doc(db, "travelAgents", agentId), {
        status: nextStatus,
        active: nextStatus === "active",
        statusReason: nextMeta.label,
        statusUpdatedAt: serverTimestamp(),
        statusUpdatedByUid: user?.uid || "",
        statusUpdatedByName:
          user?.name || user?.displayName || user?.email || "Team member",
        updatedAt: serverTimestamp()
      });

      if (nextMeta.contactable === false && user) {
        await cancelPendingAgentTasks({
          agentId,
          user,
          reason: `Travel agent status changed to ${nextMeta.label}`
        });
      }

      setMessage(
        nextMeta.contactable === false
          ? `${nextMeta.label} saved. Pending follow-ups stopped.`
          : `${nextMeta.label} saved.`
      );
      onChange?.(nextStatus);
    } catch (err) {
      console.error("Travel agent status update failed", err);
      setSelectedStatus(previousStatus);
      setMessage("Unable to update status.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-w-[190px]">
      <select
        value={selectedStatus}
        onChange={event => updateStatus(event.target.value)}
        disabled={updating}
        aria-label="Travel agent status"
        className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 ${
          TONE_CLASS[meta.tone] || TONE_CLASS.slate
        }`}
      >
        {TRAVEL_AGENT_STATUS_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {message ? (
        <p className="mt-1 max-w-[220px] text-[10px] leading-4 text-gray-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}
