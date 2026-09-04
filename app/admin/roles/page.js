"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import {
  ADMIN_MODULES,
  ROLE_OPTIONS,
  getAdminModulesForRole
} from "@/lib/rolePermissions";

export default function RoleDefaultsPage() {
  return (
    <AdminGuard permission="users.manage_role">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Role Access</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              All active team roles receive the same operational User Front. Roles now define workstream measurement and Admin/management access rather than hiding day-to-day CRM modules.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">User Front access is automatic for the full team</p>
              <p className="mt-1 text-sm leading-6 text-emerald-700">
                Dashboard, Action Center, Travel Agents, Engagements, Meetings, Leads, Destinations and Profile are available to every active team user. Workstream roles only change KPI attribution, pulse scoring and management reporting.
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-800">
                Travel Agents: users can claim an unassigned agent for themselves; Manager/Admin/Super Admin can reassign.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {ROLE_OPTIONS.map(role => {
            const allowedKeys = getAdminModulesForRole(role.value);
            const modules = ADMIN_MODULES.filter(module => allowedKeys.includes(module.key));

            return (
              <section key={role.value} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{role.label}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-500">{role.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${modules.length ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {modules.length ? `${modules.length} Admin modules` : "Team/User only"}
                  </span>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Admin Access</p>
                  {modules.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {modules.map(module => (
                        <span key={module.key} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                          {module.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No Admin workspace access.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </AdminGuard>
  );
}
