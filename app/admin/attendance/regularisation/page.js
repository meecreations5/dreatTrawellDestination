"use client";

import { useCallback, useEffect, useState } from "react";
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
import EmptyState from "@/components/ui/EmptyState";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { deriveAttendanceStatus } from "@/lib/deriveAttendanceStatus";

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

function buildLocalDateTime(date, time) {
  if (!date || !time) return null;

  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(time).split(":").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function calcMinutes(date, inTime, outTime) {
  const checkInAt = buildLocalDateTime(date, inTime);
  let checkOutAt = buildLocalDateTime(date, outTime);

  if (!checkInAt || !checkOutAt) {
    return {
      valid: false,
      minutes: 0,
      checkInAt: null,
      checkOutAt: null,
      isOvernight: false
    };
  }

  let isOvernight = false;

  // Example: 2026-01-08 19:52 to 08:52 means checkout is on 2026-01-09.
  if (checkOutAt.getTime() < checkInAt.getTime()) {
    checkOutAt = new Date(checkOutAt);
    checkOutAt.setDate(checkOutAt.getDate() + 1);
    isOvernight = true;
  }

  const minutes = Math.floor(
    (checkOutAt.getTime() - checkInAt.getTime()) / 60000
  );

  return {
    valid: minutes > 0,
    minutes,
    checkInAt,
    checkOutAt,
    isOvernight
  };
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

export default function AdminRegularizationPage() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [remarkMap, setRemarkMap] = useState({});
  const [processingId, setProcessingId] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const allowed = isAdminUser(user);

  /* =========================
     LOAD DATA
  ========================= */

  const load = useCallback(async () => {
    try {
      setPageLoading(true);
      setError("");

      const usersMap = await loadUsersMap();

      const regularizationQuery = query(
        collection(db, "regularizations"),
        where("status", "==", "pending")
      );

      const snap = await getDocs(regularizationQuery);

      const rows = snap.docs
        .map((regularizationDoc) => {
          const data = regularizationDoc.data();
          const uid = getRequestUid(data);
          const matchedUser = usersMap[uid] || {};

          return {
            id: regularizationDoc.id,
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
          const appliedDiff =
            getTimestampMillis(b.appliedAt || b.createdAt) -
            getTimestampMillis(a.appliedAt || a.createdAt);

          if (appliedDiff !== 0) return appliedDiff;

          return String(b.date || "").localeCompare(String(a.date || ""));
        });

      setItems(rows);
    } catch (err) {
      console.error("Failed to load regularizations:", err);
      setError(
        err?.message ||
          "Unable to load pending regularization requests."
      );
    } finally {
      setPageLoading(false);
    }
  }, []);

  /* =========================
     EFFECT
  ========================= */

  useEffect(() => {
    if (loading) return;

    if (!user || !allowed) {
      setPageLoading(false);
      return;
    }

    load();
  }, [user, loading, allowed, load]);

  /* =========================
     ACTIONS
  ========================= */

  const approveOne = async (request) => {
    const remark = String(remarkMap[request.id] || "").trim();

    if (!remark) {
      alert("Admin remark required");
      return;
    }

    const uid = getRequestUid(request);

    if (!uid || !request.date) {
      alert("Invalid regularization request. UID or date is missing.");
      return;
    }

    const timeResult = calcMinutes(
      request.date,
      request.checkInTime,
      request.checkOutTime
    );

    if (!timeResult.valid) {
      alert("Invalid check-in/check-out time.");
      return;
    }

    try {
      setProcessingId(request.id);

      const regularizationRef = doc(db, "regularizations", request.id);
      const latestRegularizationSnap = await getDoc(regularizationRef);

      if (!latestRegularizationSnap.exists()) {
        alert("This regularization request no longer exists.");
        return;
      }

      const latestRegularization = latestRegularizationSnap.data();

      if (latestRegularization.status !== "pending") {
        alert("This request has already been processed.");
        await load();
        return;
      }

      const attendanceRef = doc(
        db,
        "attendance",
        `${uid}_${request.date}`
      );

      const attendanceSnap = await getDoc(attendanceRef);

      if (
        attendanceSnap.exists() &&
        attendanceSnap.data()?.status === "leave"
      ) {
        alert("Cannot regularize a leave day.");
        return;
      }

      const derivedStatus = deriveAttendanceStatus({
        totalMinutes: timeResult.minutes,
        isRegularized: true
      });

      const actualStatus = deriveAttendanceStatus({
        totalMinutes: timeResult.minutes,
        isRegularized: false
      });

      const batch = writeBatch(db);

      batch.set(
        attendanceRef,
        {
          uid,
          date: request.date,
          employeeId: request.employeeId || "",
          employeeName: request.name || "",
          sessions: [
            {
              checkInAt: timeResult.checkInAt,
              checkOutAt: timeResult.checkOutAt,
              minutes: timeResult.minutes,
              isOvernight: timeResult.isOvernight,
              source: "regularization"
            }
          ],
          totalMinutes: timeResult.minutes,
          status: derivedStatus,
          actualStatus,
          source: "regularization",
          isRegularized: true,
          regularized: true,
          regularizationId: request.id,
          regularizationType: request.type || "",
          regularizationReason: request.reason || "",
          regularizationAdminRemark: remark,
          regularizationApprovedBy: user.uid,
          regularizationApprovedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(attendanceSnap.exists()
            ? {}
            : { createdAt: serverTimestamp() })
        },
        { merge: true }
      );

      batch.update(regularizationRef, {
        status: "approved",
        adminRemark: remark,
        decisionReason: remark,
        actionBy: user.uid,
        actionByName: user.name || user.email || "",
        actionAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      setRemarkMap((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });

      await load();
    } catch (err) {
      console.error("Regularization approval failed:", err);
      alert(
        err?.message ||
          "Unable to approve regularization request."
      );
    } finally {
      setProcessingId("");
    }
  };

  const rejectOne = async (request) => {
    const remark = String(remarkMap[request.id] || "").trim();

    if (!remark) {
      alert("Admin remark required");
      return;
    }

    try {
      setProcessingId(request.id);

      const regularizationRef = doc(db, "regularizations", request.id);
      const latestRegularizationSnap = await getDoc(regularizationRef);

      if (!latestRegularizationSnap.exists()) {
        alert("This regularization request no longer exists.");
        return;
      }

      const latestRegularization = latestRegularizationSnap.data();

      if (latestRegularization.status !== "pending") {
        alert("This request has already been processed.");
        await load();
        return;
      }

      const batch = writeBatch(db);

      batch.update(regularizationRef, {
        status: "rejected",
        adminRemark: remark,
        decisionReason: remark,
        actionBy: user.uid,
        actionByName: user.name || user.email || "",
        actionAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      setRemarkMap((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });

      await load();
    } catch (err) {
      console.error("Regularization rejection failed:", err);
      alert(
        err?.message ||
          "Unable to reject regularization request."
      );
    } finally {
      setProcessingId("");
    }
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
          Attendance — Regularization
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and approve employee attendance correction requests.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No pending regularization requests"
          description="All attendance records are up to date"
        />
      ) : (
        <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left">
                    In
                  </th>
                  <th className="px-4 py-3 text-left">
                    Out
                  </th>
                  <th className="px-4 py-3 text-left">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-left">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left">
                    Admin Remark
                  </th>
                  <th className="px-4 py-3 text-left">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((request) => {
                  const isProcessing = processingId === request.id;
                  const anyProcessing = Boolean(processingId);

                  const timePreview = calcMinutes(
                    request.date,
                    request.checkInTime,
                    request.checkOutTime
                  );

                  return (
                    <tr
                      key={request.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {request.name || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {request.employeeId ||
                            request.email ||
                            "No employee ID"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {request.date || "—"}
                      </td>

                      <td className="px-4 py-3 capitalize">
                        {request.type?.replaceAll("_", " ") || "—"}
                      </td>

                      <td className="px-4 py-3">
                        {request.checkInTime || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          {request.checkOutTime || "—"}
                        </div>

                        {timePreview.isOvernight && (
                          <div className="text-[11px] text-amber-600 mt-0.5">
                            Next day
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {timePreview.valid
                          ? `${(timePreview.minutes / 60).toFixed(1)} hrs`
                          : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={request.status} />
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-gray-700 line-clamp-2">
                          {request.reason ||
                            request.employeeRemark ||
                            request.remark ||
                            "—"}
                        </div>
                      </td>

                      <td className="px-4 py-3 min-w-56">
                        <input
                          className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                          placeholder="Admin remark"
                          value={remarkMap[request.id] || ""}
                          disabled={anyProcessing}
                          onChange={(event) =>
                            setRemarkMap((previous) => ({
                              ...previous,
                              [request.id]: event.target.value
                            }))
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            disabled={anyProcessing}
                            onClick={() => approveOne(request)}
                            className="text-green-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? "Processing..." : "Approve"}
                          </button>

                          <button
                            disabled={anyProcessing}
                            onClick={() => rejectOne(request)}
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