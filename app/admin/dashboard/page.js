"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Eye,
  Handshake,
  IndianRupee,
  Layers3,
  LayoutDashboard,
  LineChart,
  PieChart,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X
} from "lucide-react";

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


function getGroupedAttentionRows(rows = []) {
  const map = new Map();

  rows.forEach(item => {
    const key = item.leadId || item.leadCode;
    if (!key) return;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        leadId: item.leadId,
        leadCode: item.leadCode,
        customerName: item.customerName,
        agentName: item.agentName,
        destinationName: item.destinationName,
        assignedToName: item.assignedToName,
        amount: Number(item.amount || 0),
        lastActivityAt: item.lastActivityAt,
        highestSeverity: item.severity || "medium",
        issues: [
          {
            type: item.type,
            severity: item.severity,
            reason: item.reason
          }
        ]
      });

      return;
    }

    existing.amount = Math.max(existing.amount, Number(item.amount || 0));

    if (
      getSeverityRank(item.severity) >
      getSeverityRank(existing.highestSeverity)
    ) {
      existing.highestSeverity = item.severity;
    }

    const itemDate = toDate(item.lastActivityAt);
    const existingDate = toDate(existing.lastActivityAt);

    if (itemDate && (!existingDate || itemDate > existingDate)) {
      existing.lastActivityAt = item.lastActivityAt;
    }

    existing.issues.push({
      type: item.type,
      severity: item.severity,
      reason: item.reason
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const severityDiff =
      getSeverityRank(b.highestSeverity) -
      getSeverityRank(a.highestSeverity);

    if (severityDiff !== 0) return severityDiff;

    return Number(b.amount || 0) - Number(a.amount || 0);
  });
}



function getSeverityRank(severity) {
  const ranks = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return ranks[severity] || 0;
}

