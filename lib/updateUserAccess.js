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
    return response.data;
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
