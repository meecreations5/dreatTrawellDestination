"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Crown,
  Handshake,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Users
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";

import {
  MODULE_PERMISSIONS,
  ROLE_OPTIONS,
  getPermissionsByRole,
  isManagementRole
} from "@/lib/rolePermissions";

const inputClass = `
  w-full rounded-xl border border-gray-200 bg-white
  px-4 py-2.5 text-sm text-gray-800
  placeholder:text-gray-400
  focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-50
  disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
`;

const labelClass = "text-xs font-medium text-gray-500";
const errorText = "mt-1 text-xs text-red-600";

const roleIcons = {
  super_admin: Crown,
  admin: ShieldCheck,
  employee: Users,
  associate: Handshake,
  partner: Building2
};

const providers = [
  {
    value: "google",
    label: "Google",
    description: "Allow login using Google account."
  },
  {
    value: "microsoft",
    label: "Microsoft",
    description: "Allow login using Microsoft account."
  }
];

function normalizeRole(data = {}) {
  if (data.role === "super_admin" || data.isSuperAdmin === true) {
    return "super_admin";
  }

  if (data.role === "admin") {
    return "admin";
  }

  if (data.isAdmin === true) {
    return "admin";
  }

  if (data.role === "associate") {
    return "associate";
  }

  if (data.role === "partner") {
    return "partner";
  }

  return "employee";
}

