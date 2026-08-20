/*
 * Dream Trawell CRM - simplified role/access model.
 *
 * Business rule:
 * - Every active user gets the normal Team/User workspace automatically.
 * - Role controls which ADMIN modules the user can enter.
 * - There are no per-user Allow/Deny/Scope/Expiry overrides in the active model.
 * - A few fixed record scopes remain internal for safe team data handling; they
 *   are not configurable in the UI.
 */

// Kept for backward-compatible imports from the retired override component.
export const ACCESS_STATES = [
  { value: "default", label: "Role Default" },
  { value: "allow", label: "Allow" },
  { value: "deny", label: "Deny" }
];

export const DATA_SCOPES = [
  { value: "none", label: "None" },
  { value: "own", label: "Own" },
  { value: "assigned", label: "Assigned" },
  { value: "own_assigned", label: "Own + Assigned" },
  { value: "team", label: "Team" },
  { value: "all", label: "All" }
];

export const ACCESS_MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Dashboard and daily action overview",
    legacyPermission: "dashboard",
    actions: [{ key: "dashboard.view", label: "View Dashboard", supportsScope: true }]
  },
  {
    key: "destinations",
    label: "Destinations",
    description: "Destination content and activity management",
    legacyPermission: "destinationManagement",
    actions: [
      { key: "destinations.view", label: "View" },
      { key: "destinations.create", label: "Create" },
      { key: "destinations.edit", label: "Edit" },
      { key: "destinations.delete", label: "Delete" }
    ]
  },
  {
    key: "travel_agents",
    label: "Travel Agents",
    description: "Travel Agent relationship master",
    legacyPermission: "travelAgentManagement",
    actions: [
      { key: "travel_agents.view", label: "View", supportsScope: true },
      { key: "travel_agents.create", label: "Create" },
      { key: "travel_agents.edit", label: "Edit", supportsScope: true },
      { key: "travel_agents.change_status", label: "Change Status", supportsScope: true },
      { key: "travel_agents.change_potential", label: "Change Potential", supportsScope: true },
      { key: "travel_agents.assign", label: "Assign", supportsScope: true }
    ]
  },
  {
    key: "engagements",
    label: "Engagements",
    description: "Relationship activity and engagement history",
    legacyPermission: "travelAgentManagement",
    actions: [
      { key: "engagements.view", label: "View", supportsScope: true },
      { key: "engagements.create", label: "Create", supportsScope: true },
      { key: "engagements.edit", label: "Edit", supportsScope: true }
    ]
  },
  {
    key: "meetings",
    label: "Meetings",
    description: "Meeting scheduling and completion",
    legacyPermission: "travelAgentManagement",
    actions: [
      { key: "meetings.view", label: "View", supportsScope: true },
      { key: "meetings.schedule", label: "Schedule", supportsScope: true },
      { key: "meetings.edit", label: "Edit", supportsScope: true },
      { key: "meetings.assign_another_user", label: "Assign Another User", supportsScope: true },
      { key: "meetings.cancel", label: "Cancel", supportsScope: true }
    ]
  },
  {
    key: "leads",
    label: "Leads",
    description: "Lead pipeline and query management",
    legacyPermission: "leadManagement",
    actions: [
      { key: "leads.view", label: "View", supportsScope: true },
      { key: "leads.create", label: "Create" },
      { key: "leads.edit", label: "Edit", supportsScope: true },
      { key: "leads.assign", label: "Assign", supportsScope: true },
      { key: "leads.close_won", label: "Close Won", supportsScope: true },
      { key: "leads.close_lost", label: "Close Lost", supportsScope: true },
      { key: "leads.reopen", label: "Reopen", supportsScope: true },
      { key: "leads.export", label: "Export", supportsScope: true }
    ]
  },
  {
    key: "quotations",
    label: "Quotations",
    description: "Quotation lifecycle and revisions",
    legacyPermission: "quotationManagement",
    actions: [
      { key: "quotations.view", label: "View", supportsScope: true },
      { key: "quotations.create", label: "Create", supportsScope: true },
      { key: "quotations.edit", label: "Edit", supportsScope: true },
      { key: "quotations.send", label: "Send", supportsScope: true },
      { key: "quotations.resend", label: "Resend", supportsScope: true },
      { key: "quotations.delete_draft", label: "Delete Draft", supportsScope: true },
      { key: "quotations.create_revision", label: "Create Revision", supportsScope: true }
    ]
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Vendor master and partner operations",
    legacyPermission: "vendorManagement",
    actions: [
      { key: "vendors.view", label: "View" },
      { key: "vendors.create", label: "Create" },
      { key: "vendors.edit", label: "Edit" }
    ]
  },
  {
    key: "payments",
    label: "Payments",
    description: "Customer/vendor payment operations",
    legacyPermission: "paymentManagement",
    actions: [
      { key: "payments.view", label: "View", supportsScope: true },
      { key: "payments.create", label: "Create", supportsScope: true },
      { key: "payments.edit", label: "Edit", supportsScope: true },
      { key: "payments.approve", label: "Approve", supportsScope: true },
      { key: "payments.view_vendor_cost", label: "View Vendor Cost", supportsScope: true },
      { key: "payments.view_revenue_gp", label: "View Revenue / GP", supportsScope: true }
    ]
  },
  {
    key: "reports",
    label: "Reports",
    description: "Management reporting and exports",
    legacyPermission: "reportManagement",
    actions: [
      { key: "reports.view", label: "View", supportsScope: true },
      { key: "reports.export", label: "Export", supportsScope: true }
    ]
  },
  {
    key: "communications",
    label: "Communication",
    description: "Templates and outbound communication",
    legacyPermission: "communicationManagement",
    actions: [
      { key: "communications.view", label: "View" },
      { key: "communications.create", label: "Create" },
      { key: "communications.edit", label: "Edit" },
      { key: "communications.send", label: "Send" }
    ]
  },
  {
    key: "documents",
    label: "Documents",
    description: "Document repository and uploaded media",
    legacyPermission: "documentManagement",
    actions: [
      { key: "documents.view", label: "View" },
      { key: "documents.upload", label: "Upload" },
      { key: "documents.edit", label: "Edit" },
      { key: "documents.delete", label: "Delete" }
    ]
  },
  {
    key: "users",
    label: "Team Management",
    description: "Internal users and role assignment",
    legacyPermission: "userManagement",
    actions: [
      { key: "users.view", label: "View" },
      { key: "users.create", label: "Create" },
      { key: "users.edit", label: "Edit" },
      { key: "users.manage_role", label: "Manage Role" },
      // Retained as a compatibility key. The simplified UI no longer exposes
      // per-user access overrides.
      { key: "users.manage_access", label: "Manage Access" }
    ]
  },
  {
    key: "settings",
    label: "Settings",
    description: "Branding and system settings",
    legacyPermission: "settingsManagement",
    actions: [
      { key: "settings.view", label: "View" },
      { key: "settings.edit", label: "Edit" }
    ]
  }
];

