// lib/assignLead.js

import {
  doc,
  updateDoc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { logLeadAction, LEAD_TIMELINE_TYPES } from "./logLeadAction";
import { sendWhatsAppWeb } from "./whatsapp";

export async function assignLead({
  leadId,
  newUser,
  assignedBy
}) {
  if (!leadId || !newUser || !assignedBy) {
    throw new Error("assignLead: missing required data");
  }

  /* =========================
     LOAD LEAD (TO GET OLD ASSIGNEE)
  ========================== */
  const ref = doc(db, "leads", leadId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Lead not found");
  }

  const lead = snap.data();

  const previousAssignee = lead.assignedToUid
    ? {
      uid: lead.assignedToUid,
      email: lead.assignedTo,
      name: lead.assignedToName || lead.assignedTo,
      phone: lead.assignedToMobile || null
    }
    : null;

  /* =========================
     UPDATE LEAD
  ========================== */
  await updateDoc(ref, {
    assignedToUid: newUser.uid,
    assignedTo: newUser.email,
    assignedToName: newUser.name || newUser.email,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  /* =========================
     TIMELINE
  ========================== */
  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.ASSIGNED,
    title: "Lead Reassigned",
    description: previousAssignee
      ? `Reassigned from ${previousAssignee.name} to ${newUser.name}`
      : `Assigned to ${newUser.name}`,
    metadata: {
      fromUid: previousAssignee?.uid || null,
      fromName: previousAssignee?.name || null,
      toUid: newUser.uid,
      toName: newUser.name
    },
    user: assignedBy
  });

  /* =========================
     📲 WHATSAPP NOTIFICATIONS
  ========================== */

  // 1️⃣ Notify NEW assignee
  if (newUser.phone) {
    sendWhatsAppWeb({
      mobile: newUser.phone,
      message: `
📌 New Lead Assigned
Lead: ${lead.leadCode}
Destination: ${lead.destinationName || "-"}
Assigned by: ${assignedBy.name || assignedBy.email}
      `.trim()
    });
  }

  // 2️⃣ Notify PREVIOUS assignee (if different)
  if (
    previousAssignee?.phone &&
    previousAssignee.uid !== newUser.uid
  ) {
    sendWhatsAppWeb({
      mobile: previousAssignee.phone,
      message: `
🔁 Lead Reassigned
Lead: ${lead.leadCode}
Destination: ${lead.destinationName || "-"}
Now assigned to: ${newUser.name}
      `.trim()
    });
  }
}
