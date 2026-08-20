"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { History } from "lucide-react";
import { db } from "@/lib/firebase";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "Pending timestamp";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AccessAuditLog({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!userId) {
        setRows([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const snap = await getDocs(
          query(collection(db, "accessAuditLogs"), where("changedUserId", "==", userId))
        );
        const next = snap.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
          .slice(0, 10);
        if (active) setRows(next);
      } catch (error) {
        console.warn("Access audit log unavailable:", error);
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [userId]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
          <History className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Access Audit History</h2>
          <p className="text-xs text-gray-500">Latest role, status and individual-access changes.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading access history…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400">No access changes recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const oldRole = row.previousAccess?.role || "—";
            const newRole = row.newAccess?.role || "—";
            const oldActive = row.previousAccess?.active;
            const newActive = row.newAccess?.active;
            const changedRole = oldRole !== newRole;
            const changedStatus = oldActive !== undefined && newActive !== undefined && oldActive !== newActive;
            const oldOverrides = Object.keys(row.previousAccess?.accessOverrides || {}).length;
            const newOverrides = Object.keys(row.newAccess?.accessOverrides || {}).length;

            return (
              <div key={row.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-700">
                    {row.changedByName || row.changedByEmail || "System"}
                  </p>
                  <p className="text-[11px] text-gray-400">{formatDate(row.createdAt)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
                  {row.previousAccess === null ? <span>Created with role {newRole}</span> : null}
                  {changedRole ? <span>Role: {oldRole} → {newRole}</span> : null}
                  {changedStatus ? <span>Status: {oldActive ? "Active" : "Inactive"} → {newActive ? "Active" : "Inactive"}</span> : null}
                  {row.previousAccess !== null && oldOverrides !== newOverrides ? <span>Overrides: {oldOverrides} → {newOverrides}</span> : null}
                </div>
                {row.reason ? <p className="mt-2 text-xs text-gray-500">Reason: {row.reason}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
