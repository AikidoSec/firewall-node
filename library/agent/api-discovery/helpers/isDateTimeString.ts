/**
 * Checks if the string is a date time according to RFC3339
 * https://datatracker.ietf.org/doc/html/rfc3339#section-5.6
 */
export default function isDateTimeString(str: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      str
    )
  ) {
    return false;
  }

  const [date, time] = str.split("T");

  // Validate date value
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 0) {
    return false;
  }

  // Validate time value
  const [hour, minute, second] = time.split(":").map(Number);
  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return false;
  }

  // Validate time offset value
  if (!str.endsWith("Z")) {
    const offset = str.slice(-5);
    const [offsetHour, offsetMinute] = offset.split(":").map(Number);
    if (
      offsetHour < 0 ||
      offsetHour > 23 ||
      offsetMinute < 0 ||
      offsetMinute > 59
    ) {
      return false;
    }
  }

  return true;
}
