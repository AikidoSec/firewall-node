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
  "urlPath",
  "rawBody",
] as const;

export type Source = (typeof SOURCES)[number];
