"use client";

import { useEffect, useMemo, useState } from "react";
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
  serverTimestamp
} from "firebase/firestore";

import StatusBadge from "@/components/ui/StatusBadge";
import PageSkeleton from "@/components/ui/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import AdminLeaveApprovalFilters from "@/components/admin/AdminLeaveApprovalFilters";
import { deriveAttendanceStatus } from "@/lib/deriveAttendanceStatus";

/* =========================
   HELPERS
========================= */
function eachDate(from, to) {
  const dates = [];
  for (
    let d = new Date(from);
    d <= new Date(to);
    d.setDate(d.getDate() + 1)
  ) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function AdminLeaveApprovalPage() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [remarkMap, setRemarkMap] = useState({});
  const [selected, setSelected] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [view, setView] = useState("table");
  const [filters, setFilters] = useState({
    employee: "",
    fromDate: "",
    toDate: ""
  });

  /* =========================
     LOAD DATA
  ========================= */
  const load = async () => {
    setPageLoading(true);

    const q = query(
      collection(db, "leaves"),
      where("status", "==", "pending")
    );

    const snap = await getDocs(q);
    setItems(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
    );

    setSelected([]);
    setPageLoading(false);
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !user.isAdmin) {
      setPageLoading(false);
      return;
    }
    load();
  }, [user, loading]);

  /* =========================
     FILTERED ITEMS
  ========================= */
  const filteredItems = useMemo(() => {
    return items.filter(l => {
      if (
        filters.employee &&
        !l.name?.toLowerCase().includes(filters.employee.toLowerCase())
      )
        return false;

      if (filters.fromDate && l.fromDate < filters.fromDate)
        return false;

      if (filters.toDate && l.toDate > filters.toDate)
        return false;

      return true;
    });
  }, [items, filters]);

  /* =========================
     ACTIONS
  ========================= */
  const applyAttendanceLeave = async l => {
    for (const date of eachDate(l.fromDate, l.toDate)) {
      await setDoc(
        doc(db, "attendance", `${l.uid}_${date}`),
        {
          uid: l.uid,
          date,
          sessions: [],
          totalMinutes: 0,
          status: deriveAttendanceStatus({ isLeave: true }),
          source: "leave",
          leaveId: l.id,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  };

  const approveOne = async l => {
    const remark = remarkMap[l.id];
    if (!remark) return alert("Admin remark required");

    setProcessing(true);

    await updateDoc(doc(db, "leaves", l.id), {
      status: "approved",
      adminRemark: remark,
      actionBy: user.uid,
      actionAt: serverTimestamp()
    });

    await applyAttendanceLeave(l);

    setProcessing(false);
    load();
  };

  const rejectOne = async l => {
    const remark = remarkMap[l.id];
    if (!remark) return alert("Admin remark required");

    setProcessing(true);

    await updateDoc(doc(db, "leaves", l.id), {
      status: "rejected",
      adminRemark: remark,
      actionBy: user.uid,
      actionAt: serverTimestamp()
    });

    setProcessing(false);
    load();
  };

  const bulkApprove = async () => {
    setProcessing(true);
    for (const id of selected) {
      const l = items.find(i => i.id === id);
      if (!l || !remarkMap[id]) continue;
      await approveOne(l);
    }
    setProcessing(false);
  };

  const bulkReject = async () => {
    setProcessing(true);
    for (const id of selected) {
      const l = items.find(i => i.id === id);
      if (!l || !remarkMap[id]) continue;
      await rejectOne(l);
    }
    setProcessing(false);
  };

  /* =========================
     GUARDS
  ========================= */
  if (loading || pageLoading) return <PageSkeleton lines={6} />;

  if (!user?.isAdmin) {
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
      <h1 className="text-xl font-semibold">
        Leave Approval
      </h1>

      <AdminLeaveApprovalFilters
        view={view}
        setView={setView}
        filters={filters}
        setFilters={setFilters}
        selectedCount={selected.length}
        onBulkApprove={bulkApprove}
        onBulkReject={bulkReject}
      />

      {filteredItems.length === 0 && (
        <EmptyState
          title="No pending leave requests"
          description="Try adjusting filters"
        />
      )}

      {/* ================= CARD VIEW ================= */}
      {view === "card" && (
        <div className="space-y-3">
          {filteredItems.map(l => (
            <div
              key={l.id}
              className="bg-white rounded-xl border border-gray-100 p-4 space-y-2"
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-gray-500">{l.employeeId}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selected.includes(l.id)}
                  onChange={e =>
                    setSelected(s =>
                      e.target.checked
                        ? [...s, l.id]
                        : s.filter(i => i !== l.id)
                    )
                  }
                />
              </div>

              <StatusBadge status={l.status} />

              <p className="text-sm">
                {l.fromDate} → {l.toDate}
              </p>

              <p className="capitalize text-sm">{l.type}</p>

              <input
                className="border rounded px-2 py-1 w-full text-sm"
                placeholder="Admin remark"
                value={remarkMap[l.id] || ""}
                onChange={e =>
                  setRemarkMap({
                    ...remarkMap,
                    [l.id]: e.target.value
                  })
                }
              />

              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => approveOne(l)}
                  className="text-green-600 font-medium"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectOne(l)}
                  className="text-red-600 font-medium"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= TABLE VIEW ================= */}
      {view === "table" && filteredItems.length > 0 && (
        <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/60 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Remark</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map(l => (
                <tr
                  key={l.id}
                  className="border-b border-gray-100 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(l.id)}
                      onChange={e =>
                        setSelected(s =>
                          e.target.checked
                            ? [...s, l.id]
                            : s.filter(i => i !== l.id)
                        )
                      }
                    />
                  </td>

                  <td className="px-4 py-2">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-gray-500">{l.employeeId}</div>
                  </td>

                  <td className="px-4 py-2">
                    {l.fromDate} → {l.toDate}
                  </td>

                  <td className="px-4 py-2 capitalize">{l.type}</td>

                  <td className="px-4 py-2">
                    <StatusBadge status={l.status} />
                  </td>

                  <td className="px-4 py-2">
                    <input
                      className="border rounded px-2 py-1 w-full text-sm"
                      value={remarkMap[l.id] || ""}
                      onChange={e =>
                        setRemarkMap({
                          ...remarkMap,
                          [l.id]: e.target.value
                        })
                      }
                    />
                  </td>

                  <td className="px-4 py-2 space-x-3">
                    <button
                      onClick={() => approveOne(l)}
                      className="text-green-600 text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectOne(l)}
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
