import {
  getFunctions,
  httpsCallable
} from "firebase/functions";

import { app } from "@/lib/firebase";
import { getPermissionsByRole } from "@/lib/rolePermissions";

const functions = getFunctions(app, "us-central1");

export async function createTeamUser(payload) {
  try {
    const createUserFn = httpsCallable(
      functions,
      "createTeamUser"
    );

    const role = payload.role || "employee";
    const permissions = getPermissionsByRole(role);

    const isSuperAdmin = role === "super_admin";
    const isAdmin = role === "super_admin" || role === "admin";

    const response = await createUserFn({
      email: payload.email?.trim().toLowerCase(),
      name: payload.name?.trim(),
      mobile: payload.mobile?.trim() || "",

      active: payload.active ?? true,
      role,
      authProvider: payload.authProvider || "google",

      isAdmin,
      isSuperAdmin,

      associateType:
        role === "associate" ? payload.associateType || "" : "",

      permissions
    });

    return response.data;
  } catch (error) {
    console.error("CREATE TEAM USER ERROR:", error);

    throw new Error(
      error?.message || "Failed to create user"
    );
  }
}

export async function deleteTeamUser(id) {
  try {
    const deleteUserFn = httpsCallable(functions, "deleteUser");

    const response = await deleteUserFn({ id });

    return response.data;
  } catch (error) {
    console.error("DELETE TEAM USER ERROR:", error);

    throw new Error(
      error?.message || "Failed to delete user"
    );
  }
}