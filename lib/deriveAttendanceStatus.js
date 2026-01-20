export function deriveAttendanceStatus({
  totalMinutes = 0,
  isLeave = false,
  isHoliday = false,
  workedOnHoliday = false,
  isRegularized = false
}) {
  // 🟣 Highest priority
  if (workedOnHoliday) {
    return "holiday_worked";
  }

  if (isLeave) {
    return "leave";
  }

  if (isHoliday) {
    return "holiday";
  }

  if (isRegularized) {
    return totalMinutes >= 240 ? "present" : "half-day";
  }

  if (totalMinutes >= 480) return "present";
  if (totalMinutes >= 240) return "half-day";

  return "absent";
}