export const MODULE_PERMISSIONS = ACCESS_MODULES.map(module => ({
  key: module.legacyPermission,
  label: module.label,
  description: module.description
})).filter((item, index, list) =>
  item.key && list.findIndex(candidate => candidate.key === item.key) === index
);

export const ROLE_OPTIONS = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Full Admin access plus the standard Team/User workspace."
  },
  {
    value: "admin",
    label: "Admin",
    description: "Admin workspace access for day-to-day CRM administration."
  },
  {
    value: "manager",
    label: "Manager",
    description: "Team/User workspace plus selected management Admin pages."
  },
  {
    value: "employee",
    label: "Employee / Sales / Operations Executive",
    description: "Full Team/User CRM workspace plus Admin Travel Agents access."
  },
  {
    value: "operation_executive",
    label: "Operation Executive",
    description: "Full Team/User workspace plus Admin access to Travel Agents, Engagements, Meetings and Leads."
  },
  {
    value: "associate",
    label: "Associate",
    description: "Standard Team/User CRM workspace."
  },
  {
    value: "partner",
    label: "Partner",
    description: "Standard Team/User CRM workspace."
  },
  {
    value: "finance",
    label: "Finance",
    description: "Team/User workspace plus finance-relevant Admin pages."
  }
];

export const LEGACY_PERMISSION_TO_ACTION = {
  dashboard: "dashboard.view",
  destinationManagement: "destinations.view",
  travelAgentManagement: "travel_agents.view",
  vendorManagement: "vendors.view",
  leadManagement: "leads.view",
  quotationManagement: "quotations.view",
  communicationManagement: "communications.view",
  documentManagement: "documents.view",
  userManagement: "users.view",
  roleManagement: "users.manage_role",
  settingsManagement: "settings.view",
  paymentManagement: "payments.view",
  reportManagement: "reports.view"
};

