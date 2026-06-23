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

function getLocalDateKey(value = new Date()) {
  const d = toDate(value) || new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function pickAmount(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
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

function sumBy(rows, keyGetter, valueGetter, formatter) {
  const map = new Map();

  rows.forEach(row => {
    const key = keyGetter(row);
    if (!key) return;

    const value = Number(valueGetter(row) || 0);
    if (!Number.isFinite(value)) return;

    map.set(key, (map.get(key) || 0) + value);
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({
      name,
      count,
      displayCount: formatter ? formatter(count) : count
    }))
    .sort((a, b) => b.count - a.count);
}

function getScoreLabel(score) {
  if (score >= 120) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 20) return "Average";
  return "Needs Attention";
}

function getScoreClass(score) {
  if (score >= 120) {
    return "bg-green-50 text-green-700 border-green-100";
  }

  if (score >= 60) {
    return "bg-blue-50 text-blue-700 border-blue-100";
  }

  if (score >= 20) {
    return "bg-yellow-50 text-yellow-700 border-yellow-100";
  }

  return "bg-red-50 text-red-700 border-red-100";
}

/* =========================
   GLOBAL LEAD VISIBILITY
   isDeleted === true is excluded everywhere
========================== */

function isDeletedLead(lead) {
  return lead?.isDeleted === true;
}

function getActiveLeads(leads = []) {
  if (!Array.isArray(leads)) return [];
  return leads.filter(lead => !isDeletedLead(lead));
}

/* =========================
   LEAD HELPERS
========================== */

function getLeadDate(lead) {
  return (
    toDate(lead?.createdAt) ||
    toDate(lead?.assignedAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.lastActivityAt)
  );
}

function getLeadActivityDate(lead) {
  return (
    toDate(lead?.lastActivityAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.assignedAt) ||
    toDate(lead?.createdAt)
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

function getLeadQuotationAmount(lead) {
  return (
    pickAmount(
      lead?.latestQuotationAmount,
      lead?.latestCustomerQuoteAmount,
      lead?.totalReceivableAmount,
      lead?.customerQuoteAmount
    ) || 0
  );
}

function getLeadVendorCost(lead) {
  return (
    pickAmount(
      lead?.latestVendorCost,
      lead?.latestSelectedVendorCost,
      lead?.totalVendorPayableAmount,
      lead?.latestVendorQuoteCost
    ) || 0
  );
}

function getLeadGrossProfit(lead) {
  const storedProfit = pickAmount(
    lead?.actualGrossProfit,
    lead?.latestGrossProfit,
    lead?.expectedGrossProfit
  );

  if (storedProfit !== null) return storedProfit;

  return getLeadQuotationAmount(lead) - getLeadVendorCost(lead);
}

function getLeadReceivedAmount(lead) {
  return (
    pickAmount(
      lead?.totalPaymentReceived,
      lead?.latestCustomerPaymentAmount
    ) || 0
  );
}

function getLeadVendorPaidAmount(lead) {
  return (
    pickAmount(
      lead?.totalVendorPaid,
      lead?.latestVendorPaymentAmount,
      lead?.latestVendorPaymentEntryAmount
    ) || 0
  );
}

function hasQuotationSent(lead) {
  return (
    normalize(lead?.latestQuotationStatus) === "sent" ||
    Boolean(lead?.latestQuotationSentAt) ||
    Boolean(lead?.latestQuotationId)
  );
}

function hasVendorRequest(lead) {
  return (
    Number(lead?.vendorRequestCount || 0) > 0 ||
    Boolean(lead?.latestVendorRequestId) ||
    Boolean(lead?.lastVendorCommunicationAt)
  );
}

function hasVendorQuoteReceived(lead) {
  const quoteStatus = normalize(lead?.latestVendorQuoteStatus);
  const requestStatus = normalize(lead?.latestVendorRequestStatus);

  return (
    Number(lead?.vendorQuoteCount || 0) > 0 ||
    quoteStatus === "received" ||
    requestStatus === "quote_received" ||
    Boolean(lead?.latestVendorQuoteId)
  );
}

function isVendorQuotePending(lead) {
  if (!hasVendorRequest(lead)) return false;
  return !hasVendorQuoteReceived(lead);
}

function isVendorSelected(lead) {
  return Boolean(
    lead?.latestSelectedVendorName ||
      lead?.latestSelectedVendorQuoteId ||
      lead?.latestSelectedVendorRequestId
  );
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

function getAttendanceRecordDate(record) {
  if (record?.date) return record.date;

  const d =
    toDate(record?.createdAt) ||
    toDate(record?.updatedAt) ||
    toDate(getFirstCheckIn(record));

  if (!d) return "";

  return getLocalDateKey(d);
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
        const allRows = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        const activeRows = getActiveLeads(allRows).sort((a, b) => {
          const ad = getLeadDate(a)?.getTime() || 0;
          const bd = getLeadDate(b)?.getTime() || 0;
          return bd - ad;
        });

        console.log("[Management Dashboard Lead Filter]", {
          firestoreTotal: allRows.length,
          activeUsed: activeRows.length,
          deletedExcluded: allRows.length - activeRows.length,
          deletedLeadCodes: allRows
            .filter(isDeletedLead)
            .map(lead => lead.leadCode || lead.id)
        });

        setLeads(activeRows);
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

  const activeDashboardLeads = useMemo(() => {
    return getActiveLeads(leads);
  }, [leads]);

  const periodLeads = useMemo(() => {
    return getActiveLeads(activeDashboardLeads).filter(lead =>
      isInRange(getLeadDate(lead), rangeWindow)
    );
  }, [activeDashboardLeads, rangeWindow]);

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
     LEAD TOTALS
  ========================== */

  const leadTotals = useMemo(() => {
    const leadRows = getActiveLeads(periodLeads);

    const assignedLeads = leadRows.filter(hasLeadAssignee).length;
    const openLeads = leadRows.filter(
      lead => normalize(lead.status) === "open"
    ).length;

    const activeLeads = leadRows.filter(isActiveLead).length;
    const wonLeads = leadRows.filter(isWonLead).length;
    const lostLeads = leadRows.filter(isLostLead).length;
    const quoteSentLeads = leadRows.filter(hasQuotationSent).length;

    const uniqueAgents = new Set(
      leadRows
        .map(item => item.agentId || item.agentName || item.agencyName)
        .filter(Boolean)
    ).size;

    const uniqueDestinations = new Set(
      leadRows.map(item => item.destinationName).filter(Boolean)
    ).size;

    return {
      total: leadRows.length,
      openLeads,
      activeLeads,
      assignedLeads,
      unassignedLeads: Math.max(leadRows.length - assignedLeads, 0),
      wonLeads,
      lostLeads,
      quoteSentLeads,
      uniqueAgents,
      uniqueDestinations,
      byStage: countBy(leadRows, item => item.stage || "Unknown"),
      byStatus: countBy(leadRows, item => item.status || "Unknown"),
      byDestination: countBy(
        leadRows,
        item => item.destinationName || "Unknown Destination"
      ),
      byAssignee: countBy(leadRows, item => {
        const owner = getLeadOwner(item, userMap);
        return owner.name || "Unassigned";
      }),
      bySource: countBy(leadRows, item => item.source || "Unknown Source"),
      byAgent: countBy(
        leadRows,
        item =>
          item.agentName ||
          item.agencyName ||
          item.travelAgentName ||
          "Unknown Agent"
      )
    };
  }, [periodLeads, userMap]);

  /* =========================
     FINANCE TOTALS
  ========================== */

  const financeTotals = useMemo(() => {
    const financeLeads = getActiveLeads(periodLeads);

    const quotationValue = financeLeads.reduce((sum, lead) => {
      return sum + getLeadQuotationAmount(lead);
    }, 0);

    const vendorCost = financeLeads.reduce((sum, lead) => {
      return sum + getLeadVendorCost(lead);
    }, 0);

    const grossProfit = financeLeads.reduce((sum, lead) => {
      return sum + getLeadGrossProfit(lead);
    }, 0);

    const receivableAmount = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.totalReceivableAmount);
    }, 0);

    const receivedAmount = financeLeads.reduce((sum, lead) => {
      return sum + getLeadReceivedAmount(lead);
    }, 0);

    const pendingReceivable = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.paymentBalance);
    }, 0);

    const vendorPayable = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.totalVendorPayableAmount);
    }, 0);

    const vendorPaid = financeLeads.reduce((sum, lead) => {
      return sum + getLeadVendorPaidAmount(lead);
    }, 0);

    const vendorBalance = financeLeads.reduce((sum, lead) => {
      return sum + toAmount(lead?.vendorPaymentBalance);
    }, 0);

    const quotationSent = financeLeads.filter(lead => {
      return normalize(lead?.latestQuotationStatus) === "sent";
    }).length;

    const customerFullyPaid = financeLeads.filter(lead => {
      return normalize(lead?.customerPaymentStatus) === "fully_paid";
    }).length;

    const vendorFullyPaid = financeLeads.filter(lead => {
      return normalize(lead?.vendorPaymentStatus) === "fully_paid";
    }).length;

    const marginPercent = quotationValue
      ? Number(((grossProfit / quotationValue) * 100).toFixed(2))
      : 0;

    return {
      quotationValue,
      vendorCost,
      grossProfit,
      receivableAmount,
      receivedAmount,
      pendingReceivable,
      vendorPayable,
      vendorPaid,
      vendorBalance,
      quotationSent,
      customerFullyPaid,
      vendorFullyPaid,
      marginPercent,
      cashInHand: receivedAmount - vendorPaid,
      byDestinationRevenue: sumBy(
        financeLeads,
        lead => lead.destinationName || "Unknown Destination",
        getLeadQuotationAmount,
        formatCurrency
      ),
      byDestinationProfit: sumBy(
        financeLeads,
        lead => lead.destinationName || "Unknown Destination",
        getLeadGrossProfit,
        formatCurrency
      ),
      byAgentRevenue: sumBy(
        financeLeads,
        lead =>
          lead.agentName ||
          lead.agencyName ||
          lead.travelAgentName ||
          "Unknown Agent",
        getLeadQuotationAmount,
        formatCurrency
      ),
      byAssigneeRevenue: sumBy(
        financeLeads,
        lead => {
          const owner = getLeadOwner(lead, userMap);
          return owner.name || "Unassigned";
        },
        getLeadQuotationAmount,
        formatCurrency
      ),
      byPaymentStatus: countBy(
        financeLeads,
        lead => lead.customerPaymentStatus || "Not Updated"
      ),
      byVendorPaymentStatus: countBy(
        financeLeads,
        lead => lead.vendorPaymentStatus || "Not Updated"
      )
    };
  }, [periodLeads, userMap]);

  /* =========================
     VENDOR TOTALS
  ========================== */

  const vendorTotals = useMemo(() => {
    const vendorLeads = getActiveLeads(periodLeads);

    const requestedLeads = vendorLeads.filter(hasVendorRequest);
    const quoteReceivedLeads = vendorLeads.filter(hasVendorQuoteReceived);
    const pendingQuoteLeads = vendorLeads.filter(isVendorQuotePending);
    const selectedVendorLeads = vendorLeads.filter(isVendorSelected);

    const totalVendorRequests = vendorLeads.reduce((sum, lead) => {
      return sum + Number(lead?.vendorRequestCount || 0);
    }, 0);

    const totalVendorQuotes = vendorLeads.reduce((sum, lead) => {
      return sum + Number(lead?.vendorQuoteCount || 0);
    }, 0);

    const lastVendorActivity = vendorLeads.reduce((latest, lead) => {
      const d =
        toDate(lead?.lastVendorQuoteAt) ||
        toDate(lead?.lastVendorCommunicationAt);

      if (!d) return latest;
      if (!latest || d > latest) return d;

      return latest;
    }, null);

    return {
      requestedLeads: requestedLeads.length,
      quoteReceivedLeads: quoteReceivedLeads.length,
      pendingQuoteLeads: pendingQuoteLeads.length,
      selectedVendorLeads: selectedVendorLeads.length,
      totalVendorRequests,
      totalVendorQuotes,
      lastVendorActivity,
      byVendor: countBy(
        vendorLeads.filter(lead => lead?.latestVendorName),
        lead => lead.latestVendorName
      ),
      byVendorCost: sumBy(
        vendorLeads.filter(lead => lead?.latestVendorName),
        lead => lead.latestVendorName,
        getLeadVendorCost,
        formatCurrency
      ),
      byVendorStatus: countBy(
        vendorLeads.filter(hasVendorRequest),
        lead => lead.latestVendorRequestStatus || "Unknown"
      ),
      byVendorQuoteStatus: countBy(
        vendorLeads.filter(hasVendorRequest),
        lead => lead.latestVendorQuoteStatus || "Pending"
      )
    };
  }, [periodLeads]);

  /* =========================
     ATTENTION REQUIRED
  ========================== */

  const attentionSummary = useMemo(() => {
    const attentionLeads = getActiveLeads(periodLeads);

    const now = new Date();
    const staleLimit = new Date(now);
    staleLimit.setDate(staleLimit.getDate() - 3);

    const rows = [];

    const pushItem = (lead, type, severity, reason) => {
      if (isDeletedLead(lead)) return;

      rows.push({
        id: `${lead.id}-${type}`,
        leadId: lead.id,
        leadCode: lead.leadCode || lead.id,
        customerName: lead.customerName || lead.agentName || "Unknown Client",
        agentName:
          lead.agentName ||
          lead.agencyName ||
          lead.travelAgentName ||
          "Unknown Agent",
        destinationName: lead.destinationName || "Unknown Destination",
        assignedToName: lead.assignedToName || "Unassigned",
        stage: lead.stage || lead.status || "Unknown",
        type,
        severity,
        reason,
        amount: getLeadQuotationAmount(lead),
        lastActivityAt: getLeadActivityDate(lead)
      });
    };

    attentionLeads.forEach(lead => {
      if (!hasLeadAssignee(lead)) {
        pushItem(lead, "unassigned", "high", "Lead is not assigned to any team member.");
      }

      if (isActiveLead(lead) && !hasVendorRequest(lead)) {
        pushItem(lead, "vendor_request_missing", "medium", "Vendor request has not been sent.");
      }

      if (isVendorQuotePending(lead)) {
        pushItem(lead, "vendor_quote_pending", "high", "Vendor quotation is pending.");
      }

      if (hasVendorQuoteReceived(lead) && !hasQuotationSent(lead)) {
        pushItem(lead, "quotation_pending", "high", "Vendor quote received but quotation not sent to customer.");
      }

      if (toAmount(lead?.paymentBalance) > 0) {
        pushItem(lead, "customer_payment_pending", "high", "Customer payment balance is pending.");
      }

      if (toAmount(lead?.vendorPaymentBalance) > 0) {
        pushItem(lead, "vendor_payment_pending", "medium", "Vendor payment balance is pending.");
      }

      if (getLeadGrossProfit(lead) < 0) {
        pushItem(lead, "negative_profit", "critical", "Gross profit is negative.");
      }

      if (
        getLeadQuotationAmount(lead) > 0 &&
        Number(lead?.latestMarginPercent || 0) > 0 &&
        Number(lead?.latestMarginPercent || 0) < 8
      ) {
        pushItem(lead, "low_margin", "medium", "Margin is below recommended level.");
      }

      const nextDue = toDate(lead?.nextActionDueAt);
      if (isActiveLead(lead) && nextDue && nextDue < now) {
        pushItem(lead, "overdue_followup", "high", "Next action / follow-up is overdue.");
      }

      const lastActivity = getLeadActivityDate(lead);
      if (isActiveLead(lead) && lastActivity && lastActivity < staleLimit) {
        pushItem(lead, "stale_lead", "medium", "No recent activity in the last 3 days.");
      }
    });

    const byType = countBy(rows, item => item.type);
    const critical = rows.filter(item => item.severity === "critical").length;
    const high = rows.filter(item => item.severity === "high").length;
    const medium = rows.filter(item => item.severity === "medium").length;

    return {
      rows: rows.sort((a, b) => {
        const severityRank = {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1
        };

        return (
          (severityRank[b.severity] || 0) -
            (severityRank[a.severity] || 0) ||
          (b.amount || 0) - (a.amount || 0)
        );
      }),
      byType,
      critical,
      high,
      medium,
      total: rows.length
    };
  }, [periodLeads]);

  /* =========================
     ENGAGEMENT TOTALS
  ========================== */

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

  /* =========================
     ATTENDANCE TOTALS
  ========================== */

  const attendanceTotals = useMemo(() => {
    const todayIso = getLocalDateKey();

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

  /* =========================
     USER TOTALS
  ========================== */

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
      byDepartment: countBy(
        activeUsers,
        item => item.department || "No Department"
      ),
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
    const teamLeads = getActiveLeads(periodLeads);
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
          quoteSentLeads: 0,

          quotationValue: 0,
          receivedAmount: 0,
          vendorPaid: 0,
          grossProfit: 0,

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

    teamLeads.forEach(lead => {
      const owner = getLeadOwner(lead, userMap);
      const row = ensureMember(owner);

      row.newLeads += 1;

      if (hasLeadAssignee(lead)) row.assignedLeads += 1;
      if (isActiveLead(lead)) row.activeLeads += 1;
      if (isWonLead(lead)) row.wonLeads += 1;
      if (isLostLead(lead)) row.lostLeads += 1;
      if (hasQuotationSent(lead)) row.quoteSentLeads += 1;

      row.quotationValue += getLeadQuotationAmount(lead);
      row.receivedAmount += getLeadReceivedAmount(lead);
      row.vendorPaid += getLeadVendorPaidAmount(lead);
      row.grossProfit += getLeadGrossProfit(lead);

      updateLastActivity(
        row,
        lead.lastActivityAt || lead.updatedAt || lead.assignedAt || lead.createdAt
      );
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

      if (isAttendanceActive(record)) row.activeSessions += 1;
      if (isAttendanceLate(record)) row.late += 1;
      if (isAttendanceLeave(record)) row.leave += 1;

      updateFirstCheckIn(row, getFirstCheckIn(record));
      updateLastCheckOut(row, getLastCheckOut(record));
    });

    return Array.from(map.values())
      .map(row => {
        const profitScore = Math.max(Math.floor(row.grossProfit / 1000), 0);

        const score =
          row.wonLeads * 15 +
          row.quoteSentLeads * 5 +
          row.completedEngagements * 3 +
          row.calls * 2 +
          row.whatsapp * 2 +
          row.emails * 2 +
          row.meetings * 3 +
          row.activeLeads +
          row.attendanceDays +
          profitScore -
          row.lostLeads * 5;

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

        if (activeTab === "finance") {
          return b.grossProfit - a.grossProfit || b.quotationValue - a.quotationValue;
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

  /* =========================
     RENDER GUARDS
  ========================== */

  if (loading || user === undefined) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <p className="p-6 text-red-600">Access denied</p>;
  }

  return (
    <main className="p-4 md:p-6 space-y-6 w-full">
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Management Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Executive overview of active leads, finance, vendor operations, team workload and attendance.
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardKpiCard label="Active Leads" value={leadTotals.activeLeads} color="blue" />
          <DashboardKpiCard label="Converted Leads" value={leadTotals.wonLeads} color="green" />
          <DashboardKpiCard label="Quotation Value" value={formatCurrency(financeTotals.quotationValue)} color="purple" />
          <DashboardKpiCard label="Gross Profit" value={formatCurrency(financeTotals.grossProfit)} color="green" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardKpiCard label="Customer Received" value={formatCurrency(financeTotals.receivedAmount)} color="green" />
          <DashboardKpiCard label="Pending Receivable" value={formatCurrency(financeTotals.pendingReceivable)} color={financeTotals.pendingReceivable ? "amber" : "gray"} />
          <DashboardKpiCard label="Vendor Paid" value={formatCurrency(financeTotals.vendorPaid)} color="blue" />
          <DashboardKpiCard label="Cash Position" value={formatCurrency(financeTotals.cashInHand)} color={financeTotals.cashInHand >= 0 ? "green" : "red"} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardKpiCard label="Unassigned Leads" value={leadTotals.unassignedLeads} color={leadTotals.unassignedLeads ? "red" : "gray"} />
          <DashboardKpiCard label="Pending Vendor Quotes" value={vendorTotals.pendingQuoteLeads} color={vendorTotals.pendingQuoteLeads ? "amber" : "gray"} />
          <DashboardKpiCard label="Attention Items" value={attentionSummary.total} color={attentionSummary.total ? "red" : "gray"} />
          <DashboardKpiCard label="Present Today" value={attendanceTotals.presentToday} color="green" />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm flex gap-1 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "finance", label: "Finance" },
            { key: "leads", label: "Pipeline" },
            { key: "vendor", label: "Vendor Ops" },
            { key: "attention", label: "Attention Required" },
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

      {activeTab === "overview" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Total Leads" value={leadTotals.total} />
            <DashboardKpiCard label="Quote Sent" value={leadTotals.quoteSentLeads} color="blue" />
            <DashboardKpiCard label="Margin" value={`${financeTotals.marginPercent}%`} color="purple" />
            <DashboardKpiCard label="Vendor Balance" value={formatCurrency(financeTotals.vendorBalance)} color={financeTotals.vendorBalance ? "amber" : "gray"} />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeadsTrendChart leads={periodLeads} />
            <LeadsByStageChart leads={periodLeads} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList title="Revenue by Destination" rows={financeTotals.byDestinationRevenue} />
            <MiniBarList title="Gross Profit by Destination" rows={financeTotals.byDestinationProfit} />
            <MiniBarList title="Top Travel Agents" rows={leadTotals.byAgent} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList title="Vendor Requests by Status" rows={vendorTotals.byVendorStatus} />
            <MiniBarList title="Vendor Quotes by Status" rows={vendorTotals.byVendorQuoteStatus} />
            <MiniBarList title="Attention by Type" rows={attentionSummary.byType} />
          </section>

          <AttentionRequiredPanel rows={attentionSummary.rows.slice(0, 8)} compact />
          <ManagementOverviewTable rows={teamRows} />
        </section>
      )}

      {activeTab === "finance" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Quotation Value" value={formatCurrency(financeTotals.quotationValue)} color="purple" />
            <DashboardKpiCard label="Total Receivable" value={formatCurrency(financeTotals.receivableAmount)} color="blue" />
            <DashboardKpiCard label="Customer Received" value={formatCurrency(financeTotals.receivedAmount)} color="green" />
            <DashboardKpiCard label="Pending Receivable" value={formatCurrency(financeTotals.pendingReceivable)} color={financeTotals.pendingReceivable ? "amber" : "gray"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Vendor Payable" value={formatCurrency(financeTotals.vendorPayable)} color="blue" />
            <DashboardKpiCard label="Vendor Paid" value={formatCurrency(financeTotals.vendorPaid)} color="green" />
            <DashboardKpiCard label="Vendor Balance" value={formatCurrency(financeTotals.vendorBalance)} color={financeTotals.vendorBalance ? "amber" : "gray"} />
            <DashboardKpiCard label="Margin" value={`${financeTotals.marginPercent}%`} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList title="Revenue by Destination" rows={financeTotals.byDestinationRevenue} />
            <MiniBarList title="Gross Profit by Destination" rows={financeTotals.byDestinationProfit} />
            <MiniBarList title="Revenue by Travel Agent" rows={financeTotals.byAgentRevenue} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList title="Revenue by Team Member" rows={financeTotals.byAssigneeRevenue} />
            <MiniBarList title="Customer Payment Status" rows={financeTotals.byPaymentStatus} />
            <MiniBarList title="Vendor Payment Status" rows={financeTotals.byVendorPaymentStatus} />
          </section>

          <ManagementFinanceTable rows={teamRows} />
        </section>
      )}

      {activeTab === "leads" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="New Leads" value={leadTotals.total} />
            <DashboardKpiCard label="Active Leads" value={leadTotals.activeLeads} color="blue" />
            <DashboardKpiCard label="Quote Sent" value={leadTotals.quoteSentLeads} color="purple" />
            <DashboardKpiCard label="Converted" value={leadTotals.wonLeads} color="green" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Assigned" value={leadTotals.assignedLeads} color="blue" />
            <DashboardKpiCard label="Unassigned" value={leadTotals.unassignedLeads} color={leadTotals.unassignedLeads ? "red" : "gray"} />
            <DashboardKpiCard label="Lost" value={leadTotals.lostLeads} color={leadTotals.lostLeads ? "red" : "gray"} />
            <DashboardKpiCard label="Destinations" value={leadTotals.uniqueDestinations} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeadsByStageChart leads={periodLeads} />
            <LeadsByDestinationChart leads={periodLeads} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList title="Leads by Stage" rows={leadTotals.byStage} />
            <MiniBarList title="Leads by Status" rows={leadTotals.byStatus} />
            <MiniBarList title="Leads by Source" rows={leadTotals.bySource} />
          </section>

          <ManagementLeadsTable rows={teamRows} />
        </section>
      )}

      {activeTab === "vendor" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Vendor Requests" value={vendorTotals.totalVendorRequests} color="blue" />
            <DashboardKpiCard label="Vendor Quotes" value={vendorTotals.totalVendorQuotes} color="green" />
            <DashboardKpiCard label="Pending Quotes" value={vendorTotals.pendingQuoteLeads} color={vendorTotals.pendingQuoteLeads ? "amber" : "gray"} />
            <DashboardKpiCard label="Vendors Selected" value={vendorTotals.selectedVendorLeads} color="purple" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Vendor Cost" value={formatCurrency(financeTotals.vendorCost)} color="blue" />
            <DashboardKpiCard label="Vendor Paid" value={formatCurrency(financeTotals.vendorPaid)} color="green" />
            <DashboardKpiCard label="Vendor Balance" value={formatCurrency(financeTotals.vendorBalance)} color={financeTotals.vendorBalance ? "amber" : "gray"} />
            <DashboardKpiCard label="Last Vendor Activity" value={formatDateTime(vendorTotals.lastVendorActivity)} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList title="Vendor Requests by Status" rows={vendorTotals.byVendorStatus} />
            <MiniBarList title="Vendor Quotes by Status" rows={vendorTotals.byVendorQuoteStatus} />
            <MiniBarList title="Top Vendors by Count" rows={vendorTotals.byVendor} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList title="Top Vendors by Cost" rows={vendorTotals.byVendorCost} />
            <MiniBarList title="Vendor Payment Status" rows={financeTotals.byVendorPaymentStatus} />
          </section>

          <ManagementVendorTable rows={periodLeads} />
        </section>
      )}

      {activeTab === "attention" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Total Attention Items" value={attentionSummary.total} color={attentionSummary.total ? "red" : "gray"} />
            <DashboardKpiCard label="Critical" value={attentionSummary.critical} color={attentionSummary.critical ? "red" : "gray"} />
            <DashboardKpiCard label="High Priority" value={attentionSummary.high} color={attentionSummary.high ? "amber" : "gray"} />
            <DashboardKpiCard label="Medium Priority" value={attentionSummary.medium} color={attentionSummary.medium ? "blue" : "gray"} />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList title="Attention by Type" rows={attentionSummary.byType} />
            <MiniBarList
              title="High Value Attention Leads"
              rows={attentionSummary.rows
                .filter(item => item.amount > 0)
                .slice(0, 8)
                .map(item => ({
                  name: item.leadCode,
                  count: item.amount,
                  displayCount: formatCurrency(item.amount)
                }))}
            />
          </section>

          <AttentionRequiredPanel rows={attentionSummary.rows} />
        </section>
      )}

      {activeTab === "engagement" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <EngagementKpiCard label="Calls" value={engagementTotals.calls} />
            <EngagementKpiCard label="WhatsApp" value={engagementTotals.whatsapp} />
            <EngagementKpiCard label="Emails" value={engagementTotals.emails} />
            <EngagementKpiCard label="Meetings" value={engagementTotals.meetings} />
            <EngagementKpiCard label="Last Activity" value={formatDateTime(engagementTotals.lastActivity)} />
          </div>

          <EngagementByChannelChart engagements={periodEngagements} />

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList title="Engagement by Employee" rows={engagementTotals.byCreator} />
            <MiniBarList title="Engagement by Destination" rows={engagementTotals.byDestination} />
          </section>

          <ManagementEngagementTable rows={teamRows} />
        </section>
      )}

      {activeTab === "attendance" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Present Today" value={attendanceTotals.presentToday} color="green" />
            <DashboardKpiCard label="Active Now" value={attendanceTotals.activeNow} color="green" />
            <DashboardKpiCard label="Late" value={attendanceTotals.late} color={attendanceTotals.late ? "amber" : "gray"} />
            <DashboardKpiCard label="Total Hours" value={formatDuration(attendanceTotals.totalMinutes)} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList title="Attendance by Status" rows={attendanceTotals.byStatus} />

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

      {activeTab === "team" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Active Users" value={userTotals.activeUsers} color="blue" />
            <DashboardKpiCard label="Employee Users" value={userTotals.employeeUsers} color="green" />
            <DashboardKpiCard label="Admin Users" value={userTotals.adminUsers} color="purple" />
            <DashboardKpiCard label="Departments" value={userTotals.departments} color="blue" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList title="Users by Department" rows={userTotals.byDepartment} />
            <MiniBarList title="Users by Role" rows={userTotals.byRole} />
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
   ATTENTION PANEL
========================== */

function getSeverityClass(severity) {
  if (severity === "critical") {
    return "bg-red-50 text-red-700 border-red-100";
  }

  if (severity === "high") {
    return "bg-orange-50 text-orange-700 border-orange-100";
  }

  if (severity === "medium") {
    return "bg-yellow-50 text-yellow-700 border-yellow-100";
  }

  return "bg-gray-50 text-gray-700 border-gray-100";
}

function AttentionRequiredPanel({ rows, compact = false }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          Attention Required
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Leads that need management or operations action.
        </p>
      </div>

      {!rows.length ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No attention items found.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.slice(0, compact ? 8 : 50).map(item => (
            <div
              key={item.id}
              className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm text-gray-900">
                    {item.leadCode}
                  </p>
                  <span
                    className={`
                      inline-flex items-center px-2 py-0.5 rounded-full text-xs border
                      ${getSeverityClass(item.severity)}
                    `}
                  >
                    {readableLabel(item.severity)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {readableLabel(item.type)}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mt-1">
                  {item.reason}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {item.customerName} • {item.destinationName} • Assigned: {item.assignedToName}
                </p>
              </div>

              <div className="text-left md:text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(item.amount)}
                </p>
                <p className="text-xs text-gray-500">
                  Last: {formatDateTime(item.lastActivityAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   TABLES
========================== */

function ManagementOverviewTable({ rows }) {
  return (
    <DashboardTable
      title="Team Member Management Overview"
      description="Combined lead, revenue, engagement and attendance performance."
      headers={[
        "Team Member",
        "Leads",
        "Won",
        "Quotation",
        "GP",
        "Engagements",
        "Hours",
        "Last Activity",
        "Status"
      ]}
      emptyText="No management data found."
      colSpan={9}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name}>
          <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">
              {row.department || row.email || "—"}
            </div>
          </td>
          <td className="px-4 py-3 text-right">{row.newLeads}</td>
          <td className="px-4 py-3 text-right text-green-700 font-medium">{row.wonLeads}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.quotationValue)}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.grossProfit)}</td>
          <td className="px-4 py-3 text-right">{row.engagements}</td>
          <td className="px-4 py-3 text-right font-medium">{formatDuration(row.totalMinutes)}</td>
          <td className="px-4 py-3 text-gray-600">{formatDateTime(row.lastActivityAt)}</td>
          <td className="px-4 py-3">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getScoreClass(row.score)}`}>
              {getScoreLabel(row.score)}
            </span>
          </td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementFinanceTable({ rows }) {
  return (
    <DashboardTable
      title="Team Finance Overview"
      description="Revenue, collection, vendor payout and gross profit by team member."
      headers={[
        "Team Member",
        "Quotation Value",
        "Customer Received",
        "Vendor Paid",
        "Gross Profit",
        "Won Leads",
        "Score"
      ]}
      emptyText="No finance data found."
      colSpan={7}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name}>
          <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.quotationValue)}</td>
          <td className="px-4 py-3 text-right text-green-700 font-medium">{formatCurrency(row.receivedAmount)}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(row.vendorPaid)}</td>
          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(row.grossProfit)}</td>
          <td className="px-4 py-3 text-right">{row.wonLeads}</td>
          <td className="px-4 py-3 text-right font-semibold">{row.score}</td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementVendorTable({ rows }) {
  const activeRows = getActiveLeads(rows);

  return (
    <DashboardTable
      title="Vendor Operations Overview"
      description="Vendor request, quote and payment status by active lead."
      headers={[
        "Lead",
        "Destination",
        "Vendor",
        "Requests",
        "Quotes",
        "Vendor Cost",
        "Vendor Paid",
        "Balance",
        "Status"
      ]}
      emptyText="No vendor data found."
      colSpan={9}
    >
      {activeRows.map(row => (
        <tr key={row.id}>
          <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{row.leadCode || row.id}</div>
            <div className="text-xs text-gray-500">{row.agentName || row.agencyName || "—"}</div>
          </td>
          <td className="px-4 py-3 text-gray-600">{row.destinationName || "—"}</td>
          <td className="px-4 py-3 text-gray-600">{row.latestVendorName || row.latestSelectedVendorName || "—"}</td>
          <td className="px-4 py-3 text-right">{Number(row.vendorRequestCount || 0)}</td>
          <td className="px-4 py-3 text-right">{Number(row.vendorQuoteCount || 0)}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(getLeadVendorCost(row))}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(getLeadVendorPaidAmount(row))}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.vendorPaymentBalance)}</td>
          <td className="px-4 py-3 text-gray-600">
            {readableLabel(row.latestVendorQuoteStatus || row.latestVendorRequestStatus || "Pending")}
          </td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementLeadsTable({ rows }) {
  return (
    <DashboardTable
      title="Team Member Lead Overview"
      description="Lead assignment, quotation and pipeline movement for the selected period."
      headers={[
        "Team Member",
        "New",
        "Assigned",
        "Active",
        "Quote Sent",
        "Won",
        "Lost"
      ]}
      emptyText="No lead data found."
      colSpan={7}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name}>
          <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right">{row.newLeads}</td>
          <td className="px-4 py-3 text-right">{row.assignedLeads}</td>
          <td className="px-4 py-3 text-right">{row.activeLeads}</td>
          <td className="px-4 py-3 text-right">{row.quoteSentLeads}</td>
          <td className="px-4 py-3 text-right text-green-700 font-medium">{row.wonLeads}</td>
          <td className="px-4 py-3 text-right">{row.lostLeads}</td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementEngagementTable({ rows }) {
  return (
    <DashboardTable
      title="Team Member Engagement Overview"
      description="WhatsApp, call, email and meeting activity for the selected period."
      headers={[
        "Team Member",
        "Total",
        "Calls",
        "WhatsApp",
        "Emails",
        "Meetings",
        "Completed",
        "Last Activity"
      ]}
      emptyText="No engagement data found."
      colSpan={8}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name}>
          <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right">{row.engagements}</td>
          <td className="px-4 py-3 text-right">{row.calls}</td>
          <td className="px-4 py-3 text-right">{row.whatsapp}</td>
          <td className="px-4 py-3 text-right">{row.emails}</td>
          <td className="px-4 py-3 text-right">{row.meetings}</td>
          <td className="px-4 py-3 text-right text-green-700 font-medium">{row.completedEngagements}</td>
          <td className="px-4 py-3 text-gray-600">{formatDateTime(row.lastActivityAt)}</td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementAttendanceTable({ rows }) {
  return (
    <DashboardTable
      title="Team Member Attendance Overview"
      description="Attendance days, active sessions, late marks and working hours."
      headers={[
        "Team Member",
        "Days",
        "Check-ins",
        "Active",
        "Late",
        "Leave",
        "First Check-in",
        "Last Check-out",
        "Hours"
      ]}
      emptyText="No attendance data found."
      colSpan={9}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name}>
          <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.department || row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right">{row.attendanceDays}</td>
          <td className="px-4 py-3 text-right">{row.checkIns}</td>
          <td className={`px-4 py-3 text-right font-medium ${row.activeSessions ? "text-green-700" : "text-gray-700"}`}>
            {row.activeSessions}
          </td>
          <td className={`px-4 py-3 text-right font-medium ${row.late ? "text-amber-600" : "text-gray-700"}`}>
            {row.late}
          </td>
          <td className="px-4 py-3 text-right">{row.leave}</td>
          <td className="px-4 py-3 text-gray-600">{formatDateTime(row.firstCheckIn)}</td>
          <td className="px-4 py-3 text-gray-600">{formatDateTime(row.lastCheckOut)}</td>
          <td className="px-4 py-3 text-right font-medium">{formatDuration(row.totalMinutes)}</td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementTeamTable({ rows }) {
  return (
    <DashboardTable
      title="Team Workload Overview"
      description="Combined score based on leads, conversion, quotations, gross profit, engagements and attendance."
      headers={[
        "Team Member",
        "Department",
        "Role",
        "Leads",
        "Won",
        "GP",
        "Engagements",
        "Hours",
        "Score",
        "Rating"
      ]}
      emptyText="No team data found."
      colSpan={10}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name}>
          <td className="px-4 py-3">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-gray-600">{row.department || "—"}</td>
          <td className="px-4 py-3 text-gray-600">{readableLabel(row.role)}</td>
          <td className="px-4 py-3 text-right">{row.newLeads}</td>
          <td className="px-4 py-3 text-right text-green-700 font-medium">{row.wonLeads}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.grossProfit)}</td>
          <td className="px-4 py-3 text-right">{row.engagements}</td>
          <td className="px-4 py-3 text-right font-medium">{formatDuration(row.totalMinutes)}</td>
          <td className="px-4 py-3 text-right font-semibold">{row.score}</td>
          <td className="px-4 py-3">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getScoreClass(row.score)}`}>
              {getScoreLabel(row.score)}
            </span>
          </td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function DashboardTable({
  title,
  description,
  headers,
  children,
  emptyText,
  colSpan
}) {
  const hasRows = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">
          {title}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {description}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={header}
                  className={`
                    px-4 py-3 font-medium
                    ${index === 0 ? "text-left" : "text-right"}
                  `}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {hasRows ? (
              children
            ) : (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}