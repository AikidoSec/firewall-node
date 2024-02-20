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
 * This checks the object for user input
 * @param body The object you want to analyze for user input
 * @returns User input found in the body as an array of strings
 */
function extract(body: any): string[] {
  let results: Set<string> = new Set();
  if (isPlainObject(body)) {
    for (const key in body) {
      results = new Set([key, ...results, ...extract(body[key])]);
    }
  } else if (Array.isArray(body)) {
    for (const element of body) {
      results = new Set([...results, ...extract(element)]);
    }
  } else if (typeof body == "string") {
    results.add(body);
  }
  return Array.from(results)
}

/**
  extract({
 * @param body The body property you want to analyze for user input
    e: "c",
 */
export function extractFromBody(body: Context["body"]): string[] {
