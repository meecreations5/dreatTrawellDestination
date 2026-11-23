/**
 * DreamTrawell event-date reporting contract.
 * - Enquiries: createdAt (never lastActivityAt)
 * - Won: verified booking confirmation date, NOT lead creation/update/payment date
 * - Quote sent: actual quotation dispatch date, NOT finalisation/update date
 * - Reopened leads are not current wins even if historical timestamps remain.
 *
 * Pure helpers to keep the same semantics in Admin, Engagement, Lead and
 * Agent Activation dashboards. Date-only keys use the business zone Asia/Kolkata.
 */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";
const WON_STAGES = new Set(["converted", "won", "closed_won", "deal_won", "booked", "confirmed", "booking_confirmed", "business_generated", "package_confirmed", "travel_confirmed"]);
const QUOTE_SENT_STAGES = new Set(["quote_sent", "quotation_sent", "quoted"]);
const LOST_STAGES = new Set(["lost", "closed_lost", "cancelled_invalid", "closed_invalid"]);
const normalized = value => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export function asReportDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value?.toDate === "function") return asReportDate(value.toDate());
  if (typeof value?.seconds === "number") return asReportDate(new Date(value.seconds * 1000));
  if (typeof value?._seconds === "number") return asReportDate(new Date(value._seconds * 1000));
  if (typeof value === "number") return asReportDate(new Date(value));
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isValidDateKey(value) ? new Date(`${value}T12:00:00+05:30`) : null;
  }
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

export function businessDateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isValidDateKey(value) ? value : "";
  }
  const date = asReportDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const piece = type => parts.find(part => part.type === type)?.value || "";
  return `${piece("year")}-${piece("month")}-${piece("day")}`;
}

export function isValidDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return false;
  const date = new Date(`${key}T12:00:00+05:30`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

export function dateKeyToDate(key) {
  return isValidDateKey(key) ? new Date(`${key}T12:00:00+05:30`) : null;
}

function lastHistoryDate(lead, acceptedStages) {
  if (!Array.isArray(lead?.stageHistory)) return null;
  const matching = lead.stageHistory
    .filter(record => acceptedStages.has(normalized(record?.toStage || record?.stage)))
    .map(record => acceptedStages === WON_STAGES
      ? (dateKeyToDate(record?.dealWonDateKey) || asReportDate(record?.confirmedAt || record?.changedAt))
      : asReportDate(record?.changedAt))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());
  return matching[0] || null;
}

export function isCurrentWon(lead = {}) {
  const stage = normalized(lead?.stage || lead?.leadStage || "");
  if (stage) return WON_STAGES.has(stage);
  return WON_STAGES.has(normalized(lead?.status));
}

export function getLeadCreatedEventDate(lead = {}) {
  return asReportDate(lead?.createdAt || lead?.leadCreatedAt || lead?.createdOn || lead?.addedAt);
}

export function getDealWonEventDate(lead = {}) {
  if (!isCurrentWon(lead)) return null;
  // New date-only field is authoritative; snapshot timestamps are next.
  return dateKeyToDate(lead?.dealWonDateKey) ||
    asReportDate(lead?.dealWonAt) ||
    asReportDate(lead?.closedWonAt) ||
    asReportDate(lead?.bookingConfirmedAt) ||
    asReportDate(lead?.businessGeneratedAt) ||
    asReportDate(lead?.convertedAt) ||
    // Legacy closedAt is valid only for a currently won lead.
    asReportDate(lead?.closedAt) ||
    lastHistoryDate(lead, WON_STAGES);
}

export function getQuotationSentEventDate(lead = {}) {
  return asReportDate(lead?.latestQuotationSentAt) ||
    asReportDate(lead?.quotationSentAt) ||
    asReportDate(lead?.lastQuotationSentAt) ||
    asReportDate(lead?.quoteSentAt) ||
    asReportDate(lead?.lastQuoteSentAt) ||
    lastHistoryDate(lead, QUOTE_SENT_STAGES);
}

export function isWithinBusinessDates(value, fromKey = "", toKey = "") {
  const day = businessDateKey(value);
  if (!day) return false;
  return (!fromKey || day >= fromKey) && (!toKey || day <= toKey);
}

export function validateWonDateInput({
  wonDateKey, leadCreatedAt, now = new Date(), mayBackdate = false,
  correctionReason = "", confirmationReference = ""
}) {
  const day = String(wonDateKey || "").trim();
  if (!isValidDateKey(day)) throw new Error("Enter a valid actual booking confirmation date.");
  const today = businessDateKey(now);
  if (day > today) throw new Error("Booking confirmation cannot be dated in the future.");
  const created = businessDateKey(leadCreatedAt);
  if (created && day < created) throw new Error("Deal Won date cannot be before the lead was created. Contact Admin to reconcile historical data.");
  if (day !== today && !mayBackdate) throw new Error("Only Admin can enter or correct a past booking confirmation date.");
  if (day !== today && String(correctionReason || "").trim().length < 8) {
    throw new Error("Admin must enter a correction reason (at least 8 characters) when using a past date.");
  }
  if (day !== today && !String(confirmationReference || "").trim()) {
    throw new Error("Provide the booking confirmation reference for a past-date adjustment.");
  }
  return { dateKey: day, actualDate: dateKeyToDate(day), isBackdated: day !== today };
}

export const REPORTING_DATE_CONTRACT = Object.freeze({
  enquiry: "createdAt",
  won: "dealWonDateKey (actual confirmation), fallback convertedAt for legacy records",
  quote: "latestQuotationSentAt / quotationSentAt (dispatch evidence)",
  financialRevenue: "separate accounting recognition, not Deal Won count"
});