export default function EditUserPage() {
  const params = useParams();
  const uid = params?.uid;

  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState(null);
  const [originalUser, setOriginalUser] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isSelf = useMemo(() => {
    if (!user || !form || !uid) return false;

    return user.id === uid || user.uid === form.uid;
  }, [user, form, uid]);

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((role) => role.value === form?.role),
    [form?.role]
  );

  const selectedPermissions = useMemo(
    () => getPermissionsByRole(form?.role),
    [form?.role]
  );

  const SelectedRoleIcon = roleIcons[form?.role] || User;

  /* =========================
     LOAD USER
  ========================= */
  useEffect(() => {
    const loadUser = async () => {
      if (!uid || !user) return;

      try {
        setPageLoading(true);

        const snap = await getDoc(doc(db, "users", uid));

        if (!snap.exists()) {
          setNotFound(true);
          return;
        }

        const data = snap.data();
        const role = normalizeRole(data);
        const permissions = getPermissionsByRole(role);

        const normalizedUser = {
          id: snap.id,
          ...data,
          role,
          isAdmin: role === "super_admin" || role === "admin",
          isSuperAdmin: role === "super_admin",
          permissions,
          active: data.active !== false,
          authProvider: data.authProvider || "google",
          associateType: role === "associate" ? data.associateType || "" : ""
        };

        setOriginalUser(normalizedUser);
        setForm(normalizedUser);
      } catch (err) {
        console.error("LOAD USER ERROR:", err);
        setErrors({
          form: err?.message || "Failed to load user"
        });
      } finally {
        setPageLoading(false);
      }
    };

    if (!loading && user) {
      loadUser();
    }
  }, [uid, user, loading]);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));

    setErrors((prev) => ({
      ...prev,
      [key]: null,
      form: null
    }));
  };

  const updateRole = (role) => {
    if (isSelf) return;

    const permissions = getPermissionsByRole(role);

    setForm((prev) => ({
      ...prev,
      role,
      permissions,
      isAdmin: role === "super_admin" || role === "admin",
      isSuperAdmin: role === "super_admin",
      associateType: role === "associate" ? prev.associateType : ""
    }));

    setErrors((prev) => ({
      ...prev,
      role: null,
      associateType: null,
      form: null
    }));
  };

  /* =========================
     VALIDATION
  ========================= */
  const validate = () => {
    const e = {};

    const name = form?.name?.trim();
    const mobile = form?.mobile?.trim();

    if (!name) {
      e.name = "Full name is required";
    }

    if (mobile && !/^[0-9+\-\s()]{7,15}$/.test(mobile)) {
      e.mobile = "Enter a valid mobile number";
    }

    if (!["google", "microsoft"].includes(form.authProvider)) {
      e.authProvider = "Please select login provider";
    }

    if (!ROLE_OPTIONS.some((role) => role.value === form.role)) {
      e.role = "Please select user role";
    }

    if (form.role === "associate" && !form.associateType) {
      e.associateType = "Please select associate type";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (saving) return;
    if (!validate()) return;

    try {
      setSaving(true);

      const safeRole = isSelf ? originalUser.role : form.role;
      const permissions = getPermissionsByRole(safeRole);

      await updateDoc(doc(db, "users", uid), {
        name: form.name.trim(),
        mobile: form.mobile?.trim() || "",

        role: safeRole,
        isAdmin: safeRole === "super_admin" || safeRole === "admin",
        isSuperAdmin: safeRole === "super_admin",

        permissions,

        associateType:
          safeRole === "associate" ? form.associateType || "" : "",

        active: isSelf ? true : form.active === true,
        authProvider: form.authProvider || "google",

        updatedAt: new Date()
      });

      router.replace("/admin/users");
    } catch (err) {
      setErrors({
        form: err?.message || "Failed to update user"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || pageLoading || (!form && !notFound)) {
    return (
      <AdminGuard permission="userManagement">
        <main className="min-h-screen ">
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 h-4 w-1/3 rounded bg-gray-200" />
              <div className="space-y-3">
                <div className="h-10 rounded-xl bg-gray-100" />
                <div className="h-10 rounded-xl bg-gray-100" />
                <div className="h-10 rounded-xl bg-gray-100" />
              </div>
            </div>
          </div>
        </main>
      </AdminGuard>
    );
  }

  if (notFound) {
    return (
      <AdminGuard permission="userManagement">
        <main className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle className="h-7 w-7" />
            </div>

            <h1 className="text-xl font-semibold text-gray-900">
              User Not Found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              This user record does not exist or was deleted.
            </p>

            <button
              type="button"
              onClick={() => router.replace("/admin/users")}
              className="mt-6 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Users
            </button>
          </div>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard permission="userManagement">
      <main className="min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {/* HEADER */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={() => router.back()}
                className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <h1 className="text-2xl font-semibold text-gray-900">
                Edit User
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Update user profile, role and module permissions.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <SelectedRoleIcon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-medium text-blue-600">
                    Current Role
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedRole?.label || "Employee"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isSelf && (
            <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              You are editing your own account. Role and active status are locked
              to avoid losing access.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-6">
              {errors.form && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{errors.form}</p>
                </div>
              )}

              {/* BASIC DETAILS */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                    <User className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Basic Information
                    </h2>
                    <p className="text-sm text-gray-500">
                      User identity and contact details.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Employee ID</label>
                    <input
                      className={inputClass}
                      value={form.employeeId || "—"}
                      disabled
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Email</label>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        className={`${inputClass} pl-10`}
                        value={form.email || ""}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass}>Full Name</label>
                    <div className="relative mt-1">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        className={`${inputClass} pl-10`}
                        value={form.name || ""}
                        placeholder="Enter full name"
                        onChange={(e) => updateForm("name", e.target.value)}
                      />
                    </div>
                    {errors.name && <p className={errorText}>{errors.name}</p>}
                  </div>

                  <div>
                    <label className={labelClass}>Mobile</label>
                    <div className="relative mt-1">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        className={`${inputClass} pl-10`}
                        value={form.mobile || ""}
                        placeholder="+91 98765 43210"
                        onChange={(e) => updateForm("mobile", e.target.value)}
                      />
                    </div>
                    {errors.mobile && <p className={errorText}>{errors.mobile}</p>}
                  </div>

                  <div>
                    <label className={labelClass}>Login Provider</label>
                    <select
                      className={`${inputClass} mt-1`}
                      value={form.authProvider || "google"}
                      onChange={(e) =>
                        updateForm("authProvider", e.target.value)
                      }
                    >
                      {providers.map((provider) => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                    {errors.authProvider && (
                      <p className={errorText}>{errors.authProvider}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ROLE MANAGEMENT */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <Briefcase className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Role Management
                    </h2>
                    <p className="text-sm text-gray-500">
                      Change the role to automatically update permissions.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {ROLE_OPTIONS.map((role) => {
                    const Icon = roleIcons[role.value] || User;
                    const active = form.role === role.value;

                    return (
                      <button
                        key={role.value}
                        type="button"
                        disabled={isSelf}
                        onClick={() => updateRole(role.value)}
                        className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          active
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              active
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          {active && (
                            <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          )}
                        </div>

                        <p className="text-sm font-semibold text-gray-900">
                          {role.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          {role.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {errors.role && <p className={errorText}>{errors.role}</p>}

                {form.role === "associate" && (
                  <div className="mt-5">
                    <label className={labelClass}>Associate Type</label>
                    <select
                      className={`${inputClass} mt-1`}
                      value={form.associateType || ""}
                      disabled={isSelf}
                      onChange={(e) =>
                        updateForm("associateType", e.target.value)
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
              </div>

              {/* PERMISSIONS */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Module Permissions
                    </h2>

                    <p className="text-sm text-gray-500">
                      {form.role === "super_admin"
                        ? "Super Admin automatically gets access to all modules."
                        : form.role === "admin"
                        ? "Admin gets only Destination, Travel Agent, Communication and Document Management."
                        : "This role does not receive admin module access by default."}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    <Lock className="h-3.5 w-3.5" />
                    Auto assigned
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {MODULE_PERMISSIONS.map((item) => {
                    const allowed = Boolean(selectedPermissions[item.key]);

                    return (
                      <div
                        key={item.key}
                        className={`rounded-2xl border p-4 ${
                          allowed
                            ? "border-green-100 bg-green-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                allowed ? "text-green-800" : "text-gray-600"
                              }`}
                            >
                              {item.label}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              {item.description}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              allowed
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {allowed ? "Allowed" : "No Access"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SUMMARY */}
            <aside className="space-y-4">
              <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">
                  User Summary
                </h2>

                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-medium text-gray-500">Name</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {form.name?.trim() || "Not entered"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-medium text-gray-500">Email</p>
                    <p className="mt-1 break-all text-sm font-semibold text-gray-900">
                      {form.email || "Not entered"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs font-medium text-gray-500">Role</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedRole?.label || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs font-medium text-gray-500">
                        Provider
                      </p>
                      <p className="mt-1 text-sm font-semibold capitalize text-gray-900">
                        {form.authProvider || "google"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.active === true}
                        disabled={isSelf}
                        onChange={(e) =>
                          updateForm("active", e.target.checked)
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                      />

                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Active User
                        </p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          Inactive users should not be allowed to access the platform.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div
                    className={`rounded-2xl p-4 text-xs leading-5 ${
                      form.role === "super_admin"
                        ? "bg-purple-50 text-purple-700"
                        : form.role === "admin"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {form.role === "super_admin" &&
                      "Super Admin will get full access including Dashboard, User Management, Role Management and Settings."}

                    {form.role === "admin" &&
                      "Admin will not access the main dashboard. Admin gets only Destination, Travel Agent, Communication and Document Management."}

                    {!isManagementRole(form.role) &&
                      "This user will not receive admin module permissions by default."}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={save}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={saving}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}