export const DEFAULT_WORK_SCHEDULE = {
  workStart: "10:30",
  lunchStart: "14:00",
  lunchEnd: "15:00",
  eveningBreakStart: "17:30",
  eveningBreakEnd: "18:15",
  workEnd: ""
};

function parseClock(value = "") {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesOfDay(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function dateAtMinutes(base, minutes) {
  const date = new Date(base);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function normalizeWorkSchedule(schedule = {}) {
  return {
    ...DEFAULT_WORK_SCHEDULE,
    ...(schedule || {})
  };
}

export function getWorkSegments(date = new Date(), schedule = DEFAULT_WORK_SCHEDULE) {
  const normalized = normalizeWorkSchedule(schedule);
  const start = parseClock(normalized.workStart) ?? 630;
  const lunchStart = parseClock(normalized.lunchStart) ?? 840;
  const lunchEnd = parseClock(normalized.lunchEnd) ?? 900;
  const eveningStart = parseClock(normalized.eveningBreakStart) ?? 1050;
  const eveningEnd = parseClock(normalized.eveningBreakEnd) ?? 1095;
  const end = parseClock(normalized.workEnd);

  const segments = [
    [start, lunchStart],
    [lunchEnd, eveningStart],
    [eveningEnd, end ?? 24 * 60]
  ]
    .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && to > from)
    .map(([from, to]) => ({
      startMinute: from,
      endMinute: to,
      start: dateAtMinutes(date, from),
      end: dateAtMinutes(date, to)
    }));

  return segments;
}

export function isScheduledBreak(date = new Date(), schedule = DEFAULT_WORK_SCHEDULE) {
  const normalized = normalizeWorkSchedule(schedule);
  const minute = minutesOfDay(date);
  const lunchStart = parseClock(normalized.lunchStart);
  const lunchEnd = parseClock(normalized.lunchEnd);
  const eveningStart = parseClock(normalized.eveningBreakStart);
  const eveningEnd = parseClock(normalized.eveningBreakEnd);

  return Boolean(
    (lunchStart !== null && lunchEnd !== null && minute >= lunchStart && minute < lunchEnd) ||
    (eveningStart !== null && eveningEnd !== null && minute >= eveningStart && minute < eveningEnd)
  );
}

export function isWithinWorkTime(date = new Date(), schedule = DEFAULT_WORK_SCHEDULE) {
  const normalized = normalizeWorkSchedule(schedule);
  const minute = minutesOfDay(date);
  const start = parseClock(normalized.workStart) ?? 630;
  const end = parseClock(normalized.workEnd);

  if (minute < start) return false;
  if (end !== null && minute >= end) return false;
  return !isScheduledBreak(date, normalized);
}

export function alignToWorkSchedule(value, schedule = DEFAULT_WORK_SCHEDULE) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const normalized = normalizeWorkSchedule(schedule);
  const segments = getWorkSegments(date, normalized);
  const minute = minutesOfDay(date);

  for (const segment of segments) {
    if (minute >= segment.startMinute && minute < segment.endMinute) {
      return date;
    }
    if (minute < segment.startMinute) {
      return dateAtMinutes(date, segment.startMinute);
    }
  }

  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = parseClock(normalized.workStart) ?? 630;
  return dateAtMinutes(tomorrow, start);
}

export function getLatestPulseSlot(now = new Date(), intervalMinutes = 15, schedule = DEFAULT_WORK_SCHEDULE) {
  const safeInterval = Math.max(5, Number(intervalMinutes) || 15);
  const segments = getWorkSegments(now, schedule);
  const minute = minutesOfDay(now);

  // Include the exact segment end so the last work interval is captured at
  // lunch/evening-break/work-end boundaries (for example 13:45-14:00).
  const segment = segments.find(item => minute >= item.startMinute && minute <= item.endMinute);
  if (!segment) return null;

  const elapsed = minute - segment.startMinute;
  const completedIntervals = Math.floor(elapsed / safeInterval);
  if (completedIntervals < 1) return null;

  const slotMinute = segment.startMinute + completedIntervals * safeInterval;
  if (slotMinute > segment.endMinute) return null;

  return dateAtMinutes(now, slotMinute);
}

export function getNextPulseSlot(now = new Date(), intervalMinutes = 15, schedule = DEFAULT_WORK_SCHEDULE) {
  const safeInterval = Math.max(5, Number(intervalMinutes) || 15);
  const startTime = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(startTime.getTime())) return null;

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const day = new Date(startTime);
    day.setDate(startTime.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    const segments = getWorkSegments(day, schedule);
    for (const segment of segments) {
      for (
        let slotMinute = segment.startMinute + safeInterval;
        slotMinute <= segment.endMinute;
        slotMinute += safeInterval
      ) {
        const candidate = dateAtMinutes(day, slotMinute);
        if (candidate.getTime() > startTime.getTime()) return candidate;
      }
    }
  }

  return null;
}
