import { isIPv4, isIPv6 } from "net";
import isDateString from "./helpers/isDateString";
import isDateTimeString from "./helpers/isDateTimeString";
import isUUIDString from "./helpers/isUUIDString";
import isEmailString from "./helpers/isEmail";

/**
 * https://swagger.io/docs/specification/v3_0/data-models/data-types/#strings
 */
type StringFormat =
  | "date"
  | "date-time"
  | "email"
  | "uuid"
  | "uri"
  | "hostname"
  | "ipv4"
  | "ipv6";

// Used for improved performance
const indicationChars = new Set<string>(["-", ":", "@", "."]);

/**
 * Get the format of a string
 * https://swagger.io/docs/specification/v3_0/data-models/data-types/#strings
 */
export function getStringFormat(str: string): StringFormat | undefined {
  // Skip if too short
  if (str.length < 4) {
    return undefined;
  }

  // Skip if too long (performance optimization)
  if (str.length > 255) {
    return undefined;
  }

  const foundIndicationChars = checkForIndicationChars(str);

  if (foundIndicationChars.has("-")) {
    if (foundIndicationChars.has(":")) {
      // Check if it is a date-time, e.g. 2021-01-01T00:00:00Z
      if (isDateTimeString(str)) {
        return "date-time";
      }
    } else {
      // Check if it is a date, e.g. 2021-01-01
      if (isDateString(str)) {
        return "date";
      }

      // Check if it is a UUID
      if (isUUIDString(str)) {
        return "uuid";
      }
    }
  }

  if (foundIndicationChars.has("@") && isEmailString(str)) {
    return "email";
  }

  // Check if it is an IPv4
  if (foundIndicationChars.has(".") && isIPv4(str)) {
    return "ipv4";
  }

  // Check if it is an IPv6
  if (foundIndicationChars.has(":") && isIPv6(str)) {
    return "ipv6";
  }

  return undefined;
}

/**
 * Check for indication characters in a string
 * This is used to improve performance
 */
function checkForIndicationChars(str: string): Set<string> {
  const foundChars = new Set<string>();

  for (const iChar of indicationChars) {
    if (str.includes(iChar)) {
      foundChars.add(iChar);
    }
  }

  return foundChars;
}
