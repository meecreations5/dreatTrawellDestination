export const ACCESS_STATES = [
  { value: "default", label: "Use Role Default" },
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
    actions: [
      { key: "dashboard.view", label: "View Dashboard", supportsScope: true }
    ]
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
    label: "Users / Team Management",
    description: "Internal users, roles and access control",
    legacyPermission: "userManagement",
    actions: [
      { key: "users.view", label: "View" },
      { key: "users.create", label: "Create" },
      { key: "users.edit", label: "Edit" },
      { key: "users.manage_role", label: "Manage Role" },
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
    description: "Full access to every CRM action and all data."
  },
  {
    value: "admin",
    label: "Admin",
    description: "Existing admin defaults for operational masters and administration modules."
  },
  {
    value: "manager",
    label: "Manager",
    description: "Team-scoped relationship, meeting, lead, quotation and reporting access."
  },
  {
    value: "employee",
    label: "Employee / Sales / Operations Executive",
    description: "Own and assigned CRM work with standard team workspace access."
  },
  {
    value: "associate",
    label: "Associate",
    description: "External associate with own and assigned CRM work access."
  },
  {
    value: "partner",
    label: "Partner",
    description: "External partner with own and assigned CRM work access."
  },
  {
    value: "finance",
    label: "Finance",
    description: "Finance-focused vendor, payment and reporting access."
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

const ACTION_DEFINITION_MAP = new Map(
  ACCESS_MODULES.flatMap(module =>
    module.actions.map(action => [action.key, { ...action, moduleKey: module.key }])
  )
);

const ADMIN_ENTRY_PERMISSIONS = [
  "dashboard.view",
  "travel_agents.view",
  "engagements.view",
  "meetings.view",
  "leads.view",
  "quotations.view",
  "vendors.view",
  "payments.view",
  "reports.view",
  "destinations.view",
  "communications.view",
  "documents.view",
  "users.view",
  "settings.view"
];

const ADMIN_ROUTE_RULES = [
  [/^\/admin\/users\/new(?:\/|$)/, "users.create"],
  [/^\/admin\/roles(?:\/|$)/, "users.manage_role"],
  [/^\/admin\/users(?:\/|$)/, "users.view"],
  [/^\/admin\/travel-agents\/(?:new|bulk-upload)(?:\/|$)/, "travel_agents.create"],
  [/^\/admin\/vendors\/new(?:\/|$)/, "vendors.create"],
  [/^\/admin\/destinations\/new(?:\/|$)/, "destinations.create"],
  [/^\/admin\/destinations\/[^/]+(?:\/|$)/, "destinations.edit"],
  [/^\/admin\/settings\/branding(?:\/|$)/, "settings.view"],
  [/^\/admin\/settings\/quotation-templates(?:\/|$)/, "quotations.view"],
  [/^\/admin\/communication-templates\/[^/]+(?:\/|$)/, "communications.edit"],
  [/^\/admin\/communication-templates(?:\/|$)/, "communications.view"],
  [/^\/admin\/template-categories(?:\/|$)/, "communications.edit"],
  [/^\/admin\/documents(?:\/|$)/, "documents.view"],
  [/^\/admin\/destinations(?:\/|$)/, "destinations.view"],
  [/^\/admin\/vendors(?:\/|$)/, "vendors.view"],
  [/^\/admin\/leads(?:\/|$)/, "leads.view"],
  [/^\/admin\/meetings(?:\/|$)/, "meetings.view"],
  [/^\/admin\/engagements(?:\/|$)/, "engagements.view"],
  [/^\/admin\/travel-agents(?:\/|$)/, "travel_agents.view"],
  [/^\/admin\/action-center(?:\/|$)/, "dashboard.view"],
  [/^\/admin\/dashboard(?:\/|$)/, "dashboard.view"]
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
    if (!ACTION_DEFINITION_MAP.has(key)) return;
    defaults[key] = {
      allowed: true,
      scope: ACTION_DEFINITION_MAP.get(key)?.supportsScope ? normalizeScope(scope, "all") : "all"
    };
  });
}

function allowModule(defaults, moduleKey, scope = "all", excludedActions = []) {
  const module = ACCESS_MODULES.find(item => item.key === moduleKey);
  if (!module) return;
  const keys = module.actions
    .filter(action => !excludedActions.includes(action.key))
    .map(action => action.key);
  allow(defaults, keys, scope);
}

export function normalizeRole(role) {
  const normalized = clean(role).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "team" || normalized === "sales" || normalized === "operations_executive") {
    return "employee";
  }
  return ROLE_OPTIONS.some(item => item.value === normalized) ? normalized : "employee";
}

