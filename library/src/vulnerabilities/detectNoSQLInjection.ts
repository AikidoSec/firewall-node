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
      return matchFilterPartInUser(jwt.object, filterPart, `${path}<jwt>`);
    }
  }

  if (isDeepStrictEqual(user, filterPart)) {
    return path;
  }

  if (isPlainObject(user)) {
    for (const key in user) {
      const match = matchFilterPartInUser(
        user[key],
        filterPart,
        `${path}.${key}`
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
        `${path}.[${index}]`
      );
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function getObjectWithOperators(
  filter: Record<string, unknown>
): Record<string, unknown> {
  return Object.keys(filter).reduce((acc, key) => {
    if (key.startsWith("$")) {
      return { ...acc, [key]: filter[key] };
    }

    return acc;
  }, {});
}

function findFilterPartWithOperators(
  user: unknown,
  partOfFilter: unknown
): string | null {
  if (isPlainObject(partOfFilter)) {
    const object = getObjectWithOperators(partOfFilter);
    if (Object.keys(object).length > 0) {
      const path = matchFilterPartInUser(user, object);
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
    if (source === "body" && isPlainObject(request[source])) {
      const object = getObjectWithOperators(filter);
      if (
        Object.keys(object).length > 0 &&
        isDeepStrictEqual(request[source], object)
      ) {
        return {
          injection: true,
          source: source,
          path: ".",
        };
      }
    }

    if (request[source]) {
      const path = findFilterPartWithOperators(request[source], filter);

      if (path) {
        return {
          injection: true,
          source: source,
          path: path,
        };
      }
    }
  }

  return { injection: false };
}
