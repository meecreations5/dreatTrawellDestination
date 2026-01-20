"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";

import AdminTemplateCategoryFilters from "@/components/admin/AdminTemplateCategoryFilters";
import TemplateCategoryDrawer from "@/components/admin/TemplateCategoryDrawer";
import { exportTemplateCategoriesCsv } from "@/lib/exportTemplateCategoriesCsv";

/* =========================
   MAU UI
========================= */

const MAUChip = ({ label }) => (
  <span className="px-2 py-[2px] rounded-md text-[11px] bg-slate-100 text-slate-700">
    {label}
  </span>
);

export default function TemplateCategoriesPage() {
  const { user } = useAuth();

  /* =========================
     STATE
  ========================= */
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);

  // filters
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  // create form
  const [form, setForm] = useState({
    name: "",
    code: "",
    requireAttachment: false
  });

  /* =========================
     LOAD
  ========================= */
  const load = async () => {
    const snap = await getDocs(collection(db, "templateCategories"));
    setCategories(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
    );
  };

  useEffect(() => {
    load();
  }, []);

  /* =========================
     FILTER
  ========================= */
  const filtered = useMemo(() => {
    return categories.filter(c => {
      if (
        search &&
        !c.name?.toLowerCase().includes(search.toLowerCase()) &&
        !c.code?.toLowerCase().includes(search.toLowerCase())
      )
        return false;

      if (type === "required" && !c.rules?.requireAttachment)
        return false;

      if (type === "not_required" && c.rules?.requireAttachment)
        return false;

      return true;
    });
  }, [categories, search, type]);

  /* =========================
     CREATE
  ========================= */
  const createCategory = async () => {
    if (!form.name || !form.code) {
      alert("Name and code required");
      return;
    }

    await addDoc(collection(db, "templateCategories"), {
      name: form.name,
      code: form.code,
      rules: {
        requireAttachment: form.requireAttachment
      },
      active: true,
      createdAt: serverTimestamp()
    });

    setForm({
      name: "",
      code: "",
      requireAttachment: false
    });

    load();
  };

  /* =========================
     SAVE EDIT
  ========================= */
  const saveEdit = async (data) => {
    await updateDoc(
      doc(db, "templateCategories", selected.id),
      {
        name: data.name,
        code: data.code,
        active: data.active,
        rules: {
          requireAttachment: data.requireAttachment
        },
        updatedAt: serverTimestamp()
      }
    );

    setSelected(null);
    load();
  };

  if (!user || !user.isAdmin) return null;

  return (
    <AdminGuard>
      <main className="p-6 space-y-5">

        <h1 className="text-xl font-semibold text-gray-800">
          Template Categories
        </h1>



        {/* =========================
           2 COLUMN LAYOUT
        ========================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* =========================
             LEFT: CATEGORY LIST
          ========================= */}
          <div className="lg:col-span-2">
            {/* FILTER BAR */}
            <AdminTemplateCategoryFilters
              search={search}
              type={type}
              setSearch={setSearch}
              setType={setType}
              onExport={() =>
                exportTemplateCategoriesCsv(filtered)
              }
            />
            <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/60 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left">
                      Rules
                    </th>
                    <th className="px-4 py-3 text-left">
                      Status
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(cat => (
                    <tr
                      key={cat.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {cat.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {cat.code}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {cat.rules?.requireAttachment && (
                          <MAUChip label="Requires attachment" />
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <MAUChip
                          label={cat.active ? "Active" : "Inactive"}
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(cat)}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        No categories found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* =========================
             RIGHT: CREATE CATEGORY (STICKY)
          ========================= */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 border border-gray-100 rounded-xl bg-white p-4">
              <h2 className="font-semibold text-sm mb-3">
                Create Category
              </h2>

              <div className="space-y-3 text-sm">
                <input
                  placeholder="Category name"
                  value={form.name}
                  onChange={e =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />

                <input
                  placeholder="Category code"
                  value={form.code}
                  onChange={e =>
                    setForm({ ...form, code: e.target.value })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.requireAttachment}
                    onChange={e =>
                      setForm({
                        ...form,
                        requireAttachment: e.target.checked
                      })
                    }
                  />
                  Require attachment
                </label>

                <button
                  onClick={createCategory}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs"
                >
                  Create Category
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================
           EDIT DRAWER
        ========================= */}
        {selected && (
          <TemplateCategoryDrawer
            category={selected}
            onClose={() => setSelected(null)}
            onSave={saveEdit}
          />
        )}
      </main>
    </AdminGuard>
  );
}