export function getRoleAccessDefaults(role) {
  const normalizedRole = normalizeRole(role);
  const defaults = createDeniedDefaults();

  if (normalizedRole === "super_admin") {
    Object.keys(defaults).forEach(key => {
      defaults[key] = { allowed: true, scope: "all" };
    });
    return defaults;
  }

  if (normalizedRole === "admin") {
    ["destinations", "travel_agents", "engagements", "meetings", "quotations", "vendors", "communications", "documents"]
      .forEach(moduleKey => allowModule(defaults, moduleKey, "all"));
    allowModule(defaults, "payments", "all");
    return defaults;
  }

  if (normalizedRole === "manager") {
    allow(defaults, ["dashboard.view"], "team");
    ["travel_agents", "engagements", "meetings", "leads", "quotations"]
      .forEach(moduleKey => allowModule(defaults, moduleKey, "team"));
    allow(defaults, [
      "payments.view",
      "payments.create",
      "payments.edit",
      "payments.view_vendor_cost",
      "payments.view_revenue_gp"
    ], "team");
    allow(defaults, ["reports.view", "reports.export"], "team");
    return defaults;
  }

  if (["employee", "associate", "partner"].includes(normalizedRole)) {
    allow(defaults, ["dashboard.view"], "own_assigned");
    allow(defaults, ["travel_agents.view"], "assigned");
    allow(defaults, ["engagements.view", "engagements.create", "engagements.edit"], "own_assigned");
    allow(defaults, ["meetings.view", "meetings.schedule", "meetings.edit", "meetings.cancel"], "own_assigned");
    allow(defaults, ["leads.view", "leads.create", "leads.edit"], "own_assigned");
    allow(defaults, ["payments.view", "payments.create", "payments.edit"], "own_assigned");
    allow(defaults, [
      "quotations.view",
      "quotations.create",
      "quotations.edit",
      "quotations.send",
      "quotations.resend",
      "quotations.delete_draft",
      "quotations.create_revision"
    ], "own_assigned");
    return defaults;
  }

  if (normalizedRole === "finance") {
    allow(defaults, ["dashboard.view"], "all");
    allow(defaults, ["vendors.view"], "all");
    allowModule(defaults, "payments", "all");
    allow(defaults, ["reports.view", "reports.export", "quotations.view"], "all");
    return defaults;
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

export function isManagementRole(role) {
  return ["super_admin", "admin", "manager", "finance"].includes(normalizeRole(role));
}

export function isSuperAdmin(user) {
  const role = normalizeRole(user?.role);
  return role === "super_admin" || user?.isSuperAdmin === true || user?.superAdmin === true;
}

export function isAdmin(user) {
  const role = normalizeRole(user?.role);
  return role === "admin" || user?.isAdmin === true || isSuperAdmin(user);
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getOverride(user, permissionKey) {
  return user?.accessOverrides?.[permissionKey] || user?.permissionOverrides?.[permissionKey] || null;
}

function isOverrideActive(override, now = new Date()) {
  if (!override || override.state === "default") return false;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const fromMs = toMillis(override.accessFrom);
  const untilMs = toMillis(override.accessUntil);
  if (fromMs && nowMs < fromMs) return false;
  if (untilMs && nowMs > untilMs) return false;
  return true;
}

export function resolveAccess(user, permissionKey, now = new Date()) {
  if (!user || user.active === false) {
    return { allowed: false, scope: "none", source: "inactive", expired: false };
  }

  if (isSuperAdmin(user)) {
    return { allowed: true, scope: "all", source: "super_admin", expired: false };
  }

  const normalizedKey = LEGACY_PERMISSION_TO_ACTION[permissionKey] || permissionKey;
  const definition = ACTION_DEFINITION_MAP.get(normalizedKey);

  if (!definition) {
    if (user.permissions && Object.prototype.hasOwnProperty.call(user.permissions, permissionKey)) {
      return {
        allowed: Boolean(user.permissions[permissionKey]),
        scope: Boolean(user.permissions[permissionKey]) ? "all" : "none",
        source: "legacy",
        expired: false
      };
    }
    return { allowed: false, scope: "none", source: "unknown", expired: false };
  }

  const roleDefault = getRoleAccessDefaults(user.role)[normalizedKey] || { allowed: false, scope: "none" };
  const override = getOverride(user, normalizedKey);
  const active = isOverrideActive(override, now);
  const untilMs = toMillis(override?.accessUntil);
  const expired = Boolean(override && override.state !== "default" && untilMs && untilMs < now.getTime());

  if (!active) {
    return {
      allowed: Boolean(roleDefault.allowed),
      scope: roleDefault.allowed
        ? normalizeScope(roleDefault.scope, definition.supportsScope ? "all" : "all")
        : "none",
      source: expired ? "role_default_after_expiry" : "role_default",
      expired
    };
  }

  if (override.state === "deny") {
    return { allowed: false, scope: "none", source: "override_deny", expired: false };
  }

  if (override.state === "allow") {
    return {
      allowed: true,
      scope: definition.supportsScope
        ? normalizeScope(override.scope, roleDefault.scope || "all")
        : "all",
      source: "override_allow",
      expired: false
    };
  }

  return {
    allowed: Boolean(roleDefault.allowed),
    scope: roleDefault.allowed ? normalizeScope(roleDefault.scope, "all") : "none",
    source: "role_default",
    expired: false
  };
}

export function canAccess(user, permissionKey, now = new Date()) {
  return resolveAccess(user, permissionKey, now).allowed;
}

export function getDataScope(user, permissionKey, now = new Date()) {
  return resolveAccess(user, permissionKey, now).scope;
}

export function getEffectiveAccessMap(user, now = new Date()) {
  return Object.fromEntries(
    Array.from(ACTION_DEFINITION_MAP.keys()).map(key => [key, resolveAccess(user, key, now)])
  );
}

export function getEffectiveLegacyPermissions(user, now = new Date()) {
  return MODULE_PERMISSIONS.reduce((acc, module) => {
    const key = LEGACY_PERMISSION_TO_ACTION[module.key];
    acc[module.key] = key ? canAccess(user, key, now) : false;
    return acc;
  }, {});
}

export function canEnterAdminArea(user, now = new Date()) {
  return Boolean(user?.active !== false && ADMIN_ENTRY_PERMISSIONS.some(key => canAccess(user, key, now)));
}

export function getRequiredPermissionForPath(pathname = "", { admin = false } = {}) {
  const rules = admin ? ADMIN_ROUTE_RULES : TEAM_ROUTE_RULES;
  return rules.find(([pattern]) => pattern.test(pathname))?.[1] || null;
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
  const access = resolveAccess(user, permissionKey, options.now || new Date());
  if (!access.allowed) return false;
  if (!record) return access.scope !== "none";
  if (access.scope === "all") return true;
  if (access.scope === "none") return false;

  const userValues = valuesForUser(user);

  const ownFields = {
    lead: ["ownerUid", "ownerEmail", "createdByUid", "createdByEmail", "createdBy", "creatorUid", "creatorEmail"],
    travel_agent: ["createdByUid", "createdByEmail", "createdBy", "creatorUid", "creatorEmail"],
    engagement: ["createdByUid", "createdByEmail", "createdBy", "performedByUid", "performedByEmail"],
    meeting: ["createdByUid", "createdByEmail", "createdBy", "scheduledByUid", "scheduledByEmail", "ownerUid", "ownerEmail"],
    quotation: ["createdByUid", "createdByEmail", "createdBy", "ownerUid", "ownerEmail"],
    payment: ["createdByUid", "createdByEmail", "createdBy", "ownerUid", "ownerEmail"]
  };

  const assignedFields = {
    lead: ["assignedToUid", "assignedToEmail", "assignedTo", "assignedUserUid", "assigneeUid", "assigneeEmail"],
    travel_agent: ["assignedToUid", "assignedToEmail", "assignedTo", "accountManagerUid"],
    engagement: ["assignedToUid", "assignedToEmail", "assignedTo"],
    meeting: ["assignedToUid", "assignedToEmail", "assignedTo", "assignedUserUid", "assignedUserEmail", "assignedUserKey", "teamMemberUid", "meetingOwnerUid", "meetingOwnerEmail"],
    quotation: ["assignedToUid", "assignedToEmail", "assignedTo", "leadOwnerUid", "leadAssigneeUid"],
    payment: ["assignedToUid", "assignedToEmail", "assignedTo", "leadOwnerUid", "leadAssigneeUid"]
  };

  const owns = anyRecordValueMatches(record, ownFields[kind] || ownFields.lead, userValues);
  const assigned = anyRecordValueMatches(record, assignedFields[kind] || assignedFields.lead, userValues);

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

export function normalizeAccessOverrides(overrides = {}) {
  const normalized = {};

  Object.entries(overrides || {}).forEach(([key, raw]) => {
    if (!ACTION_DEFINITION_MAP.has(key) || !raw || typeof raw !== "object") return;
    const state = ["default", "allow", "deny"].includes(raw.state) ? raw.state : "default";
    if (state === "default") return;

    const definition = ACTION_DEFINITION_MAP.get(key);
    normalized[key] = {
      state,
      scope: state === "allow" && definition?.supportsScope
        ? normalizeScope(raw.scope, "all")
        : "none",
      accessFrom: raw.accessFrom || null,
      accessUntil: raw.accessUntil || null,
      reason: clean(raw.reason)
    };
  });

  return normalized;
}
