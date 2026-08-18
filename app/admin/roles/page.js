"use client";

import { ShieldCheck } from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import {
  ACCESS_MODULES,
  ROLE_OPTIONS,
  getRoleAccessDefaults
} from "@/lib/rolePermissions";

function formatScope(scope) {
  return String(scope || "all")
    .replaceAll("_", " + ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

export default function RoleDefaultsPage() {
  return (
    <AdminGuard permission="users.manage_role">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Role Defaults</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Role permissions are the baseline. User-specific Allow or Deny overrides are managed from Team Management and automatically return to the role default when a temporary override expires.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {ROLE_OPTIONS.map(role => {
            const defaults = getRoleAccessDefaults(role.value);
            const allowedCount = Object.values(defaults).filter(item => item.allowed).length;

            return (
              <details key={role.value} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <summary className="cursor-pointer list-none p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{role.label}</p>
                      <p className="mt-1 text-sm text-gray-500">{role.description}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {allowedCount} actions enabled
                    </span>
                  </div>
                </summary>

                <div className="border-t border-gray-100 p-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {ACCESS_MODULES.map(module => {
                      const allowedActions = module.actions
                        .map(action => ({ action, access: defaults[action.key] }))
                        .filter(item => item.access?.allowed);

                      return (
                        <section key={module.key} className="rounded-xl border border-gray-100 p-4">
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-900">{module.label}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{module.description}</p>
                          </div>

                          {allowedActions.length ? (
                            <div className="flex flex-wrap gap-2">
                              {allowedActions.map(({ action, access }) => (
                                <span
                                  key={action.key}
                                  className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700"
                                >
                                  {action.label}{action.supportsScope ? ` · ${formatScope(access.scope)}` : ""}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No role-default access.</p>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </main>
    </AdminGuard>
  );
}
