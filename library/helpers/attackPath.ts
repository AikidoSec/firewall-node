import { isPlainObject } from "./isPlainObject";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

// Default match count to return
const DEFAULT_MATCH_COUNT = 1;

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

  const traverse = (value: unknown, path: PathPart[] = []) => {
    if (matches.length >= matchCount) {
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
        traverse(jwt.object, path.concat({ type: "jwt" }));
      }

      return;
    }

    if (Array.isArray(value)) {
      // Handle arrays
      value.forEach((item, index) => {
        traverse(item, path.concat({ type: "array", index }));
      });

      if (value.join().toLowerCase() === attackPayloadLowercase) {
        matches.push(buildPathToPayload(path));
      }

      return;
    }

    if (isPlainObject(value)) {
      // Handle objects
      for (const key in value) {
        traverse(value[key], path.concat({ type: "object", key }));
      }
    }
  };

  traverse(obj);

  return matches;
}
