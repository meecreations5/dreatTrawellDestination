"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";
import { createTeamUser } from "@/lib/createTeamUser";

/* =========================
   STYLES
========================= */
const inputClass = `
  w-full border border-gray-200 rounded-lg
  px-3 py-2 text-sm bg-white
  focus:outline-none focus:ring-2 focus:ring-blue-100
`;

const errorText = "text-xs text-red-600 mt-1";

export default function AddUserPage() {
  const { user, loading } = useAuth(true);
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    name: "",
    mobile: "",
    role: "employee",
    isAdmin: false,
    associateType: "",
    active: true // ✅ FIX
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  /* =========================
     GUARD
  ========================= */
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [loading, user, router]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (!user) return null;

  /* =========================
     VALIDATION
  ========================= */
  const validate = () => {
    const e = {};
    if (!form.email) e.email = "Email is required";
    if (!form.name) e.name = "Name is required";

    if (
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      e.email = "Invalid email address";
    }

    if (form.role === "associate" && !form.associateType) {
      e.associateType = "Please select associate type";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* =========================
     SUBMIT
  ========================= */
  const submit = async () => {
    if (!validate()) return;

    try {
      setSubmitting(true);
      await createTeamUser(form);
      router.replace("/admin/users");
    } catch (err) {
      setErrors({
        form: err.message || "Failed to create user"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminGuard>
      <main className="p-6 max-w-3xl mx-auto space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Add Team Member
          </h1>
          <p className="text-sm text-gray-500">
            Create a new internal user, associate, or partner
          </p>
        </div>

        {/* FORM */}
        <div className="border border-gray-100 rounded-xl bg-white p-6 space-y-4">

          {errors.form && (
            <p className="text-sm text-red-600">
              {errors.form}
            </p>
          )}

          {/* EMAIL */}
          <div>
            <label className="text-xs text-gray-500">Email</label>
            <input
              className={inputClass}
              value={form.email}
              onChange={e => {
                setForm({ ...form, email: e.target.value });
                setErrors({ ...errors, email: null });
              }}
            />
            {errors.email && <p className={errorText}>{errors.email}</p>}
          </div>

          {/* NAME */}
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

          {/* MOBILE */}
          <div>
            <label className="text-xs text-gray-500">Mobile</label>
            <input
              className={inputClass}
              value={form.mobile}
              onChange={e =>
                setForm({ ...form, mobile: e.target.value })
              }
            />
          </div>

          {/* ROLE */}
          <div>
            <label className="text-xs text-gray-500">Role</label>
            <select
              className={inputClass}
              value={form.role}
              onChange={e =>
                setForm({
                  ...form,
                  role: e.target.value,
                  isAdmin: false,
                  associateType: ""
                })
              }
            >
              <option value="employee">Employee</option>
              <option value="associate">Associate</option>
              <option value="partner">Partner</option>
            </select>
          </div>

          {/* ASSOCIATE TYPE */}
          {form.role === "associate" && (
            <div>
              <label className="text-xs text-gray-500">Associate Type</label>
              <select
                className={inputClass}
                value={form.associateType}
                onChange={e =>
                  setForm({
                    ...form,
                    associateType: e.target.value
                  })
                }
              >
                <option value="">Select type</option>
                <option value="freelancer">Freelancer</option>
                <option value="consultant">Consultant</option>
                <option value="self-employed">Self Employed</option>
              </select>
              {errors.associateType && (
                <p className={errorText}>{errors.associateType}</p>
              )}
            </div>
          )}

          {/* ADMIN ACCESS */}
          {form.role === "employee" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isAdmin}
                onChange={e =>
                  setForm({ ...form, isAdmin: e.target.checked })
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
                setForm({ ...form, active: e.target.checked })
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
            disabled={submitting}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create User"}
          </button>
        </div>
      </main>
    </AdminGuard>
  );
}
