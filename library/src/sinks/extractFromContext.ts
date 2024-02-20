import { Context } from "../agent/Context";
import { isPlainObject } from "../helpers/isPlainObject";

/**
 * This checks the context (query, headers, cookies, body) for user input and extracts it into an array.
 * Useful for checking SQL Injections
 * @param context The context you want to analyze for user input
 * @returns User input found in the context as an array of strings
 */
export function extractFromContext(context: Context) {
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

/**
 * This checks the object for user input
 * @param obj The object you want to analyze for user input
 * @returns User input found in the obj as an array of strings
 */
export function extract(obj: any): string[] {
  let results: Set<string> = new Set();
  if (isPlainObject(obj)) {
    for (const key in obj) {
      results = new Set([key, ...results, ...extract(obj[key])]);
    }
  } else if (Array.isArray(obj)) {
    for (const element of obj) {
      results = new Set([...results, ...extract(element)]);
    }
  } else if (typeof obj == "string") {
    results.add(obj);
  }
  return Array.from(results)
}