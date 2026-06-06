"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";

import { useAuth } from "@/hooks/useAuth";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { getStatusChipProps } from "@/lib/statusChipMap";

/* =========================
   HELPERS
========================= */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function localDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function getMonthRange(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();

  return {
    start: localDate(new Date(y, m, 1)),
    end: localDate(new Date(y, m + 1, 0))
  };
}

function isAdminUser(user) {
  const role = user?.role || user?.userRole || "";

  return (
    user?.isAdmin === true ||
    ["super_admin", "admin", "hr"].includes(role)
  );
}

function getUserName(data = {}) {
  return (
    data.name ||
    data.fullName ||
    data.displayName ||
    data.employeeName ||
    `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
    data.email ||
    "—"
  );
}

function getUserEmployeeId(data = {}) {
  return (
    data.employeeId ||
    data.empId ||
    data.employeeCode ||
    data.code ||
    ""
  );
}

function getAttendanceUid(record = {}) {
  return String(
    record.uid ||
      record.userId ||
      record.employeeUid ||
      record.authUid ||
      record.firebaseUid ||
      record.employeeId ||
      record.email ||
      ""
  );
}

function getChip(status) {
  return (
    getStatusChipProps(status) || {
      label: status || "Not Marked",
      color: "gray"
    }
  );
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

  records.forEach((record) => {
    const status = record.status || "absent";

    if (summary[status] !== undefined) {
      summary[status]++;
    }

    summary.totalMinutes += Number(record.totalMinutes || 0);
  });

  return summary;
}

/* =========================
   PAGE
========================= */

export default function AdminMonthlyAttendance() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState({});
  const [pageLoading, setPageLoading] = useState(true);
  const [openUser, setOpenUser] = useState(null);
  const [error, setError] = useState("");

  const allowed = isAdminUser(user);

  /* =========================
     LOAD DATA
  ========================= */

  useEffect(() => {
    if (loading) return;

    if (!user || !allowed) {
      setPageLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        setPageLoading(true);
        setError("");

        const { start, end } = getMonthRange();

        /* =========================
           LOAD USERS
           Important:
           attendance.uid = users.uid
           not users document id
        ========================= */

        const usersSnap = await getDocs(collection(db, "users"));

        const usersMap = {};

        usersSnap.docs.forEach((doc) => {
          const data = doc.data();

          const userRow = {
            docId: doc.id,
            uid: data.uid || doc.id,
            name: getUserName(data),
            employeeId: getUserEmployeeId(data),
            email: data.email || data.officialEmail || ""
          };

          const lookupKeys = [
            doc.id,
            data.uid,
            data.userId,
            data.authUid,
            data.firebaseUid,
            data.firebaseUserId,
            data.employeeUid,
            data.employeeId,
            data.empId,
            data.employeeCode,
            data.email,
            data.officialEmail
          ].filter(Boolean);

          lookupKeys.forEach((key) => {
            usersMap[String(key)] = userRow;
          });
        });

        /* =========================
           LOAD ATTENDANCE
        ========================= */

        const attendanceQuery = query(
          collection(db, "attendance"),
          where("date", ">=", start),
          where("date", "<=", end),
          orderBy("date", "asc")
        );

        const attendanceSnap = await getDocs(attendanceQuery);

        const grouped = {};

        attendanceSnap.docs.forEach((doc) => {
          const record = {
            id: doc.id,
            ...doc.data()
          };

          const attendanceUid = getAttendanceUid(record);

          if (!attendanceUid) return;

          const matchedUser = usersMap[attendanceUid] || {};

          if (!grouped[attendanceUid]) {
            grouped[attendanceUid] = {
              uid: attendanceUid,
              name:
                matchedUser.name ||
                record.employeeName ||
                record.name ||
                record.email ||
                "—",
              employeeId:
                matchedUser.employeeId ||
                record.employeeId ||
                record.empId ||
                "",
              email:
                matchedUser.email ||
                record.email ||
                "",
              records: []
            };
          }

          grouped[attendanceUid].records.push(record);
        });

        Object.keys(grouped).forEach((uid) => {
          grouped[uid].records.sort((a, b) =>
            String(a.date || "").localeCompare(String(b.date || ""))
          );
        });

        if (mounted) {
          setRows(grouped);
        }
      } catch (err) {
        console.error("Monthly attendance load failed:", err);

        if (mounted) {
          setError(
            err?.message ||
              "Unable to load monthly attendance records."
          );
        }
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [user, loading, allowed]);

  /* =========================
     STATES
  ========================= */

  if (loading || pageLoading) {
    return <PageSkeleton lines={8} />;
  }

  if (!user || !allowed) {
    return (
      <main className="p-6 text-center text-red-600">
        Access denied
      </main>
    );
  }

  const employees = Object.values(rows).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );

  /* =========================
     UI
  ========================= */

  return (
    <main className="p-6 w-full mx-auto space-y-4">
      <h1 className="text-xl font-semibold">
        Monthly Attendance — Team
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {employees.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-center text-sm text-gray-500">
          No attendance records found for this month.
        </div>
      )}

      {employees.map((emp) => {
        const summary = summarize(emp.records);
        const isOpen = openUser === emp.uid;

        return (
          <div
            key={emp.uid}
            className="border border-gray-100 rounded-xl bg-white overflow-hidden"
          >
            {/* HEADER ROW */}
            <div
              className="px-4 py-3 flex flex-wrap gap-3 items-center justify-between cursor-pointer hover:bg-gray-50/60"
              onClick={() =>
                setOpenUser(isOpen ? null : emp.uid)
              }
            >
              {/* EMPLOYEE */}
              <div>
                <div className="font-medium text-gray-900">
                  {emp.name}
                </div>

                <div className="text-xs text-gray-500">
                  {emp.employeeId || emp.email || "No employee ID"}
                </div>
              </div>

              {/* SUMMARY */}
              <div className="flex flex-wrap gap-3 items-center text-sm">
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

                  const chip = getChip(key);

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
            {isOpen && (
              <div className="border-t border-gray-100 overflow-x-auto">
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
                    {emp.records.map((record) => {
                      const chip = getChip(record.status);

                      return (
                        <tr
                          key={record.id}
                          className="border-b border-gray-100 last:border-b-0"
                        >
                          <td className="px-4 py-2">
                            {record.date || "—"}
                          </td>

                          <td className="px-4 py-2">
                            {record.totalMinutes || 0}
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