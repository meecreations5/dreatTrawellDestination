// lib/createTeamUser.js

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

export async function createTeamUser(payload) {
  const functions = getFunctions(app, "us-central1");
  const fn = httpsCallable(functions, "createTeamUser");

  const res = await fn(payload);
  return res.data;
}
