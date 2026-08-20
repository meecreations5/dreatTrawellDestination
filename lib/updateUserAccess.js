import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

function normalizeCallableError(error) {
  const rawCode = String(error?.code || "").replace(/^functions\//, "");
  const rawMessage = String(error?.message || "").trim();

  const friendlyByCode = {
    "permission-denied": rawMessage || "You do not have permission to update this user.",
    "failed-precondition": rawMessage || "This role change is blocked by a safety rule.",
    "invalid-argument": rawMessage || "The user or role data is invalid.",
    "not-found": "The user record no longer exists.",
    unauthenticated: "Your session is no longer authenticated. Please sign in again.",
    unavailable: "The user-management service is temporarily unavailable. Please try again."
  };

  if (friendlyByCode[rawCode]) return new Error(friendlyByCode[rawCode]);

  if (rawCode === "internal" || rawMessage.toLowerCase() === "internal") {
    return new Error(
      "The server could not update this user. Deploy the latest updateUserAccess Cloud Function and try again."
    );
  }

  return new Error(rawMessage || "Failed to update user.");
}

export async function updateUserAccess(payload) {
  const functions = getFunctions(app, "us-central1");
  const fn = httpsCallable(functions, "updateUserAccess");

  // Only simple profile/role/status fields are part of the active access model.
  const safePayload = {
    userId: payload?.userId,
    name: payload?.name,
    mobile: payload?.mobile,
    teamName: payload?.teamName,
    role: payload?.role,
    active: payload?.active,
    authProvider: payload?.authProvider,
    associateType: payload?.associateType,
    changeReason: payload?.changeReason
  };

  Object.keys(safePayload).forEach(key => {
    if (safePayload[key] === undefined) delete safePayload[key];
  });

  if (String(safePayload.role || "").trim().toLowerCase() === "super_admin") {
    safePayload.active = true;
  }

  try {
    const response = await fn(safePayload);
    const result = response?.data || {};

    if (result.roleModelVersion !== "2.7.5.8.1") {
      throw new Error(
        `The deployed updateUserAccess function is outdated (server: ${result.roleModelVersion || "unknown"}, required: 2.7.5.8.1). Deploy the functions from this build before changing roles.`
      );
    }

    // Never report a role change as successful when an older deployed
    // Cloud Function silently normalizes an unsupported role back to another
    // role (for example operation_executive -> employee).
    if (safePayload.role) {
      const requestedRole = String(safePayload.role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
      const persistedRole = String(result.role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

      if (persistedRole && persistedRole !== requestedRole) {
        throw new Error(
          `Role was not saved by the server. Requested ${requestedRole}, but the deployed user-management function saved ${persistedRole}. Deploy the latest updateUserAccess Firebase Function and try again.`
        );
      }

      if (requestedRole === "operation_executive" && !persistedRole) {
        throw new Error(
          "Operation Executive was not confirmed by the server. Deploy the latest updateUserAccess Firebase Function and try again."
        );
      }
    }

    return result;
  } catch (error) {
    console.error("UPDATE USER ERROR:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      userId: safePayload?.userId,
      requestedRole: safePayload?.role
    });

    throw normalizeCallableError(error);
  }
}
