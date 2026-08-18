"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Clock3,
  Flame,
  PhoneOff,
  Target,
  UserPlus
} from "lucide-react";
import { db } from "@/lib/firebase";
import { getLeadAging } from "@/lib/leadAging";
import { normalizeLeadClosingPotential } from "@/lib/leadPotential";
import { isLeadAssignedToUser, isLeadOwnedByUser, getLeadAssignee, getLeadOwner } from "@/lib/leadOwnership";
import { resolveDirectoryIdentity, teamMatchesScope } from "@/lib/teamDirectory";
import { toMeetingDate } from "@/lib/meetings";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function isDeleted(row) {
  return Boolean(row?.isDeleted === true || row?.deletedAt || row?.status === "deleted");
}

function isAgentContacted(agent) {
  return Boolean(
    agent?.lastEngagementAt ||
      agent?.lastContactedAt ||
      agent?.lastContactAt ||
      Number(agent?.engagementCount || agent?.totalEngagements || 0) > 0
  );
}

function agentMatchesUser(agent, user) {
  const uid = user?.uid || user?.id || "";
  const email = String(user?.email || "").toLowerCase();
  return Boolean(
    (uid && [agent?.assignedToUid, agent?.accountManagerUid, agent?.createdByUid].includes(uid)) ||
      (email && [agent?.assignedToEmail, agent?.createdByEmail].some(value => String(value || "").toLowerCase() === email))
  );
}

function meetingMatchesUser(meeting, user) {
  const uid = user?.uid || user?.id || "";
  const email = String(user?.email || "").toLowerCase();
  return Boolean(
    (uid && [meeting?.assignedUserUid, meeting?.assignedUserKey].includes(uid)) ||
      (email && String(meeting?.assignedUserEmail || "").toLowerCase() === email)
  );
}

function getAgentDirectoryIdentity(agent, lookup) {
  return resolveDirectoryIdentity(
    {
      uid: agent?.assignedToUid || agent?.accountManagerUid || agent?.createdByUid || "",
      email: agent?.assignedToEmail || agent?.createdByEmail || "",
      name: agent?.assignedToName || agent?.createdByName || ""
    },
    lookup
  );
}

function leadMatchesTeam(lead, lookup, team) {
  if (!team || team === "all") return true;
  const ownerMember = resolveDirectoryIdentity(getLeadOwner(lead), lookup);
  const assigneeMember = resolveDirectoryIdentity(getLeadAssignee(lead), lookup);
  return teamMatchesScope(ownerMember.team, team) || teamMatchesScope(assigneeMember.team, team);
}

function meetingMatchesTeam(meeting, lookup, team) {
  if (!team || team === "all") return true;
  const member = resolveDirectoryIdentity(
    {
      uid: meeting?.assignedUserUid || meeting?.assignedUserKey || "",
      email: meeting?.assignedUserEmail || "",
      name: meeting?.assignedUserName || ""
    },
    lookup
  );
  return teamMatchesScope(member.team, team);
}

