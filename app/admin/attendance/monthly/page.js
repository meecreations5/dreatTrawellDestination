"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { getStatusChipProps } from "@/lib/statusChipMap";

/* =========================
   HELPERS
========================= */
function getMonthRange(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();

  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 0).toISOString().slice(0, 10)
  };
}

function summarize(records = []) {
  const summary = {
    present: 0,
    "half-day": 0,
    leave: 0,
    absent: 0,
    regularized: 0,
    totalMinutes: 0
  };

  records.forEach(r => {
    if (summary[r.status] !== undefined) {
      summary[r.status]++;
    }
    summary.totalMinutes += r.totalMinutes || 0;
  });

  return summary;
}

export default function AdminMonthlyAttendance() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState({});
  const [pageLoading, setPageLoading] = useState(true);
  const [openUser, setOpenUser] = useState(null);

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    if (loading) return;

    if (!user || !user.isAdmin) {
      setPageLoading(false);
      return;
    }

    const load = async () => {
      setPageLoading(true);

      const { start, end } = getMonthRange();

      // Load users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap = {};
      usersSnap.docs.forEach(d => {
        usersMap[d.id] = d.data();
      });

      // Load attendance
      const q = query(
        collection(db, "attendance"),
        where("date", ">=", start),
        where("date", "<=", end)
      );

      const snap = await getDocs(q);

      const grouped = {};

      snap.docs.forEach(d => {
        const r = d.data();
        const u = usersMap[r.uid] || {};

        if (!grouped[r.uid]) {
          grouped[r.uid] = {
            uid: r.uid,
            name: u.name || u.email || "—",
            employeeId: u.employeeId || "",
            records: []
          };
        }

        grouped[r.uid].records.push(r);
      });

      setRows(grouped);
      setPageLoading(false);
    };

    load();
  }, [user, loading]);

  /* =========================
     STATES
  ========================= */
  if (loading || pageLoading) {
    return <PageSkeleton lines={8} />;
  }

  if (!user || !user.isAdmin) {
    return (
      <main className="p-6 text-center text-red-600">
        Access denied
      </main>
    );
  }

  /* =========================
     UI (MATCHES attendance/page.js)
  ========================= */
  return (
    <main className="p-6 w-full mx-auto space-y-4">
      <h1 className="text-xl font-semibold">
        Monthly Attendance — Team
      </h1>

      {Object.values(rows).map(emp => {
        const summary = summarize(emp.records);

        return (
          <div
            key={emp.uid}
            className="
              border border-gray-100
              rounded-xl
              bg-white
              overflow-hidden
            "
          >
            {/* HEADER ROW */}
            <div
              className="
                px-4 py-3
                flex flex-wrap gap-3
                items-center justify-between
                cursor-pointer
                hover:bg-gray-50/60
              "
              onClick={() =>
                setOpenUser(
                  openUser === emp.uid ? null : emp.uid
                )
              }
            >
              {/* EMPLOYEE */}
              <div>
                <div className="font-medium">
                  {emp.name}
                </div>
                <div className="text-xs text-gray-500">
                  {emp.employeeId}
                </div>
              </div>

              {/* SUMMARY */}
              <div className="flex flex-wrap gap-3 items-center text-sm">
                {/* Present always shown */}
                <div className="flex items-center gap-1">
                  <StatusChip label="Present" color="green" />
                  <span>{summary.present}</span>
                </div>

                {Object.entries({
                  "half-day": summary["half-day"],
                  leave: summary.leave,
                  regularized: summary.regularized,
                  absent: summary.absent
                }).map(([key, count]) => {
                  if (!count) return null;
                  const chip = getStatusChipProps(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1"
                    >
                      <StatusChip
                        label={chip.label}
                        color={chip.color}
                      />
                      <span>{count}</span>
                    </div>
                  );
                })}

                <span className="ml-2 font-medium text-gray-600">
                  {(summary.totalMinutes / 60).toFixed(1)} hrs
                </span>
              </div>
            </div>

            {/* DETAILS */}
            {openUser === emp.uid && (
              <div className="border-t border-gray-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50/60 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left">
                        Minutes
                      </th>
                      <th className="px-4 py-3 text-left">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {emp.records.map((r, i) => {
                      const chip = getStatusChipProps(r.status);
                      return (
                        <tr
                          key={i}
                          className="border-b border-gray-100"
                        >
                          <td className="px-4 py-2">
                            {r.date}
                          </td>
                          <td className="px-4 py-2">
                            {r.totalMinutes || 0}
                          </td>
                          <td className="px-4 py-2">
                            <StatusChip
                              label={chip.label}
                              color={chip.color}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
