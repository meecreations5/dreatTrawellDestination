import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { canAccess, normalizeRole } from "@/lib/rolePermissions";
import { DEFAULT_WORK_SCHEDULE, normalizeWorkSchedule } from "@/lib/workSchedule";

export const DEFAULT_PRODUCTIVITY_SETTINGS = {
  enabled: true,
  pulseIntervalMinutes: 15,
  requireSelfRating: true,
  showTodaySummary: true,
  showNextFocus: true,
  enabledRoles: ["employee", "operation_executive", "manager", "associate", "partner"],
  workSchedule: DEFAULT_WORK_SCHEDULE
};

export function normalizeProductivitySettings(settings = {}) {
  const interval = Math.min(120, Math.max(5, Number(settings?.pulseIntervalMinutes) || 15));
  const enabledRoles = Array.isArray(settings?.enabledRoles) && settings.enabledRoles.length
    ? settings.enabledRoles.map(normalizeRole)
    : DEFAULT_PRODUCTIVITY_SETTINGS.enabledRoles;

  return {
    ...DEFAULT_PRODUCTIVITY_SETTINGS,
    ...(settings || {}),
    pulseIntervalMinutes: interval,
    enabledRoles: Array.from(new Set(enabledRoles)),
    workSchedule: normalizeWorkSchedule(settings?.workSchedule)
  };
}

export async function getProductivitySettings() {
  const ref = doc(db, "settings", "engagementProductivity");
  const snap = await getDoc(ref);
  return normalizeProductivitySettings(snap.exists() ? snap.data() : {});
}


export function subscribeProductivitySettings(onChange, onError) {
  const ref = doc(db, "settings", "engagementProductivity");
  return onSnapshot(
    ref,
    snap => onChange?.(normalizeProductivitySettings(snap.exists() ? snap.data() : {})),
    error => {
      // The pulse must never disappear silently because a deployment has not yet
      // granted read access to the settings document. Keep the CRM usable with
      // the DreamTrawell defaults and surface the error for diagnostics.
      onChange?.(normalizeProductivitySettings(DEFAULT_PRODUCTIVITY_SETTINGS));
      onError?.(error);
    }
  );
}

export async function saveProductivitySettings(settings, user) {
  if (!user || !canAccess(user, "settings.edit")) {
    throw new Error("You do not have permission to edit productivity settings.");
  }

  const normalized = normalizeProductivitySettings(settings);

  await setDoc(
    doc(db, "settings", "engagementProductivity"),
    {
      ...normalized,
      updatedAt: serverTimestamp(),
      updatedByUid: user?.uid || "",
      updatedByName: user?.displayName || user?.name || user?.email || ""
    },
    { merge: true }
  );

  return normalized;
}
