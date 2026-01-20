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
import { useRouter } from "next/navigation";

import StatusBadge from "@/components/ui/StatusBadge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

/* =========================
   HELPERS
========================= */
function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return {
    start: new Date(year, month, 1).toISOString().slice(0, 10),
    end: new Date(year, month + 1, 0).toISOString().slice(0, 10),
    label: date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric"
    })
  };
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function minutesToHM(min = 0) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

/* =========================
   COMPONENT
========================= */
export default function MonthlyAttendancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [records, setRecords] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [monthDate, setMonthDate] = useState(new Date());
  const [openDay, setOpenDay] = useState(null);

  /* =========================
     AUTH
  ========================== */
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  /* =========================
     LOAD DATA
  ========================== */
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setPageLoading(true);

      const { start, end } = getMonthRange(monthDate);

      const q = query(
        collection(db, "attendance"),
        where("uid", "==", user.uid),
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "desc")
      );

      const snap = await getDocs(q);
      setRecords(snap.docs.map(d => d.data()));
      setPageLoading(false);
    };

    load();
  }, [user, monthDate]);

  /* =========================
     SUMMARY
  ========================== */
  const summary = useMemo(() => {
    const presentDays = records.filter(
      r => (r.sessions?.length || 0) > 0
    ).length;

    const totalMinutes = records.reduce(
      (sum, r) => sum + (r.totalMinutes || 0),
      0
    );

    return {
      days: presentDays,
      total: totalMinutes,
      avg:
        presentDays > 0
          ? Math.floor(totalMinutes / presentDays)
          : 0
    };
  }, [records]);

  if (loading || pageLoading) {
    return <TableSkeleton rows={6} cols={4} />;
  }

  const { label } = getMonthRange(monthDate);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Monthly Attendance
          </h1>
          <p className="text-sm text-slate-500">
            {label}
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
          label="Records"
          value={records.length}
          variant="rose"
        />
      </div>

      {/* DAILY LIST */}
      <div className="mt-4 divide-y divide-slate-200 bg-white rounded-lg border border-slate-200">
        {records.map((r, i) => {
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

                <StatusBadge
                  status={
                    (r.sessions?.length || 0) > 0
                      ? "present"
                      : r.status
                  }
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-4 text-sm text-slate-600">
                  Total working time:{" "}
                  <strong>
                    {minutesToHM(r.totalMinutes)}
                  </strong>
                </div>
              )}
            </div>
          );
        })}

        {records.length === 0 && (
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
  const map = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    amber: "bg-amber-50 border-amber-100",
    rose: "bg-rose-50 border-rose-100"
  };

  return (
    <div
      className={`${map[variant]} border rounded-lg px-4 py-3`}
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
