// lib/userProfileRef.js

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function getUserProfileByUid(uid) {
  if (!uid) {
    throw new Error("UID is required");
  }

  const usersRef = collection(db, "users");

  const uidQuery = query(
    usersRef,
    where("uid", "==", uid),
    limit(1)
  );

  const uidSnap = await getDocs(uidQuery);

  if (!uidSnap.empty) {
    const docSnap = uidSnap.docs[0];

    return {
      id: docSnap.id,
      ref: docSnap.ref,
      data: docSnap.data(),
      exists: true
    };
  }

  return {
    id: uid,
    ref: doc(db, "users", uid),
    data: {},
    exists: false
  };
}

export async function getUserProfileDocRefByUid(uid) {
  const profile = await getUserProfileByUid(uid);
  return profile.ref;
}