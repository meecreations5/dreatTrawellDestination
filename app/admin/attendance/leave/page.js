"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  serverTimestamp,
  getDoc,
  writeBatch
} from "firebase/firestore";

import StatusBadge from "@/components/ui/StatusBadge";
import PageSkeleton from "@/components/ui/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import AdminLeaveApprovalFilters from "@/components/admin/AdminLeaveApprovalFilters";
import { deriveAttendanceStatus } from "@/lib/deriveAttendanceStatus";

/* =========================
   CONFIG
========================= */

/**
 * If your current Firestore collection is still "leaves",
 * keep this as "leaves".
 *
 * If you migrated to the newer module structure,
 * change it to "leave_requests".
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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function parseLocalDate(value) {
  if (!value) return null;

  const [year, month, day] = String(value).split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function eachDate(from, to) {
  const start = parseLocalDate(from);
  const end = parseLocalDate(to || from);

  if (!start || !end || start > end) return [];

  const dates = [];

  const current = new Date(start);

  while (current <= end) {
    dates.push(formatLocalDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
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

/* =========================
   PAGE
========================= */

export default function AdminLeaveApprovalPage() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [remarkMap, setRemarkMap] = useState({});
  const [selected, setSelected] = useState([]);
  const [processingId, setProcessingId] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState("table");
  const [filters, setFilters] = useState({
    employee: "",
    fromDate: "",
    toDate: ""
  });

  const allowed = isAdminUser(user);
  const isProcessing = Boolean(processingId || bulkProcessing);

  /* =========================
     LOAD DATA
  ========================= */

  const load = useCallback(async () => {
    try {
      setPageLoading(true);
      setError("");

      const usersMap = await loadUsersMap();

      const leaveQuery = query(
        collection(db, LEAVE_COLLECTION),
        where("status", "==", "pending")
      );

      const snap = await getDocs(leaveQuery);

      const rows = snap.docs
        .map((leaveDoc) => {
          const data = leaveDoc.data();
          const uid = getRequestUid(data);
          const matchedUser = usersMap[uid] || {};

          return {
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
              ""
          };
        })
        .sort((a, b) => {
          const bTime = getTimestampMillis(
            b.appliedAt || b.createdAt || b.updatedAt
          );
          const aTime = getTimestampMillis(
            a.appliedAt || a.createdAt || a.updatedAt
          );

          if (bTime !== aTime) return bTime - aTime;

          return String(b.fromDate || "").localeCompare(
            String(a.fromDate || "")
          );
        });

      setItems(rows);
      setSelected([]);
    } catch (err) {
      console.error("Failed to load leave approvals:", err);
      setError(
        err?.message ||
          "Unable to load pending leave requests."
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
     FILTERED ITEMS
  ========================= */

  const filteredItems = useMemo(() => {
    const employeeSearch = filters.employee.trim().toLowerCase();

    return items.filter((leave) => {
      if (employeeSearch) {
        const employeeText = [
          leave.name,
          leave.employeeId,
          leave.email
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!employeeText.includes(employeeSearch)) {
          return false;
        }
      }

      if (!isLeaveOverlappingFilter(leave, filters)) {
        return false;
      }

      return true;
    });
  }, [items, filters]);

  const selectedItems = useMemo(() => {
    return items.filter((item) => selected.includes(item.id));
  }, [items, selected]);

  /* =========================
     SHARED ACTIONS
  ========================= */

  const buildLeaveAttendanceWrites = (batch, leave) => {
    const uid = getRequestUid(leave);
    const dates = eachDate(leave.fromDate, leave.toDate);

    if (!uid) {
      throw new Error("Employee UID is missing.");
    }

    if (!leave.fromDate) {
      throw new Error("Leave start date is missing.");
    }

    if (!dates.length) {
      throw new Error("Invalid leave date range.");
    }

    if (dates.length > 450) {
      throw new Error("Leave date range is too large to process.");
    }

    dates.forEach((dateValue) => {
      const attendanceRef = doc(
        db,
        "attendance",
        `${uid}_${dateValue}`
      );

      batch.set(
        attendanceRef,
        {
          uid,
          date: dateValue,
          employeeId: leave.employeeId || "",
          employeeName: leave.name || "",
          sessions: [],
          totalMinutes: 0,
          status: deriveAttendanceStatus({ isLeave: true }),
          source: "leave",
          isLeave: true,
          leaveId: leave.id,
          leaveType: leave.type || "",
          leaveFromDate: leave.fromDate || "",
          leaveToDate: leave.toDate || leave.fromDate || "",
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    });
  };

  const processSingleLeave = async (leave, decision) => {
    const remark = String(remarkMap[leave.id] || "").trim();

    if (!remark) {
      alert("Admin remark required");
      return false;
    }

    try {
      setProcessingId(leave.id);

      const leaveRef = doc(db, LEAVE_COLLECTION, leave.id);
      const latestSnap = await getDoc(leaveRef);

      if (!latestSnap.exists()) {
        alert("This leave request no longer exists.");
        return false;
      }

      const latestLeave = latestSnap.data();

      if (latestLeave.status !== "pending") {
        alert("This leave request has already been processed.");
        await load();
        return false;
      }

      const batch = writeBatch(db);

      batch.update(leaveRef, {
        status: decision,
        adminRemark: remark,
        decisionReason: remark,
        actionBy: user.uid,
        actionByName: user.name || user.email || "",
        actionAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (decision === "approved") {
        buildLeaveAttendanceWrites(batch, {
          ...leave,
          ...latestLeave,
          id: leave.id
        });
      }

      await batch.commit();

      setRemarkMap((previous) => {
        const next = { ...previous };
        delete next[leave.id];
        return next;
      });

      return true;
    } catch (err) {
      console.error(`Leave ${decision} failed:`, err);
      alert(
        err?.message ||
          `Unable to ${decision === "approved" ? "approve" : "reject"} leave request.`
      );
      return false;
    } finally {
      setProcessingId("");
    }
  };

  const approveOne = async (leave) => {
    const success = await processSingleLeave(leave, "approved");
    if (success) await load();
  };

  const rejectOne = async (leave) => {
    const success = await processSingleLeave(leave, "rejected");
    if (success) await load();
  };

  const validateBulkRemarks = () => {
    if (!selected.length) {
      alert("Please select at least one leave request.");
      return false;
    }

    const missingRemark = selectedItems.find(
      (item) => !String(remarkMap[item.id] || "").trim()
    );

    if (missingRemark) {
      alert("Admin remark is required for all selected requests.");
      return false;
    }

    return true;
  };

  const bulkApprove = async () => {
    if (!validateBulkRemarks()) return;

    try {
      setBulkProcessing(true);

      for (const leave of selectedItems) {
        await processSingleLeave(leave, "approved");
      }

      await load();
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkReject = async () => {
    if (!validateBulkRemarks()) return;

    try {
      setBulkProcessing(true);

      for (const leave of selectedItems) {
        await processSingleLeave(leave, "rejected");
      }

      await load();
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelected = (id, checked) => {
    setSelected((previous) => {
      if (checked) {
        return previous.includes(id) ? previous : [...previous, id];
      }

      return previous.filter((itemId) => itemId !== id);
    });
  };

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
          Leave Approval
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review pending leave requests and update attendance automatically on approval.
        </p>
      </div>

      <AdminLeaveApprovalFilters
        view={view}
        setView={setView}
        filters={filters}
        setFilters={setFilters}
        selectedCount={selected.length}
        onBulkApprove={bulkApprove}
        onBulkReject={bulkReject}
      />

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {filteredItems.length === 0 && (
        <EmptyState
          title="No pending leave requests"
          description="Try adjusting filters"
        />
      )}

      {/* ================= CARD VIEW ================= */}
      {view === "card" && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((leave) => {
            const rowProcessing = processingId === leave.id;

            return (
              <div
                key={leave.id}
                className="bg-white rounded-xl border border-gray-100 p-4 space-y-3"
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

                  <input
                    type="checkbox"
                    checked={selected.includes(leave.id)}
                    disabled={isProcessing}
                    onChange={(event) =>
                      toggleSelected(leave.id, event.target.checked)
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
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
                    <p className="capitalize text-gray-700">
                      {formatLeaveType(leave.type)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Days
                    </p>
                    <p className="text-gray-700">
                      {eachDate(leave.fromDate, leave.toDate).length || "—"}
                    </p>
                  </div>
                </div>

                {(leave.reason || leave.employeeRemark) && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Reason:</span>{" "}
                    {leave.reason || leave.employeeRemark}
                  </p>
                )}

                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Admin remark"
                  value={remarkMap[leave.id] || ""}
                  disabled={isProcessing}
                  onChange={(event) =>
                    setRemarkMap((previous) => ({
                      ...previous,
                      [leave.id]: event.target.value
                    }))
                  }
                />

                <div className="flex gap-4 text-sm">
                  <button
                    disabled={isProcessing}
                    onClick={() => approveOne(leave)}
                    className="text-green-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rowProcessing ? "Processing..." : "Approve"}
                  </button>

                  <button
                    disabled={isProcessing}
                    onClick={() => rejectOne(leave)}
                    className="text-red-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= TABLE VIEW ================= */}
      {view === "table" && filteredItems.length > 0 && (
        <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3"></th>
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
                    Days
                  </th>
                  <th className="px-4 py-3 text-left">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left">
                    Remark
                  </th>
                  <th className="px-4 py-3 text-left">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((leave) => {
                  const rowProcessing = processingId === leave.id;

                  return (
                    <tr
                      key={leave.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(leave.id)}
                          disabled={isProcessing}
                          onChange={(event) =>
                            toggleSelected(
                              leave.id,
                              event.target.checked
                            )
                          }
                        />
                      </td>

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
                        {eachDate(leave.fromDate, leave.toDate).length || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={leave.status} />
                      </td>

                      <td className="px-4 py-3 min-w-56">
                        <input
                          className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                          placeholder="Admin remark"
                          value={remarkMap[leave.id] || ""}
                          disabled={isProcessing}
                          onChange={(event) =>
                            setRemarkMap((previous) => ({
                              ...previous,
                              [leave.id]: event.target.value
                            }))
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            disabled={isProcessing}
                            onClick={() => approveOne(leave)}
                            className="text-green-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {rowProcessing ? "Processing..." : "Approve"}
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={() => rejectOne(leave)}
                            className="text-red-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}