"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";

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
   FIRESTORE COLLECTIONS
========================== */

const LEADS_COLLECTION = "leads";
const ENGAGEMENT_COLLECTION = "engagements";
const USERS_COLLECTION = "users";
const ATTENDANCE_COLLECTION = "attendance_sessions";

/* =========================
   COMMON HELPERS
========================== */

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function readableLabel(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getRangeWindow(range) {
  const now = new Date();

  if (range === "all") {
    return {
      start: null,
      end: now
    };
  }

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
  if (!rangeWindow?.start) return true;

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

function formatDate(value) {
  const d = toDate(value);
  if (!d) return "—";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatNameFromEmail(email) {
  if (!email) return "Unassigned";

  return email
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(minutes) {
  const value = Number(minutes || 0);

  if (!value) return "—";

  const h = Math.floor(value / 60);
  const m = value % 60;

  if (!h) return `${m}m`;
  if (!m) return `${h}h`;

  return `${h}h ${m}m`;
}

function looksLikeEmail(value) {
  return String(value || "").includes("@");
}

function countBy(rows, getter) {
  const map = new Map();

  rows.forEach(row => {
    const key = getter(row);

    if (Array.isArray(key)) {
      key.forEach(item => {
        if (!item) return;
        map.set(item, (map.get(item) || 0) + 1);
      });
    } else if (key) {
      map.set(key, (map.get(key) || 0) + 1);
    }
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
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
   LEAD HELPERS
========================== */

function getLeadDate(lead) {
  return (
    toDate(lead?.createdAt) ||
    toDate(lead?.assignedAt) ||
    toDate(lead?.updatedAt)
  );
}

function hasLeadAssignee(lead) {
  return Boolean(
    lead?.assignedToUid ||
      lead?.assignedToName ||
      lead?.assignedTo ||
      lead?.assignedToEmail
  );
}

function isWonLead(lead) {
  const status = normalize(lead?.status);
  const stage = normalize(lead?.stage);

  return (
    status === "won" ||
    status === "converted" ||
    status === "closed_won" ||
    stage === "won" ||
    stage === "converted" ||
    stage === "closed_won"
  );
}

function isLostLead(lead) {
  const status = normalize(lead?.status);
  const stage = normalize(lead?.stage);

  return (
    status === "lost" ||
    status === "cancelled" ||
    status === "closed_lost" ||
    stage === "lost" ||
    stage === "cancelled" ||
    stage === "closed_lost"
  );
}

function isClosedLead(lead) {
  const status = normalize(lead?.status);
  const stage = normalize(lead?.stage);

  return (
    isWonLead(lead) ||
    isLostLead(lead) ||
    status === "closed" ||
    stage === "closed"
  );
}

function isActiveLead(lead) {
  return !isClosedLead(lead);
}

function getLeadOwner(lead, userMap) {
  const uid =
    lead?.assignedToUid ||
    lead?.assignedTo ||
    lead?.createdByUid ||
    lead?.assignedByUid ||
    "";

  const userData = uid ? userMap.get(uid) : null;

  const email =
    lead?.assignedToEmail ||
    lead?.assignedBy ||
    lead?.createdByEmail ||
    (looksLikeEmail(lead?.assignedTo) ? lead.assignedTo : "") ||
    userData?.email ||
    "";

  const name =
    lead?.assignedToName ||
    userData?.displayName ||
    userData?.name ||
    lead?.createdByName ||
    formatNameFromEmail(email);

  return {
    uid,
    email,
    name,
    department: userData?.department || "",
    role: userData?.role || userData?.designation || ""
  };
}

/* =========================
   ENGAGEMENT HELPERS
========================== */

function getEngagementDate(item) {
  return toDate(item?.createdAt) || toDate(item?.updatedAt);
}

function getEngagementOwner(item, userMap) {
  const uid = item?.createdByUid || "";

  const userData = uid ? userMap.get(uid) : null;

  const email = userData?.email || item?.createdByEmail || "";

  const name =
    item?.createdByName ||
    userData?.displayName ||
    userData?.name ||
    formatNameFromEmail(email);

  return {
    uid,
    email,
    name,
    department: userData?.department || "",
    role: userData?.role || userData?.designation || ""
  };
}

function getEngagementDestinationList(item) {
  if (Array.isArray(item?.destinationNames) && item.destinationNames.length) {
    return item.destinationNames.filter(Boolean);
  }

  if (item?.destinationName) {
    return [item.destinationName];
  }

  return [];
}

/* =========================
   ATTENDANCE HELPERS
========================== */

function getAttendanceSessions(record) {
  if (Array.isArray(record?.sessions)) {
    return record.sessions;
  }

  if (record?.checkInAt || record?.checkOutAt) {
    return [
      {
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
        minutes: record.minutes,
        status: record.status
      }
    ];
  }

  return [];
}

function getAttendanceRecordDate(record) {
  if (record?.date) return record.date;

  const d =
    toDate(record?.createdAt) ||
    toDate(record?.updatedAt) ||
    toDate(getFirstCheckIn(record));

  if (!d) return "";

  return d.toISOString().slice(0, 10);
}

function getFirstCheckIn(record) {
  const sessions = getAttendanceSessions(record);

  const dates = sessions
    .map(session => toDate(session?.checkInAt))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  return dates[0] || null;
}

function getLastCheckOut(record) {
  const sessions = getAttendanceSessions(record);

  const dates = sessions
    .map(session => toDate(session?.checkOutAt))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return dates[0] || null;
}

function getAttendanceStatus(record) {
  if (record?.status) return normalize(record.status);

  const sessions = getAttendanceSessions(record);
  const presentSession = sessions.find(
    session => normalize(session?.status) === "present"
  );

  if (presentSession) return "present";

  if (sessions.some(session => session?.checkInAt)) return "present";

  return "unknown";
}

function getAttendanceMinutes(record) {
  if (typeof record?.totalMinutes === "number") {
    return record.totalMinutes;
  }

  const sessions = getAttendanceSessions(record);

  return sessions.reduce((total, session) => {
    if (typeof session?.totalMinutes === "number") {
      return total + session.totalMinutes;
    }

    if (typeof session?.minutes === "number") {
      return total + session.minutes;
    }

    const checkIn = toDate(session?.checkInAt);
    const checkOut = toDate(session?.checkOutAt);

    if (!checkIn || !checkOut) return total;

    const diff = checkOut.getTime() - checkIn.getTime();

    if (diff <= 0) return total;

    return total + Math.round(diff / 60000);
  }, 0);
}

function isAttendanceInRange(record, rangeWindow) {
  if (!rangeWindow?.start) return true;

  const attendanceDate = getAttendanceRecordDate(record);

  if (attendanceDate) {
    const date = new Date(`${attendanceDate}T00:00:00`);
    return date >= rangeWindow.start && date <= rangeWindow.end;
  }

  return (
    isInRange(record?.createdAt, rangeWindow) ||
    isInRange(record?.updatedAt, rangeWindow) ||
    isInRange(getFirstCheckIn(record), rangeWindow)
  );
}

function isAttendancePresent(record) {
  const status = getAttendanceStatus(record);

  return (
    status === "present" ||
    status === "checked_in" ||
    status === "checked_out" ||
    getAttendanceSessions(record).some(session => session?.checkInAt)
  );
}

function isAttendanceActive(record) {
  return getAttendanceSessions(record).some(session => {
    return session?.checkInAt && !session?.checkOutAt;
  });
}

function isAttendanceLate(record) {
  const status = getAttendanceStatus(record);

  return (
    record?.isLate === true ||
    status === "late" ||
    status === "checked_in_late"
  );
}

function isAttendanceLeave(record) {
  const status = getAttendanceStatus(record);

  return status === "leave" || status === "on_leave" || status === "paid_leave";
}

function getAttendanceUser(record, userMap) {
  const uid =
    record?.uid ||
    record?.userUid ||
    record?.employeeUid ||
    record?.createdByUid ||
    "";

  const userData = uid ? userMap.get(uid) : null;

  const email =
    userData?.email ||
    record?.email ||
    record?.userEmail ||
    record?.employeeEmail ||
    "";

  const name =
    userData?.displayName ||
    userData?.name ||
    record?.displayName ||
    record?.userName ||
    record?.employeeName ||
    formatNameFromEmail(email);

  return {
    uid,
    email,
    name,
    department: userData?.department || "",
    role: userData?.role || userData?.designation || ""
  };
}

/* =========================
   MAIN MANAGEMENT DASHBOARD
========================== */

export default function AdminDashboardGraph() {
  const router = useRouter();
  const { user, loading, error } = useAuth("admin");

  const mountTimeRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now()
  );
  const authLoggedRef = useRef(false);

  const [range, setRange] = useState("today");
  const [activeTab, setActiveTab] = useState("overview");

  const [leads, setLeads] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [users, setUsers] = useState([]);
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
        Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
            mountTimeRef.current
        ),
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
  ========================== */

  useEffect(() => {
    if (!user) return;

    setDataLoading(true);
    setDashboardError("");

    const loaded = {
      leads: false,
      engagements: false,
      users: false,
      attendance: false
    };

    const markLoaded = key => {
      loaded[key] = true;

      if (
        loaded.leads &&
        loaded.engagements &&
        loaded.users &&
        loaded.attendance
      ) {
        setDataLoading(false);

        console.log(
          "[TimeLog] Management dashboard ready in",
          Math.round(
            (typeof performance !== "undefined"
              ? performance.now()
              : Date.now()) - mountTimeRef.current
          ),
          "ms"
        );
      }
    };

    const handleError = (label, err) => {
      console.error(`${label} load failed:`, err);
      setDashboardError(`Unable to load ${label.toLowerCase()} data.`);
      setDataLoading(false);
    };

    const unsubLeads = onSnapshot(
      collection(db, LEADS_COLLECTION),
      snap => {
        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const ad = getLeadDate(a)?.getTime() || 0;
            const bd = getLeadDate(b)?.getTime() || 0;
            return bd - ad;
          });

        setLeads(rows);
        markLoaded("leads");
      },
      err => handleError("Leads", err)
    );

    const unsubEngagements = onSnapshot(
      collection(db, ENGAGEMENT_COLLECTION),
      snap => {
        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const ad = getEngagementDate(a)?.getTime() || 0;
            const bd = getEngagementDate(b)?.getTime() || 0;
            return bd - ad;
          });

        setEngagements(rows);
        markLoaded("engagements");
      },
      err => handleError("Engagements", err)
    );

    const unsubUsers = onSnapshot(
      collection(db, USERS_COLLECTION),
      snap => {
        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const an = a.displayName || a.name || a.email || "";
            const bn = b.displayName || b.name || b.email || "";
            return an.localeCompare(bn);
          });

        setUsers(rows);
        markLoaded("users");
      },
      err => handleError("Users", err)
    );

    const unsubAttendance = onSnapshot(
      collection(db, ATTENDANCE_COLLECTION),
      snap => {
        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const ad = getAttendanceRecordDate(a);
            const bd = getAttendanceRecordDate(b);
            return bd.localeCompare(ad);
          });

        setAttendanceRecords(rows);
        markLoaded("attendance");
      },
      err => handleError("Attendance", err)
    );

    return () => {
      unsubLeads();
      unsubEngagements();
      unsubUsers();
      unsubAttendance();
    };
  }, [user]);

  /* =========================
     BASE MEMOS
  ========================== */

  const rangeWindow = useMemo(() => {
    return getRangeWindow(range);
  }, [range]);

  const activeUsers = useMemo(() => {
    return users.filter(item => item.active !== false);
  }, [users]);

  const userMap = useMemo(() => {
    const map = new Map();

    users.forEach(item => {
      const uid = item.uid || item.id;
      if (!uid) return;

      map.set(uid, item);
    });

    return map;
  }, [users]);

  const periodLeads = useMemo(() => {
    return leads.filter(lead => isInRange(lead.createdAt, rangeWindow));
  }, [leads, rangeWindow]);

  const periodEngagements = useMemo(() => {
    return engagements.filter(item =>
      isInRange(item.createdAt || item.updatedAt, rangeWindow)
    );
  }, [engagements, rangeWindow]);

  const periodAttendance = useMemo(() => {
    return attendanceRecords.filter(record =>
      isAttendanceInRange(record, rangeWindow)
    );
  }, [attendanceRecords, rangeWindow]);

  /* =========================
     TOTALS
  ========================== */

  const leadTotals = useMemo(() => {
    const assignedLeads = periodLeads.filter(hasLeadAssignee).length;
    const openLeads = periodLeads.filter(
      lead => normalize(lead.status) === "open"
    ).length;

    const activeLeads = periodLeads.filter(isActiveLead).length;
    const wonLeads = periodLeads.filter(isWonLead).length;
    const lostLeads = periodLeads.filter(isLostLead).length;

    const uniqueAgents = new Set(
      periodLeads.map(item => item.agentId || item.agentName).filter(Boolean)
    ).size;

    const uniqueDestinations = new Set(
      periodLeads.map(item => item.destinationName).filter(Boolean)
    ).size;

    return {
      total: periodLeads.length,
      openLeads,
      activeLeads,
      assignedLeads,
      unassignedLeads: Math.max(periodLeads.length - assignedLeads, 0),
      wonLeads,
      lostLeads,
      uniqueAgents,
      uniqueDestinations,
      byStage: countBy(periodLeads, item => item.stage || "Unknown"),
      byStatus: countBy(periodLeads, item => item.status || "Unknown"),
      byDestination: countBy(
        periodLeads,
        item => item.destinationName || "Unknown Destination"
      ),
      byAssignee: countBy(periodLeads, item => {
        const owner = getLeadOwner(item, userMap);
        return owner.name || "Unassigned";
      }),
      bySource: countBy(periodLeads, item => item.source || "Unknown Source")
    };
  }, [periodLeads, userMap]);

  const engagementTotals = useMemo(() => {
    const completed = periodEngagements.filter(
      item => normalize(item.status) === "completed"
    ).length;

    const calls = periodEngagements.filter(
      item => normalize(item.channel) === "call"
    ).length;

    const whatsapp = periodEngagements.filter(
      item => normalize(item.channel) === "whatsapp"
    ).length;

    const emails = periodEngagements.filter(
      item => normalize(item.channel) === "email"
    ).length;

    const meetings = periodEngagements.filter(
      item => normalize(item.channel) === "meeting"
    ).length;

    const lastActivity = periodEngagements.reduce((latest, item) => {
      const d = getEngagementDate(item);
      if (!d) return latest;
      if (!latest || d > latest) return d;
      return latest;
    }, null);

    return {
      total: periodEngagements.length,
      completed,
      calls,
      whatsapp,
      emails,
      meetings,
      completionRate: periodEngagements.length
        ? Math.round((completed / periodEngagements.length) * 100)
        : 0,
      lastActivity,
      byChannel: countBy(
        periodEngagements,
        item => item.channel || "Unknown Channel"
      ),
      byCreator: countBy(periodEngagements, item => {
        const owner = getEngagementOwner(item, userMap);
        return owner.name || "Unknown User";
      }),
      byDestination: countBy(periodEngagements, getEngagementDestinationList)
    };
  }, [periodEngagements, userMap]);

  const attendanceTotals = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);

    const todayAttendanceRows = attendanceRecords.filter(
      record => getAttendanceRecordDate(record) === todayIso
    );

    const presentTodayUids = new Set(
      todayAttendanceRows
        .filter(isAttendancePresent)
        .map(record => record.uid || record.userUid || record.employeeUid)
        .filter(Boolean)
    );

    const checkIns = periodAttendance.reduce((total, record) => {
      const sessions = getAttendanceSessions(record);
      const count = sessions.filter(session => session?.checkInAt).length;

      return total + (count || (getFirstCheckIn(record) ? 1 : 0));
    }, 0);

    const checkedOut = periodAttendance.reduce((total, record) => {
      const sessions = getAttendanceSessions(record);
      const count = sessions.filter(session => session?.checkOutAt).length;

      return total + (count || (getLastCheckOut(record) ? 1 : 0));
    }, 0);

    const totalMinutes = periodAttendance.reduce((total, record) => {
      return total + getAttendanceMinutes(record);
    }, 0);

    const activeNow = todayAttendanceRows.filter(isAttendanceActive).length;
    const late = periodAttendance.filter(isAttendanceLate).length;
    const leave = periodAttendance.filter(isAttendanceLeave).length;

    return {
      checkIns,
      checkedOut,
      activeNow,
      late,
      leave,
      presentToday: presentTodayUids.size,
      absentToday: Math.max(activeUsers.length - presentTodayUids.size, 0),
      totalMinutes,
      averageMinutes: periodAttendance.length
        ? Math.round(totalMinutes / periodAttendance.length)
        : 0,
      byStatus: countBy(periodAttendance, getAttendanceStatus)
    };
  }, [attendanceRecords, periodAttendance, activeUsers]);

  const userTotals = useMemo(() => {
    const adminUsers = activeUsers.filter(item => {
      const role = normalize(item.role);

      return item.isAdmin === true || role === "admin" || role === "super_admin";
    }).length;

    const employeeUsers = activeUsers.filter(item => {
      const role = normalize(item.role);

      return role === "employee";
    }).length;

    return {
      activeUsers: activeUsers.length,
      adminUsers,
      employeeUsers,
      departments: new Set(
        activeUsers.map(item => item.department).filter(Boolean)
      ).size,
      byDepartment: countBy(activeUsers, item => item.department || "No Department"),
      byRole: countBy(
        activeUsers,
        item => item.role || item.designation || "Unknown Role"
      )
    };
  }, [activeUsers]);

  /* =========================
     TEAM ROWS
  ========================== */

  const teamRows = useMemo(() => {
    const map = new Map();

    const ensureMember = member => {
      const key =
        member.uid ||
        member.email ||
        member.name ||
        `unknown-${map.size + 1}`;

      if (!map.has(key)) {
        map.set(key, {
          uid: member.uid || "",
          email: member.email || "",
          name: member.name || formatNameFromEmail(member.email),
          department: member.department || "",
          role: member.role || "",

          newLeads: 0,
          activeLeads: 0,
          wonLeads: 0,
          lostLeads: 0,
          assignedLeads: 0,

          engagements: 0,
          completedEngagements: 0,
          calls: 0,
          whatsapp: 0,
          emails: 0,
          meetings: 0,
          otherEngagements: 0,

          attendanceDays: 0,
          checkIns: 0,
          activeSessions: 0,
          late: 0,
          leave: 0,
          totalMinutes: 0,
          firstCheckIn: null,
          lastCheckOut: null,

          lastActivityAt: null,
          score: 0
        });
      }

      const row = map.get(key);

      if (!row.email && member.email) row.email = member.email;
      if (!row.department && member.department) row.department = member.department;
      if (!row.role && member.role) row.role = member.role;

      return row;
    };

    const updateLastActivity = (row, value) => {
      const d = toDate(value);
      if (!d) return;

      if (!row.lastActivityAt || d > row.lastActivityAt) {
        row.lastActivityAt = d;
      }
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

    activeUsers.forEach(item => {
      ensureMember({
        uid: item.uid || item.id,
        email: item.email || "",
        name: item.displayName || item.name || formatNameFromEmail(item.email),
        department: item.department || "",
        role: item.role || item.designation || ""
      });
    });

    periodLeads.forEach(lead => {
      const owner = getLeadOwner(lead, userMap);
      const row = ensureMember(owner);

      row.newLeads += 1;

      if (hasLeadAssignee(lead)) {
        row.assignedLeads += 1;
      }

      if (isActiveLead(lead)) {
        row.activeLeads += 1;
      }

      if (isWonLead(lead)) {
        row.wonLeads += 1;
      }

      if (isLostLead(lead)) {
        row.lostLeads += 1;
      }

      updateLastActivity(row, lead.updatedAt || lead.assignedAt || lead.createdAt);
    });

    periodEngagements.forEach(item => {
      const owner = getEngagementOwner(item, userMap);
      const row = ensureMember(owner);

      row.engagements += 1;

      if (normalize(item.status) === "completed") {
        row.completedEngagements += 1;
      }

      const channel = normalize(item.channel);

      if (channel === "call") row.calls += 1;
      else if (channel === "whatsapp") row.whatsapp += 1;
      else if (channel === "email") row.emails += 1;
      else if (channel === "meeting") row.meetings += 1;
      else row.otherEngagements += 1;

      updateLastActivity(row, item.updatedAt || item.createdAt);
    });

    periodAttendance.forEach(record => {
      const owner = getAttendanceUser(record, userMap);
      const row = ensureMember(owner);

      const sessions = getAttendanceSessions(record);
      const checkInCount = sessions.filter(session => session?.checkInAt).length;

      row.attendanceDays += 1;
      row.checkIns += checkInCount || (getFirstCheckIn(record) ? 1 : 0);
      row.totalMinutes += getAttendanceMinutes(record);

      if (isAttendanceActive(record)) {
        row.activeSessions += 1;
      }

      if (isAttendanceLate(record)) {
        row.late += 1;
      }

      if (isAttendanceLeave(record)) {
        row.leave += 1;
      }

      updateFirstCheckIn(row, getFirstCheckIn(record));
      updateLastCheckOut(row, getLastCheckOut(record));
    });

    return Array.from(map.values())
      .map(row => {
        const score =
          row.newLeads * 3 +
          row.activeLeads +
          row.completedEngagements * 3 +
          row.calls * 2 +
          row.whatsapp * 2 +
          row.emails * 2 +
          row.meetings * 3 +
          row.wonLeads * 10 +
          row.attendanceDays;

        return {
          ...row,
          score
        };
      })
      .sort((a, b) => {
        if (activeTab === "engagement") {
          return b.engagements - a.engagements || b.score - a.score;
        }

        if (activeTab === "leads") {
          return b.newLeads - a.newLeads || b.activeLeads - a.activeLeads;
        }

        if (activeTab === "attendance") {
          return b.totalMinutes - a.totalMinutes || b.checkIns - a.checkIns;
        }

        return b.score - a.score;
      });
  }, [
    activeUsers,
    periodLeads,
    periodEngagements,
    periodAttendance,
    userMap,
    activeTab
  ]);

  const managementSummary = useMemo(() => {
    const totalWorkloadScore = teamRows.reduce((sum, row) => sum + row.score, 0);

    return {
      workloadScore: totalWorkloadScore,
      lastActivity: teamRows.reduce((latest, row) => {
        if (!row.lastActivityAt) return latest;
        if (!latest || row.lastActivityAt > latest) return row.lastActivityAt;
        return latest;
      }, null)
    };
  }, [teamRows]);

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
      {/* HEADER */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Management Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Business performance, lead pipeline, engagement activity, employee workload and attendance overview.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-full md:w-auto">
            {[
              { key: "today", label: "Today" },
              { key: "week", label: "This Week" },
              { key: "month", label: "This Month" },
              { key: "all", label: "All" }
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

        {dashboardError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dashboardError}
          </div>
        ) : null}

        {dataLoading ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Loading management data...
          </div>
        ) : null}

        {/* TOP MANAGEMENT PULSE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardKpiCard
            label="Total Leads"
            value={leadTotals.total}
          />

          <DashboardKpiCard
            label="Open Leads"
            value={leadTotals.openLeads}
            color="blue"
          />

          <DashboardKpiCard
            label="Total Engagements"
            value={engagementTotals.total}
            color="green"
          />

          <DashboardKpiCard
            label="Present Today"
            value={attendanceTotals.presentToday}
            color="green"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardKpiCard
            label="Assigned Leads"
            value={leadTotals.assignedLeads}
            color="blue"
          />

          <DashboardKpiCard
            label="Unassigned Leads"
            value={leadTotals.unassignedLeads}
            color={leadTotals.unassignedLeads ? "red" : "gray"}
          />

          <DashboardKpiCard
            label="Active Employees"
            value={userTotals.activeUsers}
            color="purple"
          />

          <DashboardKpiCard
            label="Attendance Hours"
            value={formatDuration(attendanceTotals.totalMinutes)}
            color="purple"
          />
        </div>

        {/* TABS */}
        <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm flex gap-1 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "leads", label: "Leads" },
            { key: "engagement", label: "Engagement" },
            { key: "attendance", label: "Attendance" },
            { key: "team", label: "Team" }
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

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Active Leads"
              value={leadTotals.activeLeads}
              color="blue"
            />

            <DashboardKpiCard
              label="Won Leads"
              value={leadTotals.wonLeads}
              color="green"
            />

            <DashboardKpiCard
              label="Engagement Completion"
              value={`${engagementTotals.completionRate}%`}
              color="green"
            />

            <DashboardKpiCard
              label="Absent / Not Checked In"
              value={attendanceTotals.absentToday}
              color={attendanceTotals.absentToday ? "red" : "gray"}
            />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeadsTrendChart leads={periodLeads} />
            <LeadsByStageChart leads={periodLeads} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              title="Leads by Destination"
              rows={leadTotals.byDestination}
            />

            <MiniBarList
              title="Engagement by Channel"
              rows={engagementTotals.byChannel}
            />

            <MiniBarList
              title="Users by Department"
              rows={userTotals.byDepartment}
            />
          </section>

          <ManagementOverviewTable rows={teamRows} />
        </section>
      )}

      {/* LEADS */}
      {activeTab === "leads" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="New Leads"
              value={leadTotals.total}
            />

            <DashboardKpiCard
              label="Active Leads"
              value={leadTotals.activeLeads}
              color="blue"
            />

            <DashboardKpiCard
              label="Assigned"
              value={leadTotals.assignedLeads}
              color="blue"
            />

            <DashboardKpiCard
              label="Unassigned"
              value={leadTotals.unassignedLeads}
              color={leadTotals.unassignedLeads ? "red" : "gray"}
            />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeadsByStageChart leads={periodLeads} />
            <LeadsByDestinationChart leads={periodLeads} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              title="Leads by Stage"
              rows={leadTotals.byStage}
            />

            <MiniBarList
              title="Leads by Status"
              rows={leadTotals.byStatus}
            />

            <MiniBarList
              title="Leads by Source"
              rows={leadTotals.bySource}
            />
          </section>

          <ManagementLeadsTable rows={teamRows} />
        </section>
      )}

      {/* ENGAGEMENT */}
      {activeTab === "engagement" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <EngagementKpiCard
              label="Calls"
              value={engagementTotals.calls}
            />

            <EngagementKpiCard
              label="WhatsApp"
              value={engagementTotals.whatsapp}
            />

            <EngagementKpiCard
              label="Emails"
              value={engagementTotals.emails}
            />

            <EngagementKpiCard
              label="Meetings"
              value={engagementTotals.meetings}
            />

            <EngagementKpiCard
              label="Last Activity"
              value={formatDateTime(engagementTotals.lastActivity)}
            />
          </div>

          <EngagementByChannelChart engagements={periodEngagements} />

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList
              title="Engagement by Employee"
              rows={engagementTotals.byCreator}
            />

            <MiniBarList
              title="Engagement by Destination"
              rows={engagementTotals.byDestination}
            />
          </section>

          <ManagementEngagementTable rows={teamRows} />
        </section>
      )}

      {/* ATTENDANCE */}
      {activeTab === "attendance" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Present Today"
              value={attendanceTotals.presentToday}
              color="green"
            />

            <DashboardKpiCard
              label="Active Now"
              value={attendanceTotals.activeNow}
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

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList
              title="Attendance by Status"
              rows={attendanceTotals.byStatus}
            />

            <MiniBarList
              title="Working Hours by Employee"
              rows={teamRows
                .filter(row => row.totalMinutes > 0)
                .map(row => ({
                  name: row.name,
                  count: row.totalMinutes,
                  displayCount: formatDuration(row.totalMinutes)
                }))
                .sort((a, b) => b.count - a.count)}
            />
          </section>

          <ManagementAttendanceTable rows={teamRows} />
        </section>
      )}

      {/* TEAM */}
      {activeTab === "team" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Active Users"
              value={userTotals.activeUsers}
              color="blue"
            />

            <DashboardKpiCard
              label="Employee Users"
              value={userTotals.employeeUsers}
              color="green"
            />

            <DashboardKpiCard
              label="Admin Users"
              value={userTotals.adminUsers}
              color="purple"
            />

            <DashboardKpiCard
              label="Departments"
              value={userTotals.departments}
              color="blue"
            />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList
              title="Users by Department"
              rows={userTotals.byDepartment}
            />

            <MiniBarList
              title="Users by Role"
              rows={userTotals.byRole}
            />
          </section>

          <ManagementTeamTable rows={teamRows} />
        </section>
      )}
    </main>
  );
}

