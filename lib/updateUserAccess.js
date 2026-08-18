import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

function toIsoOrNull(value) {
  if (!value) return null;

  const date = typeof value?.toDate === "function"
    ? value.toDate()
    : value instanceof Date
      ? value
      : new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function serializeAccessOverrides(overrides = {}) {
  return Object.fromEntries(
    Object.entries(overrides || {}).map(([key, override]) => [
      key,
      {
        state: override?.state || "default",
        scope: override?.scope || "none",
        accessFrom: toIsoOrNull(override?.accessFrom),
        accessUntil: toIsoOrNull(override?.accessUntil),
        reason: String(override?.reason || "").trim()
      }
    ])
  );
}

function normalizeCallableError(error) {
  const rawCode = String(error?.code || "").replace(/^functions\//, "");
  const rawMessage = String(error?.message || "").trim();

  const friendlyByCode = {
    "permission-denied": "You do not have permission to make this role/access change.",
    "failed-precondition": rawMessage || "This role/access change is blocked by a safety rule.",
    "invalid-argument": rawMessage || "The role/access data is invalid.",
    "not-found": "The user record no longer exists.",
    unauthenticated: "Your session is no longer authenticated. Please sign in again.",
    unavailable: "The role/access service is temporarily unavailable. Please try again."
  };

  if (friendlyByCode[rawCode]) {
    return new Error(friendlyByCode[rawCode]);
  }

  if (rawCode === "internal" || rawMessage.toLowerCase() === "internal") {
    return new Error(
      "The server could not update this role/access record. Deploy the latest updateUserAccess Cloud Function and try again."
    );
  }

  return new Error(rawMessage || "Failed to update user role/access.");
}

export async function updateUserAccess(payload) {
  const functions = getFunctions(app, "us-central1");
  const fn = httpsCallable(functions, "updateUserAccess");
  const role = String(payload?.role || "").trim().toLowerCase();
  const safePayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(payload || {}, "accessOverrides")) {
    safePayload.accessOverrides = serializeAccessOverrides(payload.accessOverrides || {});
  }

  // Promotion to Super Admin is always clean, active, unrestricted role access.
  if (role === "super_admin") {
    safePayload.active = true;
    safePayload.accessOverrides = {};
  }

  try {
    const response = await fn(safePayload);
    return response.data;
  } catch (error) {
    console.error("UPDATE USER ACCESS CALLABLE ERROR:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      userId: safePayload?.userId,
      requestedRole: safePayload?.role
    });

    throw normalizeCallableError(error);
  }
}
