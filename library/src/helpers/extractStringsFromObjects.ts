import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./jwt";
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
    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      results = new Set([...results, ...extract(jwt.object)]);
    } else {
      results.add(obj);
    }
  }
  return Array.from(results);
}
