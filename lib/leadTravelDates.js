export function parseLeadTravelDate(value) {
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

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const text = String(value || "").trim();
  if (!text) return null;

  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const parsed = new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const parsed = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3])
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInputValue(value) {
  const date = parseLeadTravelDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTravelMonthKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const date = parseLeadTravelDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getLeadTravelStartDate(lead = {}) {
  return (
    parseLeadTravelDate(lead.travelStartDate) ||
    parseLeadTravelDate(lead.travelDate) ||
    parseLeadTravelDate(lead.departureDate) ||
    parseLeadTravelDate(lead.journeyDate) ||
    parseLeadTravelDate(lead.tripStartDate) ||
    parseLeadTravelDate(lead.checkInDate) ||
    parseLeadTravelDate(lead.checkIn) ||
    parseLeadTravelDate(lead.travelDetails?.travelStartDate) ||
    parseLeadTravelDate(lead.travelDetails?.travelDate) ||
    parseLeadTravelDate(lead.travelDetails?.checkInDate) ||
    parseLeadTravelDate(lead.travelDetails?.checkIn) ||
    parseLeadTravelDate(lead.travelMonth) ||
    parseLeadTravelDate(lead.travelDetails?.travelMonth) ||
    null
  );
}

export function getLeadTravelEndDate(lead = {}) {
  return (
    parseLeadTravelDate(lead.travelEndDate) ||
    parseLeadTravelDate(lead.returnDate) ||
    parseLeadTravelDate(lead.tripEndDate) ||
    parseLeadTravelDate(lead.checkOutDate) ||
    parseLeadTravelDate(lead.checkOut) ||
    parseLeadTravelDate(lead.travelDetails?.travelEndDate) ||
    parseLeadTravelDate(lead.travelDetails?.returnDate) ||
    parseLeadTravelDate(lead.travelDetails?.checkOutDate) ||
    parseLeadTravelDate(lead.travelDetails?.checkOut) ||
    null
  );
}

export function getLeadTravelMonthKey(lead = {}) {
  const explicit = String(
    lead.travelMonth || lead.travelDetails?.travelMonth || ""
  ).trim();

  if (/^\d{4}-\d{2}$/.test(explicit)) return explicit;

  return formatTravelMonthKey(getLeadTravelStartDate(lead));
}

export function getLeadTravelRange(lead = {}) {
  const start = getLeadTravelStartDate(lead);
  const end = getLeadTravelEndDate(lead);
  const monthKey = getLeadTravelMonthKey(lead);

  return { start, end, monthKey };
}

export function formatTravelMonthLabel(monthKey = "") {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) return "Travel date missing";
  const [year, month] = String(monthKey).split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

export function formatLeadTravelRange(lead = {}, { short = false } = {}) {
  const { start, end, monthKey } = getLeadTravelRange(lead);

  if (!start) {
    return monthKey ? formatTravelMonthLabel(monthKey) : "Travel date missing";
  }

  const startText = start.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    ...(short ? {} : { year: "numeric" })
  });

  if (!end) return startText;

  const endText = end.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  return `${startText} – ${endText}`;
}

export function getLeadTravelCountdown(lead = {}, now = new Date()) {
  const start = getLeadTravelStartDate(lead);
  if (!start) {
    return {
      key: "missing",
      label: "Travel date missing",
      days: null
    };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const travelDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const days = Math.round((travelDay - today) / 86400000);

  if (days < 0) return { key: "past", label: `${Math.abs(days)}d past travel`, days };
  if (days === 0) return { key: "today", label: "Travel today", days };
  if (days === 1) return { key: "tomorrow", label: "Travel tomorrow", days };
  if (days <= 7) return { key: "soon", label: `${days} days to travel`, days };
  if (days <= 30) return { key: "upcoming", label: `${days} days to travel`, days };
  return { key: "future", label: `${days} days to travel`, days };
}

export function matchesLeadTravelMonth(lead = {}, travelMonth = "all") {
  if (!travelMonth || travelMonth === "all") return true;
  if (travelMonth === "missing") return !getLeadTravelMonthKey(lead);
  return getLeadTravelMonthKey(lead) === travelMonth;
}

function firstString(...values) {
  return values.find(value => typeof value === "string" && value.trim())?.trim() || "";
}

export function buildLeadTravelPayload({ travelStartDate = "", travelEndDate = "", travelMonth = "", source = "manual" } = {}) {
  const start = firstString(travelStartDate);
  const end = firstString(travelEndDate);
  const month = firstString(travelMonth) || (start ? start.slice(0, 7) : "");

  return {
    travelStartDate: start,
    travelEndDate: end,
    travelDate: start,
    travelMonth: month,
    travelDateSource: source
  };
}

export function buildLeadTravelPayloadFromQuotationData(quotationData = {}) {
  const travel = quotationData?.travelDetails || {};
  const start = firstString(
    travel.travelStartDate,
    travel.startDate,
    travel.checkIn,
    travel.checkInDate,
    quotationData?.travelStartDate,
    quotationData?.travelDate
  );
  const end = firstString(
    travel.travelEndDate,
    travel.endDate,
    travel.checkOut,
    travel.checkOutDate,
    quotationData?.travelEndDate,
    quotationData?.returnDate
  );
  const month = firstString(
    travel.travelMonth,
    quotationData?.travelMonth,
    start ? start.slice(0, 7) : ""
  );

  if (!start && !end && !month) return {};

  return buildLeadTravelPayload({
    travelStartDate: start,
    travelEndDate: end,
    travelMonth: month,
    source: "quotation"
  });
}
