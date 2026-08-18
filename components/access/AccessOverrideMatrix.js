"use client";

import {
  ACCESS_MODULES,
  ACCESS_STATES,
  DATA_SCOPES,
  getRoleAccessDefaults,
  resolveAccess
} from "@/lib/rolePermissions";

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function statusPill(allowed, scope) {
  return allowed
    ? `Allowed${scope && scope !== "all" ? ` · ${scope.replace("_", " + ")}` : ""}`
    : "Denied";
}

export default function AccessOverrideMatrix({ value = {}, role, targetUser, disabled = false, onChange }) {
  const roleDefaults = getRoleAccessDefaults(role);

  const updateOverride = (permissionKey, patch) => {
    const current = value?.[permissionKey] || {};
    const next = { ...value };
    const state = patch.state ?? current.state ?? "default";

    if (state === "default") {
      delete next[permissionKey];
      onChange?.(next);
      return;
    }

    const roleDefault = roleDefaults[permissionKey] || { allowed: false, scope: "none" };
    next[permissionKey] = {
      state,
      scope: state === "allow"
        ? (patch.scope ?? current.scope ?? roleDefault.scope ?? "all")
        : "none",
      accessFrom: patch.accessFrom ?? current.accessFrom ?? null,
      accessUntil: patch.accessUntil ?? current.accessUntil ?? null,
      reason: patch.reason ?? current.reason ?? ""
    };

    onChange?.(next);
  };

  const previewUser = {
    ...targetUser,
    role,
    accessOverrides: value,
    active: targetUser?.active !== false
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
        Role defaults remain the baseline. Use an override only when this individual needs different access. Temporary overrides automatically fall back to the role default after expiry.
      </div>

      {ACCESS_MODULES.map(module => (
        <details key={module.key} className="group rounded-2xl border border-gray-200 bg-white" open={module.key === "leads" || module.key === "travel_agents" || module.key === "users"}>
          <summary className="cursor-pointer list-none px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{module.label}</p>
                <p className="mt-1 text-xs text-gray-500">{module.description}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                {module.actions.length} action{module.actions.length === 1 ? "" : "s"}
              </span>
            </div>
          </summary>

          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <div className="space-y-3">
              {module.actions.map(action => {
                const roleDefault = roleDefaults[action.key] || { allowed: false, scope: "none" };
                const override = value?.[action.key] || null;
                const effective = resolveAccess(previewUser, action.key);
                const state = override?.state || "default";

                return (
                  <div key={action.key} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <div className="grid gap-3 xl:grid-cols-[minmax(180px,1.2fr)_150px_180px_150px] xl:items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{action.label}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          <span className={`rounded-full px-2 py-0.5 ${roleDefault.allowed ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                            Role: {statusPill(roleDefault.allowed, roleDefault.scope)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 ${effective.allowed ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
                            Effective: {statusPill(effective.allowed, effective.scope)}
                          </span>
                        </div>
                      </div>

                      <select
                        value={state}
                        disabled={disabled}
                        onChange={event => updateOverride(action.key, { state: event.target.value })}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs disabled:bg-gray-100"
                      >
                        {ACCESS_STATES.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>

                      {action.supportsScope ? (
                        <select
                          value={state === "allow" ? (override?.scope || roleDefault.scope || "all") : (state === "default" ? roleDefault.scope : "none")}
                          disabled={disabled || state !== "allow"}
                          onChange={event => updateOverride(action.key, { scope: event.target.value })}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs disabled:bg-gray-100"
                        >
                          {DATA_SCOPES.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-gray-400">No data scope</div>
                      )}

                      <div className="text-xs text-gray-500">
                        {effective.source === "override_allow" && "Individual allow"}
                        {effective.source === "override_deny" && "Individual deny"}
                        {effective.source === "role_default" && "Role default"}
                        {effective.source === "role_default_after_expiry" && "Expired → role default"}
                        {effective.source === "super_admin" && "Super Admin safeguard"}
                      </div>
                    </div>

                    {state !== "default" ? (
                      <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 md:grid-cols-2 xl:grid-cols-[190px_190px_1fr]">
                        <label className="text-[11px] font-medium text-gray-500">
                          Access From
                          <input
                            type="datetime-local"
                            value={toDateTimeLocal(override?.accessFrom)}
                            disabled={disabled}
                            onChange={event => updateOverride(action.key, { accessFrom: event.target.value ? new Date(event.target.value).toISOString() : null })}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 disabled:bg-gray-100"
                          />
                        </label>
                        <label className="text-[11px] font-medium text-gray-500">
                          Access Until
                          <input
                            type="datetime-local"
                            value={toDateTimeLocal(override?.accessUntil)}
                            disabled={disabled}
                            onChange={event => updateOverride(action.key, { accessUntil: event.target.value ? new Date(event.target.value).toISOString() : null })}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 disabled:bg-gray-100"
                          />
                        </label>
                        <label className="text-[11px] font-medium text-gray-500 md:col-span-2 xl:col-span-1">
                          Reason
                          <input
                            value={override?.reason || ""}
                            disabled={disabled}
                            onChange={event => updateOverride(action.key, { reason: event.target.value })}
                            placeholder="Why is this override needed?"
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 disabled:bg-gray-100"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
