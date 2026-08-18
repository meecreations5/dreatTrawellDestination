import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  query
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toMeetingDate } from "@/lib/meetings";
import { canAccessRecord } from "@/lib/rolePermissions";

const clean = value => String(value || "").trim();

function getUserName(user = {}) {
  return clean(user.name || user.fullName || user.displayName || user.email || "System");
}

function getUserEmail(user = {}) {
  return clean(user.email || user.workEmail || user.officialEmail);
}

export async function checkMeetingConflicts({ assignedUserKey, startAt, endAt, excludeMeetingId = "" }) {
  if (!assignedUserKey || !startAt || !endAt) return [];

  const snap = await getDocs(
    query(collection(db, "meetings"), where("assignedUserKey", "==", assignedUserKey))
  );

  const start = toMeetingDate(startAt);
  const end = toMeetingDate(endAt);
  if (!start || !end) return [];

  return snap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.id !== excludeMeetingId)
    .filter(item => ["scheduled", "rescheduled"].includes(item.status || "scheduled"))
    .filter(item => {
      const itemStart = toMeetingDate(item.scheduledStartAt);
      const itemEnd = toMeetingDate(item.scheduledEndAt);
      if (!itemStart || !itemEnd) return false;
      return start < itemEnd && end > itemStart;
    });
}

export async function saveMeeting({ meetingId = "", meeting, user }) {
  if (!meeting?.travelAgentId) throw new Error("Travel Agent is required.");
  if (!meeting?.assignedUserKey) throw new Error("Assigned Team Member is required.");

  const start = toMeetingDate(meeting.scheduledStartAt);
  const end = toMeetingDate(meeting.scheduledEndAt);
  if (!start || !end || end <= start) throw new Error("Valid meeting start and end time are required.");

  let existingMeeting = null;
  if (meetingId) {
    const existingSnap = await getDoc(doc(db, "meetings", meetingId));
    existingMeeting = existingSnap.exists() ? { id: existingSnap.id, ...existingSnap.data() } : null;
    if (!existingMeeting) throw new Error("Meeting not found.");
    if (!canAccessRecord(user, "meetings.edit", existingMeeting, "meeting")) {
      throw new Error("You do not have permission to edit this meeting.");
    }
  } else if (!canAccessRecord(user, "meetings.schedule", meeting, "meeting")) {
    throw new Error("You do not have permission to schedule this meeting.");
  }

  const actorKeys = new Set([clean(user?.uid), clean(user?.id), clean(user?.email).toLowerCase()].filter(Boolean));
  const assigneeKeys = [clean(meeting.assignedUserUid), clean(meeting.assignedUserKey), clean(meeting.assignedUserEmail).toLowerCase()].filter(Boolean);
  const assigningAnotherUser = assigneeKeys.length > 0 && !assigneeKeys.some(value => actorKeys.has(value));
  if (assigningAnotherUser && !canAccessRecord(user, "meetings.assign_another_user", meeting, "meeting")) {
    throw new Error("You do not have permission to assign a meeting to another user.");
  }

  const conflicts = await checkMeetingConflicts({
    assignedUserKey: meeting.assignedUserKey,
    startAt: start,
    endAt: end,
    excludeMeetingId: meetingId
  });

  if (conflicts.length) {
    const conflict = conflicts[0];
    const conflictStart = toMeetingDate(conflict.scheduledStartAt);
    const conflictEnd = toMeetingDate(conflict.scheduledEndAt);
    throw new Error(
      `${meeting.assignedUserName || "This team member"} already has a meeting from ${conflictStart?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) || "another time"} to ${conflictEnd?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) || "another time"}.`
    );
  }

  const payload = {
    schemaVersion: 1,
    travelAgentId: clean(meeting.travelAgentId),
    travelAgentName: clean(meeting.travelAgentName),
    travelAgentCode: clean(meeting.travelAgentCode),
    travelAgentContactName: clean(meeting.travelAgentContactName),
    travelAgentEmail: clean(meeting.travelAgentEmail).toLowerCase(),
    travelAgentWhatsapp: clean(meeting.travelAgentWhatsapp),
    leadId: clean(meeting.leadId),
    leadCode: clean(meeting.leadCode),
    sourceEngagementId: clean(meeting.sourceEngagementId),
    sourceEngagementChannel: clean(meeting.sourceEngagementChannel),
    sourceEngagementSummary: clean(meeting.sourceEngagementSummary),

    assignedUserKey: clean(meeting.assignedUserKey),
    assignedUserUid: clean(meeting.assignedUserUid),
    assignedUserName: clean(meeting.assignedUserName),
    assignedUserEmail: clean(meeting.assignedUserEmail).toLowerCase(),
    assignedUserMobile: clean(meeting.assignedUserMobile),
    assignedTeam: clean(meeting.assignedTeam),

    meetingType: clean(meeting.meetingType || "in_person"),
    scheduledStartAt: Timestamp.fromDate(start),
    scheduledEndAt: Timestamp.fromDate(end),
    durationMinutes: Number(meeting.durationMinutes || 30),
    agenda: clean(meeting.agenda),
    meetingLink: clean(meeting.meetingLink),
    phone: clean(meeting.phone),
    reminderMinutes: Number(meeting.reminderMinutes || 30),

    location: {
      venue: clean(meeting.location?.venue),
      address: clean(meeting.location?.address),
      subArea: clean(meeting.location?.subArea),
      city: clean(meeting.location?.city),
      state: clean(meeting.location?.state),
      pincode: clean(meeting.location?.pincode),
      latitude: clean(meeting.location?.latitude),
      longitude: clean(meeting.location?.longitude),
      mapUrl: clean(meeting.location?.mapUrl)
    },

    status: meetingId ? clean(meeting.status || "rescheduled") : "scheduled",
    updatedAt: serverTimestamp(),
    updatedByUid: clean(user?.uid),
    updatedByName: getUserName(user),
    updatedByEmail: getUserEmail(user)
  };

  if (meetingId) {
    await updateDoc(doc(db, "meetings", meetingId), {
      ...payload,
      rescheduledAt: serverTimestamp(),
      rescheduledByUid: clean(user?.uid),
      rescheduledByName: getUserName(user)
    });
    return meetingId;
  }

  const ref = await addDoc(collection(db, "meetings"), {
    ...payload,
    createdAt: serverTimestamp(),
    createdByUid: clean(user?.uid),
    createdByName: getUserName(user),
    createdByEmail: getUserEmail(user)
  });
  return ref.id;
}

