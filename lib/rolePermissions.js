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
      "Access to Destination, Travel Agent, Communication and Document Management."
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

export function getEmptyPermissions() {
  return MODULE_PERMISSIONS.reduce((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {});
}

export function getPermissionsByRole(role) {
  const permissions = getEmptyPermissions();

  if (role === "super_admin") {
    MODULE_PERMISSIONS.forEach((item) => {
      permissions[item.key] = true;
    });

    return permissions;
  }

  if (role === "admin") {
    return {
      ...permissions,

      // Dashboard blocked for Admin
      dashboard: false,

      // Admin allowed modules
      destinationManagement: true,
      travelAgentManagement: true,
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
  return ["super_admin", "admin"].includes(role);
}

export function canAccess(user, permissionKey) {
  if (!user || user.active === false) return false;

  if (user.role === "super_admin" || user.isSuperAdmin === true) {
    return true;
  }

  if (!permissionKey) {
    return user.role === "admin" || user.isAdmin === true;
  }

  return Boolean(user.permissions?.[permissionKey]);
}