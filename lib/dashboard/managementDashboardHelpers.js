import {
  getLeadAssignee as getLeadAssigneeIdentity,
  getLeadOwner as getLeadOwnerIdentity
} from "@/lib/leadOwnership";
import { isTerminalLeadStage } from "@/lib/leadStages";

/* =========================
   COMMON HELPERS
========================== */

export function getGroupedAttentionRows(rows = []) {
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



export function getSeverityRank(severity) {
  const ranks = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return ranks[severity] || 0;
}

export function getUniqueHighValueAttentionRows(rows = []) {
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

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getLocalDateKey(value = new Date()) {
  const d = toDate(value) || new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function readableLabel(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function pickAmount(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

export function getRangeWindow(range) {
  const now = new Date();

  if (range === "all") {
    return {
      start: null,
      end: now
    };
  }

  const start = new Date(now);
  const end = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  }

  if (range === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (range === "30d") {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (range === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (range === "month" || range === "thisMonth") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (range === "lastMonth") {
    start.setMonth(start.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  }

  return {
    start,
    end
  };
}

export function isInRange(value, rangeWindow) {
  if (!rangeWindow?.start && !rangeWindow?.end) return true;

  const d = toDate(value);
  if (!d) return false;

  return (!rangeWindow?.start || d >= rangeWindow.start) &&
    (!rangeWindow?.end || d <= rangeWindow.end);
}

export function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatNameFromEmail(email) {
  if (!email) return "Unassigned";

  return email
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function formatDuration(minutes) {
  const value = Number(minutes || 0);

  if (!value) return "—";

  const h = Math.floor(value / 60);
  const m = value % 60;

  if (!h) return `${m}m`;
  if (!m) return `${h}h`;

  return `${h}h ${m}m`;
}

export function looksLikeEmail(value) {
  return String(value || "").includes("@");
}

export function countBy(rows, getter) {
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

export function sumBy(rows, keyGetter, valueGetter, formatter) {
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

export function getScoreLabel(score) {
  if (score >= 120) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 20) return "Average";
  return "Needs Attention";
}

export function getScoreClass(score) {
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

export function getRangeLabel(range) {
  return {
    today: "Today",
    yesterday: "Yesterday",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    week: "This Week",
    month: "This Month",
    thisMonth: "This Month",
    lastMonth: "Last Month",
    custom: "Custom Period",
    all: "All Time"
  }[range] || "Selected Period";
}

/* =========================
   GLOBAL LEAD VISIBILITY
   Deleted leads are excluded everywhere
========================== */

export function isDeletedLead(lead) {
  return (
    lead?.isDeleted === true ||
    lead?.deleted === true ||
    String(lead?.isDeleted).trim().toLowerCase() === "true" ||
    String(lead?.deleted).trim().toLowerCase() === "true" ||
    Boolean(lead?.deletedAt)
  );
}

export function getActiveLeads(leads = []) {
  if (!Array.isArray(leads)) return [];
  return leads.filter(lead => !isDeletedLead(lead));
}

/* =========================
   LEAD HELPERS
========================== */



export function getLeadDate(lead) {
  return (
    toDate(lead?.createdAt) ||
    toDate(lead?.assignedAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.lastActivityAt)
  );
}

export function getLeadActivityDate(lead) {
  return (
    toDate(lead?.lastActivityAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.assignedAt) ||
    toDate(lead?.createdAt)
  );
}

export function hasLeadAssignee(lead) {
  return Boolean(
    lead?.assignedToUid ||
    lead?.assignedToName ||
    lead?.assignedTo ||
    lead?.assignedToEmail
  );
}

export function isWonLead(lead) {
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

export function isLostLead(lead) {
  const status = normalize(lead?.status);
  const stage = normalize(lead?.stage);

  return (
    status === "lost" ||
    status === "closed_lost" ||
    stage === "lost" ||
    stage === "closed_lost"
  );
}

export function isCancelledInvalidLead(lead) {
  const status = normalize(lead?.status);
  const stage = normalize(lead?.stage);
  const closureType = normalize(lead?.closureType);

  return (
    closureType === "cancelled_invalid" ||
    status === "cancelled_invalid" ||
    status === "cancelled" ||
    status === "invalid" ||
    status === "closed_invalid" ||
    stage === "cancelled_invalid" ||
    stage === "cancelled" ||
    stage === "invalid" ||
    stage === "closed_invalid"
  );
}

export function getLeadWonDate(lead) {
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

export function getLeadLostDate(lead) {
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

export function getLeadCancelledInvalidDate(lead) {
  if (!isCancelledInvalidLead(lead)) return null;

  return (
    toDate(lead?.cancelledInvalidAt) ||
    toDate(lead?.closureDate) ||
    toDate(lead?.closedAt) ||
    toDate(lead?.cancelledAt) ||
    toDate(lead?.stageUpdatedAt) ||
    toDate(lead?.statusUpdatedAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.lastActivityAt) ||
    toDate(lead?.createdAt)
  );
}

export function getQuotationDate(lead) {
  return (
    toDate(lead?.finalQuotationAt) ||
    toDate(lead?.latestQuotationSentAt) ||
    toDate(lead?.quotationSentAt) ||
    toDate(lead?.lastQuotationSentAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.createdAt)
  );
}

export function getPaymentDate(lead) {
  return (
    toDate(lead?.latestCustomerPaymentAt) ||
    toDate(lead?.lastPaymentReceivedAt) ||
    toDate(lead?.paymentReceivedAt) ||
    toDate(lead?.updatedAt) ||
    toDate(lead?.createdAt)
  );
}

export function isInSelectedRangeByDate(dateValue, rangeWindow) {
  if (!rangeWindow?.start && !rangeWindow?.end) return true;

  const date = toDate(dateValue);
  if (!date) return false;

  return (!rangeWindow?.start || date >= rangeWindow.start) &&
    (!rangeWindow?.end || date <= rangeWindow.end);
}

export function getLeadDisplayName(lead) {
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

export function isClosedLead(lead) {
  const status = normalize(lead?.status);
  const stage = normalize(lead?.stage);

  return (
    isTerminalLeadStage(lead?.stage || lead?.status || "") ||
    isWonLead(lead) ||
    isLostLead(lead) ||
    status === "closed" ||
    stage === "closed" ||
    status === "cancelled_invalid" ||
    stage === "cancelled_invalid"
  );
}

export function isActiveLead(lead) {
  return !isClosedLead(lead);
}

export function getLeadQuotationAmount(lead) {
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

export function getLeadVendorCost(lead) {
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

export function getLeadGrossProfit(lead) {
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

export function getPaymentBalance(lead) {
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

export function getVendorPaymentBalance(lead) {
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

export function isCustomerPaymentRealized(lead) {
  const status = normalize(lead?.customerPaymentStatus);

  return (
    status === "fully_paid" ||
    status === "paid" ||
    status === "received" ||
    getPaymentBalance(lead) <= 0
  );
}

export function isVendorPaymentSettled(lead) {
  const status = normalize(lead?.vendorPaymentStatus);

  return (
    status === "fully_paid" ||
    status === "paid" ||
    status === "settled" ||
    getVendorPaymentBalance(lead) <= 0
  );
}

export function isGrossProfitRealized(lead) {
  return (
    isWonLead(lead) &&
    getLeadGrossProfit(lead) > 0 &&
    isCustomerPaymentRealized(lead) &&
    isVendorPaymentSettled(lead)
  );
}

export function getLeadActualRealizedGrossProfit(lead) {
  if (!isGrossProfitRealized(lead)) return 0;
  return getLeadGrossProfit(lead);
}

export function getLeadUnrealizedGrossProfit(lead) {
  const grossProfit = getLeadGrossProfit(lead);
  const realizedProfit = getLeadActualRealizedGrossProfit(lead);

  return Math.max(grossProfit - realizedProfit, 0);
}

export function getLeadReceivedAmount(lead) {
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

export function getLeadReceivableAmount(lead) {
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

export function getLeadPaymentBalance(lead) {
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

export function getLeadVendorPayableAmount(lead) {
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

export function getLeadVendorPaymentBalance(lead) {
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

export function getLeadVendorPaidAmount(lead) {
  return (
    pickAmount(
      lead?.totalVendorPaid,
      lead?.latestVendorPaymentAmount,
      lead?.latestVendorPaymentEntryAmount
    ) || 0
  );
}

export function hasQuotationSent(lead) {
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

export function hasVendorRequest(lead) {
  return (
    Number(lead?.vendorRequestCount || 0) > 0 ||
    Boolean(lead?.latestVendorRequestId) ||
    Boolean(lead?.lastVendorCommunicationAt)
  );
}

export function hasVendorQuoteReceived(lead) {
  const quoteStatus = normalize(lead?.latestVendorQuoteStatus);
  const requestStatus = normalize(lead?.latestVendorRequestStatus);

  return (
    Number(lead?.vendorQuoteCount || 0) > 0 ||
    quoteStatus === "received" ||
    requestStatus === "quote_received" ||
    Boolean(lead?.latestVendorQuoteId)
  );
}

export function isVendorQuotePending(lead) {
  if (!hasVendorRequest(lead)) return false;
  return !hasVendorQuoteReceived(lead);
}

export function isVendorSelected(lead) {
  return Boolean(
    lead?.latestSelectedVendorName ||
    lead?.latestSelectedVendorQuoteId ||
    lead?.latestSelectedVendorRequestId
  );
}

export function getLeadOwner(lead, userMap = new Map()) {
  const identity = getLeadOwnerIdentity(lead);
  const userData = identity.uid ? userMap.get(identity.uid) : null;
  const email = identity.email || userData?.email || "";
  const name =
    identity.name ||
    userData?.displayName ||
    userData?.name ||
    formatNameFromEmail(email);

  return {
    uid: identity.uid || userData?.uid || userData?.id || "",
    email,
    name,
    department: userData?.department || "",
    role: identity.role || userData?.role || userData?.designation || ""
  };
}

export function getLeadAssignee(lead, userMap = new Map()) {
  const identity = getLeadAssigneeIdentity(lead);
  const userData = identity.uid ? userMap.get(identity.uid) : null;
  const email = identity.email || userData?.email || "";
  const name =
    identity.name ||
    userData?.displayName ||
    userData?.name ||
    formatNameFromEmail(email);

  return {
    uid: identity.uid || userData?.uid || userData?.id || "",
    email,
    name,
    department: userData?.department || "",
    role: identity.role || userData?.role || userData?.designation || ""
  };
}


export function getLeadCreator(lead, userMap = new Map()) {
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

export function getEngagementDate(item) {
  return toDate(item?.createdAt) || toDate(item?.updatedAt);
}

export function getEngagementOwner(item, userMap = new Map()) {
  const uid =
    item?.createdByUid ||
    item?.createdByUserId ||
    item?.loggedByUid ||
    item?.performedByUid ||
    item?.userUid ||
    item?.employeeUid ||
    item?.ownerUid ||
    "";
  const rawEmail =
    item?.createdByEmail ||
    item?.loggedByEmail ||
    item?.performedByEmail ||
    item?.userEmail ||
    item?.employeeEmail ||
    item?.ownerEmail ||
    "";
  const userData =
    (uid ? userMap.get(uid) : null) ||
    (rawEmail ? userMap.get(normalize(rawEmail)) : null);
  const email = userData?.email || rawEmail || "";

  const explicitName =
    item?.createdByName ||
    item?.loggedByName ||
    item?.performedByName ||
    item?.userName ||
    item?.employeeName ||
    item?.ownerName ||
    "";
  const name =
    userData?.displayName ||
    userData?.name ||
    explicitName ||
    (email ? formatNameFromEmail(email) : "Legacy / Unmapped");

  return {
    uid: userData?.uid || userData?.id || uid,
    email,
    name,
    department: userData?.department || "",
    role: userData?.role || userData?.designation || ""
  };
}

export function getEngagementDestinationList(item) {
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

export function getAttendanceSessions(record) {
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

export function getFirstCheckIn(record) {
  const sessions = getAttendanceSessions(record);

  const dates = sessions
    .map(session => toDate(session?.checkInAt))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  return dates[0] || null;
}

export function getLastCheckOut(record) {
  const sessions = getAttendanceSessions(record);

  const dates = sessions
    .map(session => toDate(session?.checkOutAt))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return dates[0] || null;
}

export function getAttendanceRecordDate(record) {
  if (record?.date) return record.date;

  const d =
    toDate(record?.createdAt) ||
    toDate(record?.updatedAt) ||
    toDate(getFirstCheckIn(record));

  if (!d) return "";

  return getLocalDateKey(d);
}

export function getAttendanceStatus(record) {
  if (record?.status) return normalize(record.status);

  const sessions = getAttendanceSessions(record);
  const presentSession = sessions.find(
    session => normalize(session?.status) === "present"
  );

  if (presentSession) return "present";
  if (sessions.some(session => session?.checkInAt)) return "present";

  return "unknown";
}

export function getAttendanceMinutes(record) {
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

export function isAttendanceInRange(record, rangeWindow) {
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

export function isAttendancePresent(record) {
  const status = getAttendanceStatus(record);

  return (
    status === "present" ||
    status === "checked_in" ||
    status === "checked_out" ||
    getAttendanceSessions(record).some(session => session?.checkInAt)
  );
}

export function isAttendanceActive(record) {
  return getAttendanceSessions(record).some(session => {
    return session?.checkInAt && !session?.checkOutAt;
  });
}

export function isAttendanceLate(record) {
  const status = getAttendanceStatus(record);

  return (
    record?.isLate === true ||
    status === "late" ||
    status === "checked_in_late"
  );
}

export function isAttendanceLeave(record) {
  const status = getAttendanceStatus(record);
  return status === "leave" || status === "on_leave" || status === "paid_leave";
}

export function getAttendanceUser(record, userMap = new Map()) {
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
   TRAVEL AGENT HELPERS
========================== */

export function getTravelAgentDate(agent) {
  return toDate(agent?.createdAt || agent?.addedAt || agent?.createdOn);
}

export function getTravelAgentCreator(agent, userMap = new Map()) {
  const uid =
    agent?.createdByUid ||
    agent?.createdByUserId ||
    agent?.creatorUid ||
    "";
  const rawEmail = agent?.createdByEmail || agent?.creatorEmail || "";
  const userData =
    (uid ? userMap.get(uid) : null) ||
    (rawEmail ? userMap.get(normalize(rawEmail)) : null);
  const email = userData?.email || rawEmail || "";
  const name =
    userData?.displayName ||
    userData?.name ||
    agent?.createdByName ||
    agent?.creatorName ||
    (email ? formatNameFromEmail(email) : "Legacy / Unmapped");

  return {
    uid: userData?.uid || userData?.id || uid,
    email,
    name,
    department: userData?.department || "",
    role: userData?.role || userData?.designation || ""
  };
}

export function getEngagementTravelAgentId(item = {}) {
  return (
    item.agentId ||
    item.travelAgentId ||
    item.travelAgent?.id ||
    item.agent?.id ||
    ""
  );
}
