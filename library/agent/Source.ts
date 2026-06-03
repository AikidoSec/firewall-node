export const SOURCES = [
  "query",
  "body",
  "headers",
  "cookies",
  "routeParams",
  "graphql",
  "xml",
  "subdomains",
  "markUnsafe",
  "url",
  "rawBody",
  "files",
] as const;

export type Source = (typeof SOURCES)[number];
