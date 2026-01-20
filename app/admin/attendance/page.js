"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import EmptyState from "@/components/ui/EmptyState";
import PageSkeleton from "@/components/ui/PageSkeleton";
import StatusBadge from "@/components/ui/StatusBadge";

/* =========================
   HELPERS
========================= */
function today() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  d.setMinutes(d.getMinutes() - offset);
  return d.toISOString().slice(0, 10);
}

function formatMinutes(mins = 0) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function AdminAttendancePage() {
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("table"); // card | table

  const date = today();

  /* =========================
     LOAD USERS
  ========================== */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      snap => {
        setUsers(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );
      }
    );
    return () => unsub();
  }, []);

  /* =========================
     LOAD ATTENDANCE (INDEX SAFE)
  ========================== */
  useEffect(() => {
    const q = query(
      collection(db, "attendance"),
      where("date", "==", date)
    );

    const unsub = onSnapshot(q, snap => {
      setRecords(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
      setLoading(false);
    });

    return () => unsub();
  }, [date]);

  /* =========================
     USER MAP
  ========================== */
  const userMap = useMemo(() => {
    const map = {};
    users.forEach(u => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  /* =========================
     UI
  ========================== */
  return (
    <main className="p-6 w-full mx-auto space-y-4">
      <h1 className="text-xl font-semibold">
        Admin — Attendance
      </h1>

      {/* VIEW BAR (MATCHES LEADS) */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {date}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => setView("card")}
            className={`px-3 py-1 rounded border text-sm ${
              view === "card"
                ? "bg-gray-100"
                : "bg-white"
            }`}
          >
            Card
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded border text-sm ${
              view === "table"
                ? "bg-gray-100"
                : "bg-white"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* LOADING */}
      {loading && <PageSkeleton lines={5} />}

      {/* EMPTY */}
      {!loading && records.length === 0 && (
        <EmptyState
          title="No attendance found"
          description="No one has marked attendance today"
        />
      )}

      {/* =========================
         CARD VIEW
      ========================== */}
      {!loading && view === "card" && (
        <div className="space-y-3">
          {records.map(r => {
            const user = userMap[r.uid];
            return (
              <div
                key={r.id}
                className="bg-white rounded shadow p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {user?.name || "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user?.employeeId || ""}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="text-sm text-gray-600">
                  Worked:{" "}
                  {r.totalMinutes
                    ? formatMinutes(r.totalMinutes)
                    : "—"}
                </div>

                <div className="text-xs text-gray-500">
                  Sessions:{" "}
                  {Array.isArray(r.sessions)
                    ? r.sessions.length
                    : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================
         TABLE VIEW (MATCH LEADS)
      ========================== */}
      {!loading && view === "table" && (
        <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/60 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">
                  Employee
                </th>
                <th className="px-4 py-3 text-left">
                  Employee ID
                </th>
                <th className="px-4 py-3 text-left">
                  Status
                </th>
                <th className="px-4 py-3 text-left">
                  Worked Time
                </th>
                <th className="px-4 py-3 text-left">
                  Sessions
                </th>
              </tr>
            </thead>

            <tbody>
              {records.map(r => {
                const user = userMap[r.uid];
                return (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium">
                        {user?.name || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {user?.email || ""}
                      </div>
                    </td>

                    <td className="px-4 py-2">
                      {user?.employeeId || "—"}
                    </td>

                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
                    </td>

                    <td className="px-4 py-2">
                      {r.totalMinutes
                        ? formatMinutes(r.totalMinutes)
                        : "—"}
                    </td>

                    <td className="px-4 py-2 text-xs text-gray-600">
                      {Array.isArray(r.sessions)
                        ? `${r.sessions.length} session(s)`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
