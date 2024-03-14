import { buildPathToPayload, PathPart } from "./attackPath";
import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

type UserString = string;
type PathToUserString = string;

// eslint-disable-next-line max-lines-per-function
export function extractStringsFromUserInput(
  obj: unknown,
  pathToPayload: PathPart[] = []
): Record<UserString, PathToUserString> {
  const results: Record<UserString, PathToUserString> = Object.create(null);

  if (isPlainObject(obj)) {
    for (const key in obj) {
      if (isSafeKey(key)) {
        results[key] = buildPathToPayload(pathToPayload);
      }

      const strings = extractStringsFromUserInput(
        obj[key],
        pathToPayload.concat([{ type: "object", key: key }])
      );
      for (const key in strings) {
        if (isSafeKey(key)) {
          results[key] = strings[key];
        }
      }
    }
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const strings = extractStringsFromUserInput(
        obj[i],
        pathToPayload.concat([{ type: "array", index: i }])
      );
      for (const key in strings) {
        if (isSafeKey(key)) {
          results[key] = strings[key];
        }
      }
    }
  }

  if (typeof obj == "string") {
    const jwt = tryDecodeAsJWT(obj);
    if (jwt.jwt) {
      const strings = extractStringsFromUserInput(
        jwt.object,
        pathToPayload.concat([{ type: "jwt" }])
      );
      for (const key in strings) {
        if (isSafeKey(key)) {
          results[key] = strings[key];
        }
      }
    } else {
      if (isSafeKey(obj)) {
        results[obj] = buildPathToPayload(pathToPayload);
      }
    }
  }

  return results;
}

const unsafeKeys = ["__proto__", "constructor", "prototype"];

function isSafeKey(key: string) {
  return !unsafeKeys.includes(key);
}
