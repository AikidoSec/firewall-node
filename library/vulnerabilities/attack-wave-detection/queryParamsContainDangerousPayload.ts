import type { Context } from "../../agent/Context";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";

const keywords = [
  "SELECT (CASE WHEN",
  "SELECT COUNT(",
  "SLEEP(",
  "WAITFOR DELAY",
  "SELECT LIKE(CHAR(",
  "INFORMATION_SCHEMA.COLUMNS",
  "INFORMATION_SCHEMA.TABLES",
  "MD5(",
  "DBMS_PIPE.RECEIVE_MESSAGE",
  "SYSIBM.SYSTABLES",
  "RANDOMBLOB(",
  "SELECT * FROM",
  "1'='1",
  "PG_SLEEP(",
  "UNION ALL SELECT",
  "../",
];

/**
 * Check the query for some common SQL or path traversal patterns.
 */
export function queryParamsContainDangerousPayload(context: Context): boolean {
  if (!context.query) {
    return false;
  }

  const queryStrings = extractStringsFromUserInput(context.query);
  if (!queryStrings) {
    return false;
  }

  for (const str of queryStrings) {
    // Performance optimization
    // Some keywords like ../ are shorter than this min length check
    // However, they are part of a larger string in the most cases
    // e.g. ../etc/passwd or MD5(something)
    if (str.length < 5 || str.length > 1_000) {
      continue;
    }

    const upperStr = str.toUpperCase();
    for (const keyword of keywords) {
      if (upperStr.includes(keyword)) {
        return true;
      }
    }
  }
  return false;
}
