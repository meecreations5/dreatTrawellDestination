"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  getDocs
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

/* DASHBOARD COMPONENTS */
import DashboardKpiCard from "@/components/admin/dashboard/DashboardKpiCard";
import LeadsTrendChart from "@/components/admin/dashboard/LeadsTrendChart";
import LeadsByStageChart from "@/components/admin/dashboard/LeadsByStageChart";
import LeadsByDestinationChart from "@/components/admin/dashboard/LeadsByDestinationChart";

/* ENGAGEMENT COMPONENTS */
import EngagementKpiCard from "@/components/admin/dashboard/engagements/EngagementKpiCard";
import EngagementByChannelChart from "@/components/admin/dashboard/engagements/EngagementByChannelChart";

/* =========================
   CONFIG
========================== */

const ATTENDANCE_COLLECTION = "attendance_sessions";
// If your Firestore attendance collection is attendance_logs,
// change only this line:
// const ATTENDANCE_COLLECTION = "attendance_logs";

/* =========================
   HELPERS
========================== */

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRangeWindow(range) {
  const now = new Date();
  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  }

  if (range === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
  }

  if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return {
    start,
    end: now
  };
}

function isInRange(value, rangeWindow) {
  const d = toDate(value);
  if (!d) return false;

  return d >= rangeWindow.start && d <= rangeWindow.end;
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNameFromEmail(email) {
  if (!email) return "Unassigned";

  return email
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function isClosedLead(lead) {
  return (
    lead?.status === "closed" ||
    lead?.stage === "closed_won" ||
    lead?.stage === "closed_lost"
  );
}

function isActiveLead(lead) {
  return !isClosedLead(lead);
}

function getDueDate(lead) {
  return (
    toDate(lead?.nextActionDueAt) ||
    toDate(lead?.nextActionAt) ||
    null
  );
}

function getLatestQuotationAmount(quotations = []) {
  if (!quotations.length) return 0;

  const sorted = [...quotations].sort((a, b) => {
    const ar = Number(a.revisionNumber || 0);
    const br = Number(b.revisionNumber || 0);

    if (br !== ar) return br - ar;

    const ad = toDate(a.createdAt)?.getTime() || 0;
    const bd = toDate(b.createdAt)?.getTime() || 0;

    return bd - ad;
  });

  return Number(sorted[0]?.totalPrice || 0);
}

function getScoreLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 40) return "Good";
  if (score >= 15) return "Average";
  return "Needs Attention";
}

function getScoreClass(score) {
  if (score >= 80) {
    return "bg-green-50 text-green-700 border-green-100";
  }

  if (score >= 40) {
    return "bg-blue-50 text-blue-700 border-blue-100";
  }

  if (score >= 15) {
    return "bg-yellow-50 text-yellow-700 border-yellow-100";
  }

  return "bg-red-50 text-red-700 border-red-100";
}

/* =========================
   ATTENDANCE HELPERS
========================== */

function getCheckInDate(record) {
  return (
    toDate(record?.checkInAt) ||
    toDate(record?.clockInAt) ||
    toDate(record?.startTime) ||
    toDate(record?.createdAt) ||
    toDate(record?.date) ||
    null
  );
}

function getCheckOutDate(record) {
  return (
    toDate(record?.checkOutAt) ||
    toDate(record?.clockOutAt) ||
    toDate(record?.endTime) ||
    null
  );
}

function getAttendanceUser(record) {
  const email =
    record?.userEmail ||
    record?.employeeEmail ||
    record?.email ||
    record?.createdByEmail ||
    "";

  return {
    uid:
      record?.userUid ||
      record?.employeeUid ||
      record?.uid ||
      record?.createdByUid ||
      "",
    email,
    name:
      record?.userName ||
      record?.employeeName ||
      record?.displayName ||
      formatNameFromEmail(email)
  };
}

function getAttendanceMinutes(record) {
  const checkIn = getCheckInDate(record);
  const checkOut = getCheckOutDate(record);

  if (!checkIn || !checkOut) return 0;

  const diff = checkOut.getTime() - checkIn.getTime();

  if (diff <= 0) return 0;

  return Math.round(diff / 60000);
}

function formatDuration(minutes) {
  if (!minutes) return "—";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (!h) return `${m}m`;
  if (!m) return `${h}h`;

  return `${h}h ${m}m`;
}