export const ADMIN_MODULES = [
  { key: "dashboard", label: "Dashboard & Action Center", path: "/admin/dashboard" },
  { key: "travel_agents", label: "Travel Agents", path: "/admin/travel-agents" },
  { key: "engagements", label: "Engagements", path: "/admin/engagements" },
  { key: "meetings", label: "Meetings", path: "/admin/meetings" },
  { key: "leads", label: "Leads", path: "/admin/leads" },
  { key: "vendors", label: "Vendors", path: "/admin/vendors" },
  { key: "destinations", label: "Destinations", path: "/admin/destinations" },
  { key: "communications", label: "Communication Templates", path: "/admin/communication-templates" },
  { key: "documents", label: "Documents", path: "/admin/documents" },
  { key: "users", label: "Team Management", path: "/admin/users" },
  { key: "roles", label: "Role Management", path: "/admin/roles" },
  { key: "settings", label: "Settings", path: "/admin/settings/branding" },
  { key: "quotations", label: "Quotation Templates", path: "/admin/settings/quotation-templates" }
];

const ADMIN_MODULE_KEYS = ADMIN_MODULES.map(item => item.key);

export const ROLE_ADMIN_MODULE_ACCESS = {
  super_admin: ADMIN_MODULE_KEYS,
  admin: ADMIN_MODULE_KEYS.filter(key => key !== "roles"),
  manager: ["dashboard", "travel_agents", "engagements", "meetings", "leads"],
  operation_executive: ["travel_agents", "engagements", "meetings", "leads"],
  finance: ["dashboard", "leads", "vendors"],
  employee: ["travel_agents"],
  associate: [],
  partner: []
};

const ACTION_DEFINITION_MAP = new Map(
  ACCESS_MODULES.flatMap(module =>
    module.actions.map(action => [action.key, { ...action, moduleKey: module.key }])
  )
);

const ADMIN_ROUTE_MODULE_RULES = [
  [/^\/admin\/attendance(?:\/|$)/, "legacy"],
  [/^\/admin\/roles(?:\/|$)/, "roles"],
  [/^\/admin\/users(?:\/|$)/, "users"],
  [/^\/admin\/settings\/quotation-templates(?:\/|$)/, "quotations"],
  [/^\/admin\/settings(?:\/|$)/, "settings"],
  [/^\/admin\/communication-templates(?:\/|$)/, "communications"],
  [/^\/admin\/template-categories(?:\/|$)/, "communications"],
  [/^\/admin\/documents(?:\/|$)/, "documents"],
  [/^\/admin\/destinations(?:\/|$)/, "destinations"],
  [/^\/admin\/vendors(?:\/|$)/, "vendors"],
  [/^\/admin\/leads(?:\/|$)/, "leads"],
  [/^\/admin\/meetings(?:\/|$)/, "meetings"],
  [/^\/admin\/engagements(?:\/|$)/, "engagements"],
  [/^\/admin\/travel-agents(?:\/|$)/, "travel_agents"],
  [/^\/admin\/action-center(?:\/|$)/, "dashboard"],
  [/^\/admin\/dashboard(?:\/|$)/, "dashboard"]
];

