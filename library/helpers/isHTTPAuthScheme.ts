/**
 *  https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml
 */
export type HTTPAuthScheme =
  | "basic"
  | "bearer"
  | "digest"
  | "dpop"
  | "gnap"
  | "hoba"
  | "mutal"
  | "negotiate"
  | "privatetoken"
  | "scram-sha-1"
  | "scram-sha-256"
  | "vapid";

/**
 * Checks if a string is a valid HTTP authentication scheme.
 */
export function isHTTPAuthScheme(scheme: string): scheme is HTTPAuthScheme {
  return [
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
  ].includes(scheme.toLowerCase());
}
