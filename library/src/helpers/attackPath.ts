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

    return acc;
  }, "");
}