const TEAM_ROUTE_RULES = [
  [/^\/leads\/create(?:\/|$)/, "leads.create"],
  [/^\/dashboard(?:\/|$)/, "dashboard.view"],
  [/^\/action-center(?:\/|$)/, "dashboard.view"],
  [/^\/engagements(?:\/|$)/, "engagements.view"],
  [/^\/travel-agents(?:\/|$)/, "travel_agents.view"],
  [/^\/meetings(?:\/|$)/, "meetings.view"],
  [/^\/leads(?:\/|$)/, "leads.view"]
];

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizeScope(scope, fallback = "all") {
  const value = clean(scope).toLowerCase();
  return DATA_SCOPES.some(item => item.value === value) ? value : fallback;
}

function createDeniedDefaults() {
  return Object.fromEntries(
    Array.from(ACTION_DEFINITION_MAP.keys()).map(key => [key, { allowed: false, scope: "none" }])
  );
}

function allow(defaults, keys, scope = "all") {
  keys.forEach(key => {
    const definition = ACTION_DEFINITION_MAP.get(key);
    if (!definition) return;
    defaults[key] = {
      allowed: true,
      scope: definition.supportsScope ? normalizeScope(scope, "all") : "all"
    };
  });
}

function allowModule(defaults, moduleKey, scope = "all", excludedActions = []) {
  const module = ACCESS_MODULES.find(item => item.key === moduleKey);
  if (!module) return;
  allow(
    defaults,
    module.actions.filter(action => !excludedActions.includes(action.key)).map(action => action.key),
    scope
  );
}

export function normalizeRole(role) {
  const normalized = clean(role).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "team" || normalized === "sales" || normalized === "operations_executive") {
    return "employee";
  }
  if (normalized === "operation_executive") return "operation_executive";
  return ROLE_OPTIONS.some(item => item.value === normalized) ? normalized : "employee";
}

export function resolveUserRole(user = {}) {
  const accessRole = clean(user?.accessRole || user?.roleProfile);
  if (accessRole) {
    const normalizedAccessRole = normalizeRole(accessRole);
    if (normalizedAccessRole === "operation_executive") return "operation_executive";
  }
  return normalizeRole(user?.role);
}

export function isSuperAdmin(user) {
  const rawRole = clean(user?.role);
  if (rawRole) return normalizeRole(rawRole) === "super_admin";
  return user?.isSuperAdmin === true || user?.superAdmin === true;
}

export function isAdmin(user) {
  const rawRole = clean(user?.role);
  if (rawRole) {
    const role = normalizeRole(rawRole);
    return role === "admin" || role === "super_admin";
  }
  return user?.isAdmin === true || isSuperAdmin(user);
}

export function isManagementRole(role) {
  return ["super_admin", "admin", "manager", "operation_executive", "finance"].includes(normalizeRole(role));
}

export function getAdminModulesForRole(role) {
  const normalizedRole = normalizeRole(role);
  return [...(ROLE_ADMIN_MODULE_ACCESS[normalizedRole] || [])];
}

export function canAccessAdminModule(user, moduleKey) {
  if (!user || user.active === false) return false;
  if (moduleKey === "legacy") return isSuperAdmin(user);
  return getAdminModulesForRole(user.role).includes(moduleKey);
}

export function getAdminLandingPathForRole(role) {
  const allowed = getAdminModulesForRole(role);
  const first = ADMIN_MODULES.find(item => allowed.includes(item.key));
  return first?.path || "/dashboard";
}

