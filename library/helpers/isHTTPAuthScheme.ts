const AUTH_SCHEMES = [
  "basic",
  "bearer",
  "digest",
  "dpop",
  "gnap",
  "hoba",
  "mutal",
  "negotiate",
  "privatetoken",
  "scram-sha-1",
  "scram-sha-256",
  "vapid",
] as const;
export type HTTPAuthScheme = (typeof AUTH_SCHEMES)[number];

/**
 * Checks if a string is a valid HTTP authentication scheme.
 * https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml
 */
export function isHTTPAuthScheme(scheme: string): scheme is HTTPAuthScheme {
  return AUTH_SCHEMES.includes(scheme.toLowerCase() as HTTPAuthScheme);
}
