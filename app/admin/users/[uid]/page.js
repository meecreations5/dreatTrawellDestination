"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useParams } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";

/* =========================
   STYLES
========================= */
const inputClass = `
  w-full border border-gray-200 rounded-lg
  px-3 py-2 text-sm bg-white
  focus:outline-none focus:ring-2 focus:ring-blue-100
`;

const errorText = "text-xs text-red-600 mt-1";

export default function EditUserPage() {
  const { uid } = useParams();
  const { user, loading } = useAuth(true);
  const router = useRouter();

  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  /* =========================
     GUARD
  ========================= */
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [loading, user, router]);

  /* =========================
     LOAD USER
  ========================= */
  useEffect(() => {
    const loadUser = async () => {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      setForm(snap.data());
    };

    if (user) loadUser();
  }, [user, uid]);

  if (loading || (!form && !notFound)) {
    return <p className="p-6">Loading…</p>;
  }

  if (notFound) {
    return (
      <main className="p-6">
        <p className="text-red-600 text-sm">
          User not found
        </p>
      </main>
    );
  }

  /* =========================
     VALIDATION
  ========================= */
  const validate = () => {
    const e = {};
    if (!form.name) e.name = "Name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (!validate()) return;

    try {
      setSaving(true);
      await updateDoc(doc(db, "users", uid), {
        name: form.name,
        mobile: form.mobile || "",
        role: form.role,
        active: form.active,
        isAdmin:
          form.role === "employee" ? !!form.isAdmin : false
      });
      router.replace("/admin/users");
    } catch (err) {
      setErrors({
        form: err.message || "Failed to update user"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminGuard>
      <main className="p-6 max-w-3xl mx-auto space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Edit Team Member
          </h1>
        </div>

        {/* FORM */}
        <div className="border border-gray-100 rounded-xl bg-white p-6 space-y-4">

          {errors.form && (
            <p className="text-sm text-red-600">
              {errors.form}
            </p>
          )}

          <div>
            <label className="text-xs text-gray-500">Employee ID</label>
            <input
              className={inputClass + " bg-gray-50"}
              value={form.employeeId || "—"}
              disabled
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">Email</label>
            <input
              className={inputClass + " bg-gray-50"}
              value={form.email}
              disabled
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">Full Name</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={e => {
                setForm({ ...form, name: e.target.value });
                setErrors({ ...errors, name: null });
              }}
            />
            {errors.name && <p className={errorText}>{errors.name}</p>}
          </div>

          <div>
            <label className="text-xs text-gray-500">Mobile</label>
            <input
              className={inputClass}
              value={form.mobile || ""}
              onChange={e =>
                setForm({ ...form, mobile: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">Role</label>
            <select
              className={inputClass}
              value={form.role}
              onChange={e =>
                setForm({
                  ...form,
                  role: e.target.value,
                  isAdmin: false
                })
              }
            >
              <option value="employee">Employee</option>
              <option value="associate">Associate</option>
              <option value="partner">Partner</option>
            </select>
          </div>

          {/* ADMIN ACCESS */}
          {form.role === "employee" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form.isAdmin}
                onChange={e =>
                  setForm({
                    ...form,
                    isAdmin: e.target.checked
                  })
                }
              />
              <span className="text-sm text-gray-700">
                Admin Access
              </span>
            </div>
          )}

          {/* ACTIVE */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e =>
                setForm({
                  ...form,
                  active: e.target.checked
                })
              }
            />
            <span className="text-sm text-gray-700">
              Active user
            </span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm rounded-md border border-gray-200"
          >
            Cancel
          </button>

          <button
            disabled={saving}
            onClick={save}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </main>
    </AdminGuard>
  );
}
