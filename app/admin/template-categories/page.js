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
   UI HELPERS
========================= */

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-50 disabled:text-gray-400";

const errorText = "text-xs text-red-600 mt-1";

const MAUChip = ({ label, tone = "slate" }) => {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700"
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-[3px] rounded-md text-[11px] font-medium ${
        toneMap[tone] || toneMap.slate
      }`}
    >
      {label}
    </span>
  );
};

const StatCard = ({ label, value }) => (
  <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-semibold text-gray-900 mt-1">{value}</p>
  </div>
);

/* =========================
   HELPERS
========================= */

const normalizeCategoryCode = value => {
  return (value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const getDateMs = value => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
};

export default function TemplateCategoriesPage() {
  const { user, loading: authLoading } = useAuth();

  /* =========================
     STATE
  ========================= */
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [pageError, setPageError] = useState("");
  const [formErrors, setFormErrors] = useState({});

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
    try {
      setLoading(true);
      setPageError("");

      const snap = await getDocs(collection(db, "templateCategories"));

      const rows = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getDateMs(b.createdAt) - getDateMs(a.createdAt));

      setCategories(rows);
    } catch (err) {
      setPageError(err.message || "Failed to load template categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  /* =========================
     DERIVED DATA
  ========================= */
  const stats = useMemo(() => {
    return {
      total: categories.length,
      active: categories.filter(c => c.active !== false).length,
      attachmentRequired: categories.filter(c => c.rules?.requireAttachment)
        .length
    };
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return categories.filter(c => {
      const name = c.name?.toLowerCase() || "";
      const code = c.code?.toLowerCase() || "";

      if (q && !name.includes(q) && !code.includes(q)) return false;

      if (type === "required" && !c.rules?.requireAttachment) return false;

      if (type === "not_required" && c.rules?.requireAttachment) return false;

      if (type === "active" && c.active === false) return false;

      if (type === "inactive" && c.active !== false) return false;

      return true;
    });
  }, [categories, search, type]);

  /* =========================
     VALIDATION
  ========================= */
  const validateCreate = () => {
    const errors = {};
    const normalizedCode = normalizeCategoryCode(form.code);

    if (!form.name.trim()) {
      errors.name = "Category name is required";
    }

    if (!normalizedCode) {
      errors.code = "Category code is required";
    }

    const duplicate = categories.some(
      c => normalizeCategoryCode(c.code) === normalizedCode
    );

    if (duplicate) {
      errors.code = "This category code already exists";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* =========================
     CREATE
  ========================= */
  const createCategory = async () => {
    if (!validateCreate()) return;

    try {
      setCreating(true);
      setPageError("");

      const normalizedCode = normalizeCategoryCode(form.code);

      await addDoc(collection(db, "templateCategories"), {
        name: form.name.trim(),
        code: normalizedCode,
        codeLower: normalizedCode.toLowerCase(),
        rules: {
          requireAttachment: Boolean(form.requireAttachment)
        },
        active: true,

        createdByUid: user?.uid || "",
        createdByEmail: user?.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setForm({
        name: "",
        code: "",
        requireAttachment: false
      });

      setFormErrors({});
      await load();
    } catch (err) {
      setPageError(err.message || "Failed to create category");
    } finally {
      setCreating(false);
    }
  };

  /* =========================
     SAVE EDIT
  ========================= */
  const saveEdit = async data => {
    if (!selected?.id) return;

    const normalizedCode = normalizeCategoryCode(data.code);

    if (!data.name?.trim()) {
      setPageError("Category name is required");
      return;
    }

    if (!normalizedCode) {
      setPageError("Category code is required");
      return;
    }

    const duplicate = categories.some(
      c =>
        c.id !== selected.id &&
        normalizeCategoryCode(c.code) === normalizedCode
    );

    if (duplicate) {
      setPageError("This category code already exists");
      return;
    }

    try {
      setSavingEdit(true);
      setPageError("");

      await updateDoc(doc(db, "templateCategories", selected.id), {
        name: data.name.trim(),
        code: normalizedCode,
        codeLower: normalizedCode.toLowerCase(),
        active: Boolean(data.active),
        rules: {
          requireAttachment: Boolean(data.requireAttachment)
        },

        updatedByUid: user?.uid || "",
        updatedByEmail: user?.email || "",
        updatedAt: serverTimestamp()
      });

      setSelected(null);
      await load();
    } catch (err) {
      setPageError(err.message || "Failed to update category");
    } finally {
      setSavingEdit(false);
    }
  };

  if (authLoading) {
    return (
      <main className="p-6">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    );
  }

  if (!user || !user.isAdmin) return null;

  return (
    <AdminGuard>
      <main className="p-6 space-y-5">
        {/* =========================
           HEADER
        ========================= */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-gray-800">
            Template Categories
          </h1>
          <p className="text-sm text-gray-500">
            Manage communication template groups and attachment rules.
          </p>
        </div>

        {/* =========================
           ERROR
        ========================= */}
        {pageError && (
          <div className="border border-red-100 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
            {pageError}
          </div>
        )}

        {/* =========================
           STATS
        ========================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Categories" value={stats.total} />
          <StatCard label="Active Categories" value={stats.active} />
          <StatCard
            label="Attachment Required"
            value={stats.attachmentRequired}
          />
        </div>

        {/* =========================
           2 COLUMN LAYOUT
        ========================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* =========================
             LEFT: CATEGORY LIST
          ========================= */}
          <div className="lg:col-span-2 space-y-4">
            <AdminTemplateCategoryFilters
              search={search}
              type={type}
              setSearch={setSearch}
              setType={setType}
              onExport={() => exportTemplateCategoriesCsv(filtered)}
            />

            <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
              {loading ? (
                <div className="px-4 py-10 text-center text-sm text-gray-500">
                  Loading categories...
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50/60 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Rules</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map(cat => (
                      <tr
                        key={cat.id}
                        className="border-b border-gray-100 hover:bg-gray-50/60"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">
                            {cat.name || "Untitled Category"}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {cat.code || "-"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          {cat.rules?.requireAttachment ? (
                            <MAUChip
                              label="Requires attachment"
                              tone="amber"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">
                              No attachment rule
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <MAUChip
                            label={cat.active === false ? "Inactive" : "Active"}
                            tone={cat.active === false ? "red" : "green"}
                          />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setPageError("");
                              setSelected(cat);
                            }}
                            className="text-blue-600 text-xs font-medium hover:underline"
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
                          className="px-4 py-10 text-center text-sm text-gray-500"
                        >
                          No categories found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* =========================
             RIGHT: CREATE CATEGORY
          ========================= */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 border border-gray-100 rounded-xl bg-white p-4">
              <div className="mb-4">
                <h2 className="font-semibold text-sm text-gray-800">
                  Create Category
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Category will be used while creating communication templates.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-gray-500">
                    Category Name
                  </label>
                  <input
                    placeholder="Example: Welcome Email"
                    value={form.name}
                    onChange={e => {
                      setForm(prev => ({
                        ...prev,
                        name: e.target.value
                      }));
                      setFormErrors(prev => ({
                        ...prev,
                        name: ""
                      }));
                    }}
                    className={inputClass}
                  />
                  {formErrors.name && (
                    <p className={errorText}>{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-500">
                    Category Code
                  </label>
                  <input
                    placeholder="Example: WELCOME_EMAIL"
                    value={form.code}
                    onChange={e => {
                      setForm(prev => ({
                        ...prev,
                        code: normalizeCategoryCode(e.target.value)
                      }));
                      setFormErrors(prev => ({
                        ...prev,
                        code: ""
                      }));
                    }}
                    className={inputClass}
                  />
                  {formErrors.code && (
                    <p className={errorText}>{formErrors.code}</p>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.requireAttachment}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        requireAttachment: e.target.checked
                      }))
                    }
                  />
                  Require attachment for this category
                </label>

                <button
                  onClick={createCategory}
                  disabled={creating}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create Category"}
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
            saving={savingEdit}
            onClose={() => {
              if (savingEdit) return;
              setSelected(null);
            }}
            onSave={saveEdit}
          />
        )}
      </main>
    </AdminGuard>
  );
}