"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs
} from "firebase/firestore";

import PageSkeleton from "@/components/ui/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import AdminLeaveFilters from "@/components/admin/AdminLeaveFilters";

/* =========================
   CONFIG
========================= */

/**
 * If your actual collection is "leaves", change this to:
 * const LEAVE_COLLECTION = "leaves";
 */
const LEAVE_COLLECTION = "leaves";

/* =========================
   HELPERS
========================= */

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

function getRequestUid(record = {}) {
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

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

function formatLeaveType(type) {
  return String(type || "—").replaceAll("_", " ");
}

function csvValue(value) {
  const safeValue = String(value ?? "").replaceAll('"', '""');
  return `"${safeValue}"`;
}

function exportCsv(rows) {
  if (!rows.length) return;

  const headers = [
    "Employee",
    "Employee ID",
    "From Date",
    "To Date",
    "Type",
    "Status",
    "Reason",
    "Admin Remark",
    "Action By",
    "Action At"
  ];

  const csvRows = rows.map((row) =>
    [
      row.name,
      row.employeeId,
      row.fromDate,
      row.toDate,
      formatLeaveType(row.type),
      row.status,
      row.reason || row.employeeRemark || "",
      row.adminRemark || row.decisionReason || "",
      row.actionByName || row.approvedByName || "",
      row.actionAtText || ""
    ]
      .map(csvValue)
      .join(",")
  );

  const csv = ["\uFEFF" + headers.join(","), ...csvRows].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "leave-history.csv";
  link.click();

  URL.revokeObjectURL(url);
}

async function loadUsersMap() {
  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = {};

  usersSnap.docs.forEach((userDoc) => {
    const data = userDoc.data();

    const userRow = {
      docId: userDoc.id,
      uid: data.uid || userDoc.id,
      name: getUserName(data),
      employeeId: getUserEmployeeId(data),
      email: data.email || data.officialEmail || ""
    };

    const lookupKeys = [
      userDoc.id,
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

  return usersMap;
}

function getActionAtText(row) {
  const value =
    row.actionAt ||
    row.approvedAt ||
    row.rejectedAt ||
    row.updatedAt ||
    null;

  const millis = getTimestampMillis(value);

  if (!millis) return "";

  return new Date(millis).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isLeaveOverlappingFilter(row, filters) {
  const rowFrom = row.fromDate || "";
  const rowTo = row.toDate || row.fromDate || "";

  if (filters.fromDate && rowTo < filters.fromDate) {
    return false;
  }

  if (filters.toDate && rowFrom > filters.toDate) {
    return false;
  }

  return true;
}

/* =========================
   PAGE
========================= */

export default function AdminLeaveHistory() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [view, setView] = useState("table");
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    status: "all",
    employee: "",
    fromDate: "",
    toDate: ""
  });

  const allowed = isAdminUser(user);

  /* =========================
     LOAD DATA
  ========================= */

  const load = useCallback(async () => {
    try {
      setPageLoading(true);
      setError("");

      const usersMap = await loadUsersMap();

      const snap = await getDocs(collection(db, LEAVE_COLLECTION));

      const mappedRows = snap.docs
        .map((leaveDoc) => {
          const data = leaveDoc.data();
          const uid = getRequestUid(data);
          const matchedUser = usersMap[uid] || {};

          const row = {
            id: leaveDoc.id,
            ...data,
            uid,
            name:
              matchedUser.name ||
              data.name ||
              data.employeeName ||
              "—",
            employeeId:
              matchedUser.employeeId ||
              data.employeeId ||
              data.empId ||
              "",
            email:
              matchedUser.email ||
              data.email ||
              "",
            adminRemark:
              data.adminRemark ||
              data.decisionReason ||
              "",
            actionAtText: getActionAtText(data)
          };

          return row;
        })
        .sort((a, b) => {
          const bTime = getTimestampMillis(
            b.appliedAt ||
              b.createdAt ||
              b.updatedAt ||
              b.actionAt
          );

          const aTime = getTimestampMillis(
            a.appliedAt ||
              a.createdAt ||
              a.updatedAt ||
              a.actionAt
          );

          if (bTime !== aTime) return bTime - aTime;

          return String(b.fromDate || "").localeCompare(
            String(a.fromDate || "")
          );
        });

      setRows(mappedRows);
    } catch (err) {
      console.error("Failed to load leave history:", err);

      setError(
        err?.message ||
          "Unable to load leave history. Please try again."
      );
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user || !allowed) {
      setPageLoading(false);
      return;
    }

    load();
  }, [user, loading, allowed, load]);

  /* =========================
     FILTERED ROWS
  ========================= */

  const filteredRows = useMemo(() => {
    const employeeSearch = filters.employee.trim().toLowerCase();

    return rows.filter((row) => {
      if (
        filters.status !== "all" &&
        row.status !== filters.status
      ) {
        return false;
      }

      if (employeeSearch) {
        const employeeText = [
          row.name,
          row.employeeId,
          row.email
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!employeeText.includes(employeeSearch)) {
          return false;
        }
      }

      if (!isLeaveOverlappingFilter(row, filters)) {
        return false;
      }

      return true;
    });
  }, [rows, filters]);

  /* =========================
     GUARDS
  ========================= */

  if (loading || pageLoading) {
    return <PageSkeleton lines={6} />;
  }

  if (!user || !allowed) {
    return (
      <main className="p-6 text-center text-red-600">
        Access denied
      </main>
    );
  }

  /* =========================
     UI
  ========================= */

  return (
    <main className="p-6 w-full mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">
          Leave History
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          View approved, rejected, cancelled, and pending leave records.
        </p>
      </div>

      <AdminLeaveFilters
        view={view}
        setView={setView}
        filters={filters}
        setFilters={setFilters}
        onExport={() => exportCsv(filteredRows)}
      />

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {filteredRows.length === 0 && (
        <EmptyState
          title="No leave records"
          description="Try adjusting filters"
        />
      )}

      {/* =========================
          CARD VIEW
      ========================== */}
      {view === "card" && filteredRows.length > 0 && (
        <div className="space-y-3">
          {filteredRows.map((leave) => (
            <div
              key={leave.id}
              className="border border-gray-100 rounded-xl bg-white p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {leave.name || "—"}
                  </p>

                  <p className="text-xs text-gray-500">
                    {leave.employeeId ||
                      leave.email ||
                      "No employee ID"}
                  </p>
                </div>

                <StatusBadge status={leave.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">
                    Dates
                  </p>
                  <p className="text-gray-700">
                    {leave.fromDate || "—"} → {leave.toDate || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Type
                  </p>
                  <p className="text-gray-700 capitalize">
                    {formatLeaveType(leave.type)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Action At
                  </p>
                  <p className="text-gray-700">
                    {leave.actionAtText || "—"}
                  </p>
                </div>
              </div>

              {(leave.reason || leave.employeeRemark) && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Reason:</span>{" "}
                  {leave.reason || leave.employeeRemark}
                </p>
              )}

              {leave.adminRemark && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Remark:</span>{" "}
                  {leave.adminRemark}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* =========================
          TABLE VIEW
      ========================== */}
      {view === "table" && filteredRows.length > 0 && (
        <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left">
                    Dates
                  </th>
                  <th className="px-4 py-3 text-left">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left">
                    Remark
                  </th>
                  <th className="px-4 py-3 text-left">
                    Action At
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((leave) => (
                  <tr
                    key={leave.id}
                    className="border-b border-gray-100 hover:bg-gray-50/60 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {leave.name || "—"}
                      </div>

                      <div className="text-xs text-gray-500">
                        {leave.employeeId ||
                          leave.email ||
                          "No employee ID"}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {leave.fromDate || "—"} → {leave.toDate || "—"}
                    </td>

                    <td className="px-4 py-3 capitalize">
                      {formatLeaveType(leave.type)}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={leave.status} />
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      <div className="line-clamp-2 text-gray-600">
                        {leave.reason ||
                          leave.employeeRemark ||
                          "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      <div className="line-clamp-2 text-gray-600">
                        {leave.adminRemark || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {leave.actionAtText || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}