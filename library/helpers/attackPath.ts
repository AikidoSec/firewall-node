import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

// Default match count to return
const DEFAULT_MATCH_COUNT = 1;

// Maximum depth to traverse
const MAX_DEPTH = 30;

// Maximum array length to traverse
const MAX_ARRAY_LENGTH = 100;

export type PathPart =
  | { type: "jwt" }
  | { type: "object"; key: string }
  | { type: "array"; index: number };

export function buildPathToPayload(pathToPayload: PathPart[]): string {
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
    /* c8 ignore next */
    return acc;
  }, "");
}

export function getPathsToPayload(
  attackPayload: string,
  obj: unknown,
  matchCount = DEFAULT_MATCH_COUNT
): string[] {
  const matches: string[] = [];

  const attackPayloadLowercase = attackPayload.toLowerCase();

  const traverse = (value: unknown, path: PathPart[] = [], depth = 0) => {
    if (matches.length >= matchCount) {
      return;
    }

    if (depth > MAX_DEPTH) {
      return;
    }

    // Handle strings
    if (typeof value === "string") {
      if (value.toLowerCase() === attackPayloadLowercase) {
        matches.push(buildPathToPayload(path));
        return;
      }

      const jwt = tryDecodeAsJWT(value);
      if (jwt.jwt) {
        traverse(jwt.object, path.concat({ type: "jwt" }), depth + 1);
      }

      return;
    }

    if (Array.isArray(value)) {
      // Handle arrays
      for (const [index, item] of value.entries()) {
        if (index > MAX_ARRAY_LENGTH) {
          break;
        }
        traverse(item, path.concat({ type: "array", index }), depth);
      }

      if (value.join().toLowerCase() === attackPayloadLowercase) {
        matches.push(buildPathToPayload(path));
      }

      return;
    }

    if (isPlainObject(value)) {
      // Handle objects
      for (const key in value) {
        traverse(value[key], path.concat({ type: "object", key }), depth + 1);
      }
    }
  };

  traverse(obj);

  return matches;
}