/*
 * Fixed role defaults. These are internal only; the UI no longer exposes an
 * action-by-action matrix.
 */
export function getRoleAccessDefaults(role) {
  const normalizedRole = normalizeRole(role);
  const defaults = createDeniedDefaults();

  if (normalizedRole === "super_admin") {
    Object.keys(defaults).forEach(key => {
      defaults[key] = { allowed: true, scope: "all" };
    });
    return defaults;
  }

  // Standard Team/User workspace for every active role.
  allow(defaults, ["dashboard.view"], "all");
  allow(defaults, [
    "travel_agents.view",
    "travel_agents.create",
    "travel_agents.edit",
    "travel_agents.change_status",
    "travel_agents.change_potential",
    "travel_agents.assign"
  ], "all");
  allow(defaults, ["engagements.create"], "all");
  allow(defaults, ["engagements.view", "engagements.edit"], "own_assigned");
  allow(defaults, ["meetings.schedule"], "all");
  allow(defaults, ["meetings.view", "meetings.edit", "meetings.cancel"], "own_assigned");
  allow(defaults, ["leads.create"], "all");
  allow(defaults, [
    "leads.view",
    "leads.edit",
    "leads.close_won",
    "leads.close_lost",
    "leads.reopen",
    "leads.export"
  ], "own_assigned");
  allowModule(defaults, "quotations", "own_assigned");
  allow(defaults, ["payments.view", "payments.create", "payments.edit"], "own_assigned");
  allow(defaults, ["communications.send"], "all");

  if (normalizedRole === "operation_executive") {
    // Operation Executive gets the selected Admin modules with full operational access.
    ["travel_agents", "engagements", "meetings", "leads"]
      .forEach(moduleKey => allowModule(defaults, moduleKey, "all"));
  }

  if (normalizedRole === "employee") {
    // Employee/Sales/Operations Executive gets full Travel Agent access in Admin.
    allowModule(defaults, "travel_agents", "all");
  }

  if (normalizedRole === "manager") {
    // Managers get team-level operational access and can assign/reassign work.
    ["travel_agents", "engagements", "meetings", "leads", "quotations"]
      .forEach(moduleKey => allowModule(defaults, moduleKey, "team"));
    allow(defaults, ["leads.assign", "meetings.assign_another_user"], "team");
    allow(defaults, [
      "payments.view",
      "payments.create",
      "payments.edit",
      "payments.approve",
      "payments.view_vendor_cost",
      "payments.view_revenue_gp",
      "reports.view",
      "reports.export"
    ], "team");
  }

  if (normalizedRole === "finance") {
    allowModule(defaults, "payments", "all");
    allow(defaults, ["reports.view", "reports.export", "quotations.view", "leads.view"], "all");
    allowModule(defaults, "vendors", "all");
  }

  if (normalizedRole === "admin") {
    // Admin can perform actions inside all Admin modules. Admin route access is
    // still decided by ROLE_ADMIN_MODULE_ACCESS above.
    Object.keys(defaults).forEach(key => {
      defaults[key] = { allowed: true, scope: "all" };
    });
  }

  // User-management actions are only for roles that have Team Management in
  // Admin. This also protects callable functions from direct use by team users.
  if (["admin"].includes(normalizedRole)) {
    allowModule(defaults, "users", "all");
    allowModule(defaults, "settings", "all");
    allowModule(defaults, "destinations", "all");
    allowModule(defaults, "vendors", "all");
    allowModule(defaults, "communications", "all");
    allowModule(defaults, "documents", "all");
    allow(defaults, ["reports.view", "reports.export"], "all");
  }

  return defaults;
}

