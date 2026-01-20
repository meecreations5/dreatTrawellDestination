"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import StatusBadge from "@/components/ui/StatusBadge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

/* =========================
   HELPERS
========================= */
function getMonthRangeFromDate(d) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 0).toISOString().slice(0, 10)
  };
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function minutesToHM(min = 0) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function toJSDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(value);
}

/* =========================
   COMPONENT
========================= */
export default function AttendanceHistory() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [openDay, setOpenDay] = useState(null);
  const [monthDate, setMonthDate] = useState(new Date());

  /* =========================
     LOAD DATA
  ========================== */
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setPageLoading(true);

      const { start, end } =
        getMonthRangeFromDate(monthDate);

      const q = query(
        collection(db, "attendance"),
        where("uid", "==", user.uid),
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "desc")
      );

      const snap = await getDocs(q);
      setRows(snap.docs.map(d => d.data()));
      setPageLoading(false);
    };

    load();
  }, [user, monthDate]);

  /* =========================
     SUMMARY + STREAK
  ========================== */
  const summary = useMemo(() => {
    const presentDays = rows.filter(
      r => (r.sessions?.length || 0) > 0
    ).length;

    const totalMinutes = rows.reduce(
      (s, r) => s + (r.totalMinutes || 0),
      0
    );

    let streak = 0;
    let lastDate = null;

    const sorted = [...rows].sort(
      (a, b) => b.date.localeCompare(a.date)
    );

    for (const r of sorted) {
      if ((r.sessions?.length || 0) === 0) break;

      if (!lastDate) {
        lastDate = new Date(r.date);
        streak++;
      } else {
        const expected = new Date(lastDate);
        expected.setDate(expected.getDate() - 1);

        if (
          expected.toISOString().slice(0, 10) ===
          r.date
        ) {
          streak++;
          lastDate = expected;
        } else break;
      }
    }

    return {
      days: presentDays,
      total: totalMinutes,
      avg:
        presentDays > 0
          ? Math.floor(totalMinutes / presentDays)
          : 0,
      streak
    };
  }, [rows]);

  if (loading || pageLoading) {
    return <TableSkeleton rows={6} cols={4} />;
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Attendance History
          </h1>
          <p className="text-sm text-slate-500">
            Monthly work log
          </p>
        </div>

        {/* MONTH SWITCHER */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() =>
              setMonthDate(
                new Date(
                  monthDate.getFullYear(),
                  monthDate.getMonth() - 1,
                  1
                )
              )
            }
            className="text-slate-500 hover:text-slate-900"
          >
            ◀
          </button>

          <span className="font-medium text-slate-700">
            {monthDate.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric"
            })}
          </span>

          <button
            onClick={() =>
              setMonthDate(
                new Date(
                  monthDate.getFullYear(),
                  monthDate.getMonth() + 1,
                  1
                )
              )
            }
            className="text-slate-500 hover:text-slate-900"
          >
            ▶
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Days"
          value={summary.days}
          variant="blue"
        />
        <SummaryCard
          label="Total Time"
          value={minutesToHM(summary.total)}
          variant="green"
        />
        <SummaryCard
          label="Avg / Day"
          value={minutesToHM(summary.avg)}
          variant="amber"
        />
        <SummaryCard
          label="Streak"
          value={`${summary.streak} 🔥`}
          variant="rose"
        />
      </div>


      {/* DAY LIST */}
      <div className="mt-4 divide-y divide-slate-200 bg-white rounded-lg border border-slate-200">
        {rows.map((r, i) => {
          const isOpen = openDay === r.date;

          return (
            <div key={i}>
              <button
                onClick={() =>
                  setOpenDay(isOpen ? null : r.date)
                }
                className="w-full px-4 py-4 flex justify-between items-center hover:bg-slate-50"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(r.date)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.sessions?.length || 0} sessions •{" "}
                    {minutesToHM(r.totalMinutes)}
                  </p>
                </div>

                {/* ✅ FIXED STATUS LOGIC */}
                <StatusBadge
                  status={
                    (r.sessions?.length || 0) > 0
                      ? "present"
                      : r.status
                  }
                />
              </button>

              {/* EXPANDED TIMELINE */}
              {isOpen && (
                <div className="px-6 pb-4">
                  <div className="pl-4 border-l border-slate-200 space-y-2">
                    {r.sessions?.map((s, idx) => {
                      const inTime = toJSDate(
                        s.checkInAt
                      );
                      const outTime = toJSDate(
                        s.checkOutAt
                      );

                      return (
                        <div
                          key={idx}
                          className="relative text-sm text-slate-700"
                        >
                          <span className="absolute -left-[20px] top-1 w-2 h-2 bg-blue-600 rounded-full" />
                          {formatTime(inTime)}
                          {outTime && (
                            <>
                              {" "}→{" "}
                              {formatTime(outTime)}
                              <span className="text-xs text-slate-400 ml-1">
                                (
                                {minutesToHM(
                                  s.minutes || 0
                                )}
                                )
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="p-6 text-center text-slate-500">
            No attendance records
          </p>
        )}
      </div>
    </main>
  );
}

/* =========================
   SUMMARY CARD
========================= */
function SummaryCard({ label, value, variant = "blue" }) {
  const bgMap = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    amber: "bg-amber-50 border-amber-100",
    rose: "bg-rose-50 border-rose-100"
  };

  return (
    <div
      className={`
        ${bgMap[variant]}
        border
        rounded-lg
        px-4 py-3
      `}
    >
      <p className="text-xs text-slate-500">
        {label}
      </p>
      <p className="text-base font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

