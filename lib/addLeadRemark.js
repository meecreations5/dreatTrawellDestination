// lib/addLeadRemark.js

import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

import {
  logLeadAction,
  // LEAD_TIMELINE_TYPES
} from "./logLeadAction";
import { LEAD_EVENTS } from "./leadEvents";
export async function addLeadRemark({
  leadId,
  text,
  user
}) {
  if (!leadId || !text || !user) return;

  // Save remark
  await addDoc(
    collection(db, "leads", leadId, "remarks"),
    {
      text,
      createdByUid: user.uid,
      createdByEmail: user.email,
      createdAt: serverTimestamp()
    }
  );

  // Timeline log
  await logLeadAction({
    leadId,
    type: LEAD_EVENTS.REMARK,
    title: "Remark added",
    description: text,
    user
  });
}
