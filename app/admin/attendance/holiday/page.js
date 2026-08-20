"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

import PageSkeleton from "@/components/ui/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import AdminHolidayFilters from "@/components/admin/AdminHolidayFilters";

/* =========================
   HOLIDAY → ATTENDANCE SYNC
========================= */
async function applyHolidayToAttendance(date) {
  const usersSnap = await getDocs(collection(db, "users"));

  for (const u of usersSnap.docs) {
    const user = u.data();
    if (user.active === false) continue;

    await setDoc(
      doc(db, "attendance", `${u.id}_${date}`),
      {
        uid: u.id,
        date,
        sessions: [],
        totalMinutes: 0,
        status: "holiday",
        source: "holiday",
        holidayId: date,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }
}

async function removeHolidayFromAttendance(date) {
  const usersSnap = await getDocs(collection(db, "users"));

  for (const u of usersSnap.docs) {
    await deleteDoc(
      doc(db, "attendance", `${u.id}_${date}`)
    ).catch(() => { });
  }
}

/* =========================
   CSV EXPORT
========================= */
function exportHolidaysCsv(rows) {
  if (!rows.length) return;

  const headers = ["Date", "Holiday", "Type"];
  const data = rows.map(h => [h.date, h.name, h.type]);

  const csv = [headers, ...data]
    .map(r => r.map(v => `"${v}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "holidays.csv";
  a.click();

  URL.revokeObjectURL(url);
}

export default function AdminHolidayPage() {
  const { user, loading } = useAuth();

  const [holidays, setHolidays] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);

  /* FILTER STATE */
  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState([]);

  /* ADD FORM */
  const [form, setForm] = useState({
    date: "",
    name: "",
    type: "general"
  });

  /* EDIT */
  const [editingDate, setEditingDate] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "general"
  });

  /* =========================
     LOAD
  ========================= */
  const load = async () => {
    setPageLoading(true);
    const snap = await getDocs(collection(db, "holidays"));
    setHolidays(snap.docs.map(d => d.data()));
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
     YEAR OPTIONS
  ========================= */
  const years = useMemo(() => {
    const ys = new Set(
      holidays.map(h => h.date?.slice(0, 4))
    );
    ys.add(currentYear);
    return Array.from(ys).sort().reverse();
  }, [holidays, currentYear]);

  /* =========================
     FILTER
  ========================= */
  const filteredHolidays = useMemo(() => {
    return holidays
      .filter(h => h.date?.startsWith(year))
      .filter(h => {
        if (search && !h.name?.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        if (type !== "all" && h.type !== type) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, year, search, type]);

  /* =========================
     ACTIONS
  ========================= */
  const addHoliday = async () => {
    if (!form.date || !form.name) {
      alert("Date and holiday name required");
      return;
    }

    await setDoc(doc(db, "holidays", form.date), {
      date: form.date,
      name: form.name,
      type: form.type,
      createdAt: serverTimestamp()
    });

    await applyHolidayToAttendance(form.date);

    setForm({ date: "", name: "", type: "general" });
    load();
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.length} holidays?`)) return;

    for (const date of selected) {
      await deleteDoc(doc(db, "holidays", date));
      await removeHolidayFromAttendance(date);
    }
    load();
  };

  /* =========================
     STATES
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
     UI
  ========================= */
  return (
    <main className="p-6 w-full mx-auto space-y-4">
      <h1 className="text-xl font-semibold">
        Holiday Management
      </h1>


      {/* CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">


        {/* LEFT – LIST */}
        <div>
          {/* FILTER BAR */}
          <AdminHolidayFilters
            year={year}
            years={years}
            search={search}
            type={type}
            setYear={setYear}
            setSearch={setSearch}
            setType={setType}
            selectedCount={selected.length}
            onBulkDelete={bulkDelete}
            onExport={() => exportHolidaysCsv(filteredHolidays)}
          />
          {filteredHolidays.length === 0 ? (
            <EmptyState
              title="No holidays found"
              description="Change year or add new holiday"
            />
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={
                          selected.length === filteredHolidays.length
                        }
                        onChange={e =>
                          setSelected(
                            e.target.checked
                              ? filteredHolidays.map(h => h.date)
                              : []
                          )
                        }
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Holiday</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHolidays.map(h => (
                    <tr key={h.date} className="border-b">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(h.date)}
                          onChange={e =>
                            setSelected(s =>
                              e.target.checked
                                ? [...s, h.date]
                                : s.filter(d => d !== h.date)
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">{h.date}</td>
                      <td className="px-3 py-2">{h.name}</td>
                      <td className="px-3 py-2">
                        <StatusChip label={h.type} color="blue" />
                      </td>
                      <td className="px-3 py-2 text-xs space-x-2">
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this holiday?")) return;
                            await deleteDoc(doc(db, "holidays", h.date));
                            await removeHolidayFromAttendance(h.date);
                            load();
                          }}
                          className="text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT – ADD FORM */}
        <div className="sticky top-24 h-fit">
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <h2 className="font-medium text-sm">
              Add Holiday
            </h2>

            <input
              type="date"
              className="w-full text-sm px-3 py-2 border border-gray-100 rounded-lg"
              value={form.date}
              onChange={e =>
                setForm({ ...form, date: e.target.value })
              }
            />

            <input
              placeholder="Holiday name"
              className="w-full text-sm px-3 py-2 border border-gray-100 rounded-lg"
              value={form.name}
              onChange={e =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <select
              className="w-full text-sm px-3 py-2 border border-gray-100 rounded-lg"
              value={form.type}
              onChange={e =>
                setForm({ ...form, type: e.target.value })
              }
            >
              <option value="general">General</option>
              <option value="national">National</option>
              <option value="optional">Optional</option>
            </select>

            <button
              onClick={addHoliday}
              className="w-full bg-blue-600 text-white rounded-lg text-sm py-2"
            >
              Add Holiday
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
