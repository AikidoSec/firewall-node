import { isDeepStrictEqual } from "node:util";
import { isPlainObject } from "../helpers/isPlainObject";
import { tryDecodeAsJWT } from "../helpers/jwt";
import { Context } from "../agent/Context";
import { Source } from "../agent/Source";

type DetectionResult =
  | { injection: true; source: Source; path: string }
  | { injection: false };

function matchFilterPartInUser(
  user: unknown,
  filterPart: Record<string, unknown>,
  path = ""
): string | null {
  if (typeof user === "string") {
    const jwt = tryDecodeAsJWT(user);
    if (jwt.jwt) {
      return matchFilterPartInUser(jwt.object, filterPart, path);
    }
  }

  if (isPlainObject(user)) {
    for (const key in user) {
      if (isDeepStrictEqual(user[key], filterPart)) {
        return path + key;
      }

      const match = matchFilterPartInUser(
        user[key],
        filterPart,
        path + key + "."
      );
      if (match) {
        return match;
      }
    }
  }

  if (Array.isArray(user)) {
    for (let index = 0; index < user.length; index++) {
      const match = matchFilterPartInUser(
        user[index],
        filterPart,
        `${path}[${index}]`
      );
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function findFilterPartWithOperators(
  user: unknown,
  partOfFilter: unknown
): string | null {
  if (isPlainObject(partOfFilter)) {
    const keys = Object.keys(partOfFilter).filter((key) => key.startsWith("$"));

    if (keys.length > 0) {
      const objectToMatch = keys.reduce(
        (acc, key) => ({ ...acc, [key]: partOfFilter[key] }),
        {}
      );

      const path = matchFilterPartInUser(user, objectToMatch);
      if (path) {
        return path;
      }
    }

    for (const key in partOfFilter) {
      const path = findFilterPartWithOperators(user, partOfFilter[key]);
      if (path) {
        return path;
      }
    }
  }

  if (Array.isArray(partOfFilter)) {
    for (const value of partOfFilter) {
      const path = findFilterPartWithOperators(user, value);
      if (path) {
        return path;
      }
    }
  }

  return null;
}

export function detectNoSQLInjection(
  request: Context,
  filter: unknown
): DetectionResult {
  if (!isPlainObject(filter)) {
    return { injection: false };
  }

  for (const source of ["body", "query", "headers", "cookies"] as Source[]) {
    if (!request[source]) {
      continue;
    }

    const path = findFilterPartWithOperators(request[source], filter);
    if (path) {
      return {
        injection: true,
        source,
        path: source === "body" ? `.${path}` : path,
      };
    }
  }

  return { injection: false };
}
