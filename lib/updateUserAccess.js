import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

function normalizeCallableError(error) {
  const code = String(error?.code || "").replace(/^functions\//, "").trim();
  const rawMessage = String(error?.message || "").trim();
  const meaningfulMessage = rawMessage && !["internal", "unknown", "not-found"].includes(rawMessage.toLowerCase());

  let message = rawMessage || "Unable to update this user.";
  if (code === "unauthenticated") {
    message = "Your login session could not be verified. Sign out, sign in again and retry.";
  } else if (code === "permission-denied") {
    message = meaningfulMessage ? rawMessage : "Your account does not have permission to update this user. Check Admin/Super Admin role permissions.";
  } else if (code === "failed-precondition") {
    message = meaningfulMessage ? rawMessage : "The server blocked this change. Check user-management function logs and duplicate user profiles.";
  } else if (code === "invalid-argument") {
    message = meaningfulMessage ? rawMessage : "The selected role or user details are invalid.";
  } else if (code === "not-found") {
    message = /user not found|user record no longer exists/i.test(rawMessage)
      ? "The user record was not found. Reload Team Management and try again."
      : "The user-management Cloud Function was not found in us-central1, or the target user was not found. Verify the function deployment and inspect its logs.";
  } else if (code === "unavailable" || code === "deadline-exceeded") {
    message = "The user-management service is unreachable or timed out. Check connectivity and the deployed Firebase Function in us-central1.";
  } else if (code === "resource-exhausted") {
    message = "The user update exceeded a Firebase service limit. Review updateUserAccess server logs before retrying.";
  } else if (code === "internal" || rawMessage.toLowerCase() === "internal") {
    message = "The Firebase user-management function failed on the server (functions/internal). Check updateUserAccess Cloud Function logs and verify that the latest function is deployed.";
  }

  const normalized = new Error(message);
  if (code) normalized.code = `functions/${code}`;
  return normalized;
}

function describeCallableError(error) {
  const code = String(error?.code || "unknown").trim().slice(0, 100);
  const message = String(error?.message || "No error message returned").replace(/[\r\n]+/g, " ").slice(0, 700);
  // String values are more reliable than an object in the Next.js 16 dev console.
  return `code=${code}; message=${message}`;
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

    if (result.roleModelVersion !== "2.7.5.8.3") {
      throw new Error(
        `The deployed updateUserAccess function is outdated (server: ${result.roleModelVersion || "unknown"}, required: 2.7.5.8.3). Deploy the functions from this build before changing roles.`
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
    // Expected callable errors should appear in the Edit User screen, rather
    // than triggering a Next.js dev overlay showing the unhelpful object `{}`.
    console.warn(`[User Management] updateUserAccess failed: ${describeCallableError(error)}`);
    throw normalizeCallableError(error);
  }
}
