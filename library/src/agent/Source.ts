export type Source = "query" | "body" | "headers" | "cookies";

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
