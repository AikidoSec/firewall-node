export type Source = "query" | "body" | "headers" | "cookies";

/**
 * Returns the friendly name of a source type
 * @param source A source type (either "query", "body", "headers" or "cookies")
 * @returns A friendly name for each of these types
 */
export function friendlyName(source: Source): string {
  switch (source) {
    case "query":
      return "query parameters";
    case "body":
      return "body";
    case "headers":
      return "headers";
    case "cookies":
      return "cookies";
  }
}
