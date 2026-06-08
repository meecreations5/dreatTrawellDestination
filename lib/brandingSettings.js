// lib/brandingSettings.js

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export const DEFAULT_BRANDING = {
  companyName: "DreamTrawell Destination",
  companyLogoUrl: "",
  websiteUrl: "https://go.dreamtrawelldestination.com",
  emailAssetBaseUrl: "https://go.dreamtrawelldestination.com",

  facebookUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",

  supportEmail: "info@dreamtrawelldestination.com",
  supportMobile: ""
};

export async function getBrandingSettings() {
  const ref = doc(db, "settings", "branding");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return DEFAULT_BRANDING;
  }

  return {
    ...DEFAULT_BRANDING,
    ...snap.data()
  };
}

export async function saveBrandingSettings(settings, user) {
  await setDoc(
    doc(db, "settings", "branding"),
    {
      companyName:
        settings.companyName || "DreamTrawell Destination",

      companyLogoUrl: settings.companyLogoUrl || "",

      websiteUrl:
        settings.websiteUrl || "https://go.dreamtrawelldestination.com",

      emailAssetBaseUrl:
        settings.emailAssetBaseUrl ||
        "https://go.dreamtrawelldestination.com",

      facebookUrl: settings.facebookUrl || "",
      instagramUrl: settings.instagramUrl || "",
      linkedinUrl: settings.linkedinUrl || "",
      youtubeUrl: settings.youtubeUrl || "",

      supportEmail:
        settings.supportEmail ||
        "info@dreamtrawelldestination.com",

      supportMobile: settings.supportMobile || "",

      updatedAt: serverTimestamp(),
      updatedByUid: user?.uid || "",
      updatedByName:
        user?.displayName || user?.name || user?.email || ""
    },
    { merge: true }
  );
}