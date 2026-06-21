export const MODULE_PERMISSIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Access admin dashboard overview"
  },
  {
    key: "destinationManagement",
    label: "Destination Management",
    description: "Create, update, delete and manage destinations"
  },
  {
    key: "travelAgentManagement",
    label: "Travel Agent Management",
    description: "Manage travel agents and their details"
  },
  {
    key: "vendorManagement",
    label: "Vendor Management",
    description: "Create, update, delete and manage vendors"
  },
  {
    key: "communicationManagement",
    label: "Communication Management",
    description: "Manage templates, communication logs and messages"
  },
  {
    key: "documentManagement",
    label: "Document Management",
    description: "Manage files, documents and uploaded media"
  },
  {
    key: "leadManagement",
    label: "Lead Management",
    description: "Manage leads, manual leads and lead analytics"
  },
  {
    key: "attendanceManagement",
    label: "Attendance Management",
    description: "Manage attendance, leave, history and regularisation"
  },
  {
    key: "userManagement",
    label: "User Management",
    description: "Create and manage internal users"
  },
  {
    key: "roleManagement",
    label: "Role Management",
    description: "Manage roles and permission access"
  },
  {
    key: "settingsManagement",
    label: "Settings Management",
    description: "Manage company, branding and system settings"
  }
];

export const ROLE_OPTIONS = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Full access to all modules, users, roles and settings."
  },
  {
    value: "admin",
    label: "Admin",
    description:
      "Access to Destination, Travel Agent, Vendor, Communication and Document Management."
  },
  {
    value: "employee",
    label: "Employee",
    description: "Internal employee with no admin access by default."
  },
  {
    value: "associate",
    label: "Associate",
    description: "External associate, freelancer or consultant."
  },
  {
    value: "partner",
    label: "Partner",
    description: "External business partner with limited access."
  }
];

/* =========================
   HELPERS
========================= */

export function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getEmptyPermissions() {
  return MODULE_PERMISSIONS.reduce((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {});
}

export function getPermissionsByRole(role) {
  const normalizedRole = normalizeRole(role);
  const permissions = getEmptyPermissions();

  if (normalizedRole === "super_admin") {
    MODULE_PERMISSIONS.forEach(item => {
      permissions[item.key] = true;
    });

    return permissions;
  }

  if (normalizedRole === "admin") {
    return {
      ...permissions,

      // Dashboard blocked for Admin
      dashboard: false,

      // Admin allowed modules
      destinationManagement: true,
      travelAgentManagement: true,
      vendorManagement: true,
      communicationManagement: true,
      documentManagement: true,

      // Admin blocked modules
      leadManagement: false,
      attendanceManagement: false,
      userManagement: false,
      roleManagement: false,
      settingsManagement: false
    };
  }

  return permissions;
}

export function isManagementRole(role) {
  const normalizedRole = normalizeRole(role);
  return ["super_admin", "admin"].includes(normalizedRole);
}

export function isSuperAdmin(user) {
  const role = normalizeRole(user?.role);

  return (
    role === "super_admin" ||
    user?.isSuperAdmin === true ||
    user?.superAdmin === true
  );
}

export function isAdmin(user) {
  const role = normalizeRole(user?.role);

  return role === "admin" || user?.isAdmin === true;
}

export function canAccess(user, permissionKey) {
  if (!user || user.active === false) return false;

  const role = normalizeRole(user.role);

  // Super Admin always has full access
  if (isSuperAdmin(user)) {
    return true;
  }

  // Parent menu without permissionKey
  if (!permissionKey) {
    return isAdmin(user);
  }

  /*
    Priority:
    1. User-specific permissions from Firestore
    2. Default permissions by role
  */
  if (
    user.permissions &&
    Object.prototype.hasOwnProperty.call(user.permissions, permissionKey)
  ) {
    return Boolean(user.permissions[permissionKey]);
  }

  const rolePermissions = getPermissionsByRole(role);

  return Boolean(rolePermissions[permissionKey]);
}