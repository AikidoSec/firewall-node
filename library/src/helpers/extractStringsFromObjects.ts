import { isPlainObject } from "./isPlainObject";

/**
 * This checks the object for user input
 */
export function extract(obj: unknown): string[] {
  let results: Set<string> = new Set();

  if (isPlainObject(obj)) {
    for (const key in obj) {
      results = new Set([key, ...results, ...extract(obj[key])]);
    }
  }

  if (Array.isArray(obj)) {
    for (const element of obj) {
      results = new Set([...results, ...extract(element)]);
    }
  }

  if (typeof obj == "string") {
    results.add(obj);
  }

  return Array.from(results);
}
