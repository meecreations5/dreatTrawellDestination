// Server-side Firebase login verification without Firebase Admin credentials.
//
// The CRM frontend already authenticates users with Firebase Auth and sends the
// Firebase ID token as a Bearer token. The Next.js website can validate that
// token through Firebase Auth's REST API using the project's Web API key.
//
// This intentionally avoids firebase-admin/application-default credentials so
// the email API works on non-Google hosting such as the go.dreamtrawelldestination.com
// Next.js runtime.

function clean(value = "") {
  return String(value || "").trim();
}

function getFirebaseWebApiKey() {
  return clean(
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  );
}

function authError(message = "Authentication required", status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function lookupFirebaseUser(idToken) {
  const apiKey = getFirebaseWebApiKey();

  if (!apiKey) {
    throw authError(
      "Firebase Web API key is missing on the server. Configure NEXT_PUBLIC_FIREBASE_API_KEY.",
      500
    );
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ idToken }),
      cache: "no-store"
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const providerMessage = clean(result?.error?.message);
    const expired = /TOKEN_EXPIRED|INVALID_ID_TOKEN|USER_DISABLED|USER_NOT_FOUND/i.test(providerMessage);

    console.warn("Firebase ID token verification failed", {
      status: response.status,
      providerMessage
    });

    throw authError(
      expired
        ? "Your login session is invalid or expired. Please sign in again."
        : "Unable to verify your login session.",
      401
    );
  }

  const firebaseUser = Array.isArray(result?.users) ? result.users[0] : null;
  const uid = clean(firebaseUser?.localId);

  if (!uid) {
    throw authError("Invalid login session", 401);
  }

  return {
    uid,
    email: clean(firebaseUser?.email),
    email_verified: Boolean(firebaseUser?.emailVerified),
    disabled: Boolean(firebaseUser?.disabled)
  };
}

export async function verifyFirebaseBearerToken(request) {
  const header = clean(request?.headers?.get?.("authorization"));
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw authError("Authentication required", 401);
  }

  const token = clean(match[1]);
  if (!token) {
    throw authError("Authentication required", 401);
  }

  const user = await lookupFirebaseUser(token);

  if (user.disabled) {
    throw authError("Your CRM account is disabled", 403);
  }

  return user;
}
