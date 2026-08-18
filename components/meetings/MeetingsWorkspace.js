"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { CalendarClock, CheckCircle2, Clock3, ExternalLink, MapPin, Plus, RotateCcw, Search, UserRound, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { matchesAdminDateScope } from "@/lib/adminScope";
import { teamMatchesScope } from "@/lib/teamDirectory";
import { buildLocationOptions, matchesLocation } from "@/lib/locationFilters";
import { MEETING_OUTCOMES, MEETING_STATUSES, MEETING_TYPES, formatMeetingDateTime, toMeetingDate } from "@/lib/meetings";
import { updateMeetingStatus } from "@/lib/meetingService";
import { sendMeetingNotifications } from "@/lib/meetingNotifications";
import { canAccess, canAccessRecord } from "@/lib/rolePermissions";
import MeetingSchedulerModal from "@/components/meetings/MeetingSchedulerModal";
import MeetingOutcomeModal from "@/components/meetings/MeetingOutcomeModal";
import MeetingNotificationActionsModal from "@/components/meetings/MeetingNotificationActionsModal";

const inputClass = "h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function getMapHref(meeting) {
  if (meeting.location?.mapUrl) return meeting.location.mapUrl;
  if (meeting.location?.latitude && meeting.location?.longitude) return `https://www.google.com/maps?q=${encodeURIComponent(`${meeting.location.latitude},${meeting.location.longitude}`)}`;
  const query = [meeting.location?.venue, meeting.location?.address, meeting.location?.subArea, meeting.location?.city, meeting.location?.state, meeting.location?.pincode].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}` : "";
}

function locationExtractor(meeting) {
  return meeting.location || {};
}

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getEngagementAgentId(engagement) {
  if (!engagement || typeof engagement !== "object") return "";
  return engagement.travelAgentId || engagement.agentId || engagement.travelAgentRefId || engagement.travelAgent?.id || engagement.agent?.id || "";
}

function getEngagementAssigneeKey(engagement) {
  if (!engagement || typeof engagement !== "object") return "";
  return engagement.performedByUid || engagement.performedByKey || engagement.createdByUid || engagement.ownerUid || engagement.assignedToUid || engagement.assignedUserUid || "";
}

function getPrimarySpoc(agent = {}) {
  return agent.spocs?.find(item => item?.isPrimary) || agent.spocs?.[0] || {};
}

function getAgentNotificationContact(agent = {}) {
  const primary = getPrimarySpoc(agent);
  return {
    name: primary.name || primary.contactName || primary.spocName || agent.contactPerson || agent.agencyName || "Partner",
    email: agent.genericContact?.email || primary.email || primary.contactEmail || agent.email || agent.workEmail || "",
    whatsapp: agent.genericContact?.whatsapp || agent.genericContact?.phone || primary.whatsapp || primary.mobile || primary.phone || agent.whatsappNumber || agent.whatsapp || agent.phone || agent.mobile || ""
  };
}

export default function MeetingsWorkspace({
  adminMode = false,
  user,
  scope = { dateRange: "all", dateFrom: "", dateTo: "", team: "all" },
  teamDirectory = [],
  lockedAssigneeKey = "",
  defaultAssigneeKey = ""
}) {
  const searchParams = useSearchParams();
  const requestedAgentId = searchParams.get("agentId") || "";
  const requestedLeadId = searchParams.get("leadId") || "";
  const requestedEngagementId = searchParams.get("engagementId") || "";
  const requestedView = searchParams.get("view") || "";

  const [meetings, setMeetings] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);
  const [completeMeetingTarget, setCompleteMeetingTarget] = useState(null);
  const [notificationActions, setNotificationActions] = useState(null);
  const [requestedEngagement, setRequestedEngagement] = useState(null);
  const [requestedEngagementReady, setRequestedEngagementReady] = useState(false);
  const [deepLinkOpened, setDeepLinkOpened] = useState(false);
  const [filters, setFilters] = useState({ search: "", member: "all", agent: "all", type: "all", status: "all", outcome: "all", state: "", city: "", subArea: "" });

  useEffect(() => {
    const unsubMeetings = onSnapshot(collection(db, "meetings"), snap => {
      setMeetings(snap.docs.map(item => ({ id: item.id, ...item.data() })));
      setLoading(false);
    }, () => setLoading(false));
    const unsubAgents = onSnapshot(collection(db, "travelAgents"), snap => setAgents(snap.docs.map(item => ({ id: item.id, ...item.data() }))));
    return () => { unsubMeetings(); unsubAgents(); };
  }, []);

  useEffect(() => {
    let active = true;
    setRequestedEngagementReady(false);
    if (!requestedEngagementId) {
      setRequestedEngagement(null);
      setRequestedEngagementReady(true);
      return () => { active = false; };
    }

    getDoc(doc(db, "engagements", requestedEngagementId))
      .then(snap => {
        if (!active) return;
        setRequestedEngagement(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setRequestedEngagementReady(true);
      })
      .catch(() => {
        if (active) {
          setRequestedEngagement(null);
          setRequestedEngagementReady(true);
        }
      });

    return () => { active = false; };
  }, [requestedEngagementId]);

  const resolvedRequestedAgentId = requestedAgentId || getEngagementAgentId(requestedEngagement);
  const requestedAssigneeKey = getEngagementAssigneeKey(requestedEngagement);

  useEffect(() => {
    if (deepLinkOpened || !resolvedRequestedAgentId || !agents.length) return;
    if (requestedEngagementId && !requestedEngagementReady) return;
    setSchedulerOpen(true);
    setDeepLinkOpened(true);
  }, [resolvedRequestedAgentId, agents.length, deepLinkOpened, requestedEngagementId, requestedEngagementReady]);

  useEffect(() => {
    if (!adminMode) return;
    setFilters(current => ({ ...current, member: "all" }));
  }, [adminMode, scope.team]);

  const members = useMemo(() => {
    if (!adminMode || scope.team === "all") return teamDirectory;
    return teamDirectory.filter(member => teamMatchesScope(member.team, scope.team));
  }, [adminMode, teamDirectory, scope.team]);

  const accessUserLookup = useMemo(() => {
    const lookup = new Map();
    (teamDirectory || []).forEach(member => {
      [member?.uid, member?.id, member?.email, member?.workEmail].filter(Boolean).forEach(value => {
        const key = String(value).trim();
        lookup.set(key, member);
        lookup.set(key.toLowerCase(), member);
      });
    });
    return lookup;
  }, [teamDirectory]);

  const scopedBase = useMemo(() => meetings.filter(meeting => {
    if (!canAccessRecord(user, "meetings.view", meeting, "meeting", { userLookup: accessUserLookup })) return false;

    if (adminMode) {
      if (!matchesAdminDateScope(meeting.scheduledStartAt, scope.dateRange, scope.dateFrom, scope.dateTo)) return false;
      if (scope.team !== "all" && !teamMatchesScope(meeting.assignedTeam, scope.team)) return false;
      return true;
    }
    const uid = String(user?.uid || "").toLowerCase();
    const email = String(user?.email || "").toLowerCase();
    const key = String(lockedAssigneeKey || user?.uid || "").toLowerCase();
    return [meeting.assignedUserUid, meeting.assignedUserEmail, meeting.assignedUserKey].some(value => {
      const normalized = String(value || "").toLowerCase();
      return normalized && (normalized === uid || normalized === email || normalized === key);
    });
  }), [meetings, adminMode, scope, user, lockedAssigneeKey, accessUserLookup]);

  const locationOptions = useMemo(() => buildLocationOptions(scopedBase, locationExtractor, filters.state, filters.city), [scopedBase, filters.state, filters.city]);

  const filtered = useMemo(() => scopedBase.filter(meeting => {
    const search = filters.search.trim().toLowerCase();
    if (search) {
      const haystack = [meeting.travelAgentName, meeting.travelAgentCode, meeting.assignedUserName, meeting.agenda, meeting.location?.city, meeting.location?.subArea].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.member !== "all" && meeting.assignedUserKey !== filters.member && meeting.assignedUserUid !== filters.member) return false;
    if (filters.agent !== "all" && meeting.travelAgentId !== filters.agent) return false;
    if (filters.type !== "all" && meeting.meetingType !== filters.type) return false;
    if (filters.status !== "all" && meeting.status !== filters.status) return false;
    if (requestedView === "today") {
      const date = toMeetingDate(meeting.scheduledStartAt);
      const now = new Date();
      if (!date || date.toDateString() !== now.toDateString() || !["scheduled", "rescheduled"].includes(meeting.status || "scheduled")) return false;
    }
    if (requestedView === "past_due") {
      const date = toMeetingDate(meeting.scheduledStartAt);
      if (!date || date >= new Date() || !["scheduled", "rescheduled"].includes(meeting.status || "scheduled")) return false;
    }
    if (filters.outcome !== "all" && meeting.outcome !== filters.outcome) return false;
    if (!matchesLocation(meeting.location || {}, filters)) return false;
    return true;
  }).sort((a, b) => (toMeetingDate(a.scheduledStartAt)?.getTime() || 0) - (toMeetingDate(b.scheduledStartAt)?.getTime() || 0)), [scopedBase, filters, requestedView]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      today: scopedBase.filter(item => isSameDay(toMeetingDate(item.scheduledStartAt), now) && ["scheduled", "rescheduled"].includes(item.status || "scheduled")).length,
      upcoming: scopedBase.filter(item => (toMeetingDate(item.scheduledStartAt)?.getTime() || 0) > now.getTime() && ["scheduled", "rescheduled"].includes(item.status || "scheduled")).length,
      completed: scopedBase.filter(item => item.status === "completed").length,
      overdue: scopedBase.filter(item => (toMeetingDate(item.scheduledEndAt)?.getTime() || 0) < now.getTime() && ["scheduled", "rescheduled"].includes(item.status || "scheduled")).length
    };
  }, [scopedBase]);

  const handleStatus = async (meeting, status) => {
    let reason = "";
    let noShowParty = "";
    if (status === "cancelled") {
      reason = window.prompt("Cancellation reason") || "";
      if (!reason.trim()) return;
    }
    if (status === "no_show") {
      noShowParty = window.prompt("Type 'agent' for Travel Agent no-show or 'team_member' for Team Member no-show") || "";
      if (!noShowParty.trim()) return;
      reason = window.prompt("No-show note (optional)") || "";
    }
    try {
      await updateMeetingStatus({ meetingId: meeting.id, status, reason, noShowParty, user });

      if (status === "cancelled") {
        const agent = agents.find(item => item.id === meeting.travelAgentId) || {};
        const agentContact = getAgentNotificationContact(agent);
        const member = teamDirectory.find(item =>
          item.key === meeting.assignedUserKey ||
          item.uid === meeting.assignedUserUid ||
          item.email === String(meeting.assignedUserEmail || "").toLowerCase()
        ) || {};

        const notificationMeeting = {
          ...meeting,
          travelAgentContactName: meeting.travelAgentContactName || agentContact.name,
          travelAgentEmail: meeting.travelAgentEmail || agentContact.email,
          travelAgentWhatsapp: meeting.travelAgentWhatsapp || agentContact.whatsapp,
          assignedUserEmail: meeting.assignedUserEmail || member.email || "",
          assignedUserMobile: meeting.assignedUserMobile || member.mobile || ""
        };

        const notificationResult = await sendMeetingNotifications({
          meetingId: meeting.id,
          meeting: notificationMeeting,
          eventType: "cancelled",
          cancellationReason: reason,
          user
        });

        setNotificationActions({
          meetingId: meeting.id,
          meeting: notificationMeeting,
          eventType: "cancelled",
          notificationResult
        });
      }
    } catch (err) {
      window.alert(err?.message || "Unable to update meeting.");
    }
  };

  const reset = () => setFilters({ search: "", member: "all", agent: "all", type: "all", status: "all", outcome: "all", state: "", city: "", subArea: "" });

  const requestedLead = requestedLeadId ? { id: requestedLeadId } : null;

  return (
    <main className="mx-auto w-full space-y-5 p-4 sm:p-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Sales Execution</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Meetings</h1><p className="mt-1 text-sm text-slate-500">Schedule Travel Agent meetings, protect team-member availability and capture MOM / next action.</p></div>
        {canAccess(user, "meetings.schedule") ? <button type="button" onClick={() => { setEditMeeting(null); setSchedulerOpen(true); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} /> Schedule Meeting</button> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CalendarClock} label="Meetings Today" value={stats.today} />
        <Stat icon={Clock3} label="Upcoming" value={stats.upcoming} />
        <Stat icon={CheckCircle2} label="Completed" value={stats.completed} />
        <Stat icon={XCircle} label="Past Due / MOM Pending" value={stats.overdue} tone="rose" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">Meeting Filters</h2><p className="mt-0.5 text-xs text-slate-500">{adminMode ? "Global Date + Team apply above. Team Member means the person assigned to attend." : "This page shows meetings assigned to you."}</p></div>
        <div className={`grid gap-2 sm:grid-cols-2 ${adminMode ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
          <div className="relative sm:col-span-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={filters.search} onChange={e => setFilters(current => ({ ...current, search: e.target.value }))} placeholder="Search agent, member, agenda or location" className={`${inputClass} w-full pl-9`} /></div>
          {adminMode ? <select value={filters.member} onChange={e => setFilters(current => ({ ...current, member: e.target.value }))} className={inputClass}><option value="all">All Team Members</option>{members.map(member => <option key={member.key} value={member.key}>{member.name}</option>)}</select> : null}
          <select value={filters.type} onChange={e => setFilters(current => ({ ...current, type: e.target.value }))} className={inputClass}><option value="all">All Meeting Types</option>{MEETING_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select value={filters.status} onChange={e => setFilters(current => ({ ...current, status: e.target.value }))} className={inputClass}><option value="all">All Statuses</option>{MEETING_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select value={filters.outcome} onChange={e => setFilters(current => ({ ...current, outcome: e.target.value }))} className={inputClass}><option value="all">All Outcomes</option>{MEETING_OUTCOMES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select value={filters.agent} onChange={e => setFilters(current => ({ ...current, agent: e.target.value }))} className={inputClass}><option value="all">All Travel Agents</option>{[...agents].sort((a,b) => String(a.agencyName || "").localeCompare(String(b.agencyName || ""))).map(agent => <option key={agent.id} value={agent.id}>{agent.agencyName || "Unnamed Agent"}</option>)}</select>
          <select value={filters.state} onChange={e => setFilters(current => ({ ...current, state: e.target.value, city: "", subArea: "" }))} className={inputClass}><option value="">All States</option>{locationOptions.states.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.city} onChange={e => setFilters(current => ({ ...current, city: e.target.value, subArea: "" }))} className={inputClass}><option value="">All Cities</option>{locationOptions.cities.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.subArea} onChange={e => setFilters(current => ({ ...current, subArea: e.target.value }))} className={inputClass}><option value="">All Sub Areas</option>{locationOptions.subAreas.map(value => <option key={value} value={value}>{value}</option>)}</select>
        </div>
        <div className="mt-3 flex justify-end"><button type="button" onClick={reset} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"><RotateCcw size={14} /> Reset Filters</button></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading meetings…</div> : filtered.length === 0 ? <div className="p-10 text-center"><CalendarClock className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No meetings found</p><p className="mt-1 text-xs text-slate-400">Schedule a meeting or adjust the filters.</p></div> : <div className="divide-y divide-slate-100">{filtered.map(meeting => {
          const start = toMeetingDate(meeting.scheduledStartAt);
          const end = toMeetingDate(meeting.scheduledEndAt);
          const mapHref = getMapHref(meeting);
          const active = ["scheduled", "rescheduled"].includes(meeting.status || "scheduled");
          return <article key={meeting.id} className="p-4 hover:bg-slate-50/70 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{MEETING_TYPES.find(item => item.value === meeting.meetingType)?.label || meeting.meetingType || "Meeting"}</span><MeetingStatus status={meeting.status} />{meeting.sourceEngagementId ? <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">From Engagement</span> : null}{meeting.outcome ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">{MEETING_OUTCOMES.find(item => item.value === meeting.outcome)?.label || meeting.outcome}</span> : null}</div>
                <h3 className="mt-2 text-base font-semibold text-slate-950">{meeting.travelAgentName || "Travel Agent"}</h3>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarClock size={14} />{formatMeetingDateTime(start)}{end ? ` - ${end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}</span><span className="inline-flex items-center gap-1.5"><UserRound size={14} />{meeting.assignedUserName || "Unassigned"}</span>{meeting.location?.city || meeting.location?.subArea ? <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{[meeting.location?.subArea, meeting.location?.city, meeting.location?.state].filter(Boolean).join(", ")}</span> : null}</div>
                {meeting.agenda ? <p className="mt-3 text-sm text-slate-600"><span className="font-medium text-slate-800">Agenda:</span> {meeting.agenda}</p> : null}
                {meeting.mom ? <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><span className="font-semibold">MOM:</span> {meeting.mom}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
                {mapHref ? <a href={mapHref} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"><ExternalLink size={14} /> Map</a> : null}
                {active ? <><button type="button" onClick={() => setCompleteMeetingTarget(meeting)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white"><CheckCircle2 size={14} /> Complete</button><button type="button" onClick={() => { setEditMeeting(meeting); setSchedulerOpen(true); }} className="h-9 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700">Reschedule</button><button type="button" onClick={() => handleStatus(meeting, "cancelled")} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600">Cancel</button><button type="button" onClick={() => handleStatus(meeting, "no_show")} className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700">No Show</button></> : null}
                {meeting.status === "completed" && ["lead_generated", "quotation_required", "follow_up_required", "positive"].includes(meeting.outcome) ? <Link href={`/leads/create?agentId=${encodeURIComponent(meeting.travelAgentId || "")}&meetingId=${encodeURIComponent(meeting.id)}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-700"><Plus size={14} /> Create Lead</Link> : null}
              </div>
            </div>
          </article>;
        })}</div>}
      </section>

      <MeetingSchedulerModal
        open={schedulerOpen}
        onClose={() => { setSchedulerOpen(false); setEditMeeting(null); }}
        onSaved={payload => setNotificationActions(payload || null)}
        agents={agents}
        teamDirectory={teamDirectory}
        user={user}
        defaultAgentId={editMeeting ? "" : resolvedRequestedAgentId}
        defaultLead={requestedLead}
        defaultEngagement={editMeeting ? null : requestedEngagement}
        defaultAssigneeKey={editMeeting ? "" : (requestedAssigneeKey || defaultAssigneeKey)}
        existingMeeting={editMeeting}
        lockedAssigneeKey={lockedAssigneeKey}
      />
      <MeetingOutcomeModal open={Boolean(completeMeetingTarget)} meeting={completeMeetingTarget} user={user} onClose={() => setCompleteMeetingTarget(null)} onSaved={() => setCompleteMeetingTarget(null)} />
      <MeetingNotificationActionsModal
        open={Boolean(notificationActions)}
        onClose={() => setNotificationActions(null)}
        meetingId={notificationActions?.meetingId || ""}
        eventType={notificationActions?.eventType || "scheduled"}
        notificationResult={notificationActions?.notificationResult || null}
        user={user}
      />
    </main>
  );
}

function Stat({ icon: Icon, label, value, tone = "blue" }) {
  const toneClass = tone === "rose" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-blue-100 bg-white text-blue-700";
  return <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><Icon size={17} /></div><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>;
}

function MeetingStatus({ status = "scheduled" }) {
  const classes = status === "completed" ? "bg-emerald-50 text-emerald-700" : status === "cancelled" || status === "no_show" ? "bg-rose-50 text-rose-700" : status === "rescheduled" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  const label = MEETING_STATUSES.find(item => item.value === status)?.label || status;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes}`}>{label}</span>;
}
