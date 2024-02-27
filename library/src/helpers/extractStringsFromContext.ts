import { Context } from "../agent/Context";
import { extractStringsFromObject } from "./extractStringsFromObject";

/**
 * Extract all strings from a request context, see unit tests for examples
 */
export function extractStringsFromContext(context: Context) {
  const resultsQuery = extractStringsFromObject(context.query);
  const resultsHeaders = extractStringsFromObject(context.headers);
  const resultsCookies = extractStringsFromObject(context.cookies);
  const resultsBody = extractStringsFromObject(context.body);

  return [
    ...resultsQuery,
    ...resultsHeaders,
    ...resultsCookies,
    ...resultsBody,
  ];
}
