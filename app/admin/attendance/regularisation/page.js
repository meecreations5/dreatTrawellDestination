"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp,
  getDoc
} from "firebase/firestore";

import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { deriveAttendanceStatus } from "@/lib/deriveAttendanceStatus";

/* =========================
   HELPERS
========================= */
function calcMinutes(inTime, outTime) {
  const [ih, im] = inTime.split(":").map(Number);
  const [oh, om] = outTime.split(":").map(Number);
  return Math.max(oh * 60 + om - (ih * 60 + im), 0);
}

export default function AdminRegularizationPage() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [remarkMap, setRemarkMap] = useState({});
  const [processing, setProcessing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  /* =========================
     LOAD DATA
  ========================= */
  const load = async () => {
    setPageLoading(true);

    const q = query(
      collection(db, "regularizations"),
      where("status", "==", "pending")
    );

    const snap = await getDocs(q);
    setItems(
      snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
    );

    setPageLoading(false);
  };

  /* =========================
     EFFECT
  ========================= */
  useEffect(() => {
    if (loading) return;

    if (!user || !user.isAdmin) {
      setPageLoading(false);
      return;
    }

    load();
  }, [user, loading]);

  /* =========================
     GUARDS
  ========================= */
  if (loading || pageLoading) {
    return <PageSkeleton lines={6} />;
  }

  if (!user || !user.isAdmin) {
    return (
      <main className="p-6 text-center text-red-600">
        Access denied
      </main>
    );
  }

  /* =========================
     ACTIONS
  ========================= */
  const approveOne = async r => {
    const remark = remarkMap[r.id];
    if (!remark) return alert("Admin remark required");

    setProcessing(true);

    const attendanceRef = doc(db, "attendance", `${r.uid}_${r.date}`);
    const attendanceSnap = await getDoc(attendanceRef);

    if (attendanceSnap.exists() && attendanceSnap.data().status === "leave") {
      alert("Cannot regularize a leave day");
      setProcessing(false);
      return;
    }

    const minutes = calcMinutes(r.checkInTime, r.checkOutTime);

    const derivedStatus = deriveAttendanceStatus({
      totalMinutes: minutes,
      isRegularized: true
    });

    await setDoc(
      attendanceRef,
      {
        uid: r.uid,
        date: r.date,
        sessions: [
          {
            checkInAt: new Date(`${r.date}T${r.checkInTime}`),
            checkOutAt: new Date(`${r.date}T${r.checkOutTime}`),
            minutes
          }
        ],
        totalMinutes: minutes,
        status: derivedStatus,
        source: "regularization",
        regularizationId: r.id,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await updateDoc(doc(db, "regularizations", r.id), {
      status: "approved",
      adminRemark: remark,
      actionBy: user.uid,
      actionAt: serverTimestamp()
    });

    setProcessing(false);
    load();
  };

  const rejectOne = async r => {
    const remark = remarkMap[r.id];
    if (!remark) return alert("Admin remark required");

    setProcessing(true);

    await updateDoc(doc(db, "regularizations", r.id), {
      status: "rejected",
      adminRemark: remark,
      actionBy: user.uid,
      actionAt: serverTimestamp()
    });

    setProcessing(false);
    load();
  };

  /* =========================
     UI (MATCHES attendance/page.js)
  ========================= */
  return (
    <main className="p-6 w-full mx-auto space-y-4">
      <h1 className="text-xl font-semibold">
        Attendance — Regularization
      </h1>

      {items.length === 0 ? (
        <EmptyState
          title="No pending regularization requests"
          description="All attendance records are up to date"
        />
      ) : (
        <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/60 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">In</th>
                <th className="px-4 py-3 text-left">Out</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Admin Remark</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {items.map(r => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {r?.name || "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r?.employeeId || ""}
                    </div>
                  </td>

                  <td className="px-4 py-2">{r?.date}</td>

                  <td className="px-4 py-2 capitalize">
                    {r?.type?.replaceAll("_", " ") || "—"}
                  </td>

                  <td className="px-4 py-2">{r?.checkInTime}</td>
                  <td className="px-4 py-2">{r?.checkOutTime}</td>

                  <td className="px-4 py-2">
                    <StatusBadge status={r?.status} />
                  </td>

                  <td className="px-4 py-2">
                    <input
                      className="border rounded px-2 py-1 w-full text-sm"
                      placeholder="Admin remark"
                      value={remarkMap[r.id] || ""}
                      onChange={e =>
                        setRemarkMap({
                          ...remarkMap,
                          [r.id]: e.target.value
                        })
                      }
                    />
                  </td>

                  <td className="px-4 py-2 space-x-3">
                    <button
                      disabled={processing}
                      onClick={() => approveOne(r)}
                      className="text-green-600 text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      disabled={processing}
                      onClick={() => rejectOne(r)}
                      className="text-red-600 text-sm font-medium"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
