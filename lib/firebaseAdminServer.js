// Server-side Firebase ID-token verification without Firebase Admin credentials.
//
// Dream Trawell's Next.js website may run outside Google Cloud, so it cannot
// rely on Application Default Credentials. It also should not need to call the
// Identity Toolkit accounts:lookup endpoint with the Firebase Web API key.
//
// Firebase ID tokens are standard RS256 JWTs signed by Google's Secure Token
// service. This module verifies the JWT signature with Google's public X.509
// certificates and validates the Firebase issuer/audience/time claims.

import crypto from "crypto";

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CLOCK_SKEW_SECONDS = 300;

let certificateCache = {
  expiresAt: 0,
  certificates: null
};

function clean(value = "") {
  return String(value === undefined || value === null ? "" : value).trim();
}

function authError(message = "Authentication required", status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function decodeBase64Url(value = "") {
  try {
    return Buffer.from(String(value || ""), "base64url");
  } catch {
    throw authError("Invalid login session", 401);
  }
}

function parseJsonPart(value = "") {
  try {
    return JSON.parse(decodeBase64Url(value).toString("utf8"));
  } catch {
    throw authError("Invalid login session", 401);
  }
}

function getProjectId() {
  return clean(
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "dreamtrawel-c646f"
  );
}

function getCacheMaxAgeSeconds(cacheControl = "") {
  const match = String(cacheControl || "").match(/(?:^|,)\s*max-age=(\d+)/i);
  const seconds = Number(match?.[1] || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 3600;
}

async function getGoogleCertificates() {
  const now = Date.now();
  if (
    certificateCache.certificates &&
    certificateCache.expiresAt > now + 30_000
  ) {
    return certificateCache.certificates;
  }

  let response;
  try {
    response = await fetch(FIREBASE_CERTS_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store"
    });
  } catch (error) {
    console.error("Firebase certificate fetch failed", {
      message: error?.message || String(error)
    });
    throw authError("Unable to verify your login session. Please try again.", 503);
  }

  if (!response.ok) {
    console.error("Firebase certificate fetch returned an error", {
      status: response.status
    });
    throw authError("Unable to verify your login session. Please try again.", 503);
  }

  const certificates = await response.json().catch(() => null);
  if (!certificates || typeof certificates !== "object") {
    throw authError("Unable to verify your login session. Please try again.", 503);
  }

  const maxAgeSeconds = getCacheMaxAgeSeconds(response.headers.get("cache-control"));
  certificateCache = {
    certificates,
    expiresAt: now + maxAgeSeconds * 1000
  };

  return certificates;
}

function validateFirebaseClaims(payload = {}, projectId = "") {
  const now = Math.floor(Date.now() / 1000);
  const issuer = `https://securetoken.google.com/${projectId}`;
  const subject = clean(payload?.sub);
  const audience = payload?.aud;
  const expiresAt = Number(payload?.exp || 0);
  const issuedAt = Number(payload?.iat || 0);
  const authTime = Number(payload?.auth_time || 0);

  if (audience !== projectId) {
    throw authError("Invalid login session", 401);
  }

  if (payload?.iss !== issuer) {
    throw authError("Invalid login session", 401);
  }

  if (!subject || subject.length > 128) {
    throw authError("Invalid login session", 401);
  }

  if (!Number.isFinite(expiresAt) || expiresAt <= now - CLOCK_SKEW_SECONDS) {
    throw authError("Your login session has expired. Please sign in again.", 401);
  }

  if (!Number.isFinite(issuedAt) || issuedAt > now + CLOCK_SKEW_SECONDS) {
    throw authError("Invalid login session", 401);
  }

  if (authTime && authTime > now + CLOCK_SKEW_SECONDS) {
    throw authError("Invalid login session", 401);
  }

  return subject;
}

async function verifyFirebaseIdToken(idToken) {
  const token = clean(idToken);
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw authError("Invalid login session", 401);
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader);
  const payload = parseJsonPart(encodedPayload);
  const kid = clean(header?.kid);

  if (header?.alg !== "RS256" || !kid) {
    throw authError("Invalid login session", 401);
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw authError("Firebase project ID is missing on the server", 500);
  }

  const certificates = await getGoogleCertificates();
  const certificate = certificates?.[kid];
  if (!certificate) {
    // The key may have rotated between requests. Clear the cache once and retry.
    certificateCache = { expiresAt: 0, certificates: null };
    const refreshedCertificates = await getGoogleCertificates();
    const refreshedCertificate = refreshedCertificates?.[kid];
    if (!refreshedCertificate) {
      throw authError("Unable to verify your login session. Please sign in again.", 401);
    }

    const verifiedAfterRefresh = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
      refreshedCertificate,
      decodeBase64Url(encodedSignature)
    );

    if (!verifiedAfterRefresh) {
      throw authError("Invalid login session", 401);
    }
  } else {
    const verified = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
      certificate,
      decodeBase64Url(encodedSignature)
    );

    if (!verified) {
      throw authError("Invalid login session", 401);
    }
  }

  const uid = validateFirebaseClaims(payload, projectId);

  return {
    uid,
    email: clean(payload?.email),
    email_verified: Boolean(payload?.email_verified),
    disabled: false,
    sign_in_provider: clean(payload?.firebase?.sign_in_provider)
  };
}

export async function verifyFirebaseBearerToken(request) {
  const header = clean(request?.headers?.get?.("authorization"));
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw authError("Authentication required", 401);
  }

  return verifyFirebaseIdToken(match[1]);
}
