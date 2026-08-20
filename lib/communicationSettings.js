// lib/communicationSettings.js

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_SETTINGS = {
  quotationManagementBcc: [],
  quotationCcSelectedTeamMember: true,
  quotationBccManagement: true
};

export async function getCommunicationSettings() {
  const ref = doc(db, "settings", "communication");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...snap.data()
  };
}

export async function saveCommunicationSettings(settings, user) {
  await setDoc(
    doc(db, "settings", "communication"),
    {
      quotationManagementBcc: Array.isArray(settings.quotationManagementBcc)
        ? settings.quotationManagementBcc
        : [],
      quotationCcSelectedTeamMember: Boolean(
        settings.quotationCcSelectedTeamMember
      ),
      quotationBccManagement: Boolean(settings.quotationBccManagement),
      updatedAt: serverTimestamp(),
      updatedByUid: user?.uid || "",
      updatedByName:
        user?.displayName || user?.name || user?.email || ""
    },
    { merge: true }
  );
}