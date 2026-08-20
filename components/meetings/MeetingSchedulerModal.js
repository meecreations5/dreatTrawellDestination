"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, MapPin, X } from "lucide-react";
import { saveMeeting } from "@/lib/meetingService";
import { sendMeetingNotifications } from "@/lib/meetingNotifications";
import { MEETING_TYPES, toMeetingDate } from "@/lib/meetings";
import { getTravelAgentLocationParts, formatLocationParts } from "@/lib/locationFilters";
import { canAccess } from "@/lib/rolePermissions";

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateInput(date) {
  const value = date instanceof Date ? date : new Date(date);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toTimeInput(date) {
  const value = date instanceof Date ? date : new Date(date);
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function getPrimarySpoc(agent = {}) {
  return agent.spocs?.find(item => item?.isPrimary) || agent.spocs?.[0] || {};
}

function getPrimaryPhone(agent = {}) {
  const primary = getPrimarySpoc(agent);
  return agent.genericContact?.whatsapp || agent.genericContact?.phone || primary.whatsapp || primary.mobile || primary.phone || agent.whatsappNumber || agent.whatsapp || agent.phone || agent.mobile || "";
}

function getPrimaryEmail(agent = {}) {
  const primary = getPrimarySpoc(agent);
  return agent.genericContact?.email || primary.email || primary.contactEmail || agent.email || agent.workEmail || "";
}

function getPrimaryContactName(agent = {}) {
  const primary = getPrimarySpoc(agent);
  return primary.name || primary.contactName || primary.spocName || agent.contactPerson || agent.agencyName || "Partner";
}

function buildInitial(existingMeeting, defaultEngagement = null) {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 15) * 15, 0, 0);
  const existingStart = toMeetingDate(existingMeeting?.scheduledStartAt);
  const start = existingStart || defaultStart;
  const location = existingMeeting?.location || {};

  return {
    travelAgentId: existingMeeting?.travelAgentId || "",
    assignedUserKey: existingMeeting?.assignedUserKey || existingMeeting?.assignedUserUid || "",
    meetingType: existingMeeting?.meetingType || "in_person",
    date: toDateInput(start),
    time: toTimeInput(start),
    durationMinutes: Number(existingMeeting?.durationMinutes || 30),
    agenda: existingMeeting?.agenda ||
      defaultEngagement?.nextAction ||
      defaultEngagement?.purpose ||
      defaultEngagement?.subject ||
      defaultEngagement?.outcomeLabel ||
      defaultEngagement?.outcome ||
      "",
    meetingLink: existingMeeting?.meetingLink || "",
    phone: existingMeeting?.phone || "",
    reminderMinutes: Number(existingMeeting?.reminderMinutes || 30),
    location: {
      venue: location.venue || "",
      address: location.address || "",
      subArea: location.subArea || "",
      city: location.city || "",
      state: location.state || "",
      pincode: location.pincode || "",
      latitude: location.latitude || "",
      longitude: location.longitude || "",
      mapUrl: location.mapUrl || ""
    }
  };
}

