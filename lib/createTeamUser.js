import {
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import { app } from "@/lib/firebase";

const functions = getFunctions(app, "us-central1");

export async function createTeamUser(payload) {
  try {
    const createUserFn = httpsCallable(
      functions,
      "createTeamUser"
    );

    const response = await createUserFn({
      ...payload,

      email: payload.email?.trim().toLowerCase(),
      name: payload.name?.trim(),
      mobile: payload.mobile?.trim() || "",

      active: payload.active ?? true,
      role: payload.role || "employee",
      authProvider: payload.authProvider || "google",
    });

    return response.data;
  } catch (error) {
    console.error("CREATE TEAM USER ERROR:", error);

    throw new Error(
      error?.message || "Failed to create user"
    );
  }
}