function getUniqueHighValueAttentionRows(rows = []) {
  const map = new Map();

  rows.forEach(item => {
    const leadKey = item.leadId || item.leadCode;
    const amount = Number(item.amount || 0);

    if (!leadKey || amount <= 0) return;

    const existing = map.get(leadKey);

    if (!existing) {
      map.set(leadKey, {
        key: String(leadKey),
        name: item.leadCode || leadKey,
        count: amount,
        displayCount: formatCurrency(amount),
        issueCount: 1,
        severity: item.severity || "medium",
        subLabel: `${readableLabel(item.type)} • ${readableLabel(item.severity)}`
      });

      return;
    }

    existing.count = Math.max(existing.count, amount);
    existing.displayCount = formatCurrency(existing.count);
    existing.issueCount += 1;

    if (getSeverityRank(item.severity) > getSeverityRank(existing.severity)) {
      existing.severity = item.severity;
    }

    existing.subLabel = `${existing.issueCount} attention items • Highest ${readableLabel(existing.severity)}`;
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

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

function getRangeLabel(range) {
  return {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time"
  }[range] || "Selected Period";
}

/* =========================
   GLOBAL LEAD VISIBILITY
   Deleted leads are excluded everywhere
========================== */

function isDeletedLead(lead) {
  return (
    lead?.isDeleted === true ||
    lead?.deleted === true ||
    String(lead?.isDeleted).trim().toLowerCase() === "true" ||
    String(lead?.deleted).trim().toLowerCase() === "true" ||
    Boolean(lead?.deletedAt)
  );
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

function getLeadWonDate(lead) {
  if (!isWonLead(lead)) return null;

  const stageHistoryWonDate = Array.isArray(lead?.stageHistory)
    ? lead.stageHistory
      .filter(item => {
        const stage = normalize(
          item?.toStage ||
          item?.stage ||
          item?.stageLabel ||
          item?.toStageLabel
        );

        return (
          stage === "closed_won" ||
          stage === "won" ||
          stage === "converted" ||
          stage === "business_generated"
        );
      })
      .map(item => toDate(item?.changedAt))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0]
    : null;

  return (
    toDate(lead?.closedWonAt) ||
    toDate(lead?.closedAt) ||
    toDate(lead?.dealWonAt) ||
    toDate(lead?.businessGeneratedAt) ||
    toDate(lead?.convertedAt) ||
    toDate(lead?.bookingConfirmedAt) ||
    toDate(lead?.stageUpdatedAt) ||
    stageHistoryWonDate ||
    toDate(lead?.statusUpdatedAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.lastActivityAt) ||
    toDate(lead?.createdAt)
  );
}

function getLeadLostDate(lead) {
  if (!isLostLead(lead)) return null;

  return (
    toDate(lead?.closedLostAt) ||
    toDate(lead?.dealLostAt) ||
    toDate(lead?.cancelledAt) ||
    toDate(lead?.rejectedAt) ||
    toDate(lead?.stageUpdatedAt) ||
    toDate(lead?.statusUpdatedAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.lastActivityAt) ||
    toDate(lead?.createdAt)
  );
}

function getQuotationDate(lead) {
  return (
    toDate(lead?.finalQuotationAt) ||
    toDate(lead?.latestQuotationSentAt) ||
    toDate(lead?.quotationSentAt) ||
    toDate(lead?.lastQuotationSentAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.createdAt)
  );
}

function getPaymentDate(lead) {
  return (
    toDate(lead?.latestCustomerPaymentAt) ||
    toDate(lead?.lastPaymentReceivedAt) ||
    toDate(lead?.paymentReceivedAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.createdAt)
  );
}

function isInSelectedRangeByDate(dateValue, rangeWindow) {
  if (!rangeWindow?.start) return true;

  const date = toDate(dateValue);
  if (!date) return false;

  return date >= rangeWindow.start && date <= rangeWindow.end;
}

function getLeadDisplayName(lead) {
  return (
    lead?.leadCode ||
    lead?.customerName ||
    lead?.agentName ||
    lead?.agencyName ||
    lead?.travelAgentName ||
    lead?.id ||
    "Lead"
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
      lead?.finalQuotationAmount,
      lead?.latestQuotationAmount,
      lead?.latestCustomerQuoteAmount,
      lead?.totalReceivableAmount,
      lead?.customerQuoteAmount,
      lead?.quotationAmount,
      lead?.packageAmount
    ) || 0
  );
}

function getLeadVendorCost(lead) {
  return (
    pickAmount(
      lead?.finalVendorCost,
      lead?.latestVendorCost,
      lead?.latestSelectedVendorCost,
      lead?.totalVendorPayableAmount,
      lead?.latestVendorQuoteCost,
      lead?.vendorCost
    ) || 0
  );
}

function getLeadGrossProfit(lead) {
  const storedProfit = pickAmount(
    lead?.finalGrossProfit,
    lead?.actualGrossProfit,
    lead?.latestGrossProfit,
    lead?.expectedGrossProfit,
    lead?.grossProfit
  );

  if (storedProfit !== null) return storedProfit;

  return getLeadQuotationAmount(lead) - getLeadVendorCost(lead);
}

function getPaymentBalance(lead) {
  const explicitBalance = pickAmount(
    lead?.paymentBalance,
    lead?.customerPaymentBalance,
    lead?.receivableBalance,
    lead?.pendingReceivable
  );

  if (explicitBalance !== null) return explicitBalance;

  const receivable = toAmount(lead?.totalReceivableAmount) || getLeadQuotationAmount(lead);
  const received = getLeadReceivedAmount(lead);

  return Math.max(receivable - received, 0);
}

function getVendorPaymentBalance(lead) {
  const explicitBalance = pickAmount(
    lead?.vendorPaymentBalance,
    lead?.vendorBalance,
    lead?.pendingVendorPayable
  );

  if (explicitBalance !== null) return explicitBalance;

  const vendorPayable = toAmount(lead?.totalVendorPayableAmount) || getLeadVendorCost(lead);
  const vendorPaid = getLeadVendorPaidAmount(lead);

  return Math.max(vendorPayable - vendorPaid, 0);
}

function isCustomerPaymentRealized(lead) {
  const status = normalize(lead?.customerPaymentStatus);

  return (
    status === "fully_paid" ||
    status === "paid" ||
    status === "received" ||
    getPaymentBalance(lead) <= 0
  );
}

function isVendorPaymentSettled(lead) {
  const status = normalize(lead?.vendorPaymentStatus);

  return (
    status === "fully_paid" ||
    status === "paid" ||
    status === "settled" ||
    getVendorPaymentBalance(lead) <= 0
  );
}

function isGrossProfitRealized(lead) {
  return (
    isWonLead(lead) &&
    getLeadGrossProfit(lead) > 0 &&
    isCustomerPaymentRealized(lead) &&
    isVendorPaymentSettled(lead)
  );
}

function getLeadActualRealizedGrossProfit(lead) {
  if (!isGrossProfitRealized(lead)) return 0;
  return getLeadGrossProfit(lead);
}

function getLeadUnrealizedGrossProfit(lead) {
  const grossProfit = getLeadGrossProfit(lead);
  const realizedProfit = getLeadActualRealizedGrossProfit(lead);

  return Math.max(grossProfit - realizedProfit, 0);
}

function getLeadReceivedAmount(lead) {
  return (
    pickAmount(
      lead?.totalPaymentReceived,
      lead?.travelAgentReceivedAmount,
      lead?.customerReceivedAmount,
      lead?.actualReceivedAmount,
      lead?.receivedAmount,
      lead?.amountReceived,
      lead?.paymentReceivedAmount,
      lead?.latestCustomerPaymentAmount,
      lead?.latestTravelAgentPaymentAmount
    ) || 0
  );
}

function getLeadReceivableAmount(lead) {
  return (
    pickAmount(
      lead?.totalReceivableAmount,
      lead?.finalQuotationAmount,
      lead?.latestQuotationAmount,
      lead?.latestCustomerQuoteAmount,
      lead?.customerQuoteAmount
    ) || 0
  );
}

function getLeadPaymentBalance(lead) {
  const explicitBalance = pickAmount(
    lead?.paymentBalance,
    lead?.customerPaymentBalance,
    lead?.receivableBalance,
    lead?.pendingReceivable
  );

  if (explicitBalance !== null && explicitBalance > 0) {
    return explicitBalance;
  }

  const receivable = getLeadReceivableAmount(lead);
  const received = getLeadReceivedAmount(lead);

  return Math.max(receivable - received, 0);
}

function getLeadVendorPayableAmount(lead) {
  return (
    pickAmount(
      lead?.totalVendorPayableAmount,
      lead?.finalVendorCost,
      lead?.latestVendorCost,
      lead?.latestSelectedVendorCost,
      lead?.latestVendorQuoteCost
    ) || 0
  );
}

function getLeadVendorPaymentBalance(lead) {
  const explicitBalance = pickAmount(
    lead?.vendorPaymentBalance,
    lead?.vendorBalance,
    lead?.pendingVendorPayable
  );

  if (explicitBalance !== null && explicitBalance > 0) {
    return explicitBalance;
  }

  const payable = getLeadVendorPayableAmount(lead);
  const paid = getLeadVendorPaidAmount(lead);

  return Math.max(payable - paid, 0);
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
  const status = normalize(lead?.latestQuotationStatus);

  return (
    status === "sent" ||
    status === "final" ||
    status === "finalized" ||
    status === "approved" ||
    status === "converted" ||
    status === "closed won" ||
    Boolean(lead?.finalQuotationId) ||
    Boolean(lead?.finalQuotationAt) ||
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


function getLeadCreator(lead, userMap) {
  const uid =
    lead?.createdByUid ||
    lead?.createdByUserId ||
    lead?.creatorUid ||
    "";

  const userData = uid ? userMap.get(uid) : null;

  const email =
    lead?.createdByEmail ||
    lead?.createdBy ||
    lead?.creatorEmail ||
    userData?.email ||
    "";

  const name =
    lead?.createdByName ||
    lead?.creatorName ||
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
  const [selectedInsight, setSelectedInsight] = useState(null);

  const openInsight = key => {
    setSelectedInsight(key);
  };

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

  const convertedPeriodLeads = useMemo(() => {
    return getActiveLeads(activeDashboardLeads).filter(lead => {
      return isWonLead(lead) && isInSelectedRangeByDate(getLeadWonDate(lead), rangeWindow);
    });
  }, [activeDashboardLeads, rangeWindow]);

  const lostPeriodLeads = useMemo(() => {
    return getActiveLeads(activeDashboardLeads).filter(lead => {
      return isLostLead(lead) && isInSelectedRangeByDate(getLeadLostDate(lead), rangeWindow);
    });
  }, [activeDashboardLeads, rangeWindow]);

  const quotationPeriodLeads = useMemo(() => {
    return getActiveLeads(activeDashboardLeads).filter(lead => {
      return hasQuotationSent(lead) && isInSelectedRangeByDate(getQuotationDate(lead), rangeWindow);
    });
  }, [activeDashboardLeads, rangeWindow]);

  const paymentReceivedPeriodLeads = useMemo(() => {
    return getActiveLeads(activeDashboardLeads).filter(lead => {
      return getLeadReceivedAmount(lead) > 0 && isInSelectedRangeByDate(getPaymentDate(lead), rangeWindow);
    });
  }, [activeDashboardLeads, rangeWindow]);

  /* =========================
     LEAD TOTALS
  ========================== */

  const leadTotals = useMemo(() => {
    const leadRows = getActiveLeads(periodLeads);

    const assignedLeads = leadRows.filter(hasLeadAssignee).length;
    const activeLeads = leadRows.filter(isActiveLead).length;

    const wonLeads = convertedPeriodLeads.length;
    const lostLeads = lostPeriodLeads.length;
    const quoteSentLeads = quotationPeriodLeads.length;

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
  }, [
    periodLeads,
    userMap,
    convertedPeriodLeads,
    lostPeriodLeads,
    quotationPeriodLeads
  ]);

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

    const realizedGrossProfit = financeLeads.reduce((sum, lead) => {
      return sum + getLeadActualRealizedGrossProfit(lead);
    }, 0);

    const unrealizedGrossProfit = financeLeads.reduce((sum, lead) => {
      return sum + getLeadUnrealizedGrossProfit(lead);
    }, 0);

    const realizedGrossProfitLeads = financeLeads.filter(lead => {
      return getLeadActualRealizedGrossProfit(lead) > 0;
    }).length;

    const unrealizedGrossProfitLeads = financeLeads.filter(lead => {
      return getLeadUnrealizedGrossProfit(lead) > 0;
    }).length;

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

    const lockedGrossProfit = convertedPeriodLeads.reduce((sum, lead) => {
      return sum + getLeadGrossProfit(lead);
    }, 0);

    const lockedQuotationValue = convertedPeriodLeads.reduce((sum, lead) => {
      return sum + getLeadQuotationAmount(lead);
    }, 0);

    const lockedVendorCost = convertedPeriodLeads.reduce((sum, lead) => {
      return sum + getLeadVendorCost(lead);
    }, 0);

    const lockedGrossProfitLeads = convertedPeriodLeads.length;



    const pipelineGrossProfit = financeLeads
      .filter(lead => isActiveLead(lead))
      .reduce((sum, lead) => {
        return sum + getLeadGrossProfit(lead);
      }, 0);

    return {
      quotationValue,
      vendorCost,
      grossProfit,
      realizedGrossProfit,
      unrealizedGrossProfit,
      realizedGrossProfitLeads,
      unrealizedGrossProfitLeads,
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
      lockedGrossProfit,
      lockedQuotationValue,
      lockedVendorCost,
      lockedGrossProfitLeads,
      pipelineGrossProfit,
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
  }, [periodLeads, userMap, convertedPeriodLeads]);

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
      const creator = getLeadCreator(lead, userMap);
      const creatorRow = ensureMember(creator);

      creatorRow.newLeads += 1;

      updateLastActivity(
        creatorRow,
        lead.createdAt || lead.updatedAt || lead.assignedAt || lead.lastActivityAt
      );

      const owner = getLeadOwner(lead, userMap);
      const row = ensureMember(owner);

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

  const insightPanels = useMemo(() => {
    const activeLeadRows = periodLeads.filter(isActiveLead);

    const quotationRows = quotationPeriodLeads.filter(
      lead => getLeadQuotationAmount(lead) > 0
    );

    const grossProfitRows = convertedPeriodLeads.filter(
      lead => getLeadGrossProfit(lead) !== 0
    );

    const pendingReceivableRows = periodLeads.filter(
      lead => toAmount(lead?.paymentBalance) > 0
    );

    const vendorBalanceRows = periodLeads.filter(
      lead => toAmount(lead?.vendorPaymentBalance) > 0
    );

    return {
      activeLeads: {
        title: "Active Leads",
        description: `${getRangeLabel(range)} active pipeline leads.`,
        rows: activeLeadRows,
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount
      },

      convertedLeads: {
        title: "Converted Leads",
        description: "Leads converted during the selected period.",
        rows: convertedPeriodLeads,
        type: "lead",
        amountLabel: "Gross Profit",
        amountGetter: getLeadGrossProfit,
        dateGetter: getLeadWonDate
      },

      quotationValue: {
        title: "Quotation Value",
        description: "Quotation-sent leads during the selected period.",
        rows: quotationRows,
        type: "lead",
        amountLabel: "Quotation",
        amountGetter: getLeadQuotationAmount,
        dateGetter: getQuotationDate
      },

      vendorPaid: {
        title: "Vendor Paid",
        description: "Vendor payment already paid for selected leads.",
        rows: periodLeads.filter(lead => getLeadVendorPaidAmount(lead) > 0),
        type: "lead",
        amountLabel: "Vendor Paid",
        amountGetter: getLeadVendorPaidAmount
      },

      cashPosition: {
        title: "Net Cash Position",
        description: "Travel agent received amount minus vendor paid amount.",
        rows: periodLeads.filter(lead => {
          return getLeadReceivedAmount(lead) > 0 || getLeadVendorPaidAmount(lead) > 0;
        }),
        type: "lead",
        amountLabel: "Net Cash",
        amountGetter: lead => getLeadReceivedAmount(lead) - getLeadVendorPaidAmount(lead)
      },

      grossProfit: {
        title: "Gross Profit",
        description: "Total gross profit from selected leads.",
        rows: periodLeads.filter(lead => getLeadGrossProfit(lead) !== 0),
        type: "lead",
        amountLabel: "Gross Profit",
        amountGetter: getLeadGrossProfit,
        dateGetter: getLeadDate,
        showGrossProfitBreakdown: true,
        summaryCards: [
          {
            label: "Total Gross Profit",
            value: formatCurrency(financeTotals.grossProfit),
            tone: "emerald"
          },
          {
            label: "Actual Realized",
            value: formatCurrency(financeTotals.realizedGrossProfit),
            tone: "green"
          },
          {
            label: "Not Realized",
            value: formatCurrency(financeTotals.unrealizedGrossProfit),
            tone: "amber"
          }
        ]
      },

      lockedGrossProfit: {
        title: "Locked Gross Profit",
        description: "Gross profit locked after leads are marked as Deal Won / Converted / Closed Won.",
        rows: convertedPeriodLeads,
        type: "lead",
        amountLabel: "Locked GP",
        amountGetter: getLeadGrossProfit,
        dateGetter: getLeadWonDate,
        summaryCards: [
          {
            label: "Locked GP",
            value: formatCurrency(financeTotals.lockedGrossProfit),
            tone: "green"
          },
          {
            label: "Locked Quotation",
            value: formatCurrency(financeTotals.lockedQuotationValue),
            tone: "emerald"
          },
          {
            label: "Locked Vendor Cost",
            value: formatCurrency(financeTotals.lockedVendorCost),
            tone: "amber"
          }
        ]
      },

      customerReceived: {
        title: "Customer Received",
        description: "Leads with customer payment received in selected period.",
        rows: paymentReceivedPeriodLeads,
        type: "lead",
        amountLabel: "Received",
        amountGetter: getLeadReceivedAmount,
        dateGetter: getPaymentDate
      },

      pendingReceivable: {
        title: "Pending Receivable",
        description: "Leads where customer payment balance is pending.",
        rows: pendingReceivableRows,
        type: "lead",
        amountLabel: "Pending",
        amountGetter: lead => toAmount(lead?.paymentBalance)
      },

      vendorBalance: {
        title: "Vendor Balance",
        description: "Leads where vendor payout balance is pending.",
        rows: vendorBalanceRows,
        type: "lead",
        amountLabel: "Vendor Balance",
        amountGetter: lead => toAmount(lead?.vendorPaymentBalance)
      },

      attentionItems: {
        title: "Attention Items",
        description: "Issues that need management or operations action.",
        rows: attentionSummary.rows,
        type: "attention"
      }
    };
  }, [
    periodLeads,
    quotationPeriodLeads,
    convertedPeriodLeads,
    paymentReceivedPeriodLeads,
    attentionSummary.rows,
    range
  ]);

  const selectedInsightPanel = selectedInsight
    ? insightPanels[selectedInsight]
    : null;

  /* =========================
     RENDER GUARDS
  ========================== */

  if (loading || user === undefined) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <p className="p-6 text-red-600">Access denied</p>;
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "finance", label: "Finance", icon: CircleDollarSign },
    { key: "leads", label: "Pipeline", icon: LineChart },
    { key: "vendor", label: "Vendors", icon: Handshake },
    { key: "attention", label: "Attention", icon: AlertTriangle },
    { key: "engagement", label: "Engagement", icon: Activity },
    { key: "attendance", label: "Attendance", icon: CalendarDays },
    { key: "team", label: "Team", icon: Users }
  ];

  function HighValueAttentionLeads({ rows = [] }) {
    const uniqueRows = getUniqueHighValueAttentionRows(rows).slice(0, 8);
    const max = uniqueRows.length
      ? Math.max(...uniqueRows.map(row => row.count))
      : 0;

    const theme = KPI_TONES.orange;

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2">
          <div className={`rounded-xl p-2 ${theme.icon}`}>
            <CircleDollarSign className="h-4 w-4" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              High Value Attention Leads
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Unique leads ranked by quotation value.
            </p>
          </div>
        </div>

        {!uniqueRows.length ? (
          <p className="text-sm text-gray-500 mt-4">
            No high value attention leads found.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {uniqueRows.map(row => {
              const width = max
                ? `${Math.max((row.count / max) * 100, 8)}%`
                : "0%";

              return (
                <div key={`high-value-attention-${row.key || row.name}`}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {row.name}
                      </p>

                      <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                        {row.subLabel}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      {row.displayCount}
                    </p>
                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${theme.icon}`}
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })}

            {getUniqueHighValueAttentionRows(rows).length > 8 && (
              <p className="text-xs text-gray-400">
                Showing top 8 of {getUniqueHighValueAttentionRows(rows).length}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="p-4 md:p-6 space-y-6 w-full">
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <BarChart3 className="h-3.5 w-3.5" />
              Management Command Center
            </div>

            <h1 className="mt-3 text-xl font-semibold text-gray-900">
              Management Dashboard
            </h1>

            <p className="text-sm text-gray-500">
              Executive overview of active leads, finance, vendor operations, team workload and attendance.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1  w-full md:w-auto">
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
                  ${range === item.key
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

        {dataLoading ? <DashboardSkeleton /> : null}

        <BusinessPulseCard
          range={range}
          financeTotals={financeTotals}
          leadTotals={leadTotals}
          vendorTotals={vendorTotals}
          attentionSummary={attentionSummary}
          onOpenDetail={openInsight}
        />

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <ExecutiveKpiCard
            title="Active Leads"
            value={leadTotals.activeLeads}
            helper={`${leadTotals.quoteSentLeads} quotations sent`}
            icon={LineChart}
            tone="blue"
            onClick={() => openInsight("activeLeads")}
          />

          <ExecutiveKpiCard
            title="Converted Leads"
            value={leadTotals.wonLeads}
            helper={`${leadTotals.lostLeads} lost leads`}
            icon={CheckCircle2}
            tone="green"
            onClick={() => openInsight("convertedLeads")}
          />

          <ExecutiveKpiCard
            title="Quotation Value"
            value={formatCurrency(financeTotals.quotationValue)}
            helper={`Margin ${financeTotals.marginPercent}%`}
            icon={IndianRupee}
            tone="purple"
            onClick={() => openInsight("quotationValue")}
          />

          <ExecutiveKpiCard
            title="Gross Profit"
            value={formatCurrency(financeTotals.grossProfit)}
            helper={`${formatCurrency(financeTotals.pipelineGrossProfit)} pipeline GP`}
            icon={TrendingUp}
            tone="emerald"
            onClick={() => openInsight("grossProfit")}
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <ExecutiveKpiCard
            title="Locked GP"
            value={formatCurrency(financeTotals.lockedGrossProfit)}
            helper={`${financeTotals.lockedGrossProfitLeads} converted leads • ${formatCurrency(financeTotals.lockedVendorCost)} vendor cost`}
            icon={CheckCircle2}
            tone="green"
            onClick={() => openInsight("lockedGrossProfit")}
          />

          <ExecutiveKpiCard
            title="Travel Agent Received"
            value={formatCurrency(financeTotals.receivedAmount)}
            helper={`${financeTotals.customerFullyPaid} fully paid leads`}
            icon={Wallet}
            tone="green"
            onClick={() => openInsight("customerReceived")}
          />

          <ExecutiveKpiCard
            title="Pending TA Collection"
            value={formatCurrency(financeTotals.pendingReceivable)}
            helper={financeTotals.pendingReceivable ? "Follow-up required" : "No collection pending"}
            icon={CreditCard}
            tone={financeTotals.pendingReceivable ? "amber" : "slate"}
            onClick={() => openInsight("pendingReceivable")}
          />

          <ExecutiveKpiCard
            title="Attention Items"
            value={attentionSummary.total}
            helper={`${attentionSummary.critical} critical • ${attentionSummary.high} high`}
            icon={AlertTriangle}
            tone={attentionSummary.total ? "red" : "slate"}
            onClick={() => openInsight("attentionItems")}
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <DashboardGraphCard
            title="Finance Health"
            description="Receivable, received, vendor payout and profit view."
            icon={CircleDollarSign}
            tone="purple"
          >
            <MiniColumnGraph
              rows={[
                {
                  label: "Quotation",
                  value: financeTotals.quotationValue,
                  display: formatCurrency(financeTotals.quotationValue),
                  tone: "purple"
                },
                {
                  label: "Received",
                  value: financeTotals.receivedAmount,
                  display: formatCurrency(financeTotals.receivedAmount),
                  tone: "green"
                },
                {
                  label: "Vendor Paid",
                  value: financeTotals.vendorPaid,
                  display: formatCurrency(financeTotals.vendorPaid),
                  tone: "blue"
                },
                {
                  label: "Gross Profit",
                  value: financeTotals.grossProfit,
                  display: formatCurrency(financeTotals.grossProfit),
                  tone: "emerald"
                }
              ]}
            />
          </DashboardGraphCard>

          <DashboardGraphCard
            title="Pipeline Health"
            description="Lead movement across assignment, quote and conversion."
            icon={Layers3}
            tone="blue"
          >
            <MiniColumnGraph
              rows={[
                {
                  label: "Total",
                  value: leadTotals.total,
                  display: leadTotals.total,
                  tone: "slate"
                },
                {
                  label: "Assigned",
                  value: leadTotals.assignedLeads,
                  display: leadTotals.assignedLeads,
                  tone: "blue"
                },
                {
                  label: "Quote Sent",
                  value: leadTotals.quoteSentLeads,
                  display: leadTotals.quoteSentLeads,
                  tone: "purple"
                },
                {
                  label: "Converted",
                  value: leadTotals.wonLeads,
                  display: leadTotals.wonLeads,
                  tone: "green"
                }
              ]}
            />
          </DashboardGraphCard>

          <DashboardGraphCard
            title="Risk Signals"
            description="Items needing team or management attention."
            icon={AlertTriangle}
            tone={attentionSummary.total ? "red" : "green"}
          >
            <MiniColumnGraph
              rows={[
                {
                  label: "Critical",
                  value: attentionSummary.critical,
                  display: attentionSummary.critical,
                  tone: "red"
                },
                {
                  label: "High",
                  value: attentionSummary.high,
                  display: attentionSummary.high,
                  tone: "orange"
                },
                {
                  label: "Medium",
                  value: attentionSummary.medium,
                  display: attentionSummary.medium,
                  tone: "amber"
                },
                {
                  label: "Vendor",
                  value: vendorTotals.pendingQuoteLeads,
                  display: vendorTotals.pendingQuoteLeads,
                  tone: "purple"
                }
              ]}
            />
          </DashboardGraphCard>
        </section>

        <div className="sticky top-20 z-30 bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-1  flex gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition
                  ${activeTab === tab.key
                    ? "bg-gray-900 text-white "
                    : "text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "overview" && (
        <section className="space-y-6">
          <SectionHeader
            icon={LayoutDashboard}
            title="Executive Overview"
            description={`Showing ${getRangeLabel(range)} performance across leads, finance, vendors and team.`}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Total Leads" value={leadTotals.total} />
            <DashboardKpiCard label="Quote Sent" value={leadTotals.quoteSentLeads} color="blue" />
            <DashboardKpiCard label="Margin" value={`${financeTotals.marginPercent}%`} color="purple" />
            <DashboardKpiCard label="Present Today" value={attendanceTotals.presentToday} color="green" />
          </div>

          <InsightCards
            financeTotals={financeTotals}
            attentionSummary={attentionSummary}
          />

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartShell
              icon={LineChart}
              tone="blue"
              title="Lead Trend"
              description="Lead inflow trend for selected period."
            >
              <LeadsTrendChart leads={activeDashboardLeads} days={14} />
            </ChartShell>

            <ChartShell
              icon={PieChart}
              tone="purple"
              title="Leads by Stage"
              description="Current lead distribution by pipeline stage."
            >
              <LeadsByStageChart leads={periodLeads} />
            </ChartShell>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              icon={TrendingUp}
              tone="green"
              title="Revenue by Destination"
              rows={financeTotals.byDestinationRevenue}
            />
            <MiniBarList
              icon={Target}
              tone="emerald"
              title="Gross Profit by Destination"
              rows={financeTotals.byDestinationProfit}
            />
            <MiniBarList
              icon={BriefcaseBusiness}
              tone="blue"
              title="Top Travel Agents"
              rows={leadTotals.byAgent}
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              icon={Handshake}
              tone="purple"
              title="Vendor Requests by Status"
              rows={vendorTotals.byVendorStatus}
            />
            <MiniBarList
              icon={CheckCircle2}
              tone="green"
              title="Vendor Quotes by Status"
              rows={vendorTotals.byVendorQuoteStatus}
            />
            <MiniBarList
              icon={AlertTriangle}
              tone="red"
              title="Attention by Type"
              rows={attentionSummary.byType}
            />
          </section>

          <AttentionRequiredPanel
            rows={attentionSummary.rows.slice(0, 8)}
            compact
            onViewLead={leadId => router.push(`/admin/leads/${leadId}`)}
          />

          <ManagementOverviewTable rows={teamRows} />
        </section>
      )}

      {activeTab === "finance" && (
        <section className="space-y-6">
          <SectionHeader
            icon={CircleDollarSign}
            title="Finance Performance"
            description="Quotation value, receivables, vendor payout and gross profit view."
          />

          <FinanceFlowCard financeTotals={financeTotals} />

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
            <MiniBarList
              icon={TrendingUp}
              tone="green"
              title="Revenue by Destination"
              rows={financeTotals.byDestinationRevenue}
            />
            <MiniBarList
              icon={Target}
              tone="emerald"
              title="Gross Profit by Destination"
              rows={financeTotals.byDestinationProfit}
            />
            <MiniBarList
              icon={BriefcaseBusiness}
              tone="blue"
              title="Revenue by Travel Agent"
              rows={financeTotals.byAgentRevenue}
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList
              icon={Users}
              tone="purple"
              title="Revenue by Team Member"
              rows={financeTotals.byAssigneeRevenue}
            />
            <MiniBarList
              icon={Wallet}
              tone="green"
              title="Customer Payment Status"
              rows={financeTotals.byPaymentStatus}
            />
            <MiniBarList
              icon={Handshake}
              tone="orange"
              title="Vendor Payment Status"
              rows={financeTotals.byVendorPaymentStatus}
            />
          </section>

          <ManagementFinanceTable rows={teamRows} />
        </section>
      )}

      {activeTab === "leads" && (
        <section className="space-y-6">
          <SectionHeader
            icon={LineChart}
            title="Lead Pipeline"
            description="Lead movement, assignment, conversion and destination performance."
          />

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
            <ChartShell
              icon={PieChart}
              tone="purple"
              title="Leads by Stage"
              description="Lead distribution across pipeline stages."
            >
              <LeadsByStageChart leads={periodLeads} />
            </ChartShell>

            <ChartShell
              icon={Target}
              tone="blue"
              title="Leads by Destination"
              description="Destination-wise lead distribution."
            >
              <LeadsByDestinationChart leads={periodLeads} />
            </ChartShell>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <MiniBarList icon={PieChart} tone="purple" title="Leads by Stage" rows={leadTotals.byStage} />
            <MiniBarList icon={BarChart3} tone="blue" title="Leads by Status" rows={leadTotals.byStatus} />
            <MiniBarList icon={Activity} tone="green" title="Leads by Source" rows={leadTotals.bySource} />
          </section>

          <ManagementLeadsTable rows={teamRows} />
        </section>
      )}

      {activeTab === "vendor" && (
        <section className="space-y-6">
          <SectionHeader
            icon={Handshake}
            title="Vendor Operations"
            description="Vendor requests, received quotes, pending quotes and vendor payment exposure."
          />

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
            <MiniBarList icon={Handshake} tone="blue" title="Vendor Requests by Status" rows={vendorTotals.byVendorStatus} />
            <MiniBarList icon={CheckCircle2} tone="green" title="Vendor Quotes by Status" rows={vendorTotals.byVendorQuoteStatus} />
            <MiniBarList icon={Users} tone="purple" title="Top Vendors by Count" rows={vendorTotals.byVendor} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={CircleDollarSign} tone="orange" title="Top Vendors by Cost" rows={vendorTotals.byVendorCost} />
            <MiniBarList icon={Wallet} tone="green" title="Vendor Payment Status" rows={financeTotals.byVendorPaymentStatus} />
          </section>

          <ManagementVendorTable rows={periodLeads} />
        </section>
      )}

      {activeTab === "attention" && (
        <section className="space-y-6">
          <SectionHeader
            icon={AlertTriangle}
            title="Attention Required"
            description="Issues that need management or operations action."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Total Attention Items" value={attentionSummary.total} color={attentionSummary.total ? "red" : "gray"} />
            <DashboardKpiCard label="Critical" value={attentionSummary.critical} color={attentionSummary.critical ? "red" : "gray"} />
            <DashboardKpiCard label="High Priority" value={attentionSummary.high} color={attentionSummary.high ? "amber" : "gray"} />
            <DashboardKpiCard label="Medium Priority" value={attentionSummary.medium} color={attentionSummary.medium ? "blue" : "gray"} />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={AlertTriangle} tone="red" title="Attention by Type" rows={attentionSummary.byType} />


            <HighValueAttentionLeads
              rows={attentionSummary.rows}
            />
          </section>

          <AttentionRequiredPanel
            rows={attentionSummary.rows}
            onViewLead={leadId => router.push(`/admin/leads/${leadId}`)}
          />
        </section>
      )}

      {activeTab === "engagement" && (
        <section className="space-y-6">
          <SectionHeader
            icon={Activity}
            title="Engagement Activity"
            description="Calls, WhatsApp, emails, meetings and team engagement movement."
          />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <EngagementKpiCard label="Calls" value={engagementTotals.calls} />
            <EngagementKpiCard label="WhatsApp" value={engagementTotals.whatsapp} />
            <EngagementKpiCard label="Emails" value={engagementTotals.emails} />
            <EngagementKpiCard label="Meetings" value={engagementTotals.meetings} />
            <EngagementKpiCard label="Last Activity" value={formatDateTime(engagementTotals.lastActivity)} />
          </div>

          <ChartShell
            icon={Activity}
            tone="blue"
            title="Engagement by Channel"
            description="Distribution of engagement activity by channel."
          >
            <EngagementByChannelChart engagements={periodEngagements} />
          </ChartShell>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={Users} tone="purple" title="Engagement by Employee" rows={engagementTotals.byCreator} />
            <MiniBarList icon={Target} tone="blue" title="Engagement by Destination" rows={engagementTotals.byDestination} />
          </section>

          <ManagementEngagementTable rows={teamRows} />
        </section>
      )}

      {activeTab === "attendance" && (
        <section className="space-y-6">
          <SectionHeader
            icon={CalendarDays}
            title="Attendance Overview"
            description="Today’s presence, active sessions, late marks and total working hours."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Present Today" value={attendanceTotals.presentToday} color="green" />
            <DashboardKpiCard label="Active Now" value={attendanceTotals.activeNow} color="green" />
            <DashboardKpiCard label="Late" value={attendanceTotals.late} color={attendanceTotals.late ? "amber" : "gray"} />
            <DashboardKpiCard label="Total Hours" value={formatDuration(attendanceTotals.totalMinutes)} color="purple" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={Clock3} tone="blue" title="Attendance by Status" rows={attendanceTotals.byStatus} />

            <MiniBarList
              icon={Clock3}
              tone="purple"
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
          <SectionHeader
            icon={Users}
            title="Team Performance"
            description="Team workload, revenue contribution, engagement activity and attendance score."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashboardKpiCard label="Active Users" value={userTotals.activeUsers} color="blue" />
            <DashboardKpiCard label="Employee Users" value={userTotals.employeeUsers} color="green" />
            <DashboardKpiCard label="Admin Users" value={userTotals.adminUsers} color="purple" />
            <DashboardKpiCard label="Departments" value={userTotals.departments} color="blue" />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MiniBarList icon={Users} tone="blue" title="Users by Department" rows={userTotals.byDepartment} />
            <MiniBarList icon={UserCheck} tone="green" title="Users by Role" rows={userTotals.byRole} />
          </section>

          <ManagementTeamTable rows={teamRows} />
        </section>
      )}

      <DashboardDetailDrawer
        panel={selectedInsightPanel}
        onClose={() => setSelectedInsight(null)}
        onViewLead={leadId => router.push(`/admin/leads/${leadId}`)}
      />
    </main>
  );
}

/* =========================
   UX COMPONENTS
========================== */

const KPI_TONES = {
  blue: {
    card: "border-blue-100 bg-blue-50/70",
    icon: "bg-blue-600 text-white",
    title: "text-blue-700",
    value: "text-blue-950",
    helper: "text-blue-600"
  },
  green: {
    card: "border-green-100 bg-green-50/70",
    icon: "bg-green-600 text-white",
    title: "text-green-700",
    value: "text-green-950",
    helper: "text-green-600"
  },
  emerald: {
    card: "border-emerald-100 bg-emerald-50/70",
    icon: "bg-emerald-600 text-white",
    title: "text-emerald-700",
    value: "text-emerald-950",
    helper: "text-emerald-600"
  },
  purple: {
    card: "border-purple-100 bg-purple-50/70",
    icon: "bg-purple-600 text-white",
    title: "text-purple-700",
    value: "text-purple-950",
    helper: "text-purple-600"
  },
  amber: {
    card: "border-amber-100 bg-amber-50/80",
    icon: "bg-amber-500 text-white",
    title: "text-amber-700",
    value: "text-amber-950",
    helper: "text-amber-700"
  },
  orange: {
    card: "border-orange-100 bg-orange-50/80",
    icon: "bg-orange-500 text-white",
    title: "text-orange-700",
    value: "text-orange-950",
    helper: "text-orange-700"
  },
  red: {
    card: "border-red-100 bg-red-50/80",
    icon: "bg-red-600 text-white",
    title: "text-red-700",
    value: "text-red-950",
    helper: "text-red-700"
  },
  slate: {
    card: "border-slate-200 bg-slate-50",
    icon: "bg-slate-700 text-white",
    title: "text-slate-600",
    value: "text-slate-950",
    helper: "text-slate-500"
  }
};

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(item => (
          <div
            key={item}
            className="h-28 rounded-2xl bg-gray-100 animate-pulse"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}

function ExecutiveKpiCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "slate",
  onClick
}) {
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${theme.title}`}>
            {title}
          </p>

          <p className={`mt-2 text-xl font-bold ${theme.value}`}>
            {value}
          </p>

          {helper ? (
            <p className={`mt-1 text-xs ${theme.helper}`}>
              {helper}
            </p>
          ) : null}

          {onClick ? (
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </p>
          ) : null}
        </div>

        <div className={`rounded-2xl p-2.5 ${theme.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-white/40" />
    </>
  );

  const className = `
    relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md
    ${theme.card}
    ${onClick ? "cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20" : ""}
  `;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function DashboardGraphCard({
  title,
  description,
  icon: Icon,
  tone = "slate",
  children
}) {
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 ">
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-2.5 ${theme.icon}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {children}
      </div>
    </div>
  );
}

function MiniColumnGraph({ rows = [] }) {
  const max = Math.max(...rows.map(row => Number(row.value || 0)), 1);

  return (
    <div className="flex items-end gap-3 h-44">
      {rows.map(row => {
        const theme = KPI_TONES[row.tone] || KPI_TONES.slate;
        const height = `${Math.max((Number(row.value || 0) / max) * 100, 8)}%`;

        return (
          <div key={row.label} className="flex-1 h-full flex flex-col justify-end">
            <div className="flex-1 flex items-end">
              <div
                className={`
                  w-full rounded-t-2xl transition-all
                  ${theme.icon}
                `}
                style={{ height }}
              />
            </div>

            <div className="mt-2 text-center">
              <p className="text-[11px] font-medium text-gray-500 truncate">
                {row.label}
              </p>
              <p className="text-xs font-semibold text-gray-900 truncate">
                {row.display}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-2.5 text-gray-700 ">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function BusinessPulseCard({
  range,
  financeTotals,
  leadTotals,
  vendorTotals,
  attentionSummary,
  onOpenDetail
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-5 text-white ">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gray-200">
            <Activity className="h-3.5 w-3.5" />
            {getRangeLabel(range)} Snapshot
          </div>

          <h2 className="mt-3 text-2xl font-semibold">
            Business Pulse
          </h2>

          <p className="mt-1 max-w-2xl text-sm text-gray-300">
            Quick view of revenue, collection, vendor exposure, team pipeline and management attention.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PulseMetric
            icon={LineChart}
            label="Active Leads"
            value={leadTotals.activeLeads}
            onClick={() => onOpenDetail?.("activeLeads")}
          />

          <PulseMetric
            icon={CircleDollarSign}
            label="Quotation"
            value={formatCurrency(financeTotals.quotationValue)}
            onClick={() => onOpenDetail?.("quotationValue")}
          />

          <PulseMetric
            icon={Wallet}
            label="Cash Position"
            value={formatCurrency(financeTotals.cashInHand)}
            danger={financeTotals.cashInHand < 0}
            onClick={() => onOpenDetail?.("customerReceived")}
          />

          <PulseMetric
            icon={AlertTriangle}
            label="Attention"
            value={attentionSummary.total}
            danger={attentionSummary.total > 0}
            onClick={() => onOpenDetail?.("attentionItems")}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <PulseInfo
          icon={TrendingUp}
          label="Actual Realized GP"
          value={formatCurrency(financeTotals.realizedGrossProfit)}
          helper={`${formatCurrency(financeTotals.unrealizedGrossProfit)} not realized`}
          onClick={() => onOpenDetail?.("grossProfit")}
        />

        <PulseInfo
          icon={Handshake}
          label="Vendor Exposure"
          value={formatCurrency(financeTotals.vendorBalance)}
          helper={`${vendorTotals.pendingQuoteLeads} pending vendor quotes`}
          warning={financeTotals.vendorBalance > 0 || vendorTotals.pendingQuoteLeads > 0}
          onClick={() => onOpenDetail?.("vendorBalance")}
        />

        <PulseInfo
          icon={CheckCircle2}
          label="Converted Leads"
          value={leadTotals.wonLeads}
          helper={`${financeTotals.customerFullyPaid} customer fully paid`}
          onClick={() => onOpenDetail?.("convertedLeads")}
        />
      </div>
    </section>
  );
}

function PulseMetric({ icon: Icon, label, value, danger = false, onClick }) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-gray-300">
        <Icon className="h-4 w-4" />
        <p className="text-xs">{label}</p>
      </div>

      <p className={`mt-2 text-lg font-semibold ${danger ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
    </>
  );

  const className = `
    rounded-2xl bg-white/10 px-4 py-3 backdrop-blur transition
    ${onClick ? "cursor-pointer text-left hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/20" : ""}
  `;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function PulseInfo({ icon: Icon, label, value, helper, warning = false, onClick }) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-gray-300">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>

      <p className="mt-2 text-lg font-semibold text-white">
        {value}
      </p>

      <p className={`mt-1 text-xs ${warning ? "text-amber-300" : "text-gray-300"}`}>
        {helper}
      </p>
    </>
  );

  const className = `
    rounded-2xl border border-white/10 bg-white/5 p-4 transition
    ${onClick ? "cursor-pointer text-left hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20" : ""}
  `;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function FinanceFlowCard({ financeTotals }) {
  const items = [
    {
      label: "Quotation",
      value: formatCurrency(financeTotals.quotationValue),
      icon: LineChart
    },
    {
      label: "Received",
      value: formatCurrency(financeTotals.receivedAmount),
      icon: Wallet
    },
    {
      label: "Vendor Paid",
      value: formatCurrency(financeTotals.vendorPaid),
      icon: Handshake
    },
    {
      label: "Cash Position",
      value: formatCurrency(financeTotals.cashInHand),
      icon: CircleDollarSign
    },
    {
      label: "Gross Profit",
      value: formatCurrency(financeTotals.grossProfit),
      icon: TrendingUp
    }
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 ">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-purple-50 p-2.5 text-purple-700">
            <CircleDollarSign className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Finance Flow
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Quote to collection to vendor payout and final profit.
            </p>
          </div>
        </div>

        <span className="w-fit rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
          Margin {financeTotals.marginPercent}%
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3">
        {items.map((item, index) => {
          const ItemIcon = item.icon;

          return (
            <div key={item.label} className="relative rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-gray-500">
                <ItemIcon className="h-4 w-4" />
                <p className="text-xs">{item.label}</p>
              </div>

              <p className="mt-2 text-base font-semibold text-gray-900">
                {item.value}
              </p>

              {index < items.length - 1 && (
                <span className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightCards({ financeTotals, attentionSummary }) {
  const bestDestination = financeTotals.byDestinationRevenue?.[0];
  const bestAgent = financeTotals.byAgentRevenue?.[0];
  const biggestRisk = attentionSummary.byType?.[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <InsightCard
        icon={Target}
        label="Best Destination"
        title={bestDestination?.name || "No destination yet"}
        value={bestDestination?.displayCount || "—"}
      />

      <InsightCard
        icon={BriefcaseBusiness}
        label="Best Travel Agent"
        title={bestAgent?.name || "No agent yet"}
        value={bestAgent?.displayCount || "—"}
      />

      <InsightCard
        icon={AlertTriangle}
        label="Biggest Risk"
        title={biggestRisk ? readableLabel(biggestRisk.name) : "No risk found"}
        value={biggestRisk ? `${biggestRisk.count} items` : "Clear"}
        danger={Boolean(biggestRisk)}
      />
    </div>
  );
}

function InsightCard({ icon: Icon, label, title, value, danger = false }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 ">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-900">
        {readableLabel(title)}
      </p>

      <p className={`mt-1 text-lg font-semibold ${danger ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function ChartShell({
  title,
  description,
  icon: Icon,
  tone = "slate",
  children,
  rightContent = null,
  noPadding = false,
  className = ""
}) {
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  return (
    <div
      className={`
        overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm
        transition hover:shadow-md
        ${className}
      `}
    >
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`rounded-xl p-2 shadow-sm ${theme.icon}`}>
              <Icon className="h-4 w-4" />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {title}
              </h2>

              {description ? (
                <p className="mt-0.5 text-xs text-gray-500">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {rightContent ? (
            <div className="shrink-0">
              {rightContent}
            </div>
          ) : null}
        </div>
      </div>

      <div className={noPadding ? "" : "p-4"}>
        {children}
      </div>
    </div>
  );
}

/* =========================
   MINI BAR LIST
========================== */

function MiniBarList({
  title,
  rows,
  icon: Icon = BarChart3,
  tone = "slate",
  preserveLabel = false
}) {
  const max = rows?.length ? Math.max(...rows.map(row => row.count)) : 0;
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-xl p-2 ${theme.icon}`}>
          <Icon className="h-4 w-4" />
        </div>

        <h2 className="text-sm font-semibold text-gray-900">
          {title}
        </h2>
      </div>

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
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {preserveLabel ? row.name : readableLabel(row.name)}
                    </p>

                    {row.subLabel ? (
                      <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                        {row.subLabel}
                      </p>
                    ) : null}
                  </div>

                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {row.displayCount || row.count}
                  </p>
                </div>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${theme.icon}`}
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}

          {rows.length > 8 && (
            <p className="text-xs text-gray-400">
              Showing top 8 of {rows.length}
            </p>
          )}
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

function AttentionRequiredPanel({ rows, compact = false, onViewLead }) {
  const groupedRows = getGroupedAttentionRows(rows);
  const visibleRows = groupedRows.slice(0, compact ? 8 : 50);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start gap-3">
        <div className="rounded-xl bg-red-50 p-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Attention Required
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Unique leads that need management or operations action.
          </p>
        </div>
      </div>

      {!visibleRows.length ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No attention items found.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {visibleRows.map(item => (
            <div
              key={item.leadId || item.leadCode}
              className="px-4 py-4 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-sm text-gray-900">
                    {item.leadCode}
                  </p>

                  <span
                    className={`
                      inline-flex items-center px-2 py-0.5 rounded-full text-xs border
                      ${getSeverityClass(item.highestSeverity)}
                    `}
                  >
                    Highest {readableLabel(item.highestSeverity)}
                  </span>

                  <span className="text-xs text-gray-500">
                    {item.issues.length} attention item
                    {item.issues.length > 1 ? "s" : ""}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {item.customerName} • {item.destinationName} • Assigned:{" "}
                  {item.assignedToName}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.issues.map((issue, index) => (
                    <div
                      key={`${item.leadCode}-${issue.type}-${index}`}
                      className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`
                            inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border
                            ${getSeverityClass(issue.severity)}
                          `}
                        >
                          {readableLabel(issue.severity)}
                        </span>

                        <span className="text-xs font-medium text-gray-700">
                          {readableLabel(issue.type)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        {issue.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-left xl:text-right shrink-0 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last: {formatDateTime(item.lastActivityAt)}
                  </p>
                </div>

                {onViewLead && (
                  <button
                    type="button"
                    onClick={() => onViewLead(item.leadId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Lead
                  </button>
                )}
              </div>
            </div>
          ))}

          {groupedRows.length > visibleRows.length && (
            <div className="px-4 py-3 text-xs text-gray-400">
              Showing {visibleRows.length} of {groupedRows.length} attention leads
            </div>
          )}
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
      icon={Users}
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
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
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
          <td className="px-4 py-3 text-right text-gray-600">{formatDateTime(row.lastActivityAt)}</td>
          <td className="px-4 py-3 text-right">
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
      icon={CircleDollarSign}
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
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
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
      icon={Handshake}
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
        <tr key={row.id} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">{row.leadCode || row.id}</div>
            <div className="text-xs text-gray-500">{row.agentName || row.agencyName || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right text-gray-600">{row.destinationName || "—"}</td>
          <td className="px-4 py-3 text-right text-gray-600">{row.latestVendorName || row.latestSelectedVendorName || "—"}</td>
          <td className="px-4 py-3 text-right">{Number(row.vendorRequestCount || 0)}</td>
          <td className="px-4 py-3 text-right">{Number(row.vendorQuoteCount || 0)}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(getLeadVendorCost(row))}</td>
          <td className="px-4 py-3 text-right">{formatCurrency(getLeadVendorPaidAmount(row))}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.vendorPaymentBalance)}</td>
          <td className="px-4 py-3 text-right text-gray-600">
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
      icon={LineChart}
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
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
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
      icon={Activity}
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
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right">{row.engagements}</td>
          <td className="px-4 py-3 text-right">{row.calls}</td>
          <td className="px-4 py-3 text-right">{row.whatsapp}</td>
          <td className="px-4 py-3 text-right">{row.emails}</td>
          <td className="px-4 py-3 text-right">{row.meetings}</td>
          <td className="px-4 py-3 text-right text-green-700 font-medium">{row.completedEngagements}</td>
          <td className="px-4 py-3 text-right text-gray-600">{formatDateTime(row.lastActivityAt)}</td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementAttendanceTable({ rows }) {
  return (
    <DashboardTable
      icon={CalendarDays}
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
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
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
          <td className="px-4 py-3 text-right text-gray-600">{formatDateTime(row.firstCheckIn)}</td>
          <td className="px-4 py-3 text-right text-gray-600">{formatDateTime(row.lastCheckOut)}</td>
          <td className="px-4 py-3 text-right font-medium">{formatDuration(row.totalMinutes)}</td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementTeamTable({ rows }) {
  return (
    <DashboardTable
      icon={Users}
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
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right text-gray-600">{row.department || "—"}</td>
          <td className="px-4 py-3 text-right text-gray-600">{readableLabel(row.role)}</td>
          <td className="px-4 py-3 text-right">{row.newLeads}</td>
          <td className="px-4 py-3 text-right text-green-700 font-medium">{row.wonLeads}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.grossProfit)}</td>
          <td className="px-4 py-3 text-right">{row.engagements}</td>
          <td className="px-4 py-3 text-right font-medium">{formatDuration(row.totalMinutes)}</td>
          <td className="px-4 py-3 text-right font-semibold">{row.score}</td>
          <td className="px-4 py-3 text-right">
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
  icon: Icon = BarChart3,
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
    <div className="bg-white border border-gray-200 rounded-xl  overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start gap-3">
        <div className="rounded-xl bg-gray-50 p-2 text-gray-600">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {title}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500">
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

function DashboardDetailDrawer({ panel, onClose, onViewLead }) {
  if (!panel) return null;

  const rows = Array.isArray(panel.rows) ? panel.rows : [];
  const totalAmount =
    panel.type === "lead" && panel.amountGetter
      ? rows.reduce((sum, lead) => sum + Number(panel.amountGetter(lead) || 0), 0)
      : 0;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close drawer backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-hidden bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {panel.title}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {panel.description}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">
                  Total Records
                </p>
                <p className="mt-1 text-xl font-semibold text-gray-900">
                  {rows.length}
                </p>
              </div>

              {panel.summaryCards?.length ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {panel.summaryCards.map(card => {
                    const toneMap = {
                      emerald: "bg-emerald-50 text-emerald-800",
                      green: "bg-green-50 text-green-800",
                      amber: "bg-amber-50 text-amber-800",
                      slate: "bg-gray-50 text-gray-900"
                    };

                    return (
                      <div
                        key={card.label}
                        className={`rounded-2xl p-3 ${toneMap[card.tone] || toneMap.slate}`}
                      >
                        <p className="text-xs font-medium opacity-80">
                          {card.label}
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {card.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">
                      Total Records
                    </p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {rows.length}
                    </p>
                  </div>

                  {panel.type === "lead" && panel.amountGetter ? (
                    <div className="rounded-2xl bg-emerald-50 p-3">
                      <p className="text-xs font-medium text-emerald-700">
                        Total {panel.amountLabel || "Value"}
                      </p>
                      <p className="mt-1 text-xl font-semibold text-emerald-800">
                        {formatCurrency(totalAmount)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-red-50 p-3">
                      <p className="text-xs font-medium text-red-700">
                        Attention View
                      </p>
                      <p className="mt-1 text-xl font-semibold text-red-800">
                        {rows.length}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!rows.length ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  No records found
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  No matching data is available for the selected range.
                </p>
              </div>
            ) : panel.type === "attention" ? (
              <div className="space-y-3">
                {rows.map((item, index) => (
                  <div
                    key={item.id || `${item.leadId}-${item.type}-${index}`}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.leadCode}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {item.customerName} • {item.destinationName}
                        </p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSeverityClass(item.severity)}`}>
                        {readableLabel(item.severity)}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-medium text-gray-800">
                      {readableLabel(item.type)}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {item.reason}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.amount)}
                      </p>

                      {item.leadId ? (
                        <button
                          type="button"
                          onClick={() => onViewLead?.(item.leadId)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Lead
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map(lead => {
                  const amount = panel.amountGetter
                    ? Number(panel.amountGetter(lead) || 0)
                    : 0;

                  const dateValue = panel.dateGetter
                    ? panel.dateGetter(lead)
                    : getLeadDate(lead);

                  return (
                    <div
                      key={lead.id || lead.leadCode}
                      className="rounded-2xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {getLeadDisplayName(lead)}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {lead.customerName || lead.agentName || lead.agencyName || "Unknown Client"} •{" "}
                            {lead.destinationName || "Unknown Destination"}
                          </p>
                        </div>

                        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {readableLabel(lead.stage || lead.status || "Open")}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[11px] font-medium text-gray-500">
                            Assigned To
                          </p>
                          <p className="mt-1 truncate text-xs font-semibold text-gray-800">
                            {lead.assignedToName || lead.assignedToEmail || "Unassigned"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[11px] font-medium text-gray-500">
                            Date
                          </p>
                          <p className="mt-1 text-xs font-semibold text-gray-800">
                            {formatDateTime(dateValue)}
                          </p>
                        </div>
                      </div>

                      {panel.showGrossProfitBreakdown ? (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-[11px] font-medium text-emerald-700">
                              Total GP
                            </p>
                            <p className="mt-1 text-xs font-semibold text-emerald-900">
                              {formatCurrency(getLeadGrossProfit(lead))}
                            </p>
                          </div>

                          <div className="rounded-xl bg-green-50 p-3">
                            <p className="text-[11px] font-medium text-green-700">
                              Realized
                            </p>
                            <p className="mt-1 text-xs font-semibold text-green-900">
                              {formatCurrency(getLeadActualRealizedGrossProfit(lead))}
                            </p>
                          </div>

                          <div className="rounded-xl bg-amber-50 p-3">
                            <p className="text-[11px] font-medium text-amber-700">
                              Not Realized
                            </p>
                            <p className="mt-1 text-xs font-semibold text-amber-900">
                              {formatCurrency(getLeadUnrealizedGrossProfit(lead))}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-medium text-gray-500">
                            {panel.amountLabel || "Value"}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(amount)}
                          </p>
                        </div>

                        {lead.id ? (
                          <button
                            type="button"
                            onClick={() => onViewLead?.(lead.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Lead
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}