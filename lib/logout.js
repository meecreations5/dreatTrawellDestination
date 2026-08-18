// lib/logout.js

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function logout() {
  await signOut(auth);
}
