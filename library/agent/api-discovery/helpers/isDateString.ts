/**
 * Checks if the string is a date according to RFC3339
 * https://datatracker.ietf.org/doc/html/rfc3339#section-5.6
 */
export default function isDateString(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }

  const [year, month, day] = str.split("-").map(Number);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 0) {
    return false;
  }

  return true;
}
