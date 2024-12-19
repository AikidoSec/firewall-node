import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

type UserString = string;

// eslint-disable-next-line max-lines-per-function
export function extractStringsFromUserInput(obj: unknown): Set<UserString> {
  const results: Set<UserString> = new Set();

  if (isPlainObject(obj)) {
    for (const key in obj) {
      results.add(key);
      extractStringsFromUserInput(obj[key]).forEach((value) => {
        results.add(value);
      });
    }
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      extractStringsFromUserInput(obj[i]).forEach((value) =>
        results.add(value)
      );
    }
    // Add array as string to results
    // This prevents bypassing the firewall by HTTP Parameter Pollution
    // Example: ?param=value1&param=value2 will be treated as array by express
    // If its used inside a string, it will be converted to a comma separated string
    results.add(obj.join());
  }

  if (typeof obj == "string") {
    results.add(obj);

    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      // Do not add the issuer of the JWT as a string because it can contain a domain / url and produce false positives
      if (jwt.object && typeof jwt.object === "object" && "iss" in jwt.object) {
        delete jwt.object.iss;
      }
      extractStringsFromUserInput(jwt.object).forEach((value) => {
        results.add(value);
      });
    }
  }

  return results;
}
