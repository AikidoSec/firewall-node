import { isPlainObject } from "./isPlainObject";
import { safeDecodeURIComponent } from "./safeDecodeURIComponent";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

type UserString = string;

// Prevent stack overflow from deeply nested objects
// An attacker can include a large nested payload as part of a normal body
// extractStringsFromUserInput will trigger a max call stack size,
// the error will be caught, but it stops our inspection
const MAX_DEPTH = 1024;

export function extractStringsFromUserInput(
  obj: unknown,
  depth: number = 0
): Set<UserString> {
  const results: Set<UserString> = new Set();

  if (depth >= MAX_DEPTH) {
    return results;
  }

  if (isPlainObject(obj)) {
    for (const key in obj) {
      results.add(key);
      extractStringsFromUserInput(obj[key], depth + 1).forEach((value) => {
        results.add(value);
      });
    }
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      extractStringsFromUserInput(obj[i], depth + 1).forEach((value) =>
        results.add(value)
      );
    }
    // Add array as string to results
    // This prevents bypassing the firewall by HTTP Parameter Pollution
    // Example: ?param=value1&param=value2 will be treated as array by express
    // If its used inside a string, it will be converted to a comma separated string
    results.add(obj.join());
  }

  if (typeof obj === "string") {
    results.add(obj);

    if (obj.includes("%") && obj.length >= 3) {
      const r = safeDecodeURIComponent(obj);
      if (r && r !== obj) {
        // Only add if the decoded value is different from the original, to avoid duplicates in results
        // This improves the performance of all injection tests
        results.add(r);
      }
    }

    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      // Do not add the issuer of the JWT as a string because it can contain a domain / url and produce false positives
      if (jwt.object && typeof jwt.object === "object" && "iss" in jwt.object) {
        delete jwt.object.iss;
      }
      extractStringsFromUserInput(jwt.object, depth + 1).forEach((value) => {
        results.add(value);
      });
    }
  }

  return results;
}
