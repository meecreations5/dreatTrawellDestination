import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    ""
  ).trim();
}

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = getProjectId();
  return initializeApp(projectId ? { projectId } : undefined);
}

export async function verifyFirebaseBearerToken(request) {
  const header = String(request?.headers?.get?.("authorization") || "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }

  const token = match[1].trim();
  const decoded = await getAuth(getAdminApp()).verifyIdToken(token, true);

  if (!decoded?.uid) {
    const error = new Error("Invalid login session");
    error.status = 401;
    throw error;
  }

  return decoded;
}
