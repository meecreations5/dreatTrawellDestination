"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";

import PageSkeleton from "@/components/ui/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import AdminLeaveFilters from "@/components/admin/AdminLeaveFilters";

/* =========================
   CSV EXPORT
========================= */
function exportCsv(rows) {
  if (!rows.length) return;

  const headers = [
    "Employee",
    "Employee ID",
    "From Date",
    "To Date",
    "Type",
    "Status",
    "Admin Remark"
  ];

  const csv = [
    headers.join(","),
    ...rows.map(r =>
      [
        r.name,
        r.employeeId,
        r.fromDate,
        r.toDate,
        r.type,
        r.status,
        r.adminRemark || ""
      ]
        .map(v => `"${v || ""}"`)
        .join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "leave-history.csv";
  a.click();

  URL.revokeObjectURL(url);
}

export default function AdminLeaveHistory() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [view, setView] = useState("table");

  const [filters, setFilters] = useState({
    status: "all",
    employee: "",
    fromDate: "",
    toDate: ""
  });

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    if (!user?.isAdmin) {
      setPageLoading(false);
      return;
    }

    const load = async () => {
      setPageLoading(true);

      const q = query(
        collection(db, "leaves"),
        orderBy("appliedAt", "desc")
      );

      const snap = await getDocs(q);
      setRows(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );

      setPageLoading(false);
    };

    load();
  }, [user]);

  /* =========================
     FILTERED ROWS
  ========================= */
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (
        filters.status !== "all" &&
        r.status !== filters.status
      )
        return false;

      if (
        filters.employee &&
        !r.name
          ?.toLowerCase()
          .includes(filters.employee.toLowerCase())
      )
        return false;

      if (filters.fromDate && r.fromDate < filters.fromDate)
        return false;

      if (filters.toDate && r.toDate > filters.toDate)
        return false;

      return true;
    });
  }, [rows, filters]);

  /* =========================
     GUARDS
  ========================= */
  if (loading || pageLoading) {
    return <PageSkeleton lines={6} />;
  }

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
        Leave History
      </h1>

      {/* FILTER + VIEW BAR (EXACT MATCH) */}
      <AdminLeaveFilters
        view={view}
        setView={setView}
        filters={filters}
        setFilters={setFilters}
        onExport={() => exportCsv(filteredRows)}
      />

      {/* EMPTY */}
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
          {filteredRows.map(l => (
            <div
              key={l.id}
              className="border border-gray-100 rounded-xl bg-white p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {l.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {l.employeeId}
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </div>

              <p className="text-sm text-gray-600">
                {l.fromDate} → {l.toDate}
              </p>

              <p className="text-sm capitalize">
                {l.type}
              </p>

              {l.adminRemark && (
                <p className="text-xs text-gray-500">
                  Remark: {l.adminRemark}
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
                  Remark
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map(l => (
                <tr
                  key={l.id}
                  className="border-b border-gray-100 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {l.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {l.employeeId}
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    {l.fromDate} → {l.toDate}
                  </td>

                  <td className="px-4 py-2 capitalize">
                    {l.type}
                  </td>

                  <td className="px-4 py-2">
                    <StatusBadge status={l.status} />
                  </td>

                  <td className="px-4 py-2 text-sm text-gray-600">
                    {l.adminRemark || "—"}
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