export default function MeetingSchedulerModal({
  open,
  onClose,
  onSaved,
  agents = [],
  teamDirectory = [],
  user,
  defaultAgentId = "",
  defaultLead = null,
  defaultEngagement = null,
  defaultAssigneeKey = "",
  existingMeeting = null,
  lockedAssigneeKey = ""
}) {
  const [form, setForm] = useState(() => buildInitial(existingMeeting, defaultEngagement));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canAssignAnotherUser = canAccess(user, "meetings.assign_another_user");

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => String(a.agencyName || "").localeCompare(String(b.agencyName || ""))),
    [agents]
  );
  const sortedMembers = useMemo(
    () => [...teamDirectory].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [teamDirectory]
  );

  const selectedAgent = useMemo(
    () => sortedAgents.find(item => item.id === form.travelAgentId) || null,
    [sortedAgents, form.travelAgentId]
  );
  const currentMember = useMemo(() => {
    const uid = String(user?.uid || user?.id || "");
    const email = String(user?.email || "").toLowerCase();
    return sortedMembers.find(item =>
      (uid && (item.uid === uid || item.key === uid)) ||
      (email && String(item.email || "").toLowerCase() === email)
    ) || null;
  }, [sortedMembers, user]);

  const selectedMember = useMemo(
    () => sortedMembers.find(item => item.key === form.assignedUserKey || item.uid === form.assignedUserKey) || null,
    [sortedMembers, form.assignedUserKey]
  );

  useEffect(() => {
    if (!open) return;
    const next = buildInitial(existingMeeting, defaultEngagement);
    const chosenAgentId = existingMeeting?.travelAgentId || defaultAgentId || defaultLead?.travelAgentId || defaultLead?.agentId || defaultEngagement?.travelAgentId || defaultEngagement?.agentId || "";
    const selfAssigneeKey = currentMember?.key || currentMember?.uid || user?.uid || user?.id || "";
    const chosenAssignee = canAssignAnotherUser
      ? (existingMeeting?.assignedUserKey || existingMeeting?.assignedUserUid || lockedAssigneeKey || defaultAssigneeKey || selfAssigneeKey)
      : (existingMeeting?.assignedUserKey || existingMeeting?.assignedUserUid || lockedAssigneeKey || selfAssigneeKey);
    setForm({ ...next, travelAgentId: chosenAgentId, assignedUserKey: chosenAssignee });
    setError("");
  }, [open, existingMeeting, defaultAgentId, defaultLead, defaultEngagement, defaultAssigneeKey, lockedAssigneeKey, canAssignAnotherUser, currentMember, user]);

  useEffect(() => {
    if (!selectedAgent || existingMeeting) return;
    const location = getTravelAgentLocationParts(selectedAgent);
    setForm(current => ({
      ...current,
      phone: current.phone || getPrimaryPhone(selectedAgent),
      location: {
        ...current.location,
        address: current.location.address || [location.line1, location.line2].filter(Boolean).join(", "),
        subArea: current.location.subArea || location.subArea,
        city: current.location.city || location.city,
        state: current.location.state || location.state,
        pincode: current.location.pincode || location.pincode,
        mapUrl: current.location.mapUrl || selectedAgent.googleMapLink || ""
      }
    }));
  }, [selectedAgent, existingMeeting]);

  if (!open) return null;

  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setLocation = (key, value) => setForm(current => ({
    ...current,
    location: { ...current.location, [key]: value }
  }));

  const handleSave = async () => {
    setError("");
    if (!selectedAgent) return setError("Select a Travel Agent.");
    if (canAssignAnotherUser && !selectedMember && !lockedAssigneeKey) return setError("Select the assigned Team Member.");
    if (!form.date || !form.time) return setError("Meeting date and time are required.");

    const start = new Date(`${form.date}T${form.time}:00`);
    if (Number.isNaN(start.getTime())) return setError("Meeting date/time is invalid.");
    const end = new Date(start.getTime() + Number(form.durationMinutes || 30) * 60000);

    const member = selectedMember || currentMember || {
      key: lockedAssigneeKey || user?.uid || user?.id || "",
      uid: user?.uid || "",
      name: user?.name || user?.displayName || user?.email || "Team Member",
      email: user?.email || "",
      team: user?.teamName || user?.team || user?.department || ""
    };

    if (form.meetingType === "in_person" && !form.location.city && !form.location.address) {
      return setError("Add at least a city or address for an in-person meeting.");
    }
    if (form.meetingType === "online" && !form.meetingLink.trim()) {
      return setError("Meeting link is required for an online meeting.");
    }

    setSaving(true);
    try {
      const meetingPayload = {
        ...form,
        travelAgentName: selectedAgent.agencyName || "",
        travelAgentCode: selectedAgent.agentCode || "",
        travelAgentContactName: getPrimaryContactName(selectedAgent),
        travelAgentEmail: getPrimaryEmail(selectedAgent),
        travelAgentWhatsapp: getPrimaryPhone(selectedAgent),
        leadId: defaultLead?.id || existingMeeting?.leadId || "",
        leadCode: defaultLead?.leadCode || existingMeeting?.leadCode || "",
        sourceEngagementId: defaultEngagement?.id || existingMeeting?.sourceEngagementId || "",
        sourceEngagementChannel: defaultEngagement?.channel || defaultEngagement?.type || existingMeeting?.sourceEngagementChannel || "",
        sourceEngagementSummary: defaultEngagement?.remarks || defaultEngagement?.note || defaultEngagement?.messageText || defaultEngagement?.message || defaultEngagement?.outcomeLabel || existingMeeting?.sourceEngagementSummary || "",
        assignedUserKey: member.key || member.uid,
        assignedUserUid: member.uid || "",
        assignedUserName: member.name || member.label || "",
        assignedUserEmail: member.email || "",
        assignedUserMobile: member.mobile || member.whatsapp || member.phone || "",
        assignedTeam: member.team || "",
        scheduledStartAt: start,
        scheduledEndAt: end,
        status: existingMeeting ? "rescheduled" : "scheduled"
      };

      const meetingId = await saveMeeting({
        meetingId: existingMeeting?.id || "",
        meeting: meetingPayload,
        user
      });

      const eventType = existingMeeting ? "rescheduled" : "scheduled";
      const notificationResult = await sendMeetingNotifications({
        meetingId,
        meeting: meetingPayload,
        eventType,
        user
      });

      onSaved?.({ meetingId, meeting: meetingPayload, eventType, notificationResult });
      onClose?.();
    } catch (err) {
      setError(err?.message || "Unable to schedule meeting.");
    } finally {
      setSaving(false);
    }
  };

  const agentLocation = selectedAgent ? formatLocationParts(getTravelAgentLocationParts(selectedAgent)) : "";

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CalendarClock size={20} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{existingMeeting ? "Reschedule Meeting" : "Schedule Meeting"}</h2>
              <p className="mt-0.5 text-xs text-slate-500">Link the meeting to the Travel Agent. Team users are assigned to their own meetings automatically.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-5 p-5">
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          {defaultEngagement?.id && !existingMeeting ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Scheduled from Engagement</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {defaultEngagement.channel ? `${String(defaultEngagement.channel).replaceAll("_", " ")} · ` : ""}
                {defaultEngagement.outcomeLabel || defaultEngagement.outcome || defaultEngagement.subject || "Follow-up meeting"}
              </p>
              <p className="mt-1 text-xs text-slate-500">The source engagement will stay linked to this meeting for audit and reporting.</p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Travel Agent *</label>
              <select value={form.travelAgentId} disabled={Boolean(defaultAgentId || existingMeeting?.travelAgentId)} onChange={e => setField("travelAgentId", e.target.value)} className={inputClass}>
                <option value="">Select Travel Agent</option>
                {sortedAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.agencyName || "Unnamed Agent"}{agent.agentCode ? ` (${agent.agentCode})` : ""}</option>)}
              </select>
              {agentLocation ? <p className="mt-1 text-[11px] text-slate-400">Agent location: {agentLocation}</p> : null}
            </div>

            <div>
              <label className={labelClass}>Assigned Team Member *</label>
              {canAssignAnotherUser ? (
                <select value={form.assignedUserKey} disabled={Boolean(lockedAssigneeKey)} onChange={e => setField("assignedUserKey", e.target.value)} className={inputClass}>
                  <option value="">Select Team Member</option>
                  {sortedMembers.map(member => <option key={member.key} value={member.key}>{member.label || member.name}{member.team ? ` - ${member.team}` : ""}</option>)}
                </select>
              ) : (
                <div className="flex h-10 w-full items-center rounded-xl border border-blue-100 bg-blue-50 px-3 text-sm font-medium text-blue-700">
                  Assigned to you - {currentMember?.label || currentMember?.name || user?.name || user?.displayName || user?.email || "Team Member"}
                </div>
              )}
              <p className="mt-1 text-[11px] text-slate-400">{canAssignAnotherUser ? "Availability is checked before saving." : "Team users schedule meetings for themselves."}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className={labelClass}>Meeting Type</label>
              <select value={form.meetingType} onChange={e => setField("meetingType", e.target.value)} className={inputClass}>
                {MEETING_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date *</label>
              <input type="date" value={form.date} onChange={e => setField("date", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Start Time *</label>
              <input type="time" value={form.time} onChange={e => setField("time", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Duration</label>
              <select value={form.durationMinutes} onChange={e => setField("durationMinutes", Number(e.target.value))} className={inputClass}>
                {[15, 30, 45, 60, 90, 120].map(value => <option key={value} value={value}>{value} min</option>)}
              </select>
            </div>
          </div>

          {form.meetingType === "online" ? (
            <div><label className={labelClass}>Meeting Link *</label><input value={form.meetingLink} onChange={e => setField("meetingLink", e.target.value)} placeholder="https://meet.google.com/..." className={inputClass} /></div>
          ) : null}

          {form.meetingType === "phone" ? (
            <div><label className={labelClass}>Phone Number</label><input value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="Agent contact number" className={inputClass} /></div>
          ) : null}

          {form.meetingType === "in_person" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2"><MapPin size={16} className="text-blue-600" /><h3 className="text-sm font-semibold text-slate-900">Meeting Location</h3></div>
              <div className="grid gap-3 md:grid-cols-2">
                <div><label className={labelClass}>Venue</label><input value={form.location.venue} onChange={e => setLocation("venue", e.target.value)} placeholder="Agent office / hotel / cafe" className={inputClass} /></div>
                <div><label className={labelClass}>Address</label><input value={form.location.address} onChange={e => setLocation("address", e.target.value)} placeholder="Street / building" className={inputClass} /></div>
                <div><label className={labelClass}>Sub Area</label><input value={form.location.subArea} onChange={e => setLocation("subArea", e.target.value)} placeholder="Goregaon West" className={inputClass} /></div>
                <div><label className={labelClass}>City</label><input value={form.location.city} onChange={e => setLocation("city", e.target.value)} placeholder="Mumbai" className={inputClass} /></div>
                <div><label className={labelClass}>State</label><input value={form.location.state} onChange={e => setLocation("state", e.target.value)} placeholder="Maharashtra" className={inputClass} /></div>
                <div><label className={labelClass}>PIN Code</label><input value={form.location.pincode} onChange={e => setLocation("pincode", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Latitude</label><input value={form.location.latitude} onChange={e => setLocation("latitude", e.target.value)} placeholder="Optional" className={inputClass} /></div>
                <div><label className={labelClass}>Longitude</label><input value={form.location.longitude} onChange={e => setLocation("longitude", e.target.value)} placeholder="Optional" className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Map Link</label><input value={form.location.mapUrl} onChange={e => setLocation("mapUrl", e.target.value)} placeholder="Optional Google Maps link" className={inputClass} /></div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            <p className="font-semibold">Meeting notifications</p>
            <p className="mt-1">On schedule or reschedule, the selected Team Member and Travel Agent contact will receive Email and WhatsApp notifications when their contact details and WhatsApp Business API are available.</p>
          </div>

          <div>
            <label className={labelClass}>Agenda</label>
            <textarea value={form.agenda} onChange={e => setField("agenda", e.target.value)} rows={3} placeholder="What should be discussed?" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div><label className={labelClass}>Reminder</label><select value={form.reminderMinutes} onChange={e => setField("reminderMinutes", Number(e.target.value))} className={inputClass}><option value={15}>15 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}{saving ? "Saving..." : existingMeeting ? "Save New Time" : "Schedule Meeting"}</button>
        </div>
      </div>
    </div>
  );
}