export default function ActionCenterWorkspace({ adminMode = false, user, scopeTeam = "all", userLookup }) {
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loaded = new Set();
    const done = key => {
      loaded.add(key);
      if (loaded.size >= 3) setLoading(false);
    };

    const unsubs = [
      onSnapshot(collection(db, "leads"), snap => {
        setLeads(snap.docs.map(item => ({ id: item.id, ...item.data() })));
        done("leads");
      }, () => done("leads")),
      onSnapshot(collection(db, "travelAgents"), snap => {
        setAgents(snap.docs.map(item => ({ id: item.id, ...item.data() })));
        done("agents");
      }, () => done("agents")),
      onSnapshot(collection(db, "meetings"), snap => {
        setMeetings(snap.docs.map(item => ({ id: item.id, ...item.data() })));
        done("meetings");
      }, () => done("meetings"))
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const scoped = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 86400000));

    const scopedLeads = leads.filter(lead => {
      if (isDeleted(lead)) return false;
      if (adminMode) return leadMatchesTeam(lead, userLookup, scopeTeam);
      return isLeadOwnedByUser(lead, user) || isLeadAssignedToUser(lead, user);
    });

    const scopedAgents = agents.filter(agent => {
      if (isDeleted(agent)) return false;
      if (!adminMode) return agentMatchesUser(agent, user);
      if (!scopeTeam || scopeTeam === "all") return true;
      return teamMatchesScope(getAgentDirectoryIdentity(agent, userLookup).team, scopeTeam);
    });

    const scopedMeetings = meetings.filter(meeting => {
      if (isDeleted(meeting)) return false;
      if (adminMode) return meetingMatchesTeam(meeting, userLookup, scopeTeam);
      return meetingMatchesUser(meeting, user);
    });

    const overdueLeads = scopedLeads.filter(lead => getLeadAging(lead, now).overdue);
    const noNextAction = scopedLeads.filter(lead => getLeadAging(lead, now).noNextAction);
    const priorityLeads = scopedLeads.filter(lead => {
      if (getLeadAging(lead, now).terminal) return false;
      return ["hot", "at_risk"].includes(normalizeLeadClosingPotential(lead));
    });
    const newAgentsNotContacted = scopedAgents.filter(agent => {
      const created = toDate(agent?.createdAt);
      return created && created >= sevenDaysAgo && created <= todayEnd && !isAgentContacted(agent);
    });
    const meetingsToday = scopedMeetings.filter(meeting => {
      const start = toMeetingDate(meeting?.scheduledStartAt);
      return start && start >= todayStart && start <= todayEnd && ["scheduled", "rescheduled"].includes(meeting?.status || "scheduled");
    });
    const missedMeetings = scopedMeetings.filter(meeting => {
      const start = toMeetingDate(meeting?.scheduledStartAt);
      return start && start < now && ["scheduled", "rescheduled"].includes(meeting?.status || "scheduled");
    });
    const momPending = scopedMeetings.filter(meeting => meeting?.status === "completed" && !String(meeting?.mom || "").trim());

    return { overdueLeads, noNextAction, priorityLeads, newAgentsNotContacted, meetingsToday, missedMeetings, momPending };
  }, [adminMode, agents, leads, meetings, scopeTeam, user, userLookup]);

  const leadBase = adminMode ? "/admin/leads" : "/leads/my";
  const agentBase = adminMode ? "/admin/travel-agents" : "/travel-agents";
  const meetingBase = adminMode ? "/admin/meetings" : "/meetings";

  const cards = [
    { key: "new-agents", label: "New Agents Not Contacted", helper: "Added in the last 7 days", value: scoped.newAgentsNotContacted.length, icon: UserPlus, href: `${agentBase}?contactStatus=never_contacted&createdRange=7d` },
    { key: "overdue", label: "Overdue Lead Follow-ups", helper: "Past next-action time", value: scoped.overdueLeads.length, icon: AlertTriangle, href: `${leadBase}?followUp=overdue` },
    { key: "no-action", label: "Leads Without Next Action", helper: "Open leads with no due action", value: scoped.noNextAction.length, icon: Clock3, href: `${leadBase}?followUp=none` },
    { key: "priority", label: "Hot / At-Risk Leads", helper: "Closing attention required", value: scoped.priorityLeads.length, icon: Flame, href: `${leadBase}?priorityAttention=1` },
    { key: "meetings-today", label: "Meetings Today", helper: "Scheduled or rescheduled", value: scoped.meetingsToday.length, icon: CalendarClock, href: `${meetingBase}?view=today` },
    { key: "missed", label: "Past-Due Meetings", helper: "Meeting time passed, still open", value: scoped.missedMeetings.length, icon: PhoneOff, href: `${meetingBase}?view=past_due` }
  ];

  const urgentLeads = [...scoped.overdueLeads, ...scoped.priorityLeads]
    .filter((lead, index, rows) => rows.findIndex(item => item.id === lead.id) === index)
    .sort((a, b) => Number(!getLeadAging(a).overdue) - Number(!getLeadAging(b).overdue))
    .slice(0, 8);

  const todayMeetings = [...scoped.meetingsToday]
    .sort((a, b) => (toMeetingDate(a.scheduledStartAt)?.getTime() || 0) - (toMeetingDate(b.scheduledStartAt)?.getTime() || 0))
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Daily Execution</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Action Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Current work requiring attention. {adminMode ? "The global Team scope is respected; overdue/current work is intentionally not hidden by lead creation date." : "Only work owned by, assigned to, or scheduled for you is shown."}
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <Link key={card.key} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{loading ? "—" : card.value}</p></div>
                  <div className="rounded-xl bg-slate-50 p-2 text-slate-600"><Icon size={18} /></div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400"><span>{card.helper}</span><ChevronRight size={14} className="transition group-hover:translate-x-0.5" /></div>
              </Link>
            );
          })}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-900">Closing Attention</h2><p className="text-xs text-slate-500">Overdue, Hot and At-Risk open leads</p></div><Target size={18} className="text-blue-600" /></div>
            {urgentLeads.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No urgent leads right now.</div> : <div className="divide-y divide-slate-100">{urgentLeads.map(lead => {
              const aging = getLeadAging(lead);
              const potential = normalizeLeadClosingPotential(lead);
              return <Link key={lead.id} href={adminMode ? `/admin/leads/${lead.id}` : `/leads/${lead.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{lead.leadCode || lead.destinationName || "Lead"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{lead.travelAgentName || lead.agentName || lead.agencyName || "Travel Agent"} · {lead.destinationName || "Destination not set"}</p></div><div className="shrink-0 text-right"><p className={`text-xs font-semibold ${aging.overdue ? "text-rose-600" : "text-amber-600"}`}>{aging.slaLabel}</p><p className="mt-0.5 text-[11px] font-medium uppercase text-slate-400">{potential.replaceAll("_", " ")}</p></div></Link>;
            })}</div>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-900">Today&apos;s Meetings</h2><p className="text-xs text-slate-500">Travel Agent meetings scheduled today</p></div><CalendarClock size={18} className="text-blue-600" /></div>
            {todayMeetings.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No meetings scheduled for today.</div> : <div className="divide-y divide-slate-100">{todayMeetings.map(meeting => {
              const start = toMeetingDate(meeting.scheduledStartAt);
              return <Link key={meeting.id} href={`${meetingBase}?agentId=${encodeURIComponent(meeting.travelAgentId || "")}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{meeting.travelAgentName || "Travel Agent"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{meeting.agenda || meeting.meetingType || "Meeting"}{meeting.location?.city ? ` · ${meeting.location.city}` : ""}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-blue-700">{start ? start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</p><p className="text-[11px] text-slate-400">{meeting.assignedUserName || "Unassigned"}</p></div></Link>;
            })}</div>}
          </section>
        </div>

        {scoped.momPending.length > 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><strong>{scoped.momPending.length}</strong> completed meeting{scoped.momPending.length === 1 ? " is" : "s are"} missing MOM in legacy data. Open Meetings to complete the record.</div> : null}
      </div>
    </main>
  );
}