function isAttendanceInRange(record, rangeWindow) {
  return (
    isInRange(record?.date, rangeWindow) ||
    isInRange(record?.createdAt, rangeWindow) ||
    isInRange(record?.checkInAt, rangeWindow) ||
    isInRange(record?.clockInAt, rangeWindow) ||
    isInRange(record?.startTime, rangeWindow)
  );
}

/* =========================
   MAIN MANAGEMENT DASHBOARD
========================== */

export default function AdminDashboardGraph() {
  const router = useRouter();
  const { user, loading, error } = useAuth("admin");

  const mountTimeRef = useRef(performance.now());
  const authLoggedRef = useRef(false);

  const [range, setRange] = useState("today");
  const [activeTab, setActiveTab] = useState("business");

  const [leads, setLeads] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [dataLoading, setDataLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  /* =========================
     AUTH REDIRECTION
  ========================== */

  useEffect(() => {
    if (!loading && !authLoggedRef.current) {
      authLoggedRef.current = true;

      console.log(
        "[TimeLog] Auth resolved in",
        Math.round(performance.now() - mountTimeRef.current),
        "ms"
      );
    }

    if (!loading && error === "ROLE_MISMATCH") {
      router.replace("/dashboard");
    }

    if (!loading && error === "USER_NOT_REGISTERED") {
      router.replace("/admin/login");
    }
  }, [loading, error, router]);

  /* =========================
     DATA LOAD
     leads
     leads/{leadId}/followUps
     leads/{leadId}/quotations
  ========================== */

  useEffect(() => {
    if (!user) return;

    setDataLoading(true);
    setDashboardError("");

    const unsubLeads = onSnapshot(
      collection(db, "leads"),
      async snap => {
        try {
          const leadsData = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }));

          const allFollowUps = [];
          const allQuotations = [];

          for (const leadDoc of snap.docs) {
            const leadId = leadDoc.id;
            const lead = {
              id: leadId,
              ...leadDoc.data()
            };

            const followUpSnap = await getDocs(
              collection(db, "leads", leadId, "followUps")
            );

            followUpSnap.forEach(fu => {
              allFollowUps.push({
                id: fu.id,
                leadId,
                leadCode: lead.leadCode || "",
                assignedToUid: lead.assignedToUid || "",
                assignedToEmail: lead.assignedTo || "",
                agentName: lead.agentName || "",
                destinationName: lead.destinationName || "",
                ...fu.data()
              });
            });

            const quotationSnap = await getDocs(
              collection(db, "leads", leadId, "quotations")
            );

            quotationSnap.forEach(q => {
              allQuotations.push({
                id: q.id,
                leadId,
                leadCode: lead.leadCode || "",
                assignedToUid: lead.assignedToUid || "",
                assignedToEmail: lead.assignedTo || "",
                agentName: lead.agentName || "",
                destinationName: lead.destinationName || "",
                ...q.data()
              });
            });
          }

          setLeads(leadsData);
          setFollowUps(allFollowUps);
          setQuotations(allQuotations);
          setDataLoading(false);

          console.log(
            "[TimeLog] Management dashboard ready in",
            Math.round(performance.now() - mountTimeRef.current),
            "ms"
          );
        } catch (err) {
          console.error("Management dashboard data load failed:", err);
          setDashboardError("Unable to load management dashboard data.");
          setDataLoading(false);
        }
      },
      err => {
        console.error("Lead subscription failed:", err);
        setDashboardError("Unable to load leads.");
        setDataLoading(false);
      }
    );

    return () => unsubLeads();
  }, [user]);

  /* =========================
     ATTENDANCE LOAD
  ========================== */

  useEffect(() => {
    if (!user) return;

    const unsubAttendance = onSnapshot(
      collection(db, ATTENDANCE_COLLECTION),
      snap => {
        setAttendanceRecords(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );
      },
      err => {
        console.error("Attendance load failed:", err);
      }
    );

    return () => unsubAttendance();
  }, [user]);

  /* =========================
     RANGE DATA
  ========================== */

  const rangeWindow = useMemo(() => {
    return getRangeWindow(range);
  }, [range]);

  const periodLeads = useMemo(() => {
    return leads.filter(lead =>
      isInRange(lead.createdAt, rangeWindow)
    );
  }, [leads, rangeWindow]);

  const periodFollowUps = useMemo(() => {
    return followUps.filter(item =>
      isInRange(item.createdAt, rangeWindow)
    );
  }, [followUps, rangeWindow]);

  const periodQuotations = useMemo(() => {
    return quotations.filter(item =>
      isInRange(item.createdAt, rangeWindow)
    );
  }, [quotations, rangeWindow]);

  const periodAttendance = useMemo(() => {
    return attendanceRecords.filter(record =>
      isAttendanceInRange(record, rangeWindow)
    );
  }, [attendanceRecords, rangeWindow]);

  /* =========================
     MANAGEMENT ROWS
  ========================== */

  const teamRows = useMemo(() => {
    const now = new Date();
    const map = new Map();

    const ensureMember = ({ uid, email, name }) => {
      const key = uid || email || "unassigned";

      if (!map.has(key)) {
        map.set(key, {
          uid: uid || "",
          email: email || "",
          name: name || formatNameFromEmail(email),

          newLeads: 0,
          activeLeads: 0,
          wonLeads: 0,
          lostLeads: 0,

          followUpMovement: 0,
          quotedMovement: 0,

          quotationsSent: 0,
          quoteValue: 0,
          wonValue: 0,

          pendingFollowUps: 0,
          overdueFollowUps: 0,
          untouchedLeads: 0,

          calls: 0,
          whatsapp: 0,
          emails: 0,
          otherEngagements: 0,
          connected: 0,
          notConnected: 0,

          lastActivityAt: null,
          score: 0
        });
      }

      return map.get(key);
    };

    const updateLastActivity = (row, value) => {
      const d = toDate(value);
      if (!d) return;

      if (!row.lastActivityAt || d > row.lastActivityAt) {
        row.lastActivityAt = d;
      }
    };

    leads.forEach(lead => {
      const row = ensureMember({
        uid: lead.assignedToUid || lead.createdByUid,
        email: lead.assignedTo || lead.assignedBy || "",
        name:
          lead.assignedToName ||
          lead.createdByName ||
          formatNameFromEmail(lead.assignedTo)
      });

      const leadCreatedInRange = isInRange(
        lead.createdAt,
        rangeWindow
      );

      const leadQuotations = quotations.filter(
        q => q.leadId === lead.id
      );

      const leadFollowUps = followUps.filter(
        f => f.leadId === lead.id
      );

      if (leadCreatedInRange) {
        row.newLeads += 1;
      }

      if (isActiveLead(lead)) {
        row.activeLeads += 1;
      }

      const dueDate = getDueDate(lead);

      if (dueDate && !isClosedLead(lead)) {
        row.pendingFollowUps += 1;

        if (dueDate < now) {
          row.overdueFollowUps += 1;
        }
      }

      if (
        leadCreatedInRange &&
        !leadFollowUps.length &&
        !lead?.stageHistory?.length
      ) {
        row.untouchedLeads += 1;
      }

      if (Array.isArray(lead.stageHistory)) {
        lead.stageHistory.forEach(history => {
          if (!isInRange(history.changedAt, rangeWindow)) return;

          if (history.stage === "follow_up") {
            row.followUpMovement += 1;
          }

          if (history.stage === "quoted") {
            row.quotedMovement += 1;
          }

          if (history.stage === "closed_won") {
            row.wonLeads += 1;
            row.wonValue += getLatestQuotationAmount(leadQuotations);
          }

          if (history.stage === "closed_lost") {
            row.lostLeads += 1;
          }

          updateLastActivity(row, history.changedAt);
        });
      }

      updateLastActivity(row, lead.updatedAt || lead.createdAt);
    });

    periodFollowUps.forEach(item => {
      const row = ensureMember({
        uid: item.createdByUid || item.assignedToUid,
        email: item.createdByEmail || item.assignedToEmail || "",
        name: formatNameFromEmail(
          item.createdByEmail || item.assignedToEmail
        )
      });

      const channel = String(item.channel || "").toLowerCase();

      if (channel === "call") row.calls += 1;
      else if (channel === "whatsapp") row.whatsapp += 1;
      else if (channel === "email") row.emails += 1;
      else row.otherEngagements += 1;

      if (item.outcome === "connected") {
        row.connected += 1;
      } else {
        row.notConnected += 1;
      }

      updateLastActivity(row, item.createdAt);
    });

    periodQuotations.forEach(item => {
      const row = ensureMember({
        uid: item.createdByUid || item.assignedToUid,
        email: item.createdByEmail || item.assignedToEmail || "",
        name: formatNameFromEmail(
          item.createdByEmail || item.assignedToEmail
        )
      });

      row.quotationsSent += 1;
      row.quoteValue += Number(item.totalPrice || 0);

      updateLastActivity(row, item.createdAt);
    });

    return Array.from(map.values())
      .map(row => {
        const score =
          row.calls * 3 +
          row.whatsapp * 2 +
          row.emails * 2 +
          row.connected * 4 +
          row.quotationsSent * 5 +
          row.wonLeads * 10 -
          row.overdueFollowUps * 5;

        return {
          ...row,
          score
        };
      })
      .sort((a, b) => {
        if (activeTab === "engagement") return b.score - a.score;
        if (activeTab === "leads") return b.newLeads - a.newLeads;
        return b.quoteValue - a.quoteValue;
      });
  }, [
    leads,
    followUps,
    quotations,
    periodFollowUps,
    periodQuotations,
    rangeWindow,
    activeTab
  ]);

  /* =========================
     ATTENDANCE ROWS
  ========================== */

  const attendanceRows = useMemo(() => {
    const map = new Map();

    const ensureMember = ({ uid, email, name }) => {
      const key = uid || email || name || "unassigned";

      if (!map.has(key)) {
        map.set(key, {
          uid: uid || "",
          email: email || "",
          name: name || formatNameFromEmail(email),

          checkIns: 0,
          checkedOut: 0,
          active: 0,
          late: 0,
          absent: 0,
          leave: 0,

          firstCheckIn: null,
          lastCheckOut: null,
          totalMinutes: 0
        });
      }

      return map.get(key);
    };

    const updateFirstCheckIn = (row, value) => {
      const d = toDate(value);
      if (!d) return;

      if (!row.firstCheckIn || d < row.firstCheckIn) {
        row.firstCheckIn = d;
      }
    };

    const updateLastCheckOut = (row, value) => {
      const d = toDate(value);
      if (!d) return;

      if (!row.lastCheckOut || d > row.lastCheckOut) {
        row.lastCheckOut = d;
      }
    };

    teamRows.forEach(member => {
      ensureMember({
        uid: member.uid,
        email: member.email,
        name: member.name
      });
    });

    periodAttendance.forEach(record => {
      const member = getAttendanceUser(record);
      const row = ensureMember(member);

      const checkIn = getCheckInDate(record);
      const checkOut = getCheckOutDate(record);
      const status = String(record?.status || "").toLowerCase();

      if (checkIn) {
        row.checkIns += 1;
        updateFirstCheckIn(row, checkIn);
      }

      if (checkOut) {
        row.checkedOut += 1;
        updateLastCheckOut(row, checkOut);
      }

      if (checkIn && !checkOut) {
        row.active += 1;
      }

      if (
        record?.isLate === true ||
        status === "late" ||
        status === "checked_in_late"
      ) {
        row.late += 1;
      }

      if (status === "absent") {
        row.absent += 1;
      }

      if (
        status === "leave" ||
        status === "on_leave" ||
        status === "paid_leave"
      ) {
        row.leave += 1;
      }

      row.totalMinutes += getAttendanceMinutes(record);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.checkIns !== a.checkIns) return b.checkIns - a.checkIns;
      return a.name.localeCompare(b.name);
    });
  }, [periodAttendance, teamRows]);

  /* =========================
     TOTALS
  ========================== */

  const totals = useMemo(() => {
    return teamRows.reduce(
      (acc, row) => {
        acc.newLeads += row.newLeads;
        acc.activeLeads += row.activeLeads;
        acc.wonLeads += row.wonLeads;
        acc.lostLeads += row.lostLeads;

        acc.followUpMovement += row.followUpMovement;
        acc.quotedMovement += row.quotedMovement;

        acc.quotationsSent += row.quotationsSent;
        acc.quoteValue += row.quoteValue;
        acc.wonValue += row.wonValue;

        acc.pendingFollowUps += row.pendingFollowUps;
        acc.overdueFollowUps += row.overdueFollowUps;
        acc.untouchedLeads += row.untouchedLeads;

        acc.calls += row.calls;
        acc.whatsapp += row.whatsapp;
        acc.emails += row.emails;
        acc.connected += row.connected;
        acc.score += row.score;

        return acc;
      },
      {
        newLeads: 0,
        activeLeads: 0,
        wonLeads: 0,
        lostLeads: 0,

        followUpMovement: 0,
        quotedMovement: 0,

        quotationsSent: 0,
        quoteValue: 0,
        wonValue: 0,

        pendingFollowUps: 0,
        overdueFollowUps: 0,
        untouchedLeads: 0,

        calls: 0,
        whatsapp: 0,
        emails: 0,
        connected: 0,
        score: 0
      }
    );
  }, [teamRows]);

  const attendanceTotals = useMemo(() => {
    return attendanceRows.reduce(
      (acc, row) => {
        acc.checkIns += row.checkIns;
        acc.checkedOut += row.checkedOut;
        acc.active += row.active;
        acc.late += row.late;
        acc.absent += row.absent;
        acc.leave += row.leave;
        acc.totalMinutes += row.totalMinutes;

        return acc;
      },
      {
        checkIns: 0,
        checkedOut: 0,
        active: 0,
        late: 0,
        absent: 0,
        leave: 0,
        totalMinutes: 0
      }
    );
  }, [attendanceRows]);

  const managementSummary = useMemo(() => {
    const totalLeads = periodLeads.length;
    const winRate = totalLeads
      ? Math.round((totals.wonLeads / totalLeads) * 100)
      : 0;

    const avgDeal = totals.wonLeads
      ? Math.round(totals.wonValue / totals.wonLeads)
      : 0;

    let lastActivity = null;

    teamRows.forEach(row => {
      if (
        row.lastActivityAt &&
        (!lastActivity || row.lastActivityAt > lastActivity)
      ) {
        lastActivity = row.lastActivityAt;
      }
    });

    return {
      totalLeads,
      winRate,
      avgDeal,
      lastActivity
    };
  }, [periodLeads, totals, teamRows]);

  /* =========================
     RENDER GUARDS
  ========================== */

  if (loading || user === undefined) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <p className="p-6 text-red-600">Access denied</p>;
  }

  /* =========================
     UI
  ========================== */

  return (
    <main className="p-4 md:p-6 space-y-6 w-full">

      {/* =========================
        MANAGEMENT HEADER
      ========================== */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Management Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Business performance, team engagement, lead movement and attendance overview.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-full md:w-auto">
            {[
              { key: "today", label: "Today" },
              { key: "week", label: "This Week" },
              { key: "month", label: "This Month" }
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={`
                  flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition
                  ${
                    range === item.key
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {dashboardError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dashboardError}
          </div>
        )}

        {dataLoading && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Loading management data...
          </div>
        )}

        {/* TOP MANAGEMENT PULSE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardKpiCard
            label="New Leads"
            value={managementSummary.totalLeads}
          />

          <DashboardKpiCard
            label="Quotation Value"
            value={formatCurrency(totals.quoteValue)}
            color="green"
          />

          <DashboardKpiCard
            label="Won Value"
            value={formatCurrency(totals.wonValue)}
            color="green"
          />

          <DashboardKpiCard
            label="Overdue"
            value={totals.overdueFollowUps}
            color={totals.overdueFollowUps ? "red" : "gray"}
          />
        </div>

        {/* TABS */}
        <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm flex gap-1 overflow-x-auto">
          {[
            { key: "business", label: "Overall Business" },
            { key: "engagement", label: "Engagement" },
            { key: "leads", label: "Leads" },
            { key: "attendance", label: "Attendance" }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition
                ${
                  activeTab === tab.key
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* =========================
        OVERALL BUSINESS
      ========================== */}
      {activeTab === "business" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Total Leads"
              value={managementSummary.totalLeads}
            />

            <DashboardKpiCard
              label="Avg Deal"
              value={formatCurrency(managementSummary.avgDeal)}
              color="purple"
            />

            <DashboardKpiCard
              label="Win Rate"
              value={`${managementSummary.winRate}%`}
              color="green"
            />

            <DashboardKpiCard
              label="Quotations Sent"
              value={totals.quotationsSent}
              color="blue"
            />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeadsTrendChart leads={periodLeads} />
            <LeadsByStageChart leads={leads} />
          </section>

          <ManagementBusinessTable rows={teamRows} />
        </section>
      )}

      {/* =========================
        ENGAGEMENT
      ========================== */}
      {activeTab === "engagement" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <EngagementKpiCard
              label="Calls"
              value={totals.calls}
            />

            <EngagementKpiCard
              label="WhatsApp"
              value={totals.whatsapp}
            />

            <EngagementKpiCard
              label="Emails"
              value={totals.emails}
            />

            <EngagementKpiCard
              label="Connected"
              value={totals.connected}
            />

            <EngagementKpiCard
              label="Last Activity"
              value={formatDateTime(managementSummary.lastActivity)}
            />
          </div>

          <EngagementByChannelChart engagements={periodFollowUps} />

          <ManagementEngagementTable rows={teamRows} />
        </section>
      )}

      {/* =========================
        LEADS
      ========================== */}
      {activeTab === "leads" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="New Leads"
              value={totals.newLeads}
            />

            <DashboardKpiCard
              label="Active Leads"
              value={totals.activeLeads}
              color="blue"
            />

            <DashboardKpiCard
              label="Untouched"
              value={totals.untouchedLeads}
              color={totals.untouchedLeads ? "red" : "gray"}
            />

            <DashboardKpiCard
              label="Closed Won"
              value={totals.wonLeads}
              color="green"
            />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeadsByStageChart leads={leads} />
            <LeadsByDestinationChart leads={periodLeads} />
          </section>

          <ManagementLeadsTable rows={teamRows} />
        </section>
      )}

      {/* =========================
        ATTENDANCE
      ========================== */}
      {activeTab === "attendance" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Check-ins"
              value={attendanceTotals.checkIns}
              color="blue"
            />

            <DashboardKpiCard
              label="Active Now"
              value={attendanceTotals.active}
              color="green"
            />

            <DashboardKpiCard
              label="Late"
              value={attendanceTotals.late}
              color={attendanceTotals.late ? "amber" : "gray"}
            />

            <DashboardKpiCard
              label="Total Hours"
              value={formatDuration(attendanceTotals.totalMinutes)}
              color="purple"
            />
          </div>

          <ManagementAttendanceTable rows={attendanceRows} />
        </section>
      )}
    </main>
  );
}

/* =========================
   BUSINESS TABLE
========================== */

function ManagementBusinessTable({ rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Team Member Business Overview
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Sorted by quotation value for management review.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-right px-4 py-3 font-medium">New Leads</th>
              <th className="text-right px-4 py-3 font-medium">Active</th>
              <th className="text-right px-4 py-3 font-medium">Quotations</th>
              <th className="text-right px-4 py-3 font-medium">Quote Value</th>
              <th className="text-right px-4 py-3 font-medium">Won</th>
              <th className="text-right px-4 py-3 font-medium">Won Value</th>
              <th className="text-right px-4 py-3 font-medium">Overdue</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.uid || row.email || row.name}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {row.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.email || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 text-right">{row.newLeads}</td>
                <td className="px-4 py-3 text-right">{row.activeLeads}</td>
                <td className="px-4 py-3 text-right">{row.quotationsSent}</td>

                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(row.quoteValue)}
                </td>

                <td className="px-4 py-3 text-right">{row.wonLeads}</td>

                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(row.wonValue)}
                </td>

                <td
                  className={`
                    px-4 py-3 text-right font-medium
                    ${row.overdueFollowUps ? "text-red-600" : "text-gray-700"}
                  `}
                >
                  {row.overdueFollowUps}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`
                      inline-flex items-center px-2 py-1 rounded-full text-xs border
                      ${getScoreClass(row.score)}
                    `}
                  >
                    {getScoreLabel(row.score)}
                  </span>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No business data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   ENGAGEMENT TABLE
========================== */

function ManagementEngagementTable({ rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Team Member Engagement Overview
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Sorted by engagement score.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-right px-4 py-3 font-medium">Calls</th>
              <th className="text-right px-4 py-3 font-medium">WhatsApp</th>
              <th className="text-right px-4 py-3 font-medium">Emails</th>
              <th className="text-right px-4 py-3 font-medium">Connected</th>
              <th className="text-right px-4 py-3 font-medium">Quotations</th>
              <th className="text-left px-4 py-3 font-medium">Last Activity</th>
              <th className="text-right px-4 py-3 font-medium">Score</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.uid || row.email || row.name}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {row.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.email || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 text-right">{row.calls}</td>
                <td className="px-4 py-3 text-right">{row.whatsapp}</td>
                <td className="px-4 py-3 text-right">{row.emails}</td>
                <td className="px-4 py-3 text-right">{row.connected}</td>
                <td className="px-4 py-3 text-right">{row.quotationsSent}</td>

                <td className="px-4 py-3 text-gray-600">
                  {formatDateTime(row.lastActivityAt)}
                </td>

                <td className="px-4 py-3 text-right">
                  <span
                    className={`
                      inline-flex items-center justify-center min-w-10 px-2 py-1
                      rounded-full text-xs border font-semibold
                      ${getScoreClass(row.score)}
                    `}
                  >
                    {row.score}
                  </span>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No engagement data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   LEADS TABLE
========================== */

function ManagementLeadsTable({ rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Team Member Lead Overview
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Sorted by new leads for the selected period.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-right px-4 py-3 font-medium">New</th>
              <th className="text-right px-4 py-3 font-medium">Active</th>
              <th className="text-right px-4 py-3 font-medium">Follow-up</th>
              <th className="text-right px-4 py-3 font-medium">Quoted</th>
              <th className="text-right px-4 py-3 font-medium">Won</th>
              <th className="text-right px-4 py-3 font-medium">Lost</th>
              <th className="text-right px-4 py-3 font-medium">Untouched</th>
              <th className="text-right px-4 py-3 font-medium">Overdue</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.uid || row.email || row.name}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {row.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.email || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 text-right">{row.newLeads}</td>
                <td className="px-4 py-3 text-right">{row.activeLeads}</td>
                <td className="px-4 py-3 text-right">{row.followUpMovement}</td>
                <td className="px-4 py-3 text-right">{row.quotedMovement}</td>

                <td className="px-4 py-3 text-right text-green-700 font-medium">
                  {row.wonLeads}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.lostLeads}
                </td>

                <td
                  className={`
                    px-4 py-3 text-right font-medium
                    ${row.untouchedLeads ? "text-red-600" : "text-gray-700"}
                  `}
                >
                  {row.untouchedLeads}
                </td>

                <td
                  className={`
                    px-4 py-3 text-right font-medium
                    ${row.overdueFollowUps ? "text-red-600" : "text-gray-700"}
                  `}
                >
                  {row.overdueFollowUps}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No lead data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   ATTENDANCE TABLE
========================== */

function ManagementAttendanceTable({ rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Team Member Attendance Overview
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Check-ins, active sessions, late marks and working hours for the selected period.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">
                Team Member
              </th>
              <th className="text-right px-4 py-3 font-medium">
                Check-ins
              </th>
              <th className="text-right px-4 py-3 font-medium">
                Active
              </th>
              <th className="text-right px-4 py-3 font-medium">
                Checked Out
              </th>
              <th className="text-right px-4 py-3 font-medium">
                Late
              </th>
              <th className="text-right px-4 py-3 font-medium">
                Leave
              </th>
              <th className="text-left px-4 py-3 font-medium">
                First Check-in
              </th>
              <th className="text-left px-4 py-3 font-medium">
                Last Check-out
              </th>
              <th className="text-right px-4 py-3 font-medium">
                Hours
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.uid || row.email || row.name}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {row.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.email || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 text-right">
                  {row.checkIns}
                </td>

                <td
                  className={`
                    px-4 py-3 text-right font-medium
                    ${row.active ? "text-green-700" : "text-gray-700"}
                  `}
                >
                  {row.active}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.checkedOut}
                </td>

                <td
                  className={`
                    px-4 py-3 text-right font-medium
                    ${row.late ? "text-amber-600" : "text-gray-700"}
                  `}
                >
                  {row.late}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.leave}
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {formatDateTime(row.firstCheckIn)}
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {formatDateTime(row.lastCheckOut)}
                </td>

                <td className="px-4 py-3 text-right font-medium">
                  {formatDuration(row.totalMinutes)}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No attendance data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}