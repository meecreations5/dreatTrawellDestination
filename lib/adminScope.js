export const ADMIN_DATE_SCOPE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Date Range" }
];

export const DEFAULT_ADMIN_SCOPE = {
  dateRange: "all",
  dateFrom: "",
  dateTo: "",
  team: "all"
};

export function toScopeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalInputDate(value, endOfDay = false) {
  if (!value) return null;
  const parsed = value instanceof Date
    ? new Date(value)
    : new Date(`${String(value).trim()}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getAdminDateWindow(
  value = "all",
  nowValue = new Date(),
  dateFrom = "",
  dateTo = ""
) {
  const now = new Date(nowValue);
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (value === "custom") {
    return {
      start: toLocalInputDate(dateFrom, false),
      end: toLocalInputDate(dateTo, true)
    };
  }

  if (!value || value === "all") return { start: null, end: null };

  if (value === "today") {
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (value === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (value === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (value === "30d") {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (value === "thisMonth") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (value === "lastMonth") {
    start.setMonth(start.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Backward-compatible dashboard aliases.
  if (value === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (value === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  return { start: null, end: null };
}

export function matchesAdminDateScope(
  value,
  dateRange = "all",
  dateFrom = "",
  dateTo = ""
) {
  if (!dateRange || dateRange === "all") return true;
  const date = toScopeDate(value);
  if (!date) return false;
  const { start, end } = getAdminDateWindow(dateRange, new Date(), dateFrom, dateTo);

  if (dateRange === "custom" && !start && !end) return true;
  return (!start || date >= start) && (!end || date <= end);
}

export function getAdminDateScopeLabel(value = "all", dateFrom = "", dateTo = "") {
  if (value === "custom") {
    if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Until ${dateTo}`;
  }
  return ADMIN_DATE_SCOPE_OPTIONS.find(item => item.value === value)?.label || value;
}
