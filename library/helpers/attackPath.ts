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

class Matches {
  private readonly matches: string[] = [];

  constructor(private readonly max: number) {
    if (max < 1) {
      throw new Error("Max must be greater than 0");
    }
  }

  add(path: PathPart[]) {
    this.matches.push(buildPathToPayload(path));
  }

  getMatches() {
    return this.matches;
  }

  found() {
    return this.matches.length >= this.max;
  }
}

export function getPathsToPayload(
  attackPayload: string,
  obj: unknown,
  matchCount = DEFAULT_MATCH_COUNT
): string[] {
  const matches = new Matches(matchCount);
  const attackPayloadLowercase = attackPayload.toLowerCase();

  const traverse = (value: unknown, path: PathPart[] = [], depth = 0) => {
    if (matches.found()) {
      return;
    }

    if (depth > MAX_DEPTH) {
      return;
    }

    if (typeof value === "string") {
      if (value.toLowerCase() === attackPayloadLowercase) {
        matches.add(path);
        return;
      }

      const jwt = tryDecodeAsJWT(value);
      if (jwt.jwt) {
        traverse(jwt.object, path.concat({ type: "jwt" }), depth + 1);
      }

      return;
    }

    if (Array.isArray(value)) {
      if (
        value.length > 1 &&
        value.length < MAX_ARRAY_LENGTH &&
        value.join().toLowerCase() === attackPayloadLowercase
      ) {
        matches.add(path);
        return;
      }

      for (const [index, item] of value.entries()) {
        if (matches.found() || index > MAX_ARRAY_LENGTH) {
          break;
        }

        traverse(item, path.concat({ type: "array", index }), depth);
      }

      return;
    }

    if (isPlainObject(value)) {
      for (const key in value) {
        if (matches.found()) {
          break;
        }

        traverse(value[key], path.concat({ type: "object", key }), depth + 1);
      }

      return;
    }
  };

  traverse(obj);

  return matches.getMatches();
}
