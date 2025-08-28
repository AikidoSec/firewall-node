import type { Context } from "../../agent/Context";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";

const keywords = [
  "SELECT (CASE WHEN",
  "SELECT COUNT(",
  "SLEEP(",
  "WAITFOR DELAY",
  "SELECT LIKE(CHAR(",
  "INFORMATION_SCHEMA.COLUMNS",
  ",MD5(",
  "DBMS_PIPE.RECEIVE_MESSAGE",
  "SYSIBM.SYSTABLES",
  "RANDOMBLOB(",
];

export function containsSQLSyntax(context: Context): boolean {
  const queryStrings = extractStringsFromUserInputCached(context, "query");
  if (!queryStrings) {
    return false;
  }
  for (const str of queryStrings) {
    // Performance optimization
    if (str.length < 5) {
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
