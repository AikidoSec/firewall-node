import { buildPathToPayload, PathPart } from "./attackPath";
import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

type UserString = string;
type PathToUserString = string;

/**
 * Extract all strings from an object, see unit tests for examples
 */
export function extractStringsFromUserInput(
  obj: unknown,
  pathToPayload: PathPart[] = []
): Record<UserString, PathToUserString> {
  const results: Record<UserString, PathToUserString> = {};

  if (isPlainObject(obj)) {
    for (const key in obj) {
      results[key] = buildPathToPayload(pathToPayload);
      const strings = extractStringsFromUserInput(
        obj[key],
        pathToPayload.concat([{ type: "object", key: key }])
      );
      for (const key in strings) {
        results[key] = strings[key];
      }
    }
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const strings = extractStringsFromUserInput(
        obj[i],
        pathToPayload.concat([{ type: "array", index: i }])
      );
      for (const nestedKey in strings) {
        results[nestedKey] = strings[nestedKey];
      }
    }
  }

  if (typeof obj == "string") {
    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      const nestedResults = extractStringsFromUserInput(
        jwt.object,
        pathToPayload.concat([{ type: "jwt" }])
      );
      for (const nestedKey in nestedResults) {
        results[nestedKey] = nestedResults[nestedKey];
      }
    } else {
      results[obj] = buildPathToPayload(pathToPayload);
    }
  }

  return results;
}
