"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
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
  ADMIN_MODULES,
  ROLE_OPTIONS,
  canAccess,
  getAdminModulesForRole,
  isSuperAdmin as isSuperAdminUser
} from "@/lib/rolePermissions";
import { updateUserAccess } from "@/lib/updateUserAccess";

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
  manager: Users,
  employee: Users,
  operation_executive: Briefcase,
  associate: Handshake,
  partner: Building2,
  finance: Briefcase
};

function normalizeRole(data = {}) {
  if (data.role === "super_admin" || data.isSuperAdmin === true) return "super_admin";
  if (data.role === "admin" || data.isAdmin === true) return "admin";
  if (["manager", "operation_executive", "associate", "partner", "finance"].includes(data.role)) return data.role;
  return "employee";
}

function getTeamAccessText() {
  return "Dashboard, Travel Agents, Engagements, Meetings, Leads, Quotations and normal follow-up work are available automatically to every active user.";
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
  const [saved, setSaved] = useState(false);

  const isSelf = useMemo(() => {
    if (!user || !form || !uid) return false;
    return user.id === uid || (user.uid && form.uid && user.uid === form.uid);
  }, [user, form, uid]);

  const actorIsSuperAdmin = isSuperAdminUser(user);
  const targetIsSuperAdmin = form?.role === "super_admin" || form?.isSuperAdmin === true;
  const targetSuperAdminLocked = targetIsSuperAdmin && !actorIsSuperAdmin;
  const canEditUser = canAccess(user, "users.edit");
  const canManageRole = canAccess(user, "users.manage_role");

  const availableRoles = useMemo(
    () => ROLE_OPTIONS.filter(role => role.value !== "super_admin" || actorIsSuperAdmin || form?.role === "super_admin"),
    [actorIsSuperAdmin, form?.role]
  );

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find(role => role.value === form?.role),
    [form?.role]
  );

  const adminModuleKeys = useMemo(
    () => getAdminModulesForRole(form?.role),
    [form?.role]
  );

  const adminModules = useMemo(
    () => ADMIN_MODULES.filter(module => adminModuleKeys.includes(module.key)),
    [adminModuleKeys]
  );

  const SelectedRoleIcon = roleIcons[form?.role] || User;

  useEffect(() => {
    async function loadUser() {
      if (!uid || !user) return;

      try {
        setPageLoading(true);
        setErrors({});
        const snap = await getDoc(doc(db, "users", uid));

        if (!snap.exists()) {
          setNotFound(true);
          return;
        }

        const data = snap.data();
        const role = normalizeRole(data);
        const normalized = {
          id: snap.id,
          ...data,
          role,
          isAdmin: role === "super_admin" || role === "admin",
          isSuperAdmin: role === "super_admin",
          active: data.active !== false,
          teamName:
            data.teamName ||
            (typeof data.team === "string" ? data.team : data.departmentName || ""),
          authProvider: data.authProvider || "google",
          associateType: role === "associate" ? data.associateType || "" : ""
        };

        setOriginalUser(normalized);
        setForm(normalized);
      } catch (error) {
        console.error("LOAD USER ERROR:", error);
        setErrors({ form: error?.message || "Failed to load user" });
      } finally {
        setPageLoading(false);
      }
    }

    if (!loading && user) loadUser();
  }, [uid, user?.uid, loading]);

  function updateForm(key, value) {
    setSaved(false);
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: null, form: null }));
  }

  function updateRole(role) {
    if (isSelf || !canManageRole || targetSuperAdminLocked) return;
    if (role === "super_admin" && !actorIsSuperAdmin) return;

    setSaved(false);
    setForm(prev => ({
      ...prev,
      role,
      isAdmin: role === "super_admin" || role === "admin",
      isSuperAdmin: role === "super_admin",
      active: role === "super_admin" ? true : prev.active !== false,
      associateType: role === "associate" ? prev.associateType : ""
    }));
    setErrors(prev => ({ ...prev, role: null, associateType: null, form: null }));
  }

  function validate() {
    const next = {};
    const name = String(form?.name || "").trim();
    const mobile = String(form?.mobile || "").trim();

    if (!name) next.name = "Full name is required";
    if (mobile && !/^[0-9+\-\s()]{7,15}$/.test(mobile)) {
      next.mobile = "Enter a valid mobile number";
    }
    if (!["google", "microsoft"].includes(form?.authProvider)) {
      next.authProvider = "Please select login provider";
    }
    if (!ROLE_OPTIONS.some(role => role.value === form?.role)) {
      next.role = "Please select user role";
    }
    if (form?.role === "associate" && !form?.associateType) {
      next.associateType = "Please select associate type";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!form || saving || !validate()) return;

    const roleChanged = form.role !== originalUser?.role;
    const activeChanged = form.active !== originalUser?.active;

    if (isSelf && (roleChanged || activeChanged)) {
      setErrors({ form: "You cannot change your own role or active status." });
      return;
    }

    if (roleChanged && !canManageRole) {
      setErrors({ form: "Your role does not allow changing user roles." });
      return;
    }

    if (targetSuperAdminLocked) {
      setErrors({ form: "Only a Super Admin can modify another Super Admin." });
      return;
    }

    try {
      setSaving(true);
      setSaved(false);

      await updateUserAccess({
        userId: uid,
        name: String(form.name || "").trim(),
        mobile: String(form.mobile || "").trim(),
        teamName: String(form.teamName || "").trim(),
        role: form.role,
        active: form.role === "super_admin" ? true : form.active !== false,
        authProvider: form.authProvider,
        associateType: form.role === "associate" ? form.associateType : "",
        changeReason: roleChanged ? `Role changed from ${originalUser?.role || "unknown"} to ${form.role}` : "User profile updated"
      });

      const nextOriginal = {
        ...form,
        active: form.role === "super_admin" ? true : form.active !== false,
        isAdmin: form.role === "super_admin" || form.role === "admin",
        isSuperAdmin: form.role === "super_admin"
      };
      setForm(nextOriginal);
      setOriginalUser(nextOriginal);
      setSaved(true);
    } catch (error) {
      setErrors({ form: error?.message || "Failed to save user" });
    } finally {
      setSaving(false);
    }
  }

  if (loading || pageLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Loading user...
        </div>
      </main>
    );
  }

  if (notFound || !form) {
    return (
      <AdminGuard permission="users.view">
        <main className="min-h-screen bg-gray-50 p-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center">
            <h1 className="text-lg font-semibold text-gray-900">User not found</h1>
            <button onClick={() => router.push("/admin/users")} className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Back to Team Management
            </button>
          </div>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard permission="users.view">
      <main className="min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Edit User</h1>
              <p className="mt-1 text-sm text-gray-500">Update profile, role and active status. Access is controlled automatically by role.</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <SelectedRoleIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-600">Current Role</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedRole?.label || "Employee"}</p>
                </div>
              </div>
            </div>
          </div>

          {errors.form ? (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{errors.form}</p>
            </div>
          ) : null}

          {saved ? (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>User updated successfully.</p>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"><User className="h-5 w-5" /></div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Basic Information</h2>
                    <p className="text-sm text-gray-500">User identity and contact details.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Employee ID</label>
                    <input className={`${inputClass} mt-1`} value={form.employeeId || ""} disabled />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input className={`${inputClass} pl-10`} value={form.email || ""} disabled />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Full Name</label>
                    <input className={`${inputClass} mt-1`} value={form.name || ""} disabled={!canEditUser} onChange={event => updateForm("name", event.target.value)} />
                    {errors.name ? <p className={errorText}>{errors.name}</p> : null}
                  </div>
                  <div>
                    <label className={labelClass}>Team / Department</label>
                    <div className="relative mt-1">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input className={`${inputClass} pl-10`} value={form.teamName || ""} disabled={!canEditUser} placeholder="e.g. Sales, Operations" onChange={event => updateForm("teamName", event.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Mobile</label>
                    <div className="relative mt-1">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input className={`${inputClass} pl-10`} value={form.mobile || ""} disabled={!canEditUser} onChange={event => updateForm("mobile", event.target.value)} />
                    </div>
                    {errors.mobile ? <p className={errorText}>{errors.mobile}</p> : null}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Login Provider</label>
                    <select className={`${inputClass} mt-1`} value={form.authProvider} disabled={!canEditUser} onChange={event => updateForm("authProvider", event.target.value)}>
                      <option value="google">Google</option>
                      <option value="microsoft">Microsoft</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-base font-semibold text-gray-900">Role</h2>
                  <p className="mt-1 text-sm text-gray-500">Choose one role. Team/User access is automatic; the role only decides Admin access.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {availableRoles.map(role => {
                    const Icon = roleIcons[role.value] || User;
                    const active = form.role === role.value;
                    const disabled = isSelf || !canManageRole || targetSuperAdminLocked || (role.value === "super_admin" && !actorIsSuperAdmin);
                    return (
                      <button key={role.value} type="button" disabled={disabled} onClick={() => updateRole(role.value)} className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"}`}>
                        <div className="mb-3 flex items-center justify-between">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}><Icon className="h-5 w-5" /></div>
                          {active ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : null}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{role.label}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{role.description}</p>
                      </button>
                    );
                  })}
                </div>

                {errors.role ? <p className={errorText}>{errors.role}</p> : null}

                {form.role === "associate" ? (
                  <div className="mt-5">
                    <label className={labelClass}>Associate Type</label>
                    <select className={`${inputClass} mt-1`} value={form.associateType || ""} disabled={!canEditUser} onChange={event => updateForm("associateType", event.target.value)}>
                      <option value="">Select type</option>
                      <option value="freelancer">Freelancer</option>
                      <option value="consultant">Consultant</option>
                      <option value="self-employed">Self Employed</option>
                    </select>
                    {errors.associateType ? <p className={errorText}>{errors.associateType}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Access Summary</h2>
                <p className="mt-1 text-sm text-gray-500">No individual permission setup is required.</p>

                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Team/User Access — Included</p>
                      <p className="mt-1 text-xs leading-5 text-emerald-700">{getTeamAccessText()}</p>
                      <p className="mt-2 text-xs font-medium text-emerald-800">Travel Agent rule: normal users can claim an unassigned agent for themselves. Manager/Admin/Super Admin can reassign.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">Admin Access</p>
                  {adminModules.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {adminModules.map(module => (
                        <span key={module.key} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700">{module.label}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs leading-5 text-blue-700">No Admin workspace access. This role uses the Team/User workspace only.</p>
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">User Summary</h2>
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Name</p><p className="mt-1 text-sm font-semibold text-gray-900">{String(form.name || "").trim() || "Not entered"}</p></div>
                  <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Email</p><p className="mt-1 break-all text-sm font-semibold text-gray-900">{form.email || "Not entered"}</p></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Role</p><p className="mt-1 text-sm font-semibold text-gray-900">{selectedRole?.label || "-"}</p></div>
                    <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Provider</p><p className="mt-1 text-sm font-semibold capitalize text-gray-900">{form.authProvider}</p></div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={form.active === true} disabled={isSelf || !canEditUser || targetIsSuperAdmin} onChange={event => updateForm("active", event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed" />
                      <div><p className="text-sm font-semibold text-gray-900">Active User</p><p className="mt-1 text-xs leading-5 text-gray-500">Inactive users cannot access the CRM.</p></div>
                    </label>
                  </div>

                  <div className={`rounded-2xl p-4 text-xs leading-5 ${adminModules.length ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"}`}>
                    {adminModules.length ? `${selectedRole?.label || "This role"} gets ${adminModules.length} Admin module${adminModules.length === 1 ? "" : "s"}.` : "This role uses the Team/User workspace only."}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <button type="button" disabled={saving || (!canEditUser && !canManageRole)} onClick={save} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
                  </button>
                  <button type="button" onClick={() => router.back()} disabled={saving} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60">Cancel</button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}
