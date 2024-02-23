import { isDeepStrictEqual } from "util";
import { isPlainObject } from "../../helpers/isPlainObject";
import { tryDecodeAsJWT } from "../../helpers/jwt";
import { Context } from "../../agent/Context";
import { Source } from "../../agent/Source";

type PathPart =
  | { type: "jwt" }
  | { type: "object"; key: string }
  | { type: "array"; index: number };

function buildPathToPayload(pathToPayload: PathPart[]): string {
  if (pathToPayload.length === 0) {
    return ".";
  }

  return pathToPayload.reduce((acc, part) => {
    if (part.type === "jwt") {
      return `${acc}<jwt>`;
    }

    if (part.type === "object") {
      return `${acc}.${part.key}`;
    }

    if (part.type === "array") {
      return `${acc}.[${part.index}]`;
    }

    return acc;
  }, "");
}

function matchFilterPartInUser(
  userInput: unknown,
  filterPart: Record<string, unknown>,
  pathToPayload: PathPart[] = []
): { match: false } | { match: true; pathToPayload: string } {
  if (typeof userInput === "string") {
    const jwt = tryDecodeAsJWT(userInput);
    if (jwt.jwt) {
      return matchFilterPartInUser(
        jwt.object,
        filterPart,
        pathToPayload.concat([{ type: "jwt" }])
      );
    }
  }

  if (isDeepStrictEqual(userInput, filterPart)) {
    return { match: true, pathToPayload: buildPathToPayload(pathToPayload) };
  }

  if (isPlainObject(userInput)) {
    for (const key in userInput) {
      const match = matchFilterPartInUser(
        userInput[key],
        filterPart,
        pathToPayload.concat([{ type: "object", key: key }])
      );

      if (match.match) {
        return match;
      }
    }
  }

  if (Array.isArray(userInput)) {
    for (let index = 0; index < userInput.length; index++) {
      const match = matchFilterPartInUser(
        userInput[index],
        filterPart,
        pathToPayload.concat([{ type: "array", index: index }])
      );

      if (match.match) {
        return match;
      }
    }
  }

  return {
    match: false,
  };
}

function removeKeysThatDontStartWithDollarSign(
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
  userInput: unknown,
  partOfFilter: unknown
): { found: false } | { found: true; pathToPayload: string } {
  if (isPlainObject(partOfFilter)) {
    const object = removeKeysThatDontStartWithDollarSign(partOfFilter);
    if (Object.keys(object).length > 0) {
      const result = matchFilterPartInUser(userInput, object);

      if (result.match) {
        return { found: true, pathToPayload: result.pathToPayload };
      }
    }

    for (const key in partOfFilter) {
      const result = findFilterPartWithOperators(userInput, partOfFilter[key]);

      if (result.found) {
        return { found: true, pathToPayload: result.pathToPayload };
      }
    }
  }

  if (Array.isArray(partOfFilter)) {
    for (const value of partOfFilter) {
      const result = findFilterPartWithOperators(userInput, value);

      if (result.found) {
        return { found: true, pathToPayload: result.pathToPayload };
      }
    }
  }

  return { found: false };
}

type DetectionResult =
  | { injection: true; source: Source; pathToPayload: string }
  | { injection: false };

export function detectNoSQLInjection(
  request: Context,
  filter: unknown
): DetectionResult {
  if (!isPlainObject(filter)) {
    return { injection: false };
  }

  for (const source of ["body", "query", "headers", "cookies"] as Source[]) {
    if (request[source]) {
      const result = findFilterPartWithOperators(request[source], filter);

      if (result.found) {
        return {
          injection: true,
          source: source,
          pathToPayload: result.pathToPayload,
        };
      }
    }
  }

  return { injection: false };
}
