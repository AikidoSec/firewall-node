import { Context } from "../agent/Context";
import { extract } from "../helpers/extractStringsFromObjects";
/**
 * This checks the context (query, headers, cookies, body) for user input and extracts it into an array.
 * Useful for checking SQL Injections
 * @param context The context you want to analyze for user input
 * @returns User input found in the context as an array of strings
 */
export function extractStringsFromContext(context: Context) {
  const resultsQuery = extract(context.query);
  const resultsHeaders = extract(context.headers);
  const resultsCookies = extract(context.cookies);
  const resultsBody = extract(context.body);

  return [
    ...resultsQuery,
    ...resultsHeaders,
    ...resultsCookies,
    ...resultsBody,
  ];
}
