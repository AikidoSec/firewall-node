import { Context } from "../agent/Context";

/**
 * This checks the context (query, headers, cookies, body) for user input and extracts it into an array.
 * Useful for checking SQL Injections
 * @param context The context you want to analyze for user input
 * @returns User input found in the context as an array of strings
 */
export function extractFromContext(context: Context) {
  const resultsQuery = extractFromQuery(context.query);
  const resultsHeaders = extractFromHeaders(context.headers);
  const resultsCookies = extractFromCookies(context.cookies);
  const resultsBody = extractFromBody(context.body);

  return [
    ...resultsQuery,
    ...resultsHeaders,
    ...resultsCookies,
    ...resultsBody,
  ];
}

/**
 * This checks the query for user input
 * @param query The query property you want to analyze for user input
 * @returns User input found in the query as an array of strings
 */
export function extractFromQuery(query: Context["query"]): string[] {
  let results: string[] = [];

  return results;
}

/**
 * This checks the headers for user input
 * @param headers The headers property you want to analyze for user input
 * @returns User input found in the headers as an array of strings
 */
export function extractFromHeaders(headers: Context["headers"]): string[] {
  let results: string[] = [];

  return results;
}

/**
 * This checks the cookies for user input
 * @param cookies The cookies property you want to analyze for user input
 * @returns User input found in the cookies as an array of strings
 */
export function extractFromCookies(cookies: Context["cookies"]): string[] {
  let results: string[] = [];
  for (const cookieKey in cookies) {
    // the name of a cookie is also user input, some applications may try and store all cookies given to it.
    results.push(cookieKey);
    results.push(cookies[cookieKey]);
  }
  return results;
}

/**
 * This checks the body for user input
 * @param body The body property you want to analyze for user input
 * @returns User input found in the body as an array of strings
 */
export function extractFromBody(body: Context["body"]): string[] {
  let results: string[] = [];

  return results;
}
