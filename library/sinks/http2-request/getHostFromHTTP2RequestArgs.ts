import { tryParseURL } from "../../helpers/tryParseURL";

/**
 * Determines the hostname and port from the arguments of an http2.connect call.
 * We are parsing the arguments to URL objects to support domains with special characters.
 */
export function getHostFromHTTP2RequestArgs(
  args: unknown[]
): { hostname: string; port: number | undefined } | undefined {
  if (!args || !args.length) {
    return undefined;
  }

  let authority = args[0] as Record<string, any> | URL | string | undefined;
  if (typeof authority === "string") {
    authority = tryParseURL(authority);
  }
  if (
    typeof authority !== "object" ||
    Array.isArray(authority) ||
    authority === null
  ) {
    return undefined;
  }

  // The following lines are based on https://github.com/nodejs/node/blob/22ea3029781c5c3b89bac7ac556b7acb2374ce02/lib/internal/http2/core.js#L3305
  const portStr =
    "" +
    (authority.port
      ? authority.port
      : authority.protocol === "http:"
        ? 80
        : 443);

  let host = "localhost";

  if (authority.hostname) {
    host = authority.hostname;
  } else if (authority.host) {
    host = authority.host;
  }

  const portNum = parseInt(portStr, 10);
  if (isNaN(portNum)) {
    return undefined;
  }

  return { hostname: host, port: portNum };
}
