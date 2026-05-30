import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import {
  collection,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase";

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  return provider;
}

function createMicrosoftProvider() {
  const provider = new OAuthProvider("microsoft.com");

  provider.setCustomParameters({
    prompt: "select_account",
  });

  provider.addScope("openid");
  provider.addScope("profile");
  provider.addScope("email");
  provider.addScope("User.Read");

  return provider;
}

function getFirebaseUserEmail(firebaseUser) {
  const rawEmail =
    firebaseUser?.email ||
    firebaseUser?.providerData?.[0]?.email ||
    null;

  if (!rawEmail) return null;

  return rawEmail.trim().toLowerCase();
}

async function findUserByEmail(email) {
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("email", "==", email)
    )
  );

  if (snap.empty) return null;

  const docSnap = snap.docs[0];

  return {
    id: docSnap.id,
    ref: docSnap.ref,
    ...docSnap.data(),
  };
}

async function loginWithProvider(provider, providerName) {
  const result = await signInWithPopup(auth, provider);
  const firebaseUser = result.user;

  const email = getFirebaseUserEmail(firebaseUser);

  if (!email) {
    await signOut(auth);
    throw new Error(
      "Email not found from provider. Please check Microsoft/Google account permissions."
    );
  }

  const profile = await findUserByEmail(email);

  if (!profile) {
    await signOut(auth);
    throw new Error("User profile not found");
  }

  if (profile.active !== true) {
    await signOut(auth);
    throw new Error("User is inactive");
  }

  if (profile.authProvider !== providerName) {
    await signOut(auth);

    throw new Error(
      `Please sign in with ${
        profile.authProvider === "microsoft"
          ? "Microsoft"
          : "Google"
      }`
    );
  }

  if (profile.uid !== firebaseUser.uid) {
    await updateDoc(profile.ref, {
      uid: firebaseUser.uid,
      updatedAt: new Date(),
    });
  }

  return {
    ...profile,
    uid: firebaseUser.uid,
    email,
  };
}

export function loginWithGoogle() {
  return loginWithProvider(
    createGoogleProvider(),
    "google"
  );
}

export function loginWithMicrosoft() {
  return loginWithProvider(
    createMicrosoftProvider(),
    "microsoft"
  );
}

export function getLoginErrorMessage(error) {
  if (
    error?.code ===
    "auth/account-exists-with-different-credential"
  ) {
    return "This email is already linked with another provider.";
  }

  if (error?.code === "auth/popup-blocked") {
    return "The sign-in popup was blocked by the browser.";
  }

  if (error?.code === "auth/popup-closed-by-user") {
    return "The sign-in window was closed before login finished.";
  }

  return error?.message || "Login failed. Please try again.";
}

export function logout() {
  return signOut(auth);
}