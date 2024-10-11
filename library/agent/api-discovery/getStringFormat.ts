import isDateString from "./helpers/isDateString";
import isDateTimeString from "./helpers/isDateTimeString";

/**
 * https://swagger.io/docs/specification/v3_0/data-models/data-types/#strings
 */
export type StringFormat =
  | "date"
  | "date-time"
  // | "password"
  | "byte"
  // | "binary"
  | "email"
  | "uuid"
  | "uri"
  | "hostname"
  | "ipv4"
  | "ipv6";

// Used for improved performance
const indicationChars = new Set<string>(["-", ":", "@"]);

/**
 * Get the format of a string
 * https://swagger.io/docs/specification/v3_0/data-models/data-types/#strings
 */
export function getStringFormat(str: string) {
  if (str.length < 4) {
    return undefined;
  }

  // Todo if larger than x return early?

  const foundIndicationChars = checkForIndicationChars(str);

  if (foundIndicationChars.has("-")) {
    if (foundIndicationChars.has(":") && isDateTimeString(str)) {
      return "date-time";
    }
    if (isDateString(str)) {
      return "date";
    }
  }
}

/**
 * Check for indication characters in a string
 * This is used to improve performance and is more efficient than multiple .includes() calls
 */
function checkForIndicationChars(str: string): Set<string> {
  const foundChars = new Set<string>();

  for (const char of str) {
    if (indicationChars.has(char)) {
      foundChars.add(char);
    }
  }

  return foundChars;
}
