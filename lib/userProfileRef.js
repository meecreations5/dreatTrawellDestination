// lib/userProfileRef.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";

function getProfileScore(data = {}) {
  let score = 0;

  if (data.signatureHtml || data.emailSignatureHtml) score += 20;
  if (data.whatsappSignature || data.signatureText) score += 20;
  if (data.profileUpdatedAt) score += 10;
  if (data.designation) score += 5;
  if (data.mobile) score += 5;
  if (data.email) score += 5;
  if (data.name || data.displayName) score += 5;
  if (data.signatureEnabled === false) score -= 10;

  return score;
}

export async function getUserProfileByUid(uid) {
  if (!uid) {
    throw new Error("UID is required");
  }

  const usersRef = collection(db, "users");

  const uidQuery = query(
    usersRef,
    where("uid", "==", uid)
  );

  const uidSnap = await getDocs(uidQuery);

  if (!uidSnap.empty) {
    const docs = uidSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ref: docSnap.ref,
      data: docSnap.data(),
      exists: true
    }));

    docs.sort(
      (a, b) => getProfileScore(b.data) - getProfileScore(a.data)
    );

    return docs[0];
  }

  const directRef = doc(db, "users", uid);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return {
      id: directSnap.id,
      ref: directSnap.ref,
      data: directSnap.data(),
      exists: true
    };
  }

  return {
    id: uid,
    ref: directRef,
    data: {},
    exists: false
  };
}

export async function getUserProfileDocRefByUid(uid) {
  const profile = await getUserProfileByUid(uid);
  return profile.ref;
}