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
  }

  if (typeof obj == "string") {
    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      extractStringsFromUserInput(
        jwt.object,
        pathToPayload.concat([{ type: "jwt" }])
      ).forEach((value, key) => results.set(key, value));
    } else {
      results.set(obj, buildPathToPayload(pathToPayload));
    }
  }

  return results;
}
