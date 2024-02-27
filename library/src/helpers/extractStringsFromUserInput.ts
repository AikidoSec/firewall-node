import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

/**
 * Extract all strings from an object, see unit tests for examples
 */
export function extractStringsFromUserInput(obj: unknown): string[] {
  let results: Set<string> = new Set();

  if (isPlainObject(obj)) {
    for (const key in obj) {
      results = new Set([
        key,
        ...results,
        ...extractStringsFromUserInput(obj[key]),
      ]);
    }
  }

  if (Array.isArray(obj)) {
    for (const element of obj) {
      results = new Set([...results, ...extractStringsFromUserInput(element)]);
    }
  }

  if (typeof obj == "string") {
    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      results = new Set([
        ...results,
        ...extractStringsFromUserInput(jwt.object),
      ]);
    } else {
      results.add(obj);
    }
  }

  return Array.from(results);
}