/* =========================
   MINI BAR LIST
========================== */

function MiniBarList({ title, rows }) {
  const max = rows?.length ? Math.max(...rows.map(row => row.count)) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900">
        {title}
      </h2>

      {!rows?.length ? (
        <p className="text-sm text-gray-500 mt-4">
          No data found.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.slice(0, 8).map(row => {
            const width = max
              ? `${Math.max((row.count / max) * 100, 8)}%`
              : "0%";

            return (
              <div key={row.name}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {readableLabel(row.name)}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {row.displayCount || row.count}
                  </p>
                </div>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full"
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================
   OVERVIEW TABLE
========================== */

function ManagementOverviewTable({ rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Team Member Management Overview
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Combined lead, engagement and attendance performance.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-right px-4 py-3 font-medium">Leads</th>
              <th className="text-right px-4 py-3 font-medium">Active</th>
              <th className="text-right px-4 py-3 font-medium">Won</th>
              <th className="text-right px-4 py-3 font-medium">Engagements</th>
              <th className="text-right px-4 py-3 font-medium">Attendance</th>
              <th className="text-right px-4 py-3 font-medium">Hours</th>
              <th className="text-left px-4 py-3 font-medium">Last Activity</th>
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
                    {row.department || row.email || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 text-right">{row.newLeads}</td>
                <td className="px-4 py-3 text-right">{row.activeLeads}</td>
                <td className="px-4 py-3 text-right text-green-700 font-medium">
                  {row.wonLeads}
                </td>
                <td className="px-4 py-3 text-right">{row.engagements}</td>
                <td className="px-4 py-3 text-right">{row.attendanceDays}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatDuration(row.totalMinutes)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDateTime(row.lastActivityAt)}
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
                  No management data found.
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
          Lead assignment and pipeline movement for the selected period.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-right px-4 py-3 font-medium">New</th>
              <th className="text-right px-4 py-3 font-medium">Assigned</th>
              <th className="text-right px-4 py-3 font-medium">Active</th>
              <th className="text-right px-4 py-3 font-medium">Won</th>
              <th className="text-right px-4 py-3 font-medium">Lost</th>
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
                <td className="px-4 py-3 text-right">{row.assignedLeads}</td>
                <td className="px-4 py-3 text-right">{row.activeLeads}</td>
                <td className="px-4 py-3 text-right text-green-700 font-medium">
                  {row.wonLeads}
                </td>
                <td className="px-4 py-3 text-right">{row.lostLeads}</td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td
                  colSpan={6}
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
          WhatsApp, call, email and meeting activity for the selected period.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-right px-4 py-3 font-medium">Calls</th>
              <th className="text-right px-4 py-3 font-medium">WhatsApp</th>
              <th className="text-right px-4 py-3 font-medium">Emails</th>
              <th className="text-right px-4 py-3 font-medium">Meetings</th>
              <th className="text-right px-4 py-3 font-medium">Completed</th>
              <th className="text-left px-4 py-3 font-medium">Last Activity</th>
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

                <td className="px-4 py-3 text-right">{row.engagements}</td>
                <td className="px-4 py-3 text-right">{row.calls}</td>
                <td className="px-4 py-3 text-right">{row.whatsapp}</td>
                <td className="px-4 py-3 text-right">{row.emails}</td>
                <td className="px-4 py-3 text-right">{row.meetings}</td>
                <td className="px-4 py-3 text-right text-green-700 font-medium">
                  {row.completedEngagements}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDateTime(row.lastActivityAt)}
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
          Attendance days, active sessions, late marks and working hours.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-right px-4 py-3 font-medium">Days</th>
              <th className="text-right px-4 py-3 font-medium">Check-ins</th>
              <th className="text-right px-4 py-3 font-medium">Active</th>
              <th className="text-right px-4 py-3 font-medium">Late</th>
              <th className="text-right px-4 py-3 font-medium">Leave</th>
              <th className="text-left px-4 py-3 font-medium">First Check-in</th>
              <th className="text-left px-4 py-3 font-medium">Last Check-out</th>
              <th className="text-right px-4 py-3 font-medium">Hours</th>
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
                    {row.department || row.email || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 text-right">
                  {row.attendanceDays}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.checkIns}
                </td>

                <td
                  className={`
                    px-4 py-3 text-right font-medium
                    ${row.activeSessions ? "text-green-700" : "text-gray-700"}
                  `}
                >
                  {row.activeSessions}
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

/* =========================
   TEAM TABLE
========================== */

function ManagementTeamTable({ rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Team Workload Overview
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Combined workload score based on leads, engagements, wins and attendance.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Team Member</th>
              <th className="text-left px-4 py-3 font-medium">Department</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-right px-4 py-3 font-medium">Leads</th>
              <th className="text-right px-4 py-3 font-medium">Engagements</th>
              <th className="text-right px-4 py-3 font-medium">Attendance Days</th>
              <th className="text-right px-4 py-3 font-medium">Hours</th>
              <th className="text-right px-4 py-3 font-medium">Score</th>
              <th className="text-left px-4 py-3 font-medium">Rating</th>
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

                <td className="px-4 py-3 text-gray-600">
                  {row.department || "—"}
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {readableLabel(row.role)}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.newLeads}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.engagements}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.attendanceDays}
                </td>

                <td className="px-4 py-3 text-right font-medium">
                  {formatDuration(row.totalMinutes)}
                </td>

                <td className="px-4 py-3 text-right font-semibold">
                  {row.score}
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
                  No team data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}