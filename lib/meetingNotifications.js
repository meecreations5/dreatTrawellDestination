"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { getBrandingSettings } from "@/lib/brandingSettings";
import { getUserProfileByUid } from "@/lib/userProfileRef";
import {
  buildEmailSignatureHtml,
  getFirstValue,
  getMemberEmail,
  getMemberName
} from "@/lib/signatureUtils";
import {
  buildInternalEmailTemplate,
  buildTravelAgentEmailTemplate
} from "@/lib/emailTemplates";
import { MEETING_TYPES, toMeetingDate } from "@/lib/meetings";

const clean = value => String(value || "").trim();
const DEFAULT_WHATSAPP_MODE =
  clean(process.env.NEXT_PUBLIC_MEETING_WHATSAPP_MODE).toLowerCase() === "cloud"
    ? "cloud"
    : "manual";

function escapeHtml(value = "") {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
  const date = toMeetingDate(value);
  if (!date) return "Not specified";
  return date.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getMeetingTypeLabel(value = "") {
  return MEETING_TYPES.find(item => item.value === value)?.label || clean(value) || "Meeting";
}

function getLocationText(meeting = {}) {
  if (meeting.meetingType === "online") {
    return clean(meeting.meetingLink) || "Online meeting";
  }
  if (meeting.meetingType === "phone") {
    return clean(meeting.phone) || clean(meeting.travelAgentWhatsapp) || "Phone call";
  }

  const location = meeting.location || {};
  return [
    location.venue,
    location.address,
    location.subArea,
    location.city,
    location.state,
    location.pincode
  ].map(clean).filter(Boolean).join(", ") || "Location to be confirmed";
}

function getMapLink(meeting = {}) {
  const location = meeting.location || {};
  if (clean(location.mapUrl)) return clean(location.mapUrl);
  if (clean(location.latitude) && clean(location.longitude)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
  }
  const query = getLocationText(meeting);
  return meeting.meetingType === "in_person" && query
    ? `https://www.google.com/maps?q=${encodeURIComponent(query)}`
    : "";
}

export function getMeetingNotificationEventLabel(eventType = "scheduled") {
  if (eventType === "rescheduled") return "Meeting Rescheduled";
  if (eventType === "cancelled") return "Meeting Cancelled";
  return "Meeting Scheduled";
}

function mergeProfile(base = {}, profile = {}) {
  return {
    ...(base || {}),
    ...(profile || {}),
    uid: getFirstValue(base?.uid, profile?.uid, base?.id, profile?.id),
    id: getFirstValue(base?.id, profile?.id, base?.uid, profile?.uid)
  };
}

async function loadUserProfile({ uid = "", key = "", fallback = {} } = {}) {
  let profileData = {};

  try {
    if (clean(uid)) {
      const profile = await getUserProfileByUid(clean(uid));
      profileData = profile?.data || {};
    } else if (clean(key).startsWith("userdoc:")) {
      const userDocId = clean(key).slice("userdoc:".length);
      if (userDocId) {
        const snapshot = await getDoc(doc(db, "users", userDocId));
        profileData = snapshot.exists() ? snapshot.data() : {};
      }
    }
  } catch (error) {
    console.warn("Meeting notification user profile load skipped:", error);
  }

  return mergeProfile(fallback, profileData);
}

function getMeetingDetailsRows(meeting = {}, cancellationReason = "") {
  const rows = [
    { label: "Travel Agent", value: meeting.travelAgentName || "Travel Agent" },
    { label: "Assigned Team Member", value: meeting.assignedUserName || "Team Member" },
    { label: "Meeting Type", value: getMeetingTypeLabel(meeting.meetingType) },
    { label: "Starts", value: formatDateTime(meeting.scheduledStartAt) },
    { label: "Ends", value: formatDateTime(meeting.scheduledEndAt) },
    { label: "Location / Link", value: getLocationText(meeting) }
  ];

  if (meeting.agenda) rows.push({ label: "Agenda", value: clean(meeting.agenda) });
  if (cancellationReason) rows.push({ label: "Cancellation Reason", value: clean(cancellationReason) });
  return rows;
}

function getMeetingReferenceHtml(meeting = {}) {
  const mapLink = getMapLink(meeting);

  if (meeting.meetingType === "online" && clean(meeting.meetingLink)) {
    return `
      <p style="margin:0;">
        <a href="${escapeHtml(meeting.meetingLink)}" target="_blank" style="font-weight:700;text-decoration:none;color:#1d4e89;">
          Join online meeting
        </a>
      </p>
    `;
  }

  if (meeting.meetingType === "in_person" && mapLink) {
    return `
      <p style="margin:0;">
        <a href="${escapeHtml(mapLink)}" target="_blank" style="font-weight:700;text-decoration:none;color:#1d4e89;">
          View location / get directions
        </a>
      </p>
    `;
  }

  return "";
}

function getEventCopy(eventType = "scheduled") {
  if (eventType === "rescheduled") {
    return {
      externalTitle: "Your Meeting Has Been Rescheduled",
      internalTitle: "Meeting Rescheduled",
      subtitle: "Updated Meeting Details",
      introLine: "Please note the revised meeting schedule below.",
      opening: "The meeting schedule has been updated. Please refer to the revised details below."
    };
  }

  if (eventType === "cancelled") {
    return {
      externalTitle: "Meeting Cancellation Update",
      internalTitle: "Meeting Cancelled",
      subtitle: "Meeting Status Update",
      introLine: "Please note the meeting status update below.",
      opening: "The meeting below has been cancelled. Please refer to the details for your records."
    };
  }

  return {
    externalTitle: "Your Meeting Is Scheduled",
    internalTitle: "Meeting Scheduled",
    subtitle: "Meeting Details",
    introLine: "We look forward to a productive conversation.",
    opening: "A meeting has been scheduled. Please find the complete details below."
  };
}

function buildBrandedEmailHtml({
  meeting,
  recipientName,
  recipientType,
  eventType,
  cancellationReason = "",
  branding = {},
  emailSignatureHtml = ""
}) {
  const copy = getEventCopy(eventType);
  const detailsRows = getMeetingDetailsRows(meeting, cancellationReason);
  const referenceHtml = getMeetingReferenceHtml(meeting);
  const isInternal = recipientType === "team_member";

  const common = {
    branding,
    recipientName,
    subtitle: copy.subtitle,
    introLine: copy.introLine,
    openingHtml: `<p style="margin:0;">${escapeHtml(copy.opening)}</p>`,
    detailsTitle: "Meeting Details",
    detailsRows,
    referenceTitle: meeting.meetingType === "online" ? "Meeting Link" : "Location & Directions",
    referenceHtml,
    closingLine: getFirstValue(
      branding?.emailFooterLine,
      eventType === "cancelled"
        ? "Please contact the DreamTrawell team if you need any clarification."
        : "Please keep these meeting details handy and contact us if any assistance is required."
    ),
    emailSignatureHtml
  };

  if (isInternal) {
    return buildInternalEmailTemplate({
      ...common,
      title: copy.internalTitle,
      actionTitle: "Next Step",
      actionText:
        eventType === "cancelled"
          ? "Update your follow-up plan if another interaction is required."
          : "Please prepare for the meeting and update the MOM / next action after completion.",
      showReference: Boolean(referenceHtml)
    });
  }

  return buildTravelAgentEmailTemplate({
    ...common,
    title: copy.externalTitle,
    actionTitle: eventType === "cancelled" ? "Need Assistance?" : "Meeting Reminder",
    actionText:
      eventType === "cancelled"
        ? "Please coordinate with your assigned DreamTrawell team member if the meeting needs to be scheduled again."
        : `Your DreamTrawell point of contact for this meeting is ${meeting.assignedUserName || "our team member"}.`
  });
}

export function buildMeetingWhatsAppMessage({ meeting, recipientName, eventType = "scheduled", cancellationReason = "" }) {
  const eventLabel = getMeetingNotificationEventLabel(eventType);
  const start = formatDateTime(meeting.scheduledStartAt);
  const end = formatDateTime(meeting.scheduledEndAt);
  const type = getMeetingTypeLabel(meeting.meetingType);
  const location = getLocationText(meeting);
  const mapLink = getMapLink(meeting);
  const lines = [
    `*${eventLabel}*`,
    "",
    `Hello ${clean(recipientName) || "Partner"},`,
    "",
    `Travel Agent: ${clean(meeting.travelAgentName) || "Travel Agent"}`,
    `Assigned Team Member: ${clean(meeting.assignedUserName) || "Team Member"}`,
    `Meeting Type: ${type}`,
    `Starts: ${start}`,
    `Ends: ${end}`,
    `Location / Link: ${location}`
  ];

  if (meeting.agenda) lines.push(`Agenda: ${clean(meeting.agenda)}`);
  if (cancellationReason) lines.push(`Cancellation Reason: ${clean(cancellationReason)}`);
  if (meeting.meetingType === "online" && meeting.meetingLink) {
    lines.push(`Join Meeting: ${clean(meeting.meetingLink)}`);
  }
  if (meeting.meetingType === "in_person" && mapLink) {
    lines.push(`Directions: ${mapLink}`);
  }

  lines.push("", "Regards,", "Dream Trawell Destinations");
  return lines.join("\n");
}

function buildWhatsappParameters({ meeting, recipientName, eventType, cancellationReason = "" }) {
  const dateTime = formatDateTime(meeting.scheduledStartAt);
  const type = getMeetingTypeLabel(meeting.meetingType);
  const location = getLocationText(meeting);

  return [
    recipientName || "Partner",
    getMeetingNotificationEventLabel(eventType),
    meeting.travelAgentName || "Travel Agent",
    dateTime,
    type,
    meeting.assignedUserName || "Team Member",
    location,
    cancellationReason || meeting.agenda || "No additional note"
  ];
}

async function sendWhatsappTemplate({ to, parameters }) {
  const response = await fetch("/api/send-whatsapp-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, parameters })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "WhatsApp notification failed.");
    error.code = data?.code || "whatsapp_send_failed";
    error.details = data;
    throw error;
  }
  return data;
}

async function logAttempt({ meetingId, eventType, recipient, channel, status, providerMessageId = "", error = "", user }) {
  try {
    await addDoc(collection(db, "meetingNotificationLogs"), {
      meetingId: clean(meetingId),
      eventType: clean(eventType),
      recipientType: clean(recipient.type),
      recipientName: clean(recipient.name),
      recipientEmail: clean(recipient.email).toLowerCase(),
      recipientWhatsapp: clean(recipient.whatsapp),
      channel,
      status,
      providerMessageId: clean(providerMessageId),
      error: clean(error),
      createdAt: serverTimestamp(),
      createdByUid: clean(user?.uid),
      createdByName: clean(user?.name || user?.displayName || user?.email)
    });
  } catch (logError) {
    console.warn("Meeting notification log failed:", logError);
  }
}

export async function logMeetingWhatsAppOpened({ meetingId, eventType = "scheduled", recipient, user }) {
  if (!recipient?.whatsapp) return;
  await logAttempt({
    meetingId,
    eventType,
    recipient,
    channel: "whatsapp",
    status: "opened",
    user
  });
}

async function getMeetingEmailContext({ meeting = {}, user = null } = {}) {
  let branding = {};

  try {
    branding = await getBrandingSettings();
  } catch (error) {
    console.warn("Meeting notification branding load skipped:", error);
  }

  const assignedBase = {
    uid: meeting.assignedUserUid || "",
    id: meeting.assignedUserKey || "",
    name: meeting.assignedUserName || "",
    displayName: meeting.assignedUserName || "",
    email: meeting.assignedUserEmail || "",
    mobile: meeting.assignedUserMobile || "",
    designation: meeting.assignedUserDesignation || meeting.assignedUserRole || ""
  };

  const assignedUser = await loadUserProfile({
    uid: meeting.assignedUserUid,
    key: meeting.assignedUserKey,
    fallback: assignedBase
  });

  const schedulerBase = {
    ...(user || {}),
    uid: user?.uid || "",
    name: user?.name || user?.displayName || user?.email || "DreamTrawell Team",
    displayName: user?.displayName || user?.name || user?.email || "DreamTrawell Team",
    email: user?.email || ""
  };

  const schedulerUser = await loadUserProfile({
    uid: user?.uid,
    key: user?.uid,
    fallback: schedulerBase
  });

  const externalSignatureUser = {
    ...assignedUser,
    ...branding
  };

  const internalSignatureUser = {
    ...(getMemberName(schedulerUser) || getMemberEmail(schedulerUser)
      ? schedulerUser
      : assignedUser),
    ...branding
  };

  return {
    branding,
    assignedUser,
    schedulerUser,
    externalSignatureHtml:
      externalSignatureUser?.signatureEnabled === false
        ? ""
        : buildEmailSignatureHtml(externalSignatureUser),
    internalSignatureHtml:
      internalSignatureUser?.signatureEnabled === false
        ? ""
        : buildEmailSignatureHtml(internalSignatureUser)
  };
}

export async function sendMeetingNotifications({
  meetingId,
  meeting,
  eventType = "scheduled",
  cancellationReason = "",
  user,
  whatsappMode = DEFAULT_WHATSAPP_MODE
}) {
  const recipients = [
    {
      type: "travel_agent",
      name: clean(meeting.travelAgentContactName || meeting.travelAgentName || "Partner"),
      email: clean(meeting.travelAgentEmail).toLowerCase(),
      whatsapp: clean(meeting.travelAgentWhatsapp)
    },
    {
      type: "team_member",
      name: clean(meeting.assignedUserName || "Team Member"),
      email: clean(meeting.assignedUserEmail).toLowerCase(),
      whatsapp: clean(meeting.assignedUserMobile)
    }
  ];

  const results = [];
  const normalizedWhatsappMode = whatsappMode === "cloud" ? "cloud" : "manual";
  const emailContext = await getMeetingEmailContext({ meeting, user });

  for (const recipient of recipients) {
    const subject = `${getMeetingNotificationEventLabel(eventType)} - ${meeting.travelAgentName || "Travel Agent"}`;

    if (recipient.email) {
      try {
        const isTeamRecipient = recipient.type === "team_member";
        const replyUser = isTeamRecipient
          ? emailContext.schedulerUser
          : emailContext.assignedUser;
        const replyEmail = clean(getMemberEmail(replyUser)).toLowerCase();
        const replyName = getMemberName(replyUser) || replyEmail;

        await sendEmailViaBrevo({
          toEmail: recipient.email,
          toName: recipient.name,
          subject,
          html: buildBrandedEmailHtml({
            meeting,
            recipientName: recipient.name,
            recipientType: recipient.type,
            eventType,
            cancellationReason,
            branding: emailContext.branding,
            emailSignatureHtml: isTeamRecipient
              ? emailContext.internalSignatureHtml
              : emailContext.externalSignatureHtml
          }),
          replyTo: replyEmail
            ? { email: replyEmail, name: replyName || replyEmail }
            : null,
          emailType: "transactional",
          tags: [
            "dreamtrawell_crm",
            "meeting_notification",
            meetingId ? `meeting_${meetingId}` : ""
          ].filter(Boolean)
        });
        results.push({ recipientType: recipient.type, recipientName: recipient.name, channel: "email", status: "sent" });
        await logAttempt({ meetingId, eventType, recipient, channel: "email", status: "sent", user });
      } catch (error) {
        results.push({ recipientType: recipient.type, recipientName: recipient.name, channel: "email", status: "failed", error: error?.message || "Email failed" });
        await logAttempt({ meetingId, eventType, recipient, channel: "email", status: "failed", error: error?.message || "Email failed", user });
      }
    } else {
      results.push({ recipientType: recipient.type, recipientName: recipient.name, channel: "email", status: "missing_contact" });
      await logAttempt({ meetingId, eventType, recipient, channel: "email", status: "missing_contact", error: "Email not available", user });
    }

    if (!recipient.whatsapp) {
      results.push({ recipientType: recipient.type, recipientName: recipient.name, channel: "whatsapp", status: "missing_contact" });
      await logAttempt({ meetingId, eventType, recipient, channel: "whatsapp", status: "missing_contact", error: "WhatsApp number not available", user });
      continue;
    }

    if (normalizedWhatsappMode === "cloud") {
      try {
        const response = await sendWhatsappTemplate({
          to: recipient.whatsapp,
          parameters: buildWhatsappParameters({ meeting, recipientName: recipient.name, eventType, cancellationReason })
        });
        results.push({
          recipientType: recipient.type,
          recipientName: recipient.name,
          channel: "whatsapp",
          status: "sent",
          mode: "cloud",
          providerMessageId: response?.messageId || ""
        });
        await logAttempt({ meetingId, eventType, recipient, channel: "whatsapp", status: "sent", providerMessageId: response?.messageId || "", user });
      } catch (error) {
        results.push({
          recipientType: recipient.type,
          recipientName: recipient.name,
          channel: "whatsapp",
          status: "failed",
          mode: "cloud",
          error: error?.message || "WhatsApp failed",
          code: error?.code || ""
        });
        await logAttempt({ meetingId, eventType, recipient, channel: "whatsapp", status: "failed", error: error?.message || "WhatsApp failed", user });
      }
      continue;
    }

    const message = buildMeetingWhatsAppMessage({
      meeting,
      recipientName: recipient.name,
      eventType,
      cancellationReason
    });
    results.push({
      recipientType: recipient.type,
      recipientName: recipient.name,
      channel: "whatsapp",
      status: "prepared",
      mode: "manual",
      whatsapp: recipient.whatsapp,
      message
    });
    await logAttempt({ meetingId, eventType, recipient, channel: "whatsapp", status: "prepared", user });
  }

  const sent = results.filter(item => item.status === "sent").length;
  const failed = results.filter(item => item.status === "failed").length;
  const missing = results.filter(item => item.status === "missing_contact").length;
  const prepared = results.filter(item => item.status === "prepared").length;

  try {
    await updateDoc(doc(db, "meetings", meetingId), {
      lastNotificationEvent: eventType,
      lastNotificationAt: serverTimestamp(),
      notificationSummary: { sent, failed, missing, prepared, whatsappMode: normalizedWhatsappMode },
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Meeting notification summary update failed:", error);
  }

  return {
    sent,
    failed,
    missing,
    prepared,
    whatsappMode: normalizedWhatsappMode,
    results
  };
}
