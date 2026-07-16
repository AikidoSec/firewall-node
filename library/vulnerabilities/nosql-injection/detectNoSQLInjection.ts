import { isDeepStrictEqual } from "util";
import { Context } from "../../agent/Context";
import { Source, SOURCES } from "../../agent/Source";
import { buildPathToPayload, PathPart } from "../../helpers/attackPath";
import { isPlainObject } from "../../helpers/isPlainObject";
import { tryDecodeAsJWT } from "../../helpers/tryDecodeAsJWT";
import { detectDbJsInjection } from "../js-injection/detectDbJsInjection";

// Matches the depth limit used by extractStringsFromUserInput
const MAX_DEPTH = 1024;

function matchFilterPartInUser(
  userInput: unknown,
  filterPart: Record<string, unknown>,
  pathToPayload: PathPart[] = [],
  depth = 0
): { match: false } | { match: true; pathToPayload: string } {
  if (depth > MAX_DEPTH) {
    return { match: false };
  }

  if (typeof userInput === "string") {
    // Check for js injection in $where
    if (detectDbJsInjection(userInput, filterPart)) {
      return {
        match: true,
        pathToPayload: buildPathToPayload(pathToPayload),
      };
    }

    const jwt = tryDecodeAsJWT(userInput);
    if (jwt.jwt) {
      return matchFilterPartInUser(
        jwt.object,
        filterPart,
        pathToPayload.concat([{ type: "jwt" }]),
        depth + 1
      );
    }
  }

  if (isPlainObject(userInput)) {
    const filteredInput = removeKeysThatDontStartWithDollarSign(userInput);
    if (isUserOperatorsSubsetOf(filteredInput, filterPart)) {
      return { match: true, pathToPayload: buildPathToPayload(pathToPayload) };
    }

    for (const key in userInput) {
      const match = matchFilterPartInUser(
        userInput[key],
        filterPart,
        pathToPayload.concat([{ type: "object", key: key }]),
        depth + 1
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
        pathToPayload.concat([{ type: "array", index: index }]),
        depth + 1
      );

      if (match.match) {
        return match;
      }
    }

    try {
      return matchFilterPartInUser(
        userInput.join(),
        filterPart,
        pathToPayload,
        depth + 1
      );
    } catch {
      // Ignore deeply nested arrays that overflow during native join recursion.
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

// Returns true if every operator in userOperators is present in filterOperators
// with the same value — i.e. the user-supplied operators are a subset of the
// filter. An empty userOperators object never matches (no operators = no injection).
function isUserOperatorsSubsetOf(
  userOperators: Record<string, unknown>,
  filterOperators: Record<string, unknown>
): boolean {
  let hasKeys = false;
  for (const key in userOperators) {
    // Any missing key or value mismatch means the user input wasn't used as-is.
    if (
      !(key in filterOperators) ||
      !isDeepStrictEqual(userOperators[key], filterOperators[key])
    ) {
      return false;
    }
    // Only count the key as seen after it passes the check above.
    hasKeys = true;
  }
  return hasKeys;
}

function findFilterPartWithOperators(
  userInput: unknown,
  partOfFilter: unknown
): { found: false } | { found: true; pathToPayload: string; payload: unknown } {
  if (isPlainObject(partOfFilter)) {
    const object = removeKeysThatDontStartWithDollarSign(partOfFilter);
    if (Object.keys(object).length > 0) {
      const result = matchFilterPartInUser(userInput, object);

      if (result.match) {
        return {
          found: true,
          pathToPayload: result.pathToPayload,
          payload: object,
        };
      }
    }

    for (const key in partOfFilter) {
      const result = findFilterPartWithOperators(userInput, partOfFilter[key]);

      if (result.found) {
        return {
          found: true,
          pathToPayload: result.pathToPayload,
          payload: result.payload,
        };
      }
    }
  }

  if (Array.isArray(partOfFilter)) {
    for (const value of partOfFilter) {
      const result = findFilterPartWithOperators(userInput, value);

      if (result.found) {
        return {
          found: true,
          pathToPayload: result.pathToPayload,
          payload: result.payload,
        };
      }
    }
  }

  return { found: false };
}

type DetectionResult =
  | {
      injection: true;
      source: Source;
      pathsToPayload: string[];
      payload: unknown;
    }
  | { injection: false };

export function detectNoSQLInjection(
  request: Context,
  filter: unknown
): DetectionResult {
  if (!isPlainObject(filter) && !Array.isArray(filter)) {
    return { injection: false };
  }

  for (const source of SOURCES) {
    if (request[source]) {
      const result = findFilterPartWithOperators(request[source], filter);

      if (result.found) {
        return {
          injection: true,
          source: source,
          pathsToPayload: [result.pathToPayload],
          payload: result.payload,
        };
      }
    }
  }

  return { injection: false };
}
