export const SOURCES = [
  "query",
  "body",
  "headers",
  "cookies",
  "routeParams",
  "graphql",
  "xml",
  "subdomains",
] as const;

export type Source = (typeof SOURCES)[number];