export async function completeMeeting({ meetingId, outcome, mom, nextAction, nextFollowUpAt, potentialUpdate = "", user }) {
  if (!meetingId) throw new Error("Meeting ID is required.");
  if (!outcome) throw new Error("Meeting outcome is required.");
  if (!String(mom || "").trim()) throw new Error("Meeting notes / MOM are required.");

  const nextFollowUp = toMeetingDate(nextFollowUpAt);
  const meetingRef = doc(db, "meetings", meetingId);
  const meetingSnap = await getDoc(meetingRef);
  const meeting = meetingSnap.exists() ? { id: meetingSnap.id, ...meetingSnap.data() } : null;

  if (!meeting || !canAccessRecord(user, "meetings.edit", meeting, "meeting")) {
    throw new Error("You do not have permission to complete this meeting.");
  }

  await updateDoc(meetingRef, {
    status: "completed",
    outcome: clean(outcome),
    mom: clean(mom),
    nextAction: clean(nextAction),
    nextFollowUpAt: nextFollowUp ? Timestamp.fromDate(nextFollowUp) : null,
    potentialUpdate: clean(potentialUpdate),
    completedAt: serverTimestamp(),
    completedByUid: clean(user?.uid),
    completedByName: getUserName(user),
    completedByEmail: getUserEmail(user),
    updatedAt: serverTimestamp()
  });

  // Completing a meeting should create its own engagement entry so team members
  // never have to log the same work twice. Existing engagement records are not
  // changed; this is additive for V2.6 meetings only.
  if (meeting?.travelAgentId) {
    const engagementId = `meeting_${meetingId}`;
    await setDoc(doc(db, "engagements", engagementId), {
      schemaVersion: 2,
      meetingId,
      agentId: meeting.travelAgentId,
      travelAgentId: meeting.travelAgentId,
      agentName: meeting.travelAgentName || "",
      travelAgentName: meeting.travelAgentName || "",
      channel: "meeting",
      type: "meeting",
      engagementType: "meeting",
      outcome: clean(outcome),
      note: clean(mom),
      remarks: clean(mom),
      nextAction: clean(nextAction),
      nextFollowUpAt: nextFollowUp ? Timestamp.fromDate(nextFollowUp) : null,
      performedByUid: clean(user?.uid),
      performedByName: getUserName(user),
      performedByEmail: getUserEmail(user),
      ownerUid: clean(user?.uid),
      ownerName: getUserName(user),
      ownerEmail: getUserEmail(user),
      createdAt: serverTimestamp(),
      engagedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await updateDoc(meetingRef, {
      engagementId,
      updatedAt: serverTimestamp()
    });

    const agentUpdate = {
      lastEngagementAt: serverTimestamp(),
      lastContactedAt: serverTimestamp(),
      lastEngagementType: "Meeting",
      lastEngagementNote: clean(mom),
      nextContactAt: nextFollowUp ? Timestamp.fromDate(nextFollowUp) : null,
      updatedAt: serverTimestamp()
    };
    if (clean(potentialUpdate)) {
      agentUpdate.potentialLevel = clean(potentialUpdate);
      agentUpdate.potentialUpdatedAt = serverTimestamp();
      agentUpdate.potentialUpdatedByUid = clean(user?.uid);
      agentUpdate.potentialUpdatedByName = getUserName(user);
    }
    await updateDoc(doc(db, "travelAgents", meeting.travelAgentId), agentUpdate);
  }
}

export async function updateMeetingStatus({ meetingId, status, reason = "", noShowParty = "", user }) {
  if (!meetingId || !status) throw new Error("Meeting and status are required.");

  const meetingRef = doc(db, "meetings", meetingId);
  const meetingSnap = await getDoc(meetingRef);
  const meeting = meetingSnap.exists() ? { id: meetingSnap.id, ...meetingSnap.data() } : null;
  const permission = status === "cancelled" ? "meetings.cancel" : "meetings.edit";
  if (!meeting || !canAccessRecord(user, permission, meeting, "meeting")) {
    throw new Error("You do not have permission to update this meeting status.");
  }

  await updateDoc(meetingRef, {
    status,
    statusReason: clean(reason),
    noShowParty: clean(noShowParty),
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedByUid: clean(user?.uid),
    statusUpdatedByName: getUserName(user),
    updatedAt: serverTimestamp()
  });
}
