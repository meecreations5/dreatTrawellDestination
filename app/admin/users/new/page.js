"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

import AdminGuard from "@/components/AdminGuard";
import { createTeamUser } from "@/lib/createTeamUser";
import {
  ADMIN_MODULES,
  ROLE_OPTIONS,
  getAdminModulesForRole,
  isSuperAdmin as isSuperAdminUser
} from "@/lib/rolePermissions";
import { useAuth } from "@/hooks/useAuth";

const inputClass = `
  w-full rounded-xl border border-gray-200 bg-white
  px-4 py-2.5 text-sm text-gray-800
  placeholder:text-gray-400
  focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-50
`;
const labelClass = "text-xs font-medium text-gray-500";
const errorText = "mt-1 text-xs text-red-600";

function getTeamAccessText(role) {
  if (role === "employee") {
    return "Travel Agents, Engagements, Meetings and Destinations. Qualified Leads can be created from Engagement/Meeting for handover, without direct Lead workspace access.";
  }
  if (role === "operation_executive") {
    return "Travel Agents, Engagements, Meetings, Leads and Destinations, including the Lead & Operations work queue.";
  }
  return "Dashboard and the standard CRM workspace are available according to the selected role.";
}

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

export default function AddUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [form, setForm] = useState({
    email: "",
    name: "",
    mobile: "",
    teamName: "",
    role: "employee",
    associateType: "",
    active: true,
    authProvider: "google"
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const availableRoles = useMemo(
    () => ROLE_OPTIONS.filter(role => role.value !== "super_admin" || isSuperAdminUser(currentUser)),
    [currentUser]
  );

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find(role => role.value === form.role),
    [form.role]
  );

  const adminModules = useMemo(() => {
    const allowed = getAdminModulesForRole(form.role);
    return ADMIN_MODULES.filter(module => allowed.includes(module.key));
  }, [form.role]);

  const SelectedRoleIcon = roleIcons[form.role] || User;

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: null, form: null }));
  }

  function updateRole(role) {
    setForm(prev => ({
      ...prev,
      role,
      active: role === "super_admin" ? true : prev.active,
      associateType: role === "associate" ? prev.associateType : ""
    }));
    setErrors(prev => ({ ...prev, role: null, associateType: null, form: null }));
  }

  function validate() {
    const next = {};
    const email = form.email.trim();
    const name = form.name.trim();
    const mobile = form.mobile.trim();

    if (!email) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Invalid email address";
    if (!name) next.name = "Full name is required";
    if (mobile && !/^[0-9+\-\s()]{7,15}$/.test(mobile)) next.mobile = "Enter a valid mobile number";
    if (!["google", "microsoft"].includes(form.authProvider)) next.authProvider = "Please select login provider";
    if (!availableRoles.some(role => role.value === form.role)) next.role = "Please select user role";
    if (form.role === "associate" && !form.associateType) next.associateType = "Please select associate type";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting || !validate()) return;

    try {
      setSubmitting(true);
      await createTeamUser({
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        teamName: form.teamName.trim(),
        role: form.role,
        associateType: form.role === "associate" ? form.associateType : "",
        active: form.role === "super_admin" ? true : form.active,
        authProvider: form.authProvider
      });
      router.replace("/admin/users");
    } catch (error) {
      setErrors({ form: error?.message || "Failed to create user. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminGuard permission="users.create">
      <main className="min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Add User</h1>
              <p className="mt-1 text-sm text-gray-500">Create the user and choose a role. Access is assigned automatically.</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><SelectedRoleIcon className="h-5 w-5" /></div>
                <div><p className="text-xs font-medium text-blue-600">Selected Role</p><p className="text-sm font-semibold text-gray-900">{selectedRole?.label || "Employee"}</p></div>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-6">
              {errors.form ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{errors.form}</p></div>
              ) : null}

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"><User className="h-5 w-5" /></div>
                  <div><h2 className="text-base font-semibold text-gray-900">Basic Information</h2><p className="text-sm text-gray-500">User identity and contact details.</p></div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Full Name</label>
                    <input className={`${inputClass} mt-1`} value={form.name} placeholder="Enter full name" onChange={event => updateForm("name", event.target.value)} />
                    {errors.name ? <p className={errorText}>{errors.name}</p> : null}
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <div className="relative mt-1"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input className={`${inputClass} pl-10`} value={form.email} placeholder="name@company.com" onChange={event => updateForm("email", event.target.value)} /></div>
                    {errors.email ? <p className={errorText}>{errors.email}</p> : null}
                  </div>
                  <div>
                    <label className={labelClass}>Team / Department</label>
                    <div className="relative mt-1"><Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input className={`${inputClass} pl-10`} value={form.teamName} placeholder="e.g. Sales, Operations" onChange={event => updateForm("teamName", event.target.value)} /></div>
                  </div>
                  <div>
                    <label className={labelClass}>Mobile</label>
                    <div className="relative mt-1"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input className={`${inputClass} pl-10`} value={form.mobile} placeholder="+91 98765 43210" onChange={event => updateForm("mobile", event.target.value)} /></div>
                    {errors.mobile ? <p className={errorText}>{errors.mobile}</p> : null}
                  </div>
                  <div>
                    <label className={labelClass}>Login Provider</label>
                    <select className={`${inputClass} mt-1`} value={form.authProvider} onChange={event => updateForm("authProvider", event.target.value)}>
                      <option value="google">Google</option>
                      <option value="microsoft">Microsoft</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5"><h2 className="text-base font-semibold text-gray-900">Role</h2><p className="mt-1 text-sm text-gray-500">Role controls Admin access. Every active user automatically gets the normal Team/User workspace.</p></div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {availableRoles.map(role => {
                    const Icon = roleIcons[role.value] || User;
                    const active = form.role === role.value;
                    return (
                      <button key={role.value} type="button" onClick={() => updateRole(role.value)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"}`}>
                        <div className="mb-3 flex items-center justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}><Icon className="h-5 w-5" /></div>{active ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : null}</div>
                        <p className="text-sm font-semibold text-gray-900">{role.label}</p><p className="mt-1 text-xs leading-5 text-gray-500">{role.description}</p>
                      </button>
                    );
                  })}
                </div>
                {errors.role ? <p className={errorText}>{errors.role}</p> : null}

                {form.role === "associate" ? (
                  <div className="mt-5"><label className={labelClass}>Associate Type</label><select className={`${inputClass} mt-1`} value={form.associateType} onChange={event => updateForm("associateType", event.target.value)}><option value="">Select type</option><option value="freelancer">Freelancer</option><option value="consultant">Consultant</option><option value="self-employed">Self Employed</option></select>{errors.associateType ? <p className={errorText}>{errors.associateType}</p> : null}</div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Access Summary</h2>
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Team/User Access — Included</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">{getTeamAccessText(form.role)}</p>
                </div>
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">Admin Access</p>
                  {adminModules.length ? <div className="mt-3 flex flex-wrap gap-2">{adminModules.map(module => <span key={module.key} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700">{module.label}</span>)}</div> : <p className="mt-1 text-xs leading-5 text-blue-700">No Admin workspace access.</p>}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">User Summary</h2>
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Name</p><p className="mt-1 text-sm font-semibold text-gray-900">{form.name.trim() || "Not entered"}</p></div>
                  <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Email</p><p className="mt-1 break-all text-sm font-semibold text-gray-900">{form.email.trim() || "Not entered"}</p></div>
                  <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Role</p><p className="mt-1 text-sm font-semibold text-gray-900">{selectedRole?.label || "-"}</p></div><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">Provider</p><p className="mt-1 text-sm font-semibold capitalize text-gray-900">{form.authProvider}</p></div></div>
                  <div className="rounded-2xl border border-gray-200 p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={form.active} disabled={form.role === "super_admin"} onChange={event => updateForm("active", event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><div><p className="text-sm font-semibold text-gray-900">Active User</p><p className="mt-1 text-xs leading-5 text-gray-500">Inactive users cannot access the CRM.</p></div></label></div>
                  <div className={`rounded-2xl p-4 text-xs leading-5 ${adminModules.length ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"}`}>{adminModules.length ? `${selectedRole?.label || "This role"} gets ${adminModules.length} Admin module${adminModules.length === 1 ? "" : "s"}.` : "This role uses Team/User access only."}</div>
                </div>

                <div className="mt-5 flex flex-col gap-3"><button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create User"}</button><button type="button" onClick={() => router.back()} disabled={submitting} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Cancel</button></div>
              </div>
            </aside>
          </form>
        </div>
      </main>
    </AdminGuard>
  );
}