export function getEmptyPermissions() {
  return MODULE_PERMISSIONS.reduce((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {});
}

export function getPermissionsByRole(role) {
  const defaults = getRoleAccessDefaults(role);
  const permissions = getEmptyPermissions();

  MODULE_PERMISSIONS.forEach(module => {
    const actionKey = LEGACY_PERMISSION_TO_ACTION[module.key];
    permissions[module.key] = Boolean(actionKey && defaults[actionKey]?.allowed);
  });

  return permissions;
}

export function resolveAccess(user, permissionKey) {
  if (!user || user.active === false) {
    return { allowed: false, scope: "none", source: "inactive", expired: false };
  }

  if (isSuperAdmin(user)) {
    return { allowed: true, scope: "all", source: "super_admin", expired: false };
  }

  if (String(permissionKey || "").startsWith("admin.")) {
    const moduleKey = String(permissionKey).slice("admin.".length);
    const allowed = canAccessAdminModule(user, moduleKey);
    return {
      allowed,
      scope: allowed ? "all" : "none",
      source: "role_admin_module",
      expired: false
    };
  }

  const normalizedKey = LEGACY_PERMISSION_TO_ACTION[permissionKey] || permissionKey;
  const definition = ACTION_DEFINITION_MAP.get(normalizedKey);

  if (!definition) {
    return { allowed: false, scope: "none", source: "unknown", expired: false };
  }

  const roleDefault = getRoleAccessDefaults(user.role)[normalizedKey] || {
    allowed: false,
    scope: "none"
  };

  return {
    allowed: Boolean(roleDefault.allowed),
    scope: roleDefault.allowed ? normalizeScope(roleDefault.scope, "all") : "none",
    source: "role",
    expired: false
  };
}

export function canAccess(user, permissionKey) {
  return resolveAccess(user, permissionKey).allowed;
}

export function getDataScope(user, permissionKey) {
  return resolveAccess(user, permissionKey).scope;
}

export function getEffectiveAccessMap(user) {
  return Object.fromEntries(
    Array.from(ACTION_DEFINITION_MAP.keys()).map(key => [key, resolveAccess(user, key)])
  );
}

export function getEffectiveLegacyPermissions(user) {
  return MODULE_PERMISSIONS.reduce((acc, module) => {
    const key = LEGACY_PERMISSION_TO_ACTION[module.key];
    acc[module.key] = key ? canAccess(user, key) : false;
    return acc;
  }, {});
}

export function canEnterAdminArea(user) {
  return Boolean(user?.active !== false && getAdminModulesForRole(user?.role).length > 0);
}

export function getRequiredPermissionForPath(pathname = "", { admin = false } = {}) {
  if (admin) {
    const moduleKey = ADMIN_ROUTE_MODULE_RULES.find(([pattern]) => pattern.test(pathname))?.[1];
    return moduleKey ? `admin.${moduleKey}` : null;
  }
  return TEAM_ROUTE_RULES.find(([pattern]) => pattern.test(pathname))?.[1] || null;
}

function valuesForUser(user = {}) {
  return new Set([
    clean(user.uid),
    clean(user.id),
    clean(user.userId),
    normalizeEmail(user.email),
    normalizeEmail(user.workEmail),
    normalizeEmail(user.officialEmail),
    clean(user.name).toLowerCase(),
    clean(user.fullName).toLowerCase(),
    clean(user.displayName).toLowerCase()
  ].filter(Boolean));
}

function recordValueMatchesUser(value, userValues) {
  if (!value) return false;
  const raw = clean(value);
  const normalized = raw.includes("@") ? normalizeEmail(raw) : raw.toLowerCase();
  return userValues.has(raw) || userValues.has(normalized);
}

function anyRecordValueMatches(record, fields, userValues) {
  return fields.some(field => recordValueMatchesUser(record?.[field], userValues));
}

function sameTeam(a, b) {
  return Boolean(clean(a) && clean(b) && clean(a).toLowerCase() === clean(b).toLowerCase());
}

function getUserTeam(user = {}) {
  return clean(user.teamName || user.team || user.departmentName || user.department);
}

function teamFromLookup(value, userLookup) {
  if (!value || !userLookup) return "";
  const key = clean(value);
  const normalized = key.includes("@") ? normalizeEmail(key) : key.toLowerCase();
  const member = userLookup instanceof Map
    ? userLookup.get(key) || userLookup.get(normalized)
    : userLookup[key] || userLookup[normalized];
  return clean(member?.team || member?.teamName || member?.department || member?.departmentName);
}

function matchesTeamScope(user, record, kind, userLookup) {
  const userTeam = getUserTeam(user);
  if (!userTeam) return false;

  const directTeamFields = {
    lead: ["team", "teamName", "ownerTeam", "assignedTeam", "assignedToTeam", "createdByTeam"],
    travel_agent: ["team", "teamName", "assignedTeam", "createdByTeam"],
    engagement: ["team", "teamName", "assignedTeam", "createdByTeam"],
    meeting: ["team", "teamName", "assignedTeam", "createdByTeam"],
    quotation: ["team", "teamName", "assignedTeam", "createdByTeam"],
    payment: ["team", "teamName", "assignedTeam", "createdByTeam"]
  };

  if ((directTeamFields[kind] || ["team", "teamName"]).some(field => sameTeam(record?.[field], userTeam))) {
    return true;
  }

  const identityFields = {
    lead: ["ownerUid", "ownerEmail", "createdByUid", "createdByEmail", "assignedToUid", "assignedToEmail", "assigneeUid", "assigneeEmail"],
    travel_agent: ["createdByUid", "createdByEmail", "assignedToUid", "assignedToEmail", "accountManagerUid"],
    engagement: ["createdByUid", "createdByEmail", "assignedToUid", "assignedToEmail"],
    meeting: ["createdByUid", "createdByEmail", "scheduledByUid", "scheduledByEmail", "assignedToUid", "assignedToEmail", "assignedUserUid", "assignedUserEmail", "assignedUserKey", "teamMemberUid"],
    quotation: ["createdByUid", "createdByEmail", "ownerUid", "ownerEmail", "assignedToUid", "assignedToEmail"],
    payment: ["createdByUid", "createdByEmail", "ownerUid", "ownerEmail", "assignedToUid", "assignedToEmail"]
  };

  return (identityFields[kind] || []).some(field => sameTeam(teamFromLookup(record?.[field], userLookup), userTeam));
}

export function canAccessRecord(user, permissionKey, record, kind = "generic", options = {}) {
  if (!user || user.active === false) return false;

  const normalizedPermissionKey = LEGACY_PERMISSION_TO_ACTION[permissionKey] || permissionKey;

  /*
   * Lead assignment rule for the Team/User workflow:
   * - Permanent Lead Owner/creator may assign or reassign the Lead.
   * - Current Assignee may also reassign the Lead, even when another user owns it.
   * - Unrelated Team users still cannot reassign arbitrary Leads.
   *
   * This is intentionally record-based. canAccess(user, "leads.assign") remains
   * false for normal Team/User roles, so broad assignment access is still
   * reserved for Manager/Admin roles and a normal user cannot choose another
   * assignee while creating an unrelated Lead.
   */
  if (kind === "lead" && normalizedPermissionKey === "leads.assign" && record) {
    const assignmentUserValues = valuesForUser(user);
    const ownedByUser = anyRecordValueMatches(
      record,
      [
        "ownerUid",
        "ownerEmail",
        "createdByUid",
        "createdByUserId",
        "createdByEmail",
        "createdBy",
        "creatorUid",
        "creatorEmail"
      ],
      assignmentUserValues
    );

    const currentlyAssignedToUser = anyRecordValueMatches(
      record,
      [
        "assignedToUid",
        "assignedToEmail",
        "assignedTo",
        "assignedUserUid",
        "assignedUserEmail",
        "assigneeUid",
        "assigneeEmail",
        "accountManagerUid",
        "teamMemberUid",
        "teamMemberEmail"
      ],
      assignmentUserValues
    );

    if (ownedByUser || currentlyAssignedToUser) return true;
  }

  const access = resolveAccess(user, normalizedPermissionKey);
  if (!access.allowed) return false;
  if (!record) return access.scope !== "none";
  if (access.scope === "all") return true;
  if (access.scope === "none") return false;

  const userValues = valuesForUser(user);

  const ownFields = {
    // Keep lead view compatibility with both the newer creator-owner model and
    // older lead documents used by the Team Lead list.
    lead: [
      "ownerUid",
      "ownerEmail",
      "createdByUid",
      "createdByUserId",
      "createdByEmail",
      "createdBy",
      "creatorUid",
      "creatorEmail"
    ],
    travel_agent: ["createdByUid", "createdByEmail", "createdBy", "creatorUid", "creatorEmail"],
    engagement: ["createdByUid", "createdByEmail", "createdBy", "performedByUid", "performedByEmail"],
    meeting: ["createdByUid", "createdByEmail", "createdBy", "scheduledByUid", "scheduledByEmail", "ownerUid", "ownerEmail"],
    quotation: ["createdByUid", "createdByEmail", "createdBy", "ownerUid", "ownerEmail"],
    payment: ["createdByUid", "createdByEmail", "createdBy", "ownerUid", "ownerEmail"]
  };

  const assignedFields = {
    lead: [
      "assignedToUid",
      "assignedToEmail",
      "assignedTo",
      "assignedUserUid",
      "assignedUserEmail",
      "assigneeUid",
      "assigneeEmail",
      "accountManagerUid",
      "teamMemberUid",
      "teamMemberEmail"
    ],
    travel_agent: ["assignedToUid", "assignedToEmail", "assignedTo", "accountManagerUid"],
    engagement: ["assignedToUid", "assignedToEmail", "assignedTo"],
    meeting: ["assignedToUid", "assignedToEmail", "assignedTo", "assignedUserUid", "assignedUserEmail", "assignedUserKey", "teamMemberUid", "meetingOwnerUid", "meetingOwnerEmail"],
    quotation: ["assignedToUid", "assignedToEmail", "assignedTo", "leadOwnerUid", "leadAssigneeUid"],
    payment: ["assignedToUid", "assignedToEmail", "assignedTo", "leadOwnerUid", "leadAssigneeUid"]
  };

  const owns = anyRecordValueMatches(record, ownFields[kind] || ownFields.lead, userValues);
  const assigned = anyRecordValueMatches(record, assignedFields[kind] || assignedFields.lead, userValues);

  // The Team Lead workflow intentionally keeps the lead originator involved
  // after hand-off. A user who created/assigned the lead may continue to view
  // and edit it even when the current assignee is another teammate. Closing
  // and other sensitive actions still use their normal permission scope.
  const assignedByUser = kind === "lead" && anyRecordValueMatches(
    record,
    [
      "assignedByUid",
      "assignedByEmail",
      "assignedBy",
      "assignedByUserUid",
      "assignedByUserEmail",
      "lastAssignedByUid",
      "lastAssignedByEmail"
    ],
    userValues
  );

  if (["leads.view", "leads.edit"].includes(normalizedPermissionKey) && assignedByUser) {
    return true;
  }
  if (access.scope === "own") return owns;
  if (access.scope === "assigned") return assigned;
  if (access.scope === "own_assigned") return owns || assigned;
  if (access.scope === "team") return matchesTeamScope(user, record, kind, options.userLookup);

  return false;
}

export function filterRecordsByAccess(records = [], user, permissionKey, kind, options = {}) {
  if (!Array.isArray(records)) return [];
  return records.filter(record => canAccessRecord(user, permissionKey, record, kind, options));
}

// The previous override schema is ignored in the simplified model. Keep this
// function so old imports and old documents remain harmlessly compatible.
export function normalizeAccessOverrides() {
  return {};
}
