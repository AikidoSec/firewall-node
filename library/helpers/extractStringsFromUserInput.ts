import { buildPathToPayload, PathPart } from "./attackPath";
import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

type UserString = string;
type PathToUserString = string;

// eslint-disable-next-line max-lines-per-function
export function extractStringsFromUserInput(
  obj: unknown,
  pathToPayload: PathPart[] = []
): Map<UserString, PathToUserString> {
  const results: Map<UserString, PathToUserString> = new Map();

  if (isPlainObject(obj)) {
    for (const key in obj) {
      results.set(key, buildPathToPayload(pathToPayload));
      extractStringsFromUserInput(
        obj[key],
        pathToPayload.concat([{ type: "object", key: key }])
      ).forEach((value, key) => {
        results.set(key, value);
      });
    }
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      extractStringsFromUserInput(
        obj[i],
        pathToPayload.concat([{ type: "array", index: i }])
      ).forEach((value, key) => results.set(key, value));
    }
    // Add array as string to results
    // This prevents bypassing the firewall by HTTP Parameter Pollution
    // Example: ?param=value1&param=value2 will be treated as array by express
    // If its used inside a string, it will be converted to a comma separated string
    results.set(obj.join(), buildPathToPayload(pathToPayload));
  }

  if (typeof obj == "string") {
    results.set(obj, buildPathToPayload(pathToPayload));
    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      extractStringsFromUserInput(
        jwt.object,
        pathToPayload.concat([{ type: "jwt" }])
      ).forEach((value, key) => results.set(key, value));
    }
  }

  return results;
}
