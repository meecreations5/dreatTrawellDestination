import {
  getLeadAssignee,
  getLeadOwner,
  getLeadTravelAgentId,
  resolveLeadTravelAgent
} from "@/lib/leadOwnership";
import {
  formatTravelMonthLabel,
  getLeadTravelRange
} from "@/lib/leadTravelDates";
import { getLeadAgentLocationParts } from "@/lib/locationFilters";
import { getLeadStageMeta, normalizeLeadStage } from "@/lib/leadStages";
import { getLeadClosingPotentialMeta } from "@/lib/leadPotential";

function firstString(...values) {
  return values.find(value => typeof value === "string" && value.trim())?.trim() || "";
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[₹,%\s]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value?.seconds === "number") {
    const parsed = new Date(value.seconds * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStageLabel(lead = {}) {
  const raw = firstString(lead.stage, lead.stageLabel, lead.status);
  if (!raw) return "";

  try {
    const normalized = normalizeLeadStage(raw);
    return getLeadStageMeta(normalized)?.label || lead.stageLabel || raw;
  } catch {
    return lead.stageLabel || raw.replaceAll("_", " ");
  }
}

function getLeadStatus(lead = {}) {
  return firstString(lead.status) || "open";
}

function getCustomerName(lead = {}) {
  return firstString(
    lead.customerName,
    lead.clientName,
    lead.guestName,
    lead.travellerName,
    lead.contactName,
    lead.customer?.name
  );
}

function getCustomerEmail(lead = {}) {
  return firstString(
    lead.customerEmail,
    lead.email,
    lead.clientEmail,
    lead.customer?.email
  );
}

function getCustomerMobile(lead = {}) {
  return firstString(
    lead.customerMobile,
    lead.mobile,
    lead.phone,
    lead.contactNumber,
    lead.customer?.mobile,
    lead.customer?.phone
  );
}

function getTravelAgentSpoc(lead = {}, travelAgent = null) {
  const spocs = Array.isArray(travelAgent?.spocs) ? travelAgent.spocs : [];
  const liveSpoc = spocs.find(item => item?.isPrimary) || spocs[0] || null;
  const snapshotSpoc = lead.agentSnapshot?.primarySpoc || null;
  const leadSpoc = lead.spoc || null;

  return {
    name: firstString(liveSpoc?.name, leadSpoc?.name, snapshotSpoc?.name),
    email: firstString(liveSpoc?.email, leadSpoc?.email, snapshotSpoc?.email),
    mobile: firstString(
      liveSpoc?.mobile,
      liveSpoc?.phone,
      liveSpoc?.whatsapp,
      leadSpoc?.mobile,
      leadSpoc?.phone,
      leadSpoc?.whatsapp,
      snapshotSpoc?.mobile
    )
  };
}

function getPax(lead = {}) {
  const candidates = [
    lead.travelDetails?.paxText,
    lead.paxText,
    lead.pax,
    lead.guests,
    lead.guestCount,
    lead.numberOfPax
  ];

  for (const value of candidates) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function getQuotedAmount(lead = {}) {
  return firstNumber(
    lead.finalCustomerQuoteAmount,
    lead.finalQuotationAmount,
    lead.latestCustomerQuoteAmount,
    lead.latestQuotationAmount,
    lead.customerQuoteAmount,
    lead.customerQuotedAmount,
    lead.finalQuotedAmount,
    lead.lastQuotedAmount,
    lead.totalQuotedAmount,
    lead.quotationAmount,
    lead.packageAmount
  );
}

function getVendorCost(lead = {}) {
  return firstNumber(
    lead.finalSelectedVendorCost,
    lead.finalVendorCost,
    lead.finalTotalSelectedVendorCost,
    lead.latestSelectedVendorCost,
    lead.latestVendorCost,
    lead.latestTotalSelectedVendorCost,
    lead.selectedVendorCost,
    lead.vendorCost
  );
}

function getGrossProfit(lead = {}, quotedAmount = null, vendorCost = null) {
  const saved = firstNumber(
    lead.finalGrossProfit,
    lead.latestGrossProfit,
    lead.actualGrossProfit,
    lead.grossProfit,
    lead.expectedGrossProfit
  );

  if (saved !== null) return saved;
  if (quotedAmount !== null && vendorCost !== null) {
    return Number((quotedAmount - vendorCost).toFixed(2));
  }

  return null;
}

function getMarginPercent(lead = {}, quotedAmount = null, grossProfit = null) {
  const saved = firstNumber(
    lead.finalMarginPercent,
    lead.latestMarginPercent,
    lead.marginPercent,
    lead.expectedMarginPercent
  );

  if (saved !== null) return saved;
  if (quotedAmount && grossProfit !== null) {
    return Number(((grossProfit / quotedAmount) * 100).toFixed(2));
  }

  return null;
}

function getVendorName(lead = {}) {
  return firstString(
    lead.finalSelectedVendorName,
    lead.finalVendorName,
    lead.latestSelectedVendorName,
    lead.selectedVendorName,
    lead.vendorName
  );
}

function getQuotationCurrency(lead = {}) {
  return firstString(
    lead.finalCustomerQuoteCurrency,
    lead.latestCustomerQuoteCurrency,
    lead.customerQuoteCurrency,
    lead.finalSelectedVendorCurrency,
    lead.latestSelectedVendorCurrency,
    lead.selectedVendorCurrency,
    lead.currency,
    "INR"
  );
}

function getCustomerPaymentReceived(lead = {}) {
  return firstNumber(
    lead.totalPaymentReceived,
    lead.customerPaymentReceived,
    lead.paymentReceived
  );
}

function getVendorPaid(lead = {}) {
  return firstNumber(
    lead.totalVendorPaid,
    lead.vendorPaymentPaid,
    lead.vendorPaidAmount
  );
}

function getClosureReason(lead = {}) {
  return firstString(
    lead.closureReasonLabel,
    lead.closedReasonLabel,
    lead.closureReason,
    lead.closedReason,
    lead.lostReasonLabel,
    lead.lostReason,
    lead.cancelReasonLabel,
    lead.cancelReason
  );
}

function getClosureDate(lead = {}) {
  return (
    lead.closureDate ||
    lead.closedAt ||
    lead.convertedAt ||
    lead.lostAt ||
    lead.cancelledInvalidAt ||
    null
  );
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);

  // Prevent spreadsheet formula execution when CSV is opened in Excel/Sheets.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replaceAll('"', '""')}"`;
}

function formatFileDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildLeadExportRows(
  leads = [],
  {
    travelAgentMap = null,
    includeVendorCost = false,
    includeRevenueGp = false
  } = {}
) {
  const baseHeaders = [
    "Lead Code",
    "Lead ID",
    "Stage",
    "Status",
    "Closing Potential",
    "Lead Source",
    "Lead Owner",
    "Lead Owner Email",
    "Current Assignee",
    "Assignee Email",
    "Travel Agent Code",
    "Travel Agent Name",
    "Travel Agent Status",
    "Travel Agent Potential",
    "Agent SPOC Name",
    "Agent SPOC Mobile",
    "Agent SPOC Email",
    "Agent State",
    "Agent City",
    "Agent Sub Area",
    "Agent PIN",
    "Customer / Traveller Name",
    "Customer Mobile",
    "Customer Email",
    "Destination Code",
    "Destination",
    "Travel Start Date",
    "Travel End Date",
    "Travel Month",
    "Pax / Guests",
    "Next Action",
    "Next Action Type",
    "Last Activity",
    "Quotation Status",
    "Quotation Revision",
    "Quotation Sent At",
    "Selected Vendor",
    "Created At",
    "Assigned At",
    "Updated At",
    "Closure Type",
    "Closure Reason",
    "Closure Date",
    "Closed By",
    "Closure Note"
  ];

  const commercialHeaders = [];
  if (includeRevenueGp) {
    commercialHeaders.push(
      "Currency",
      "Customer Quotation / Selling Price",
      "Gross Profit",
      "Margin %",
      "Customer Payment Status",
      "Customer Payment Received",
      "Customer Outstanding"
    );
  }
  if (includeVendorCost) {
    commercialHeaders.push(
      "Vendor Cost",
      "Vendor Payment Status",
      "Vendor Paid",
      "Vendor Outstanding"
    );
  }

  const headers = [...baseHeaders, ...commercialHeaders];

  const rows = leads.map(lead => {
    const owner = getLeadOwner(lead);
    const assignee = getLeadAssignee(lead);
    const travelAgentId = getLeadTravelAgentId(lead);
    const liveAgent = travelAgentId
      ? travelAgentMap?.get?.(travelAgentId) || travelAgentMap?.[travelAgentId] || null
      : null;
    const travelAgent = resolveLeadTravelAgent(lead, travelAgentMap);
    const location = getLeadAgentLocationParts(lead, liveAgent);
    const spoc = getTravelAgentSpoc(lead, liveAgent);
    const travel = getLeadTravelRange(lead);
    const potential = getLeadClosingPotentialMeta(lead);

    const quotedAmount = getQuotedAmount(lead);
    const vendorCost = getVendorCost(lead);
    const grossProfit = getGrossProfit(lead, quotedAmount, vendorCost);
    const marginPercent = getMarginPercent(lead, quotedAmount, grossProfit);
    const customerPaymentReceived = getCustomerPaymentReceived(lead);
    const vendorPaid = getVendorPaid(lead);
    const customerOutstanding =
      quotedAmount !== null && customerPaymentReceived !== null
        ? Number((quotedAmount - customerPaymentReceived).toFixed(2))
        : null;
    const vendorOutstanding =
      vendorCost !== null && vendorPaid !== null
        ? Number((vendorCost - vendorPaid).toFixed(2))
        : null;

    const baseRow = [
      firstString(lead.leadCode, lead.code),
      lead.id || "",
      getStageLabel(lead),
      getLeadStatus(lead),
      potential?.label || firstString(lead.closingPotentialLabel, lead.closingPotential),
      firstString(lead.source, lead.leadSource, lead.channel),
      owner.name || owner.email || "",
      owner.email || "",
      assignee.name || assignee.email || "",
      assignee.email || "",
      firstString(travelAgent.agentCode, lead.agentCode),
      travelAgent.agencyName || firstString(lead.travelAgentName, lead.agentName, lead.agencyName),
      travelAgent.status || firstString(lead.agentStatus, lead.agentSnapshot?.status),
      firstString(
        liveAgent?.potentialLabel,
        liveAgent?.potential,
        lead.agentPotentialLabel,
        lead.agentPotential
      ),
      spoc.name,
      spoc.mobile,
      spoc.email,
      location.state,
      location.city,
      location.subArea,
      location.pincode,
      getCustomerName(lead),
      getCustomerMobile(lead),
      getCustomerEmail(lead),
      firstString(lead.destinationCode),
      firstString(lead.destinationName, lead.destination, lead.destinationTitle, lead.city),
      travel.start ? formatDate(travel.start) : "",
      travel.end ? formatDate(travel.end) : "",
      travel.monthKey ? formatTravelMonthLabel(travel.monthKey) : "",
      getPax(lead),
      formatDateTime(
        lead.nextActionAt ||
        lead.nextActionDueAt ||
        lead.followUpAt ||
        lead.nextFollowUpAt
      ),
      firstString(lead.nextActionType, lead.nextAction, lead.followUpType),
      firstString(lead.lastActivitySummary, lead.lastActivityType),
      firstString(lead.latestQuotationStatus, lead.quotationStatus),
      firstNumber(lead.finalQuotationRevision, lead.latestQuotationRevision, lead.quotationRevision),
      formatDateTime(lead.finalQuotationAt || lead.latestQuotationSentAt || lead.quotationSentAt),
      getVendorName(lead),
      formatDateTime(lead.createdAt || lead.createdOn || lead.addedAt),
      formatDateTime(lead.assignedAt),
      formatDateTime(lead.updatedAt),
      firstString(lead.closureType),
      getClosureReason(lead),
      formatDateTime(getClosureDate(lead)),
      firstString(lead.closedByName, lead.convertedByName, lead.lostByName, lead.cancelledInvalidByName),
      firstString(lead.closureNote, lead.closingRemark, lead.closeRemark, lead.stageRemark)
    ];

    const commercialRow = [];
    if (includeRevenueGp) {
      commercialRow.push(
        getQuotationCurrency(lead),
        quotedAmount,
        grossProfit,
        marginPercent,
        firstString(lead.customerPaymentStatus),
        customerPaymentReceived,
        customerOutstanding
      );
    }
    if (includeVendorCost) {
      commercialRow.push(
        vendorCost,
        firstString(lead.vendorPaymentStatus),
        vendorPaid,
        vendorOutstanding
      );
    }

    return [...baseRow, ...commercialRow];
  });

  return { headers, rows };
}

export function exportLeadsCsv(leads = [], options = {}) {
  if (!leads.length) return;

  const { headers, rows } = buildLeadExportRows(leads, options);
  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");

  // UTF-8 BOM improves Excel compatibility for ₹ and Indian names.
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName || `lead-export-${formatFileDate(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
